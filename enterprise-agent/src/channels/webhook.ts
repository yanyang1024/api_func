import { IncomingMessage, ServerResponse } from "node:http";
import { Message } from "../../core/types.js";

export interface WebhookChannelConfig {
  path: string;
  method: "POST" | "GET";
  auth?: {
    type: "bearer" | "basic";
    token?: string;
  };
}

export interface WebhookHandler {
  onMessage: (message: Message) => Promise<void>;
}

export class WebhookChannel {
  private config: WebhookChannelConfig;
  private handler: WebhookHandler | null = null;

  constructor(config: WebhookChannelConfig) {
    this.config = config;
  }

  setHandler(handler: WebhookHandler): void {
    this.handler = handler;
  }

  getPath(): string {
    return this.config.path;
  }

  getMethod(): string {
    return this.config.method;
  }

  async handleRequest(
    req: IncomingMessage,
    res: ServerResponse
  ): Promise<void> {
    // 验证请求方法
    if (req.method !== this.config.method) {
      res.writeHead(405, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }

    // 验证认证
    if (!this.validateAuth(req)) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }

    if (req.method === "GET") {
      // 健康检查
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", channel: "webhook" }));
      return;
    }

    // POST请求 - 接收消息
    let body = "";
    for await (const chunk of req) {
      body += chunk.toString();
    }

    try {
      const data = JSON.parse(body);
      
      if (this.handler) {
        await this.handler.onMessage({
          role: "user",
          content: data.content || data.message || data.text || "",
          timestamp: Date.now(),
          images: data.images,
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "received" }));
    } catch (error) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request body" }));
    }
  }

  private validateAuth(req: IncomingMessage): boolean {
    if (!this.config.auth) {
      return true;
    }

    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return false;
    }

    if (this.config.auth.type === "bearer") {
      return authHeader === `Bearer ${this.config.auth.token}`;
    }

    if (this.config.auth.type === "basic") {
      // 简单验证，实际使用应该解码验证
      return !!authHeader;
    }

    return true;
  }

  async sendResponse(content: string): Promise<void> {
    // Webhook是单向接收的，发送响应由调用方处理
  }
}

export const createWebhookChannel = (config: Partial<WebhookChannelConfig> = {}): WebhookChannel => {
  return new WebhookChannel({
    path: config.path || "/webhook",
    method: config.method || "POST",
    auth: config.auth,
  });
};
