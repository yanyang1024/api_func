#!/usr/bin/env node
/**
 * Local Agent CLI
 *
 * ==================== 教学说明 ====================
 *
 * 这个文件是 Agent 的命令行接口（CLI），提供了：
 * 1. 交互式聊天模式
 * 2. 单次查询模式
 * 3. 服务管理
 * 4. 会话管理
 */

import { LocalAgent } from './src/core/agent.js';
import { startFileSystemService } from './src/services/file-system.js';
import { startNotesService } from './src/services/notes.js';
import readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';

/**
 * 创建 readline 接口
 */
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

/**
 * 提示用户输入
 * @param {string} question - 问题
 * @returns {Promise<string>}
 */
function prompt(question) {
  const rl = createReadline();
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * 打印欢迎信息
 */
function printWelcome() {
  console.log(chalk.cyan('\n╔══════════════════════════════════════════╗'));
  console.log(chalk.cyan('║') + chalk.bold('  Local Agent - AI Assistant CLI      ') + chalk.cyan('║'));
  console.log(chalk.cyan('║') + '  Powered by Ollama (Open Source)     ' + chalk.cyan('║'));
  console.log(chalk.cyan('╚══════════════════════════════════════════╝\n'));
}

/**
 * 打印帮助信息
 */
function printHelp() {
  console.log(chalk.bold('\n📖 Commands:\n'));
  console.log('  ' + chalk.yellow('chat') + '       - Interactive chat mode');
  console.log('  ' + chalk.yellow('ask') + ' <msg>   - Ask a single question');
  console.log('  ' + chalk.yellow('services') + '   - Start local services');
  console.log('  ' + chalk.yellow('sessions') + '   - List all sessions');
  console.log('  ' + chalk.yellow('clear') + ' <id>  - Clear a session');
  console.log('  ' + chalk.yellow('status') + '      - Show agent status');
  console.log('  ' + chalk.yellow('help') + '       - Show this help message');
  console.log('  ' + chalk.yellow('exit') + '       - Exit the program');
  console.log('');
}

/**
 * 交互式聊天模式
 */
async function chatMode(agent) {
  console.log(chalk.bold('\n💬 Chat Mode'));
  console.log(chalk.gray('Type "exit" to return to main menu\n'));

  const sessionId = 'cli-chat-session';

  while (true) {
    const message = await prompt(chalk.green('You> '));

    if (!message) continue;
    if (message.toLowerCase() === 'exit') break;
    if (message.toLowerCase() === 'clear') {
      await agent.clearSession(sessionId);
      console.log(chalk.yellow('✓ Session cleared\n'));
      continue;
    }

    // 显示 spinner
    const spinner = ora('Thinking...').start();

    try {
      const response = await agent.run({
        sessionId,
        message,
      });

      spinner.stop();

      // 显示回复
      console.log(chalk.cyan('\nAgent> ') + response + '\n');
    } catch (error) {
      spinner.stop();
      console.error(chalk.red('Error:'), error.message);
    }
  }
}

/**
 * 单次查询模式
 */
async function askMode(agent, message) {
  if (!message) {
    console.error(chalk.red('Error: Please provide a message'));
    console.log(chalk.gray('Usage: ask <your message>'));
    return;
  }

  const spinner = ora('Thinking...').start();

  try {
    const response = await agent.run({
      sessionId: 'cli-one-shot',
      message,
    });

    spinner.stop();

    console.log(chalk.cyan('\nAgent> ') + response + '\n');
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Error:'), error.message);
  }
}

/**
 * 启动服务
 */
async function startServices() {
  console.log(chalk.bold('\n🚀 Starting Local Services...\n'));

  try {
    await startFileSystemService({ port: 3001 });
    await startNotesService({ port: 3004 });

    console.log(chalk.green('✓ All services started successfully!'));
    console.log(chalk.gray('Press Ctrl+C to stop services\n'));

    // 保持运行
    await new Promise(() => {});
  } catch (error) {
    console.error(chalk.red('Failed to start services:'), error.message);
  }
}

/**
 * 列出会话
 */
function listSessions(agent) {
  const sessions = agent.listSessions();

  console.log(chalk.bold('\n📋 Sessions:\n'));

  if (sessions.length === 0) {
    console.log(chalk.gray('  No sessions yet\n'));
    return;
  }

  for (const sessionId of sessions) {
    const stats = agent.getSessionStats(sessionId);
    console.log(`  ${chalk.cyan(sessionId)}`);
    console.log(`    Messages: ${stats.messageCount}`);
    console.log(`    Tokens: ${stats.estimatedTokens} / ${stats.contextWindow}`);
    console.log(`    Usage: ${(stats.usage * 100).toFixed(1)}%\n`);
  }
}

/**
 * 显示状态
 */
function showStatus(agent) {
  const sessions = agent.listSessions();
  const stats = sessions.length > 0
    ? agent.getSessionStats(sessions[0])
    : null;

  console.log(chalk.bold('\n📊 Agent Status\n'));
  console.log(`  Model: ${chalk.cyan(agent.config.agent.model.name)}`);
  console.log(`  Provider: ${chalk.cyan('Ollama')}`);
  console.log(`  Workspace: ${chalk.cyan(agent.config.agent.workspace)}`);
  console.log(`  Sessions: ${chalk.cyan(sessions.length)}`);

  if (stats) {
    console.log(`  Total Messages: ${chalk.cyan(stats.messageCount)}`);
    console.log(`  Total Tokens: ${chalk.cyan(stats.estimatedTokens)}`);
  }

  console.log('');
}

/**
 * 主菜单
 */
async function mainMenu(agent) {
  while (true) {
    const command = await prompt(chalk.bold('agent> '));

    if (!command) continue;

    const [cmd, ...args] = command.trim().split(/\s+/);
    const action = cmd.toLowerCase();

    switch (action) {
      case 'chat':
        await chatMode(agent);
        break;

      case 'ask':
        await askMode(agent, args.join(' '));
        break;

      case 'services':
        await startServices();
        break;

      case 'sessions':
        listSessions(agent);
        break;

      case 'clear':
        if (args[0]) {
          await agent.clearSession(args[0]);
          console.log(chalk.yellow(`✓ Session "${args[0]}" cleared\n`));
        } else {
          console.error(chalk.red('Error: Please provide a session ID'));
          console.log(chalk.gray('Usage: clear <session-id>'));
        }
        break;

      case 'status':
        showStatus(agent);
        break;

      case 'help':
        printHelp();
        break;

      case 'exit':
      case 'quit':
        console.log(chalk.yellow('\n👋 Goodbye!\n'));
        process.exit(0);

      default:
        console.log(chalk.red(`Unknown command: ${cmd}`));
        console.log(chalk.gray('Type "help" for available commands\n'));
    }
  }
}

/**
 * 主函数
 */
async function main() {
  printWelcome();

  // 检查命令行参数
  const args = process.argv.slice(2);

  // 特殊命令：不需要初始化 agent
  if (args[0] === 'services') {
    await startServices();
    return;
  }

  // 初始化 agent
  const spinner = ora('Initializing agent...').start();

  try {
    const agent = new LocalAgent();
    await agent.initialize();

    spinner.stop();

    // 如果有参数，执行对应命令
    if (args.length > 0) {
      const [cmd, ...cmdArgs] = args;

      switch (cmd) {
        case 'ask':
          await askMode(agent, cmdArgs.join(' '));
          process.exit(0);
          break;

        case 'chat':
          await chatMode(agent);
          process.exit(0);
          break;

        case 'sessions':
          listSessions(agent);
          process.exit(0);
          break;

        case 'status':
          showStatus(agent);
          process.exit(0);
          break;

        default:
          console.log(chalk.red(`Unknown command: ${cmd}`));
          printHelp();
          process.exit(1);
      }
    } else {
      // 没有参数，显示主菜单
      printHelp();
      await mainMenu(agent);
    }
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('\n❌ Initialization failed:'), error.message);
    console.error(chalk.gray('\nTroubleshooting:'));
    console.error(chalk.gray('  1. Make sure Ollama is running: ollama serve'));
    console.error(chalk.gray('  2. Check Ollama is accessible: curl http://localhost:11434'));
    console.error(chalk.gray('  3. Verify model is installed: ollama list\n'));
    process.exit(1);
  }
}

// 运行主函数
main().catch(console.error);
