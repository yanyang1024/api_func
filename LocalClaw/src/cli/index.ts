#!/usr/bin/env node

import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { runInteractive } from "./interactive.js";
import { runAgent } from "./run.js";
import { startGateway } from "../gateway/index.js";
import { sessionCommand } from "./session.js";
import { toolCommand } from "./tools.js";
import { configCommand } from "./config.js";

const program = new Command();

program
  .name("localclaw")
  .description("企业内网离线 Agent 框架")
  .version("1.0.0");

// 交互模式
program
  .command("interactive")
  .alias("i")
  .description("启动交互模式")
  .action(async () => {
    const config = loadConfig();
    await runInteractive(config);
  });

// 运行 Agent
program
  .command("run")
  .alias("r")
  .description("运行单次 Agent 任务")
  .argument("[prompt]", "要执行的提示词")
  .option("-s, --session <id>", "会话 ID")
  .option("-t, --timeout <ms>", "超时时间")
  .option("--think", "开启思考模式")
  .action(async (prompt, options) => {
    const config = loadConfig();

    if (!prompt) {
      console.error("请提供提示词");
      process.exit(1);
    }

    const result = await runAgent(config, {
      prompt,
      sessionId: options.session,
      timeout: options.timeout ? Number(options.timeout) : undefined,
      thinkLevel: options.think ? "on" : "off",
    });

    if (!result.success) {
      console.error("执行失败:", result.error);
      process.exit(1);
    }

    console.log("\n" + "=".repeat(60));
    console.log("Agent 回复:");
    console.log("=".repeat(60));
    console.log(result.content);
    console.log("=".repeat(60));
  });

// 启动 Gateway
program
  .command("gateway")
  .alias("g")
  .description("启动 Gateway 服务")
  .option("-p, --port <port>", "端口号", "3000")
  .option("-h, --host <host>", "主机地址", "localhost")
  .action(async (options) => {
    const config = loadConfig();
    await startGateway(config, {
      port: Number(options.port),
      host: options.host,
    });
  });

// 会话管理
program.addCommand(sessionCommand);

// 工具管理
program.addCommand(toolCommand);

// 配置管理
program.addCommand(configCommand);

// 初始化命令
program
  .command("init")
  .description("初始化项目配置")
  .action(() => {
    const fs = await import("fs/promises");
    const path = await import("path");
    const yaml = await import("yaml");

    const defaultConfig = {
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
      },
    };

    const configPath = path.join(process.cwd(), "localclaw.yaml");
    fs.writeFile(configPath, yaml.stringify(defaultConfig));

    console.log(`配置文件已创建: ${configPath}`);
    console.log("请编辑配置文件并重启 LocalClaw");
  });

// 健康检查
program
  .command("health")
  .description("检查服务健康状态")
  .action(async () => {
    const config = loadConfig();
    const ora = (await import("ora")).default;

    const spinner = ora("检查 Ollama 连接...").start();

    try {
      const response = await fetch(`${config.ollama.host}/api/tags`, {
        method: "GET",
        timeout: 5000,
      });

      if (response.ok) {
        spinner.succeed("Ollama 连接正常");
      } else {
        spinner.fail("Ollama 连接失败");
      }
    } catch {
      spinner.fail("无法连接到 Ollama");
    }

    // 检查各服务
    for (const [name, service] of Object.entries(config.services)) {
      if (service && "enabled" in service && service.enabled) {
        const serviceSpinner = ora(`检查 ${name} 服务...`).start();
        try {
          const url = "baseUrl" in service ? service.baseUrl : "";
          const response = await fetch(`${url}/health`, {
            method: "GET",
            timeout: 3000,
          });
          if (response.ok) {
            serviceSpinner.succeed(`${name} 服务正常`);
          } else {
            serviceSpinner.warn(`${name} 服务异常`);
          }
        } catch {
          serviceSpinner.warn(`${name} 服务不可达`);
        }
      }
    }
  });

program.parse();
