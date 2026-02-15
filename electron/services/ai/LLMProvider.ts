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

export class LLMProvider {
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
   * Check if API key is an OAuth token
   */
  private isOAuthToken(apiKey: string): boolean {
    return apiKey.startsWith('sk-ant-oat');
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
   * Supports both standard API keys and OAuth tokens.
   */
  private createAnthropicClient(): Anthropic {
    const aiConfig = this.getAIConfig();
    const apiKey = aiConfig.anthropicApiKey?.trim();

    logger.info('[AI] Creating Anthropic client', {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length,
      apiKeyPrefix: apiKey ? `${apiKey.substring(0, 15)}...` : 'none',
      isOAuth: apiKey ? this.isOAuthToken(apiKey) : false
    });

    if (!apiKey) {
      throw new Error('Anthropic API key not configured. Please set it in Settings.');
    }

    // For OAuth tokens, we'll handle them differently in the stream method
    // For standard API keys, use the SDK
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
    const aiConfig = this.getAIConfig();
    const apiKey = aiConfig.anthropicApiKey?.trim();
    
    // Use OAuth-compatible streaming for all Anthropic calls
    let fullContent = '';
    await this.chatStreamAnthropic(messages, options, (chunk) => {
      fullContent += chunk;
    });
    return fullContent;
  }

  private async chatKimi(messages: Message[], options: ChatOptions): Promise<string> {
    const client = this.createKimiClient();
    const aiConfig = this.getAIConfig();
    const model = options.model || aiConfig.kimiModel || 'kimi-k2.5';

    const response = await client.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? aiConfig.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
    });

    return response.choices[0]?.message?.content || '';
  }

  async chatStream(
    messages: Message[],
    options: ChatOptions = {},
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
    try {
      const aiConfig = this.getAIConfig();
      const apiKey = aiConfig.anthropicApiKey?.trim();
      const model = options.model || aiConfig.anthropicModel || 'claude-opus-4-6';

      if (!apiKey) {
        throw new Error('Anthropic API key not configured. Please set it in Settings.');
      }

      // Check if using OAuth token
      const isOAuth = this.isOAuthToken(apiKey);
      logger.info('[AI] Anthropic stream configuration', { isOAuth, model });

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

      logger.info('[AI] Starting Anthropic stream', {
        model,
        messageCount: conversationMessages.length,
        hasSystemPrompt: !!systemPrompt,
        isOAuth
      });

      // Prepare request body
      const requestBody: any = {
        model,
        max_tokens: options.maxTokens ?? aiConfig.maxTokens ?? 2000,
        temperature: options.temperature ?? aiConfig.temperature ?? 0.7,
        messages: conversationMessages.map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
        stream: true
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      // Prepare headers based on token type
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream',
      };

      if (isOAuth) {
        // OAuth tokens use Bearer authorization with special beta header
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['anthropic-beta'] = 'oauth-2025-04-20';
        logger.info('[AI] Using OAuth authentication');
      } else {
        // Standard API keys use x-api-key
        headers['x-api-key'] = apiKey;
      }

      // Make streaming request using fetch
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('[AI] Anthropic API error', { status: response.status, error: errorText });
        throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
      }

      if (!response.body) {
        throw new Error('No response body from Anthropic API');
      }

      // Process the stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const event = JSON.parse(data);
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                onChunk(event.delta.text);
              }
            } catch (e) {
              // Ignore parse errors for non-JSON lines
            }
          }
        }
      }

      logger.info('[AI] Anthropic stream completed successfully');
    } catch (error: any) {
      logger.error('[AI] Anthropic stream error:', {
        error: error.message,
        errorType: error.constructor?.name,
        status: error.status,
      });
      throw error;
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

  private async embedJina(text: string, _options: EmbedOptions): Promise<number[]> {
    const embeddingsConfig = this.getEmbeddingsConfig();
    const apiKey = embeddingsConfig.jinaApiKey?.trim();
    if (!apiKey) {
      throw new Error('Jina API key not configured. Please set it in Settings.');
    }

    const response = await fetch('https://api.jina.ai/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: embeddingsConfig.jinaModel || 'jina-embeddings-v3',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Jina API error: ${response.status}`);
    }

    const data = await response.json();
    return data.data[0].embedding;
  }

  private async embedOpenAI(text: string, _options: EmbedOptions): Promise<number[]> {
    const aiConfig = this.getAIConfig();
    const client = this.createOpenAIClient();

    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });

    return response.data[0].embedding;
  }
}

export const llmProvider = LLMProvider.getInstance();
export default llmProvider;
