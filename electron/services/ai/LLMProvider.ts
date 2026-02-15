import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { getConfigManager } from '../config';
import { logger } from '../../utils/logger';

export type MessageRole = 'system' | 'user' | 'assistant';

export interface Message {
  role: MessageRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'kimi';
}

export interface EmbedOptions {
  model?: string;
  provider?: 'openai' | 'jina';
}

export type StreamChunkCallback = (chunk: string) => void;

class LLMProvider {
  private static instance: LLMProvider;

  private constructor() {
    logger.info('LLMProvider initialized');
  }

  static getInstance(): LLMProvider {
    if (!LLMProvider.instance) {
      LLMProvider.instance = new LLMProvider();
    }
    return LLMProvider.instance;
  }

  /**
   * Read fresh AI config from ConfigManager each time to pick up Settings UI changes.
   */
  private getAIConfig() {
    const configManager = getConfigManager();
    return configManager.getSection('ai');
  }

  private getProvider(explicitProvider?: 'openai' | 'anthropic' | 'kimi'): 'openai' | 'anthropic' | 'kimi' {
    if (explicitProvider) return explicitProvider;
    const aiConfig = this.getAIConfig();
    return aiConfig.defaultProvider || 'openai';
  }

  /**
   * Create a fresh OpenAI client using the current config.
   */
  private createOpenAIClient(): OpenAI {
    const aiConfig = this.getAIConfig();
    const apiKey = aiConfig.openaiApiKey?.trim();
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Settings.');
    }
    const baseURL = aiConfig.openaiBaseUrl || 'https://api.openai.com/v1';
    return new OpenAI({ apiKey, baseURL });
  }

  /**
   * Create a fresh Anthropic client using the current config.
   */
  private createAnthropicClient(): Anthropic {
    const aiConfig = this.getAIConfig();
    const apiKey = aiConfig.anthropicApiKey?.trim();
    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please set it in Settings.');
    }
    return new Anthropic({ apiKey });
  }

  /**
   * Create a fresh Kimi (Moonshot) client using the current config.
   * Reuses OpenAI SDK with Moonshot-compatible API endpoint.
   */
  private createKimiClient(): OpenAI {
    const aiConfig = this.getAIConfig();
    const apiKey = aiConfig.kimiApiKey?.trim();
    if (!apiKey) {
      throw new Error('Kimi API key not configured. Please set it in Settings.');
    }
    return new OpenAI({ apiKey, baseURL: 'https://api.moonshot.ai/v1' });
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
    const provider = this.getProvider(options.provider);

    try {
      if (provider === 'openai') {
        return await this.chatOpenAI(messages, options);
      } else if (provider === 'kimi') {
        return await this.chatKimi(messages, options);
      } else {
        return await this.chatAnthropic(messages, options);
      }
    } catch (error) {
      logger.error(`Chat request failed for provider: ${provider}`, error);
      throw error;
    }
  }

  private async chatOpenAI(messages: Message[], options: ChatOptions): Promise<string> {
    const client = this.createOpenAIClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.openaiModel || 'gpt-4-turbo-preview';

    const response = await client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? aiConfig.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
      top_p: options.topP ?? 1.0,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(messages: Message[], options: ChatOptions): Promise<string> {
    const client = this.createAnthropicClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.anthropicModel || 'claude-sonnet-4-5-20250929';

    // Separate system messages from user/assistant messages
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    let conversationMessages = messages.filter((msg) => msg.role !== 'system');

    // Anthropic requires the first message to be 'user' role — drop leading assistant messages
    while (conversationMessages.length > 0 && conversationMessages[0].role !== 'user') {
      conversationMessages = conversationMessages.slice(1);
    }

    if (conversationMessages.length === 0) {
      throw new Error('No user messages to send to Anthropic API');
    }

    const systemPrompt = systemMessages.map((msg) => msg.content).join('\n\n');

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
      temperature: options.temperature ?? aiConfig.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    const textContent = response.content.find((block) => block.type === 'text');
    return textContent && 'text' in textContent ? textContent.text : '';
  }

  private async chatKimi(messages: Message[], options: ChatOptions): Promise<string> {
    const client = this.createKimiClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.kimiModel || 'kimi-k2.5';

    // kimi-k2.5 thinking mode requires temperature=1, top_p=0.95
    const isK2_5 = model.startsWith('kimi-k2');
    const response = await client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: isK2_5 ? 1 : (options.temperature ?? aiConfig.temperature ?? 0.7),
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
      top_p: isK2_5 ? 0.95 : (options.topP ?? 1.0),
    });

    return response.choices[0]?.message?.content || '';
  }

  async chatStream(
    messages: Message[],
    options: ChatOptions,
    onChunk: StreamChunkCallback
  ): Promise<void> {
    const provider = this.getProvider(options.provider);

    try {
      if (provider === 'openai') {
        await this.chatStreamOpenAI(messages, options, onChunk);
      } else if (provider === 'kimi') {
        await this.chatStreamKimi(messages, options, onChunk);
      } else {
        await this.chatStreamAnthropic(messages, options, onChunk);
      }
    } catch (error) {
      logger.error(`Stream chat request failed for provider: ${provider}`, error);
      throw error;
    }
  }

  private async chatStreamOpenAI(
    messages: Message[],
    options: ChatOptions,
    onChunk: StreamChunkCallback
  ): Promise<void> {
    const client = this.createOpenAIClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.openaiModel || 'gpt-4-turbo-preview';

    const stream = await client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? aiConfig.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
      top_p: options.topP ?? 1.0,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        onChunk(content);
      }
    }
  }

  private async chatStreamAnthropic(
    messages: Message[],
    options: ChatOptions,
    onChunk: StreamChunkCallback
  ): Promise<void> {
    const client = this.createAnthropicClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.anthropicModel || 'claude-sonnet-4-5-20250929';

    // Separate system messages from user/assistant messages
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    let conversationMessages = messages.filter((msg) => msg.role !== 'system');

    // Anthropic requires the first message to be 'user' role — drop leading assistant messages
    while (conversationMessages.length > 0 && conversationMessages[0].role !== 'user') {
      conversationMessages = conversationMessages.slice(1);
    }

    if (conversationMessages.length === 0) {
      throw new Error('No user messages to send to Anthropic API');
    }

    const systemPrompt = systemMessages.map((msg) => msg.content).join('\n\n');

    logger.debug('[AI] chatStreamAnthropic calling API', {
      model,
      messageCount: conversationMessages.length,
      firstRole: conversationMessages[0]?.role,
    });

    const stream = await client.messages.stream({
      model,
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
      temperature: options.temperature ?? aiConfig.temperature ?? 0.7,
      system: systemPrompt || undefined,
      messages: conversationMessages.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
    });

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        onChunk(event.delta.text);
      }
    }
  }

  private async chatStreamKimi(
    messages: Message[],
    options: ChatOptions,
    onChunk: StreamChunkCallback
  ): Promise<void> {
    const client = this.createKimiClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.kimiModel || 'kimi-k2.5';

    // kimi-k2.5 thinking mode requires temperature=1, top_p=0.95
    const isK2_5 = model.startsWith('kimi-k2');
    const stream = await client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: isK2_5 ? 1 : (options.temperature ?? aiConfig.temperature ?? 0.7),
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
      top_p: isK2_5 ? 0.95 : (options.topP ?? 1.0),
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        onChunk(content);
      }
    }
  }

  private getEmbeddingsConfig() {
    const configManager = getConfigManager();
    return configManager.getSection('embeddings');
  }

  async embed(text: string, options: EmbedOptions = {}): Promise<number[]> {
    const embeddingsConfig = this.getEmbeddingsConfig();
    const provider = options.provider || embeddingsConfig.provider || 'jina';

    try {
      if (provider === 'jina') {
        return await this.embedJina(text, options);
      } else {
        return await this.embedOpenAI(text, options);
      }
    } catch (error) {
      logger.error(`Embed request failed for provider: ${provider}`, error);
      throw error;
    }
  }

  private async embedOpenAI(text: string, options: EmbedOptions): Promise<number[]> {
    const client = this.createOpenAIClient();
    const model = options.model || 'text-embedding-3-small';

    const response = await client.embeddings.create({
      model,
      input: text,
    });

    return response.data[0].embedding;
  }

  private async embedJina(text: string, options: EmbedOptions): Promise<number[]> {
    const embeddingsConfig = this.getEmbeddingsConfig();
    const apiKey = embeddingsConfig.jinaApiKey?.trim();
    if (!apiKey) {
      throw new Error('Jina API key not configured. Please set it in Settings.');
    }
    const model = options.model || embeddingsConfig.jinaModel || 'jina-embeddings-v3';

    const requestData = JSON.stringify({
      model,
      input: [text],
    });

    return new Promise((resolve, reject) => {
      const https = require('https');
      const req = https.request(
        {
          hostname: 'api.jina.ai',
          path: '/v1/embeddings',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        },
        (res: { statusCode?: number; on: (event: string, cb: (data: Buffer) => void) => void }) => {
          let data = '';
          res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              if (res.statusCode !== 200) {
                reject(new Error(`Jina API error (${res.statusCode}): ${parsed.detail || data}`));
                return;
              }
              resolve(parsed.data[0].embedding);
            } catch (e) {
              reject(new Error(`Failed to parse Jina API response: ${data}`));
            }
          });
        }
      );
      req.on('error', reject);
      req.write(requestData);
      req.end();
    });
  }

  reinitialize(): void {
    // No-op: clients are now created fresh on each call
    logger.info('LLMProvider reinitialize called (no-op, clients created per-call)');
  }
}

// Singleton export
export const llmProvider = LLMProvider.getInstance();

export { LLMProvider };
export default llmProvider;
