import { llmProvider } from './LLMProvider';
import { contextBuilder, Memory } from './ContextBuilder';
import { logger } from '../../utils/logger';
import type { ChatOptions } from './LLMProvider';

export interface RAGOptions {
  vectorSearchLimit?: number;
  relevanceThreshold?: number;
  includeContext?: boolean;
  chatOptions?: ChatOptions;
}

export interface RAGResult {
  answer: string;
  relevantMemories: Memory[];
  context: string;
}

export interface VectorSearchResult {
  id: string;
  content: string;
  distance: number;
  metadata?: Record<string, any>;
}

class RAGPipeline {
  private static instance: RAGPipeline;

  private constructor() {
    logger.info('RAGPipeline initialized');
  }

  static getInstance(): RAGPipeline {
    if (!RAGPipeline.instance) {
      RAGPipeline.instance = new RAGPipeline();
    }
    return RAGPipeline.instance;
  }

  /**
   * Execute RAG pipeline: query → embed → search → augment → generate
   * @param query User query
   * @param searchFunction Function to search vector database (returns memories or search results)
   * @param options RAG options
   * @returns RAG result with answer and context
   */
  async query(
    query: string,
    searchFunction: (embedding: number[]) => Promise<Memory[]>,
    options: RAGOptions = {}
  ): Promise<RAGResult> {
    try {
      logger.info('Starting RAG pipeline', { query: query.substring(0, 100) });

      // Step 1: Embed the query
      const queryEmbedding = await this.embedQuery(query);

      // Step 2: Search vector database
      const relevantMemories = await this.searchVectorDB(
        queryEmbedding,
        searchFunction,
        options
      );

      // Step 3: Build augmented context
      const contextResult = contextBuilder.buildContext(query, relevantMemories, {
        maxMemories: options.vectorSearchLimit,
        relevanceThreshold: options.relevanceThreshold,
      });

      // Step 4: Generate answer with context
      const answer = await this.generateAnswer(query, contextResult.context, options);

      logger.info('RAG pipeline completed successfully', {
        memoriesFound: relevantMemories.length,
        answerLength: answer.length,
      });

      return {
        answer,
        relevantMemories: contextResult.relevantMemories,
        context: contextResult.context,
      };
    } catch (error) {
      logger.error('RAG pipeline failed', error);
      throw error;
    }
  }

  /**
   * Execute RAG pipeline with streaming response
   */
  async queryStream(
    query: string,
    searchFunction: (embedding: number[]) => Promise<Memory[]>,
    onChunk: (chunk: string) => void,
    options: RAGOptions = {}
  ): Promise<{ relevantMemories: Memory[]; context: string }> {
    try {
      logger.info('Starting RAG pipeline (streaming)', { query: query.substring(0, 100) });

      // Step 1: Embed the query
      const queryEmbedding = await this.embedQuery(query);

      // Step 2: Search vector database
      const relevantMemories = await this.searchVectorDB(
        queryEmbedding,
        searchFunction,
        options
      );

      // Step 3: Build augmented context
      const contextResult = contextBuilder.buildContext(query, relevantMemories, {
        maxMemories: options.vectorSearchLimit,
        relevanceThreshold: options.relevanceThreshold,
      });

      // Step 4: Generate answer with streaming
      await this.generateAnswerStream(query, contextResult.context, onChunk, options);

      logger.info('RAG pipeline (streaming) completed successfully', {
        memoriesFound: relevantMemories.length,
      });

      return {
        relevantMemories: contextResult.relevantMemories,
        context: contextResult.context,
      };
    } catch (error) {
      logger.error('RAG pipeline (streaming) failed', error);
      throw error;
    }
  }

  private async embedQuery(query: string): Promise<number[]> {
    try {
      logger.debug('Embedding query', { length: query.length });
      const embedding = await llmProvider.embed(query);
      logger.debug('Query embedded successfully', { dimensions: embedding.length });
      return embedding;
    } catch (error) {
      logger.error('Failed to embed query', error);
      throw new Error('Embedding failed: ' + (error as Error).message);
    }
  }

  private async searchVectorDB(
    embedding: number[],
    searchFunction: (embedding: number[]) => Promise<Memory[]>,
    options: RAGOptions
  ): Promise<Memory[]> {
    try {
      logger.debug('Searching vector database', {
        embeddingDim: embedding.length,
        limit: options.vectorSearchLimit,
      });

      const results = await searchFunction(embedding);

      logger.debug('Vector search completed', { resultsCount: results.length });
      return results;
    } catch (error) {
      logger.error('Vector search failed', error);
      // Return empty results instead of failing completely
      return [];
    }
  }

  private async generateAnswer(
    query: string,
    context: string,
    options: RAGOptions
  ): Promise<string> {
    try {
      const includeContext = options.includeContext ?? true;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. Use the provided context to answer questions accurately and concisely.',
        },
      ];

      if (includeContext && context) {
        messages.push({
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: query,
        });
      }

      const answer = await llmProvider.chat(messages, options.chatOptions || {});

      return answer;
    } catch (error) {
      logger.error('Failed to generate answer', error);
      throw new Error('Answer generation failed: ' + (error as Error).message);
    }
  }

  private async generateAnswerStream(
    query: string,
    context: string,
    onChunk: (chunk: string) => void,
    options: RAGOptions
  ): Promise<void> {
    try {
      const includeContext = options.includeContext ?? true;

      const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        {
          role: 'system',
          content:
            'You are a helpful AI assistant. Use the provided context to answer questions accurately and concisely.',
        },
      ];

      if (includeContext && context) {
        messages.push({
          role: 'user',
          content: `Context:\n${context}\n\nQuestion: ${query}`,
        });
      } else {
        messages.push({
          role: 'user',
          content: query,
        });
      }

      await llmProvider.chatStream(messages, options.chatOptions || {}, onChunk);
    } catch (error) {
      logger.error('Failed to generate streaming answer', error);
      throw new Error('Streaming answer generation failed: ' + (error as Error).message);
    }
  }

  /**
   * Simple query without vector search (direct LLM call)
   */
  async simpleQuery(query: string, options: ChatOptions = {}): Promise<string> {
    try {
      logger.info('Executing simple query', { query: query.substring(0, 100) });

      const messages = [
        {
          role: 'system' as const,
          content: 'You are a helpful AI assistant.',
        },
        {
          role: 'user' as const,
          content: query,
        },
      ];

      const answer = await llmProvider.chat(messages, options);

      logger.info('Simple query completed', { answerLength: answer.length });
      return answer;
    } catch (error) {
      logger.error('Simple query failed', error);
      throw error;
    }
  }

  /**
   * Convert vector search results to memories
   */
  convertSearchResultsToMemories(results: VectorSearchResult[]): Memory[] {
    return results.map((result) => ({
      id: result.id,
      type: 'semantic' as const,
      content: result.content,
      timestamp: Date.now(),
      relevance: 1 - result.distance, // Convert distance to similarity
      metadata: result.metadata,
    }));
  }
}

// Singleton export
export const ragPipeline = RAGPipeline.getInstance();

export { RAGPipeline };
export default ragPipeline;
