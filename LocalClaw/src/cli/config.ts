import { Command } from "commander";
import { loadConfig, clearConfigCache, getDefaultConfig } from "../config/index.js";
import fs from "fs/promises";
import path from "path";

export const configCommand = new Command("config")
  .description("配置管理")
  .addCommand(
    new Command("show")
      .description("显示当前配置")
      .action(() => {
        try {
          const config = loadConfig();
          console.log("\n当前配置:");
          console.log("-".repeat(50));

          console.log("\nOllama:");
          console.log(`  Host: ${config.ollama.host}`);
          console.log(`  Model: ${config.ollama.model}`);
          console.log(`  Context Window: ${config.ollama.contextWindow}`);

          console.log("\n服务状态:");
          for (const [name, service] of Object.entries(config.services)) {
            if (service && typeof service === "object" && "enabled" in service) {
              const status = service.enabled ? "✅" : "❌";
              console.log(`  ${name}: ${status}`);
            }
          }

          console.log("\nAgent 设置:");
          console.log(`  默认超时: ${config.agent.defaultTimeout}ms`);
          console.log(`  最大历史轮次: ${config.agent.maxHistoryTurns}`);
          console.log(`  沙箱模式: ${config.agent.enableSandbox ? "开启" : "关闭"}`);

          console.log("-".repeat(50));
        } catch (error) {
          console.error("加载配置失败:", error);
        }
      })
  )
  .addCommand(
    new Command("edit")
      .description("编辑配置文件")
      .action(async () => {
        const configPaths = [
          path.join(process.cwd(), "localclaw.yaml"),
          path.join(process.cwd(), "localclaw.yml"),
          path.join(process.cwd(), ".localclawrc"),
        ];

        let configPath: string | null = null;
        for (const p of configPaths) {
          try {
            await fs.access(p);
            configPath = p;
            break;
          } catch {
            continue;
          }
        }

        if (!configPath) {
          console.error("未找到配置文件，请先运行 'localclaw init'");
          return;
        }

        const editor = process.env.EDITOR || "vi";
        const { spawn } = await import("child_process");
        const { promisify } = await import("util");
        const exec = promisify(spawn);

        try {
          await exec(editor, [configPath], { stdio: "inherit" });
          clearConfigCache();
          console.log("\n配置文件已更新");
        } catch (error) {
          console.error("编辑失败:", error);
        }
      })
  )
  .addCommand(
    new Command("reset")
      .description("重置为默认配置")
      .action(async () => {
        const configPath = path.join(process.cwd(), "localclaw.yaml");
        const yaml = await import("yaml");
        const defaultConfig = getDefaultConfig();

        await fs.writeFile(configPath, yaml.stringify(defaultConfig));
        clearConfigCache();

        console.log(`\n配置已重置: ${configPath}`);
        console.log("请编辑配置文件以匹配您的环境");
      })
  )
  .addCommand(
    new Command("validate")
      .description("验证配置文件")
      .action(() => {
        try {
          const config = loadConfig();
          console.log("\n✅ 配置验证通过");
          console.log(`   Ollama: ${config.ollama.host}`);
          console.log(`   Model: ${config.ollama.model}`);
        } catch (error) {
          console.error("\n❌ 配置验证失败:");
          console.error(error);
          process.exit(1);
        }
      })
  );
