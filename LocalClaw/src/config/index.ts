import { z } from "zod";

// ============ 配置 Schema ============

export const ConfigSchema = z.object({
  // Ollama 配置
  ollama: z.object({
    host: z.string().url(),
    model: z.string(),
    contextWindow: z.number().positive().default(131072),
    timeout: z.number().positive().default(120000),
  }),

  // 内网服务配置
  services: z.object({
    hr: z.object({
      enabled: z.boolean().default(true),
      baseUrl: z.string().url(),
      apiKey: z.string().optional(),
    }).optional(),

    oa: z.object({
      enabled: z.boolean().default(true),
      baseUrl: z.string().url(),
      apiKey: z.string().optional(),
    }).optional(),

    fileServer: z.object({
      enabled: z.boolean().default(true),
      baseUrl: z.string().url(),
      token: z.string().optional(),
    }).optional(),

    database: z.object({
      enabled: z.boolean().default(false),
      host: z.string(),
      port: z.number(),
      user: z.string(),
      password: z.string(),
    }).optional(),

    mail: z.object({
      enabled: z.boolean().default(true),
      smtpHost: z.string(),
      smtpPort: z.number(),
      user: z.string().email(),
      password: z.string(),
    }).optional(),

    projectManagement: z.object({
      enabled: z.boolean().default(true),
      baseUrl: z.string().url(),
      apiKey: z.string().optional(),
    }).optional(),

    knowledgeBase: z.object({
      enabled: z.boolean().default(true),
      baseUrl: z.string().url(),
      apiKey: z.string().optional(),
    }).optional(),
  }),

  // Agent 配置
  agent: z.object({
    defaultTimeout: z.number().positive().default(600000),
    maxHistoryTurns: z.number().positive().default(50),
    enableSandbox: z.boolean().default(true),
    sandboxMemory: z.string().default("512M"),
    sandboxCpu: z.number().default(1.0),
  }),

  // 安全配置
  security: z.object({
    allowedDomains: z.array(z.string()).default([]),
    allowedIps: z.array(z.string()).default([]),
    deniedPatterns: z.array(z.string()).default([
      "rm -rf /",
      "rm -rf /*",
      "chmod 777",
      "mkfs",
    ]),
    maxFileSize: z.number().positive().default(10 * 1024 * 1024),
  }),

  // 日志配置
  logging: z.object({
    level: z.enum(["debug", "info", "warn", "error"]).default("info"),
    format: z.enum(["json", "text"]).default("text"),
    file: z.string().optional(),
  }),
});

export type Config = z.infer<typeof ConfigSchema>;
export type ConfigSchemaType = z.infer<typeof ConfigSchema>;

// ============ 默认配置 ============

export function getDefaultConfig(): Config {
  return {
    ollama: {
      host: "http://localhost:11434",
      model: "qwen2.5:7b-instruct",
      contextWindow: 131072,
      timeout: 120000,
    },
    services: {
      hr: {
        enabled: false,
        baseUrl: "http://hr.internal.company.com:8080/api",
      },
      oa: {
        enabled: false,
        baseUrl: "http://oa.internal.company.com:3000/api",
      },
      fileServer: {
        enabled: false,
        baseUrl: "http://files.internal.company.com:9000",
      },
      mail: {
        enabled: false,
        smtpHost: "mail.internal.company.com",
        smtpPort: 587,
        user: "agent@company.com",
        password: "",
      },
      projectManagement: {
        enabled: false,
        baseUrl: "http://pm.internal.company.com:8088/api",
      },
      knowledgeBase: {
        enabled: false,
        baseUrl: "http://kb.internal.company.com:5000/api",
      },
    },
    agent: {
      defaultTimeout: 600000,
      maxHistoryTurns: 50,
      enableSandbox: false,
      sandboxMemory: "512M",
      sandboxCpu: 1.0,
    },
    security: {
      allowedDomains: ["*.internal.company.com"],
      allowedIps: ["10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"],
      deniedPatterns: ["rm -rf /", "rm -rf /*", "chmod 777", "mkfs"],
      maxFileSize: 10 * 1024 * 1024,
    },
    logging: {
      level: "info",
      format: "text",
    },
  };
}

