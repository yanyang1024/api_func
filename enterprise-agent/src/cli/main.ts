import { createCLI } from "./commands.js";

async function main() {
  const program = createCLI();
  
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error("运行错误:", error);
    process.exit(1);
  }
}

main();
