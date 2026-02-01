import { z } from "zod";

// 基础配置Schema
export const BaseConfigSchema = z.object({
  agent: z.object({
    id: z.string().default("default"),
    name: z.string().default("Enterprise Assistant"),
    description: z.string().default("企业内网智能助手"),
  }).default({}),
  
  ollama: z.object({
    host: z.string().url().default("http://localhost:11434"),
    model: z.string().default("qwen2.5:7b"),
    embedModel: z.string().default("nomic-embed-text:latest"),
    timeout: z.number().positive().default(120000),
  }).default({}),
  
  storage: z.object({
    dataDir: z.string().default("./data"),
    sessionDir: z.string().default("./data/sessions"),
    pluginDir: z.string().default("./plugins"),
    skillDir: z.string().default("./skills"),
  }).default({}),
  
  security: z.object({
    safeBins: z.array(z.string()).default(["/usr/bin", "/bin"]),
    execTimeout: z.number().positive().default(30000),
    allowDownload: z.boolean().default(false),
    maxFileSize: z.number().positive().default(10485760),
  }).default({}),
  
  tools: z.object({
    defaultProfile: z.enum(["minimal", "coding", "full"]).default("full"),
    profiles: z.record(z.object({
      allow: z.array(z.string()).optional(),
      deny: z.array(z.string()).optional(),
    })).optional(),
  }).optional(),
  
  channels: z.record(z.object({
    enabled: z.boolean().default(true),
    adapter: z.string(),
    config: z.record(z.unknown()).optional(),
  })).optional(),
}).default({});

export type BaseConfig = z.infer<typeof BaseConfigSchema>;

// Agent配置Schema
export const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  systemPrompt: z.string().default("你是一个企业内网智能助手。"),
  model: z.string().default(""),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().positive().default(4096),
  tools: z.array(z.string()).default([]),
  toolPolicy: z.record(z.unknown()).optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;

// 工具配置Schema
export const ToolConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.unknown()),
  handler: z.function(),
  category: z.enum(["file", "network", "database", "system", "search", "notification"]),
  enabled: z.boolean().default(true),
});

export type ToolConfig = z.infer<typeof ToolConfigSchema>;

// 渠道配置Schema
export const ChannelConfigSchema = z.object({
  name: z.string(),
  type: z.enum(["cli", "webhook", "email", "oa", "im"]),
  enabled: z.boolean().default(true),
  adapter: z.string(),
  config: z.record(z.unknown()),
});

export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;

// 会话配置Schema
export const SessionConfigSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  createdAt: z.date(),
  lastActiveAt: z.date(),
  messageCount: z.number().default(0),
  maxHistory: z.number().default(50),
  summary: z.string().optional(),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// 服务接口配置Schema
export const ServiceConfigSchema = z.object({
  name: z.string(),
  type: z.enum(["database", "api", "filesystem", "search", "notification", "task"]),
  baseUrl: z.string().optional(),
  enabled: z.boolean().default(true),
  auth: z.object({
    type: z.enum(["none", "basic", "token", "oauth"]),
    credentials: z.record(z.string()).optional(),
  }).optional(),
  timeout: z.number().default(30000),
});

export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