// ============ 配置加载 ============

let cachedConfig: Config | null = null;

export function loadConfig(configPath?: string): Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const fs = require("fs");
  const path = require("path");
  const yaml = require("yaml");

  const configPaths = [
    configPath,
    path.join(process.cwd(), "localclaw.yaml"),
    path.join(process.cwd(), "localclaw.yml"),
    path.join(process.cwd(), ".localclawrc"),
    path.join(process.env.HOME || process.env.USERPROFILE, ".localclaw.yaml"),
  ].filter(Boolean) as string[];

  let configData: Record<string, unknown> = {};

  for (const p of configPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      configData = yaml.parse(content) || {};
      break;
    }
  }

  // 合并环境变量
  configData = mergeEnvVariables(configData);

  // 合并默认配置
  const defaultConfig = getDefaultConfig();
  const mergedConfig = deepMerge(defaultConfig, configData);

  // 验证配置
  const result = ConfigSchema.safeParse(mergedConfig);
  if (!result.success) {
    throw new Error(`配置验证失败: ${result.error.message}`);
  }

  cachedConfig = result.data;
  return cachedConfig;
}

function mergeEnvVariables(config: Record<string, unknown>): Record<string, unknown> {
  const envMappings: Record<string, string[]> = {
    "ollama.host": ["OLLAMA_HOST"],
    "ollama.model": ["OLLAMA_MODEL"],
    "ollama.contextWindow": ["OLLAMA_CONTEXT_WINDOW"],
    "ollama.timeout": ["OLLAMA_TIMEOUT"],
    "services.hr.baseUrl": ["HR_API_BASE"],
    "services.hr.apiKey": ["HR_API_KEY"],
    "services.oa.baseUrl": ["OA_API_BASE"],
    "services.oa.apiKey": ["OA_API_KEY"],
    "services.fileServer.baseUrl": ["FILE_SERVER_BASE"],
    "services.fileServer.token": ["FILE_SERVER_TOKEN"],
    "services.mail.smtpHost": ["MAIL_SMTP_HOST"],
    "services.mail.smtpPort": ["MAIL_SMTP_PORT"],
    "services.mail.user": ["MAIL_USER"],
    "services.mail.password": ["MAIL_PASSWORD"],
    "agent.defaultTimeout": ["DEFAULT_SESSION_TIMEOUT"],
    "agent.maxHistoryTurns": ["MAX_HISTORY_TURNS"],
    "agent.enableSandbox": ["ENABLE_SANDBOX"],
  };

  const result = { ...config };

  for (const [path, envVars] of Object.entries(envMappings)) {
    for (const envVar of envVars) {
      const value = process.env[envVar];
      if (value !== undefined) {
        setNestedValue(result, path, value);
        break;
      }
    }
  }

  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const parts = path.split(".");
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) {
      current[parts[i]] = {};
    }
    current = current[parts[i]] as Record<string, unknown>;
  }

  // 尝试转换类型
  const lastKey = parts[parts.length - 1];
  if (current[lastKey] !== undefined && typeof current[lastKey] === "number") {
    current[lastKey] = Number(value);
  } else if (current[lastKey] !== undefined && typeof current[lastKey] === "boolean") {
    current[lastKey] = value.toLowerCase() === "true";
  } else {
    current[lastKey] = value;
  }
}

function deepMerge(target: unknown, source: unknown): unknown {
  if (source === null || typeof source !== "object") {
    return target;
  }

  if (target === null || typeof target !== "object") {
    return source;
  }

  const result = Array.isArray(target) ? [...target] : { ...target };

  for (const key of Object.keys(source as Record<string, unknown>)) {
    const sourceValue = (source as Record<string, unknown>)[key];
    const targetValue = (result as Record<string, unknown>)[key];

    if (sourceValue !== null && typeof sourceValue === "object") {
      (result as Record<string, unknown>)[key] = deepMerge(targetValue, sourceValue);
    } else {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

export function clearConfigCache(): void {
  cachedConfig = null;
}
