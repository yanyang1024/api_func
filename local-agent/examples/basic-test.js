/**
 * 基础测试示例
 *
 * ==================== 教学说明 ====================
 *
 * 这个文件展示了如何使用 Local Agent API：
 * 1. 初始化 Agent
 * 2. 发送消息
 * 3. 获取响应
 */

import { LocalAgent } from '../src/core/agent.js';

async function basicTest() {
  console.log('========================================');
  console.log('  Local Agent - Basic Test');
  console.log('========================================\n');

  // 1. 初始化 Agent
  console.log('[1/3] Initializing agent...');
  const agent = new LocalAgent();
  await agent.initialize();
  console.log('✓ Agent initialized\n');

  // 2. 发送消息
  console.log('[2/3] Sending message...');
  const message = 'Hello! Can you help me create a TODO list?';

  console.log(`User: ${message}\n`);

  const response = await agent.run({
    sessionId: 'test-session',
    message,
  });

  console.log(`\nAgent: ${response}\n`);

  // 3. 查看会话状态
  console.log('[3/3] Session stats:');
  const stats = agent.getSessionStats('test-session');
  console.log(`  Messages: ${stats.messageCount}`);
  console.log(`  Tokens: ${stats.estimatedTokens}`);
  console.log(`  Usage: ${(stats.usage * 100).toFixed(1)}%\n`);

  console.log('========================================');
  console.log('  Test Complete!');
  console.log('========================================\n');
}

// 运行测试
basicTest().catch(console.error);
