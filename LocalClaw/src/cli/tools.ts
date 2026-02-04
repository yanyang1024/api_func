import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { createAllTools } from "../tools/exec.js";

export const toolCommand = new Command("tool")
  .description("工具管理")
  .addCommand(
    new Command("list")
      .description("列出所有可用工具")
      .action(() => {
        const config = loadConfig();
        const tools = createAllTools(config, process.cwd());

        console.log("\n可用工具:");
        console.log("-".repeat(70));

        // 按类别分组
        const categories: Record<string, string[]> = {
          "文件操作": [],
          "系统命令": [],
          "HR服务": [],
          "OA服务": [],
          "文件服务器": [],
          "邮件服务": [],
          "项目管理": [],
          "知识库": [],
          "其他": [],
        };

        const categoryMap: Record<string, string> = {
          read: "文件操作",
          write: "文件操作",
          edit: "文件操作",
          list_dir: "文件操作",
          exec: "系统命令",
          hr_: "HR服务",
          oa_: "OA服务",
          file_: "文件服务器",
          mail_: "邮件服务",
          pm_: "项目管理",
          kb_: "知识库",
        };

        for (const tool of tools) {
          let category = "其他";
          for (const [prefix, cat] of Object.entries(categoryMap)) {
            if (tool.name.startsWith(prefix)) {
              category = cat;
              break;
            }
          }
          categories[category].push(tool.name);
        }

        for (const [category, names] of Object.entries(categories)) {
          if (names.length > 0) {
            console.log(`\n${category}:`);
            for (const name of names) {
              console.log(`  - ${name}`);
            }
          }
        }

        console.log("-".repeat(70));
        console.log(`总计: ${tools.length} 个工具`);
      })
  )
  .addCommand(
    new Command("info")
      .description("查看工具详细信息")
      .argument("<toolName>", "工具名称")
      .action((toolName) => {
        const config = loadConfig();
        const tools = createAllTools(config, process.cwd());
        const tool = tools.find((t) => t.name === toolName);

        if (!tool) {
          console.error(`工具不存在: ${toolName}`);
          return;
        }

        console.log(`\n工具: ${tool.name}`);
        console.log("-".repeat(50));
        console.log(`描述: ${tool.description}`);
        console.log("\n输入参数:");
        const properties = tool.inputSchema.properties || {};
        for (const [name, schema] of Object.entries(properties)) {
          const s = schema as { type: string; description?: string; enum?: string[] };
          console.log(`  ${name} (${s.type}): ${s.description || ""}`);
          if (s.enum) {
            console.log(`    可选值: ${s.enum.join(", ")}`);
          }
        }
        console.log("-".repeat(50));
      })
  );
