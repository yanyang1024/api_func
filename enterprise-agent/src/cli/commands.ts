import { Command } from "commander";
import { createAgentFactory } from "../agents/agent.js";
import { getConfig } from "../config/index.js";
import { createSessionManager } from "../core/session-manager.js";

export function createCLI(): Command {
  const program = new Command();
  
  program
    .name("ent-agent")
    .description("企业内网智能Agent系统")
    .version("1.0.0");

  // 检查Ollama状态
  program
    .command("status")
    .description("检查系统状态")
    .action(async () => {
      try {
        const factory = await createAgentFactory();
        const ollamaReady = await factory.checkOllamaStatus();
        const models = await factory.getAvailableModels();

        console.log("\n=== 系统状态 ===");
        console.log(`Ollama服务: ${ollamaReady ? "✓ 就绪" : "✗ 不可用"}`);
        console.log(`可用模型: ${models.length}`);
        models.forEach(m => console.log(`  - ${m.name}`));

        await factory.shutdown();
      } catch (error) {
        console.error("状态检查失败:", error);
      }
    });

  // 交互式会话
  program
    .command("chat [session]")
    .description("启动交互式对话")
    .option("--model <model>", "指定模型")
    .action(async (session, options) => {
      try {
        const factory = await createAgentFactory();
        
        if (!(await factory.checkOllamaStatus())) {
          console.error("Ollama服务不可用，请确保本地Ollama服务正在运行");
          await factory.shutdown();
          process.exit(1);
        }

        const config = getConfig();
        const agent = factory.createAgent({
          id: "assistant",
          name: "企业助手",
          systemPrompt: "你是一个企业内网智能助手，帮助用户完成各种任务。",
          model: options.model,
        });

        console.log("\n=== 企业内网Agent ===");
        console.log("输入消息与助手对话，输入 /exit 退出");
        console.log("输入 /new 开始新会话，输入 /history 查看历史");
        console.log("");

        const readline = (await import("node:readline")).createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        const askQuestion = (): Promise<string> => {
          return new Promise((resolve) => {
            readline.question("You: ", (answer) => {
              resolve(answer);
            });
          });
        };

        let currentSession = session;
        let running = true;

        while (running) {
          const input = await askQuestion();

          if (input === "/exit") {
            running = false;
            continue;
          }

          if (input === "/new") {
            currentSession = undefined;
            console.log("已开启新会话");
            continue;
          }

          if (input === "/history") {
            const sessions = await agent.listSessions();
            console.log("\n会话列表:");
            sessions.forEach(s => {
              console.log(`  ${s.id} - ${new Date(s.lastActiveAt).toLocaleString()}`);
            });
            continue;
          }

          if (input.startsWith("/session ")) {
            currentSession = input.split(" ")[1];
            console.log(`切换到会话: ${currentSession}`);
            continue;
          }

          if (!input.trim()) continue;

          try {
            console.log("\nAssistant: ", { continuous: true });
            const result = await agent.run(input, {
              sessionId: currentSession,
            });
            console.log(result.content);
          } catch (error) {
            console.error("执行失败:", error);
          }
        }

        readline.close();
        await factory.shutdown();
        console.log("再见！");
      } catch (error) {
        console.error("启动失败:", error);
      }
    });

  // 单次请求
  program
    .command("ask <message>")
    .description("发送单次请求")
    .option("--session <session>", "指定会话ID")
    .option("--model <model>", "指定模型")
    .action(async (message, options) => {
      try {
        const factory = await createAgentFactory();
        const agent = factory.createAgent({
          id: "assistant",
          name: "企业助手",
          systemPrompt: "你是一个企业内网智能助手",
          model: options.model,
        });

        const result = await agent.run(message, {
          sessionId: options.session,
        });

        console.log(result.content);
        
        await factory.shutdown();
      } catch (error) {
        console.error("请求失败:", error);
      }
    });

  // 会话管理
  program
    .command("sessions")
    .description("管理会话")
    .action(async () => {
      try {
        const config = getConfig();
        const sessionManager = createSessionManager(config.storage.sessionDir);
        await sessionManager.initialize();

        const sessions = await sessionManager.listSessions();
        
        console.log("\n=== 会话列表 ===");
        if (sessions.length === 0) {
          console.log("暂无会话");
        } else {
          sessions.forEach(s => {
            console.log(`\n会话: ${s.id}`);
            console.log(`  Agent: ${s.agentId}`);
            console.log(`  消息数: ${s.messageCount}`);
            console.log(`  最后活跃: ${new Date(s.lastActiveAt).toLocaleString()}`);
          });
        }

        const stats = await sessionManager.getSessionStats();
        console.log(`\n总计: ${stats.totalSessions} 个会话, ${stats.totalMessages} 条消息`);
      } catch (error) {
        console.error("获取会话列表失败:", error);
      }
    });

  program
    .command("session <id>")
    .description("查看会话详情")
    .action(async (id) => {
      try {
        const config = getConfig();
        const sessionManager = createSessionManager(config.storage.sessionDir);
        await sessionManager.initialize();

        const messages = await sessionManager.getMessages(id);
        
        console.log(`\n=== 会话 ${id} ===`);
        console.log(`消息数: ${messages.length}`);
        
        messages.forEach((m, i) => {
          const role = m.role.toUpperCase().padEnd(8);
          const time = new Date(m.timestamp).toLocaleTimeString();
          const preview = m.content.substring(0, 80) + (m.content.length > 80 ? "..." : "");
          console.log(`\n[${i}] [${role}] [${time}]`);
          console.log(preview);
        });
      } catch (error) {
        console.error("获取会话详情失败:", error);
      }
    });

  program
    .command("clear [id]")
    .description("清除会话")
    .action(async (id) => {
      try {
        const config = getConfig();
        const sessionManager = createSessionManager(config.storage.sessionDir);
        await sessionManager.initialize();

        if (id) {
          await sessionManager.deleteSession(id);
          console.log(`会话已清除: ${id}`);
        } else {
          await sessionManager.clearAllSessions();
          console.log("所有会话已清除");
        }
      } catch (error) {
        console.error("清除会话失败:", error);
      }
    });

  // 工具命令
  program
    .command("tools")
    .description("列出可用工具")
    .action(async () => {
      try {
        const factory = await createAgentFactory();
        const agent = factory.createAgent({
          id: "assistant",
          name: "企业助手",
          systemPrompt: "",
        });

        // 这里应该从toolManager获取工具列表
        console.log("\n=== 可用工具 ===");
        console.log("文件操作: file_read, file_write, file_list, file_search");
        console.log("数据库: db_query");
        console.log("搜索: search, search_index");
        console.log("任务: task_create, task_list, task_complete");
        console.log("通知: notify");
        console.log("系统: exec");

        await factory.shutdown();
      } catch (error) {
        console.error("获取工具列表失败:", error);
      }
    });

  // 服务命令
  program
    .command("services")
    .description("查看服务状态")
    .action(async () => {
      try {
        const factory = await createAgentFactory();
        const stats = await factory.serviceRegistry?.getServiceStats() || {};
        
        console.log("\n=== 服务状态 ===");
        for (const [name, info] of Object.entries(stats)) {
          console.log(`${name}: ${info.initialized ? "✓ 运行中" : "✗ 未初始化"}`);
        }

        await factory.shutdown();
      } catch (error) {
        console.error("获取服务状态失败:", error);
      }
    });

  // 安装命令
  program
    .command("install")
    .description("安装依赖和服务")
    .action(async () => {
      console.log("\n=== 安装企业内网Agent ===");
      console.log("1. 安装Ollama: curl -fsSL https://ollama.ai/install.sh | sh");
      console.log("2. 拉取模型: ollama pull qwen2.5:7b");
      console.log("3. 安装npm依赖: npm install");
      console.log("4. 配置config.yaml");
      console.log("5. 启动服务: npm run dev");
    });

  return program;
}
