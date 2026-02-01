import { ApiResponse, SearchQuery, SearchResult } from "../core/types.js";

export interface SearchServiceConfig {
  type: "local" | "elasticsearch" | "meilisearch";
  host?: string;
  index: string;
  apiKey?: string;
}

export interface IndexDocument {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export class SearchService {
  private config: SearchServiceConfig;
  private documents: Map<string, IndexDocument> = new Map();

  constructor(config: SearchServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.config.type === "local") {
      // 内存索引，无需初始化
      return;
    }

    // 远程搜索服务连接逻辑
    if (this.config.type === "elasticsearch") {
      await this.initElasticsearch();
    } else if (this.config.type === "meilisearch") {
      await this.initMeilisearch();
    }
  }

  private async initElasticsearch(): Promise<void> {
    // Elasticsearch初始化
    console.log(`初始化Elasticsearch连接: ${this.config.host}`);
  }

  private async initMeilisearch(): Promise<void> {
    // Meilisearch初始化
    console.log(`初始化Meilisearch连接: ${this.config.host}`);
  }

  async indexDocument(doc: IndexDocument): Promise<ApiResponse> {
    if (this.config.type === "local") {
      this.documents.set(doc.id, doc);
      return { success: true, statusCode: 200 };
    }

    // 远程索引逻辑
    return { success: true, statusCode: 200 };
  }

  async indexDocuments(docs: IndexDocument[]): Promise<ApiResponse> {
    if (this.config.type === "local") {
      for (const doc of docs) {
        this.documents.set(doc.id, doc);
      }
      return { success: true, statusCode: 200 };
    }

    return { success: true, statusCode: 200 };
  }

  async search(query: SearchQuery): Promise<ApiResponse<SearchResult[]>> {
    const searchTerms = query.query.toLowerCase().split(" ");
    const limit = query.limit || 10;
    const offset = query.offset || 0;

    if (this.config.type === "local") {
      // 本地搜索实现
      const results: SearchResult[] = [];

      for (const doc of this.documents.values()) {
        let score = 0;
        const contentLower = doc.content.toLowerCase();
        const titleLower = doc.title.toLowerCase();

        // 标题匹配权重更高
        for (const term of searchTerms) {
          if (titleLower.includes(term)) {
            score += 10;
          }
          if (contentLower.includes(term)) {
            score += 1;
          }
        }

        if (score > 0) {
          results.push({
            id: doc.id,
            title: doc.title,
            content: doc.content.substring(0, 200) + "...",
            score: score / searchTerms.length,
            metadata: doc.metadata,
          });
        }
      }

      // 按分数排序
      results.sort((a, b) => b.score - a.score);

      return {
        success: true,
        data: results.slice(offset, offset + limit),
        statusCode: 200,
      };
    }

    // 远程搜索逻辑
    return { success: true, data: [], statusCode: 200 };
  }

  async deleteDocument(id: string): Promise<ApiResponse> {
    if (this.config.type === "local") {
      this.documents.delete(id);
      return { success: true, statusCode: 200 };
    }

    return { success: true, statusCode: 200 };
  }

  async clearIndex(): Promise<ApiResponse> {
    if (this.config.type === "local") {
      this.documents.clear();
      return { success: true, statusCode: 200 };
    }

    return { success: true, statusCode: 200 };
  }

  async getDocument(id: string): Promise<ApiResponse<IndexDocument | null>> {
    if (this.config.type === "local") {
      const doc = this.documents.get(id) || null;
      return { success: true, data: doc, statusCode: 200 };
    }

    return { success: true, data: null, statusCode: 200 };
  }

  async getStats(): Promise<ApiResponse<{ documentCount: number }>> {
    return {
      success: true,
      data: { documentCount: this.documents.size },
      statusCode: 200,
    };
  }
}

export const createSearchService = (config: SearchServiceConfig): SearchService => {
  return new SearchService(config);
};
