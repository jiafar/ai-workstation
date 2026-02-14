import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../../utils/config';
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
  private openaiClient: OpenAI | null = null;
  private anthropicClient: Anthropic | null = null;

  private constructor() {
    this.initializeClients();
  }

  static getInstance(): LLMProvider {
    if (!LLMProvider.instance) {
      LLMProvider.instance = new LLMProvider();
    }
    return LLMProvider.instance;
  }

  private initializeClients(): void {
    try {
      const aiConfig = config.get('aiProviders');

      // Initialize OpenAI client
      if (aiConfig.openai?.apiKey) {
        this.openaiClient = new OpenAI({
          apiKey: aiConfig.openai.apiKey,
          baseURL: aiConfig.openai.baseURL,
        });
        logger.info('OpenAI client initialized');
      }

      // Initialize Anthropic client
      if (aiConfig.anthropic?.apiKey) {
        this.anthropicClient = new Anthropic({
          apiKey: aiConfig.anthropic.apiKey,
        });
        logger.info('Anthropic client initialized');
      }
    } catch (error) {
      logger.error('Failed to initialize LLM clients', error);
    }
  }

  private getProvider(provider?: 'openai' | 'anthropic'): 'openai' | 'anthropic' {
    if (provider) return provider;
    const defaultProvider = config.get('aiProviders').defaultProvider;
    return defaultProvider || 'anthropic';
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
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Please set API key in config.');
    }

    const aiConfig = config.get('aiProviders');
    const model = options.model || aiConfig.openai?.model || 'gpt-4-turbo-preview';

    const response = await this.openaiClient.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
      top_p: options.topP ?? 1.0,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async chatAnthropic(messages: Message[], options: ChatOptions): Promise<string> {
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized. Please set API key in config.');
    }

    const aiConfig = config.get('aiProviders');
    const model = options.model || aiConfig.anthropic?.model || 'claude-3-5-sonnet-20241022';

    // Separate system messages from user/assistant messages
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const systemPrompt = systemMessages.map((msg) => msg.content).join('\n\n');

    const response = await this.anthropicClient.messages.create({
      model,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.7,
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
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Please set API key in config.');
    }

    const aiConfig = config.get('aiProviders');
    const model = options.model || aiConfig.openai?.model || 'gpt-4-turbo-preview';

    const stream = await this.openaiClient.chat.completions.create({
      model,
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2000,
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
    if (!this.anthropicClient) {
      throw new Error('Anthropic client not initialized. Please set API key in config.');
    }

    const aiConfig = config.get('aiProviders');
    const model = options.model || aiConfig.anthropic?.model || 'claude-3-5-sonnet-20241022';

    // Separate system messages from user/assistant messages
    const systemMessages = messages.filter((msg) => msg.role === 'system');
    const conversationMessages = messages.filter((msg) => msg.role !== 'system');

    const systemPrompt = systemMessages.map((msg) => msg.content).join('\n\n');

    const stream = await this.anthropicClient.messages.stream({
      model,
      max_tokens: options.maxTokens ?? 2000,
      temperature: options.temperature ?? 0.7,
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
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized. Please set API key in config.');
    }

    const model = options.model || 'text-embedding-3-small';

    const response = await this.openaiClient.embeddings.create({
      model,
      input: text,
    });

    return response.data[0].embedding;
  }

  reinitialize(): void {
    this.initializeClients();
  }
}

// Singleton export
export const llmProvider = LLMProvider.getInstance();

export { LLMProvider };
export default llmProvider;
