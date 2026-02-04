import type { Config } from "../config/index.js";
import { LocalAgent } from "../agent/agent.js";
import { SessionManager } from "../context/index.js";
import { createOllamaProvider } from "../agent/providers/ollama.js";
import { createAllTools } from "../tools/exec.js";
import { createServer } from "http";
import { parse } from "url";

interface GatewayOptions {
  port: number;
  host: string;
}

export async function startGateway(
  config: Config,
  options: GatewayOptions
): Promise<void> {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    LocalClaw Gateway                        ║
║                                                            ║
║  HTTP API Server Started                                   ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log(`  地址: http://${options.host}:${options.port}`);
  console.log(`  健康检查: http://${options.host}:${options.port}/health`);
  console.log(`  API 端点: http://${options.host}:${options.port}/api/v1/run`);
  console.log(`  WebSocket: ws://${options.host}:${options.port}/ws`);
  console.log("");

  // 初始化 Agent
  const sessionManager = new SessionManager({
    maxTurns: config.agent.maxHistoryTurns,
    contextWindow: config.ollama.contextWindow,
    enableCompression: true,
  });

  const provider = createOllamaProvider(config.ollama);
  const agent = new LocalAgent(provider, sessionManager, config);

  // 注册工具
  const workspaceDir = process.cwd();
  const tools = createAllTools(config, workspaceDir);
  for (const tool of tools) {
    agent.registerTool(tool);
  }

  const sessions = new Map<string, { agent: LocalAgent; sessionKey: string }>();

  const server = createServer(async (req, res) => {
    const url = parse(req.url || "", true);
    const method = req.method || "GET";

    // CORS 头
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // 健康检查
    if (url.pathname === "/health" && method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
      return;
    }

    // API 路由
    if (url.pathname === "/api/v1/run" && method === "POST") {
      try {
        const body = await readBody(req);
        const { prompt, sessionId, sessionKey, thinkLevel } = JSON.parse(body);

        if (!prompt) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "缺少 prompt 参数" }));
          return;
        }

        const sk = sessionKey || `api:${sessionId || Date.now()}`;
        const sid = sessionId || sk;

        // 设置系统提示词
        let session = sessionManager.getSession(sk);
        if (!session) {
          session = sessionManager.createSession(sk, { model: config.ollama.model });
          sessionManager.addMessage(sk, {
            role: "system",
            content: buildSystemPrompt(),
            timestamp: Date.now(),
          });
        }

        const result = await agent.run({
          sessionId: sid,
          sessionKey: sk,
          prompt,
          thinkLevel: thinkLevel || "off",
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: result.success,
            content: result.content,
            sessionId: sid,
            sessionKey: sk,
            error: result.error,
            metadata: result.metadata,
          })
        );
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(error) }));
      }
      return;
    }

    // 会话历史
    if (url.pathname === "/api/v1/session" && method === "GET") {
      const sessionKey = url.query.key as string;

      if (!sessionKey) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "缺少 sessionKey 参数" }));
        return;
      }

      try {
        const messages = sessionManager.getMessages(sessionKey);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ sessionKey, messages }));
      } catch (error) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "会话不存在" }));
      }
      return;
    }

    // 工具列表
    if (url.pathname === "/api/v1/tools" && method === "GET") {
      const tools = agent.getAllTools().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tools }));
      return;
    }

    // 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found" }));
  });

  server.listen(options.port, options.host, () => {
    console.log("Gateway 运行中... 按 Ctrl+C 停止");
  });

  // 优雅关闭
  process.on("SIGINT", () => {
    console.log("\n正在关闭 Gateway...");
    server.close(() => {
      console.log("Gateway 已关闭");
      process.exit(0);
    });
  });
}

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      resolve(body);
    });
    req.on("error", reject);
  });
}

function buildSystemPrompt(): string {
  return `你是一个企业内网智能助手，通过 API 对外提供服务。
请简洁明了地回答问题，正确使用工具。
`;
}
