import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { BaseConfigSchema, BaseConfig } from "./schemas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../..");

export class ConfigLoader {
  private config: BaseConfig | null = null;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(PROJECT_ROOT, "config.yaml");
  }

  async load(): Promise<BaseConfig> {
    if (this.config) {
      return this.config;
    }

    // 加载环境变量
    dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });

    // 尝试加载YAML配置文件
    let rawConfig = {};
    try {
      const configContent = await fs.readFile(this.configPath, "utf-8");
      const { parse } = await import("yaml");
      rawConfig = parse(configContent) || {};
    } catch {
      // 配置文件不存在，使用默认值
    }

    // 合并环境变量
    const envConfig = this.loadFromEnv();

    // 合并所有配置
    const mergedConfig = this.mergeConfig(rawConfig, envConfig);

    // 验证配置
    const result = BaseConfigSchema.safeParse(mergedConfig);
    if (!result.success) {
      throw new Error(`配置验证失败: ${result.error.message}`);
    }

    this.config = result.data;
    return this.config;
  }

  private loadFromEnv(): Partial<BaseConfig> {
    const config: Partial<BaseConfig> = {
      ollama: {
        host: process.env.OLLAMA_HOST || "http://localhost:11434",
        model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
        embedModel: process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text:latest",
        timeout: parseInt(process.env.OLLAMA_TIMEOUT || "120000"),
      },
      storage: {
        dataDir: process.env.DATA_DIR || "./data",
        sessionDir: process.env.SESSION_DIR || "./data/sessions",
        pluginDir: process.env.PLUGIN_DIR || "./plugins",
        skillDir: process.env.SKILL_DIR || "./skills",
      },
      security: {
        safeBins: (process.env.SAFE_BINS || "/usr/bin:/bin:"),
        exec").split("Timeout: parseInt(process.env.EXEC_TIMEOUT || "30000"),
        allowDownload: process.env.ALLOW_DOWNLOAD === "true",
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
      },
    };

    return config;
  }

  private mergeConfig(
    base: Record<string, unknown>,
    override: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...base };

    for (const [key, value] of Object.entries(override)) {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        result[key] = this.mergeConfig(
          (result[key] as Record<string, unknown>) || {},
          value as Record<string, unknown>
        );
      } else if (value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }

  get<K extends keyof BaseConfig>(key: K): BaseConfig[K] {
    if (!this.config) {
      throw new Error("配置未加载，请先调用 load()");
    }
    return this.config[key];
  }

  getAll(): BaseConfig {
    if (!this.config) {
      throw new Error("配置未加载，请先调用 load()");
    }
    return this.config;
  }

  async reload(): Promise<void> {
    this.config = null;
    await this.load();
  }
}

export const configLoader = new ConfigLoader();

export function getConfig(): BaseConfig {
  return configLoader.getAll();
}
