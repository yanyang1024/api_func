import type { Config } from "../config/index.js";
import inquirer from "inquirer";
import { runAgent } from "./run.js";

export async function runInteractive(config: Config): Promise<void> {
  console.log("\n" + "=".repeat(60));
  console.log("   LocalClaw 交互模式");
  console.log("   输入 'quit' 或 'exit' 退出");
  console.log("   输入 'clear' 清空对话历史");
  console.log("=".repeat(60) + "\n");

  const { SessionManager } = await import("../context/index.js");
  const sessionManager = new SessionManager({
    maxTurns: config.agent.maxHistoryTurns,
    contextWindow: config.ollama.contextWindow,
    enableCompression: true,
  });

  let sessionKey = `interactive:${Date.now()}`;

  while (true) {
    const { prompt } = await inquirer.prompt([
      {
        type: "input",
        name: "prompt",
        message: "你:",
        prefix: "🤖",
      },
    ]);

    if (!prompt.trim()) {
      continue;
    }

    if (prompt.toLowerCase() === "quit" || prompt.toLowerCase() === "exit") {
      console.log("\n再见！");
      break;
    }

    if (prompt.toLowerCase() === "clear") {
      sessionManager.clearSession(sessionKey);
      console.log("\n对话历史已清空\n");
      continue;
    }

    console.log("");

    const result = await runAgent(config, {
      prompt,
      sessionKey,
    });

    if (!result.success) {
      console.log(`错误: ${result.error}\n`);
    } else {
      console.log(`Agent: ${result.content}\n`);
    }
  }
}
