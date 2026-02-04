import { Command } from "commander";
import { SessionManager } from "../context/index.js";
import { loadConfig } from "../config/index.js";

export const sessionCommand = new Command("session")
  .description("会话管理")
  .addCommand(
    new Command("list")
      .description("列出所有会话")
      .action(() => {
        const config = loadConfig();
        const sessionManager = new SessionManager({
          maxTurns: config.agent.maxHistoryTurns,
          contextWindow: config.ollama.contextWindow,
        });

        const sessions = sessionManager.listSessions();

        if (sessions.length === 0) {
          console.log("没有活动会话");
          return;
        }

        console.log("\n活动会话:");
        console.log("-".repeat(70));

        for (const session of sessions) {
          console.log(`ID: ${session.id}`);
          console.log(`Key: ${session.key}`);
          console.log(`Messages: ${session.messages.length}`);
          console.log(`Created: ${new Date(session.createdAt).toLocaleString()}`);
          console.log(`Updated: ${new Date(session.updatedAt).toLocaleString()}`);
          console.log("-".repeat(70));
        }
      })
  )
  .addCommand(
    new Command("clear")
      .description("清空会话")
      .argument("[sessionKey]", "会话密钥（留空则清空所有）")
      .action((sessionKey) => {
        const config = loadConfig();
        const sessionManager = new SessionManager({
          maxTurns: config.agent.maxHistoryTurns,
          contextWindow: config.ollama.contextWindow,
        });

        if (sessionKey) {
          sessionManager.clearSession(sessionKey);
          console.log(`会话 ${sessionKey} 已清空`);
        } else {
          const sessions = sessionManager.listSessions();
          for (const session of sessions) {
            sessionManager.clearSession(session.key);
          }
          console.log("所有会话已清空");
        }
      })
  )
  .addCommand(
    new Command("history")
      .description("查看会话历史")
      .argument("<sessionKey>", "会话密钥")
      .action((sessionKey) => {
        const config = loadConfig();
        const sessionManager = new SessionManager({
          maxTurns: config.agent.maxHistoryTurns,
          contextWindow: config.ollama.contextWindow,
        });

        const session = sessionManager.getSession(sessionKey);

        if (!session) {
          console.error(`会话不存在: ${sessionKey}`);
          return;
        }

        console.log(`\n会话: ${session.key}`);
        console.log(`消息数: ${session.messages.length}`);
        console.log("-".repeat(70));

        for (const msg of session.messages) {
          const roleEmoji = {
            user: "👤",
            assistant: "🤖",
            system: "⚙️",
            tool: "🔧",
          };
          const emoji = roleEmoji[msg.role] || "📝";

          console.log(`\n${emoji} [${msg.role.toUpperCase()}]`);
          console.log(`时间: ${new Date(msg.timestamp).toLocaleString()}`);
          console.log(`内容: ${msg.content.substring(0, 200)}${msg.content.length > 200 ? "..." : ""}`);
        }

        console.log("-".repeat(70));
      })
  )
  .addCommand(
    new Command("status")
      .description("查看会话状态")
      .argument("<sessionKey>", "会话密钥")
      .action((sessionKey) => {
        const config = loadConfig();
        const sessionManager = new SessionManager({
          maxTurns: config.agent.maxHistoryTurns,
          contextWindow: config.ollama.contextWindow,
        });

        const status = sessionManager.getContextStatus(sessionKey);

        console.log(`\n会话上下文状态: ${sessionKey}`);
        console.log("-".repeat(50));
        console.log(`已使用 Tokens: ${status.totalTokens.toLocaleString()}`);
        console.log(`窗口限制: ${status.limit.toLocaleString()}`);
        console.log(`使用率: ${status.usagePercent.toFixed(1)}%`);
        console.log(`状态: ${status.isOverflow ? "⚠️ 溢出" : status.warning ? "⚡ 警告" : "✅ 正常"}`);
        console.log("-".repeat(50));
      })
  );
