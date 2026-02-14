import { getConfigManager } from '../config';
import { logger } from '../../utils/logger';

export interface Memory {
  id: string;
  type: 'short_term' | 'working' | 'episodic' | 'semantic';
  content: string;
  context?: string;
  timestamp: number;
  relevance?: number;
  metadata?: Record<string, any>;
}

export interface ContextOptions {
  includeShortTerm?: boolean;
  includeWorking?: boolean;
  includeEpisodic?: boolean;
  maxMemories?: number;
  relevanceThreshold?: number;
  customSystemPrompt?: string;
}

export interface ContextResult {
  systemPrompt: string;
  relevantMemories: Memory[];
  context: string;
}

class ContextBuilder {
  private static instance: ContextBuilder;

  private constructor() {
    logger.info('ContextBuilder initialized');
  }

  static getInstance(): ContextBuilder {
    if (!ContextBuilder.instance) {
      ContextBuilder.instance = new ContextBuilder();
    }
    return ContextBuilder.instance;
  }

  /**
   * Build AI context from memory layers
   * @param query The user query
   * @param memories Available memories to build context from
   * @param options Context building options
   * @returns Context result with system prompt and relevant memories
   */
  buildContext(
    query: string,
    memories: Memory[] = [],
    options: ContextOptions = {}
  ): ContextResult {
    const {
      includeShortTerm = true,
      includeWorking = true,
      includeEpisodic = true,
      maxMemories = getConfigManager().getSection('memory').maxSessionSize || 10,
      relevanceThreshold = 0.5,
      customSystemPrompt,
    } = options;

    try {
      // Filter memories by type
      const filteredMemories = this.filterMemoriesByType(memories, {
        includeShortTerm,
        includeWorking,
        includeEpisodic,
      });

      // Rank memories by relevance
      const rankedMemories = this.rankMemories(query, filteredMemories);

      // Filter by relevance threshold
      const relevantMemories = rankedMemories
        .filter((memory) => (memory.relevance ?? 0) >= relevanceThreshold)
        .slice(0, maxMemories);

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(customSystemPrompt, relevantMemories);

      // Build context string
      const context = this.buildContextString(relevantMemories);

      logger.debug('Context built successfully', {
        queryLength: query.length,
        totalMemories: memories.length,
        relevantMemories: relevantMemories.length,
      });

      return {
        systemPrompt,
        relevantMemories,
        context,
      };
    } catch (error) {
      logger.error('Failed to build context', error);
      throw error;
    }
  }

  private filterMemoriesByType(
    memories: Memory[],
    filters: {
      includeShortTerm: boolean;
      includeWorking: boolean;
      includeEpisodic: boolean;
    }
  ): Memory[] {
    return memories.filter((memory) => {
      if (memory.type === 'short_term' && !filters.includeShortTerm) return false;
      if (memory.type === 'working' && !filters.includeWorking) return false;
      if (memory.type === 'episodic' && !filters.includeEpisodic) return false;
      // Always include semantic memories as they represent core knowledge
      return true;
    });
  }

  private rankMemories(query: string, memories: Memory[]): Memory[] {
    // Simple relevance scoring based on keyword overlap
    // In production, this would use vector similarity
    const queryTokens = this.tokenize(query.toLowerCase());

    return memories
      .map((memory) => {
        const memoryTokens = this.tokenize(memory.content.toLowerCase());
        const contextTokens = memory.context
          ? this.tokenize(memory.context.toLowerCase())
          : [];

        // Calculate overlap score
        const contentScore = this.calculateOverlap(queryTokens, memoryTokens);
        const contextScore = this.calculateOverlap(queryTokens, contextTokens);

        // Combine scores with weights
        const relevance = contentScore * 0.7 + contextScore * 0.3;

        return {
          ...memory,
          relevance,
        };
      })
      .sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
  }

  private tokenize(text: string): string[] {
    return text
      .split(/\s+/)
      .map((token) => token.replace(/[^\w]/g, ''))
      .filter((token) => token.length > 2);
  }

  private calculateOverlap(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);

    let overlap = 0;
    for (const token of set1) {
      if (set2.has(token)) {
        overlap++;
      }
    }

    return overlap / Math.max(set1.size, set2.size);
  }

  private buildSystemPrompt(customPrompt?: string, memories: Memory[] = []): string {
    const basePrompt =
      customPrompt ||
      `You are an AI assistant integrated into an AI Workstation IDE. You have access to the user's context and memory layers to provide intelligent, contextual assistance.`;

    if (memories.length === 0) {
      return basePrompt;
    }

    const memoryContext = this.buildContextString(memories);

    return `${basePrompt}

## Relevant Context

${memoryContext}

Use this context to provide more informed and personalized responses. Reference specific details from the context when relevant.`;
  }

  private buildContextString(memories: Memory[]): string {
    if (memories.length === 0) {
      return 'No relevant context available.';
    }

    const sections: string[] = [];

    // Group memories by type
    const memoriesByType = this.groupMemoriesByType(memories);

    // Build sections for each memory type
    if (memoriesByType.short_term.length > 0) {
      sections.push(this.buildMemorySection('Recent Context', memoriesByType.short_term));
    }

    if (memoriesByType.working.length > 0) {
      sections.push(this.buildMemorySection('Working Memory', memoriesByType.working));
    }

    if (memoriesByType.episodic.length > 0) {
      sections.push(this.buildMemorySection('Past Interactions', memoriesByType.episodic));
    }

    if (memoriesByType.semantic.length > 0) {
      sections.push(this.buildMemorySection('Knowledge Base', memoriesByType.semantic));
    }

    return sections.join('\n\n');
  }

  private groupMemoriesByType(memories: Memory[]): Record<string, Memory[]> {
    return {
      short_term: memories.filter((m) => m.type === 'short_term'),
      working: memories.filter((m) => m.type === 'working'),
      episodic: memories.filter((m) => m.type === 'episodic'),
      semantic: memories.filter((m) => m.type === 'semantic'),
    };
  }

  private buildMemorySection(title: string, memories: Memory[]): string {
    const items = memories
      .map((memory) => {
        const timestamp = new Date(memory.timestamp).toLocaleString();
        const relevance = memory.relevance ? ` (relevance: ${memory.relevance.toFixed(2)})` : '';
        const context = memory.context ? `\n  Context: ${memory.context}` : '';
        return `- [${timestamp}${relevance}] ${memory.content}${context}`;
      })
      .join('\n');

    return `### ${title}\n\n${items}`;
  }

  /**
   * Create a simple context string from text snippets
   */
  createSimpleContext(snippets: string[]): string {
    if (snippets.length === 0) return '';

    return snippets.map((snippet, index) => `[${index + 1}] ${snippet}`).join('\n\n');
  }

  /**
   * Format a single memory for display
   */
  formatMemory(memory: Memory): string {
    const timestamp = new Date(memory.timestamp).toLocaleString();
    const type = memory.type.replace('_', ' ').toUpperCase();
    const context = memory.context ? `\nContext: ${memory.context}` : '';
    const metadata = memory.metadata
      ? `\nMetadata: ${JSON.stringify(memory.metadata)}`
      : '';

    return `[${type}] ${timestamp}\n${memory.content}${context}${metadata}`;
  }
}

// Singleton export
export const contextBuilder = ContextBuilder.getInstance();

export { ContextBuilder };
export default contextBuilder;
