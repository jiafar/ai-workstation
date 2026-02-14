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
  provider?: 'openai' | 'anthropic';
}

export interface EmbedOptions {
  model?: string;
  provider?: 'openai' | 'anthropic';
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

  private getProvider(explicitProvider?: 'openai' | 'anthropic'): 'openai' | 'anthropic' {
    if (explicitProvider) return explicitProvider;
    const aiConfig = this.getAIConfig();
    return aiConfig.defaultProvider || 'openai';
  }

  /**
   * Create a fresh OpenAI client using the current config.
   */
  private createOpenAIClient(): OpenAI {
    const aiConfig = this.getAIConfig();
    if (!aiConfig.openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please set it in Settings.');
    }
    const baseURL = aiConfig.openaiBaseUrl || 'https://api.openai.com/v1';
    return new OpenAI({ apiKey: aiConfig.openaiApiKey, baseURL });
  }

  /**
   * Create a fresh Anthropic client using the current config.
   */
  private createAnthropicClient(): Anthropic {
    const aiConfig = this.getAIConfig();
    if (!aiConfig.anthropicApiKey) {
      throw new Error('Anthropic API key not configured. Please set it in Settings.');
    }
    return new Anthropic({ apiKey: aiConfig.anthropicApiKey });
  }

  async chat(messages: Message[], options: ChatOptions = {}): Promise<string> {
    const provider = this.getProvider(options.provider);

    try {
      if (provider === 'openai') {
        return await this.chatOpenAI(messages, options);
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
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

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

  async chatStream(
    messages: Message[],
    options: ChatOptions,
    onChunk: StreamChunkCallback
  ): Promise<void> {
    const provider = this.getProvider(options.provider);

    try {
      if (provider === 'openai') {
        await this.chatStreamOpenAI(messages, options, onChunk);
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
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const systemPrompt = systemMessages.map((msg) => msg.content).join('\n\n');

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

  async embed(text: string, options: EmbedOptions = {}): Promise<number[]> {
    const provider = this.getProvider(options.provider);

    try {
      if (provider === 'openai') {
        return await this.embedOpenAI(text, options);
      } else {
        // Anthropic doesn't have a native embedding API, use OpenAI as fallback
        logger.warn('Anthropic does not support embeddings, falling back to OpenAI');
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

  reinitialize(): void {
    // No-op: clients are now created fresh on each call
    logger.info('LLMProvider reinitialize called (no-op, clients created per-call)');
  }
}

// Singleton export
export const llmProvider = LLMProvider.getInstance();

export { LLMProvider };
export default llmProvider;
