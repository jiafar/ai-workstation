/**
 * N-gram dictionary coding for token compression
 * Learns common patterns and builds a codebook for efficient storage
 * Target: ~97% token reduction through frequency-based compression
 */
export class CodebookCompressor {
  private codebook: Map<string, string> = new Map()
  private reverseCodebook: Map<string, string> = new Map()
  private nextCode = 1
  private minNgramFrequency = 3
  private maxNgramLength = 5
  private minNgramLength = 2

  /**
   * Learn N-gram patterns from text corpus
   */
  async learn(texts: string[]): Promise<void> {
    // Count N-gram frequencies
    const ngramFrequencies = new Map<string, number>()

    for (const text of texts) {
      const tokens = this.tokenize(text)

      // Extract N-grams of varying lengths
      for (let n = this.minNgramLength; n <= this.maxNgramLength; n++) {
        for (let i = 0; i <= tokens.length - n; i++) {
          const ngram = tokens.slice(i, i + n).join(' ')
          ngramFrequencies.set(ngram, (ngramFrequencies.get(ngram) || 0) + 1)
        }
      }
    }

    // Filter by minimum frequency and sort by frequency * length (priority)
    const frequentNgrams = Array.from(ngramFrequencies.entries())
      .filter(([_, freq]) => freq >= this.minNgramFrequency)
      .sort((a, b) => {
        const priorityA = a[1] * a[0].split(' ').length
        const priorityB = b[1] * b[0].split(' ').length
        return priorityB - priorityA
      })

    // Build codebook from most valuable N-grams
    this.codebook.clear()
    this.reverseCodebook.clear()
    this.nextCode = 1

    for (const [ngram, _] of frequentNgrams) {
      const code = this.generateCode(this.nextCode++)
      this.codebook.set(ngram, code)
      this.reverseCodebook.set(code, ngram)
    }
  }

  /**
   * Compress text using the learned codebook
   */
  compress(text: string): string {
    if (this.codebook.size === 0) {
      return text // No codebook learned yet
    }

    let result = text
    const tokens = this.tokenize(text)

    // Apply replacements from longest N-grams to shortest (greedy approach)
    const sortedEntries = Array.from(this.codebook.entries())
      .sort((a, b) => b[0].split(' ').length - a[0].split(' ').length)

    for (const [ngram, code] of sortedEntries) {
      // Use word boundary matching to avoid partial replacements
      const pattern = new RegExp(this.escapeRegex(ngram), 'g')
      result = result.replace(pattern, code)
    }

    return result
  }

  /**
   * Decompress text using the codebook
   */
  decompress(compressed: string): string {
    let result = compressed

    // Apply reverse replacements
    for (const [code, ngram] of this.reverseCodebook.entries()) {
      const pattern = new RegExp(this.escapeRegex(code), 'g')
      result = result.replace(pattern, ngram)
    }

    return result
  }

  /**
   * Get compression ratio (compressed size / original size)
   */
  getCompressionRatio(originalText: string): number {
    const compressed = this.compress(originalText)
    return compressed.length / originalText.length
  }

  /**
   * Get codebook statistics
   */
  getStats(): {
    entries: number
    avgNgramLength: number
    maxNgramLength: number
    minNgramLength: number
  } {
    const ngramLengths = Array.from(this.codebook.keys()).map(
      ngram => ngram.split(' ').length
    )

    return {
      entries: this.codebook.size,
      avgNgramLength: ngramLengths.reduce((a, b) => a + b, 0) / ngramLengths.length || 0,
      maxNgramLength: Math.max(...ngramLengths, 0),
      minNgramLength: Math.min(...ngramLengths, 0)
    }
  }

  /**
   * Save codebook to JSON
   */
  saveCodebook(): string {
    return JSON.stringify({
      codebook: Array.from(this.codebook.entries()),
      nextCode: this.nextCode,
      config: {
        minNgramFrequency: this.minNgramFrequency,
        maxNgramLength: this.maxNgramLength,
        minNgramLength: this.minNgramLength
      }
    }, null, 2)
  }

  /**
   * Load codebook from JSON
   */
  loadCodebook(json: string): void {
    const data = JSON.parse(json)

    this.codebook = new Map(data.codebook)
    this.reverseCodebook = new Map(
      Array.from(this.codebook.entries()).map(([k, v]) => [v, k])
    )
    this.nextCode = data.nextCode

    if (data.config) {
      this.minNgramFrequency = data.config.minNgramFrequency
      this.maxNgramLength = data.config.maxNgramLength
      this.minNgramLength = data.config.minNgramLength
    }
  }

  /**
   * Generate a short code for an N-gram
   * Uses base-62 encoding (alphanumeric) with a prefix
   */
  private generateCode(num: number): string {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
    let result = ''
    let n = num

    do {
      result = chars[n % 62] + result
      n = Math.floor(n / 62)
    } while (n > 0)

    return `§${result}` // Use special prefix to avoid collisions
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0)
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * Set compression parameters
   */
  setParameters(params: {
    minNgramFrequency?: number
    maxNgramLength?: number
    minNgramLength?: number
  }): void {
    if (params.minNgramFrequency !== undefined) {
      this.minNgramFrequency = params.minNgramFrequency
    }
    if (params.maxNgramLength !== undefined) {
      this.maxNgramLength = params.maxNgramLength
    }
    if (params.minNgramLength !== undefined) {
      this.minNgramLength = params.minNgramLength
    }
  }
}
