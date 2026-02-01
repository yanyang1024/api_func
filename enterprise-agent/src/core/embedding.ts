import { OllamaClient } from "./ollama-client.js";

export class EmbeddingService {
  private ollama: OllamaClient;
  private cache: Map<string, number[]>;

  constructor(ollama: OllamaClient) {
    this.ollama = ollama;
    this.cache = new Map();
  }

  async getEmbedding(text: string): Promise<number[]> {
    // 检查缓存
    const cacheKey = this.getCacheKey(text);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const embedding = await this.ollama.getEmbedding(text);
    
    // 缓存embedding（限制缓存大小）
    if (this.cache.size < 10000) {
      this.cache.set(cacheKey, embedding);
    }

    return embedding;
  }

  async getEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(text => this.getEmbedding(text)));
  }

  async cosineSimilarity(a: number[], b: number[]): Promise<number> {
    if (a.length !== b.length) {
      throw new Error("向量维度不匹配");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  async findSimilar(
    query: string,
    candidates: Array<{ id: string; text: string }>,
    topK: number = 5
  ): Promise<Array<{ id: string; score: number }>> {
    const queryEmbedding = await this.getEmbedding(query);
    
    const similarities = await Promise.all(
      candidates.map(async (candidate) => {
        const candidateEmbedding = await this.getEmbedding(candidate.text);
        const score = await this.cosineSimilarity(queryEmbedding, candidateEmbedding);
        return { id: candidate.id, score };
      })
    );

    return similarities
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  async semanticSearch(
    query: string,
    documents: Map<string, string>,
    topK: number = 5
  ): Promise<Array<{ id: string; text: string; score: number }>> {
    const candidates = Array.from(documents.entries()).map(([id, text]) => ({ id, text }));
    const similar = await this.findSimilar(query, candidates, topK);

    return similar.map(s => ({
      id: s.id,
      text: documents.get(s.id) || "",
      score: s.score,
    }));
  }

  private getCacheKey(text: string): string {
    // 简单的哈希函数
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `emb_${hash}_${text.length}`;
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}

export const createEmbeddingService = (ollama: OllamaClient): EmbeddingService => {
  return new EmbeddingService(ollama);
};
