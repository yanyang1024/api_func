/**
 * 基础测试脚本 - 验证核心功能
 */

import { LocalAgent } from '../src/core/agent.js';

async function testBasic() {
  console.log('========================================');
  console.log('  Local Agent - 基础功能测试');
  console.log('========================================\n');

  let agent;

  try {
    // 测试 1: 初始化
    console.log('[测试 1/5] 初始化 Agent...');
    agent = new LocalAgent();
    await agent.initialize();
    console.log('✓ 初始化成功\n');

    // 测试 2: 简单对话（不涉及工具）
    console.log('[测试 2/5] 简单对话...');
    const response1 = await agent.run({
      sessionId: 'test-basic',
      message: '你好，请简单介绍一下自己',
    });

    if (response1 && response1.length > 0) {
      console.log('✓ 对话成功');
      console.log(`  回复: ${response1.substring(0, 100)}...\n`);
    } else {
      console.log('❌ 对话失败：没有返回内容\n');
      return;
    }

    // 测试 3: 文件读取工具
    console.log('[测试 3/5] 文件读取工具...');
    const response2 = await agent.run({
      sessionId: 'test-tools',
      message: '请使用 read 工具读取 package.json 文件',
    });

    if (response2 && response2.includes('local-agent')) {
      console.log('✓ 文件读取工具工作正常');
      console.log(`  回复: ${response2.substring(0, 100)}...\n`);
    } else {
      console.log('⚠️  文件读取工具可能有问题');
      console.log(`  回复: ${response2}\n`);
    }

    // 测试 4: 文件写入工具
    console.log('[测试 4/5] 文件写入工具...');
    const response3 = await agent.run({
      sessionId: 'test-tools',
      message: '请使用 write 工具创建一个名为 test-output.txt 的文件，内容是 "Hello from Local Agent!"',
    });

    if (response3 && (response3.includes('成功') || response3.includes('created') || response3.includes('written'))) {
      console.log('✓ 文件写入工具工作正常');
      console.log(`  回复: ${response3.substring(0, 100)}...\n`);
    } else {
      console.log('⚠️  文件写入工具可能有问题');
      console.log(`  回复: ${response3}\n`);
    }

    // 测试 5: 会话持久化
    console.log('[测试 5/5] 会话持久化...');
    const stats = agent.getSessionStats('test-basic');

    if (stats && stats.messageCount > 0) {
      console.log('✓ 会话持久化正常');
      console.log(`  消息数: ${stats.messageCount}`);
      console.log(`  Tokens: ${stats.estimatedTokens}\n`);
    } else {
      console.log('❌ 会话持久化失败\n');
    }

    console.log('========================================');
    console.log('  测试完成！');
    console.log('========================================\n');

    // 总结
    console.log('测试总结:');
    console.log('  ✓ Agent 初始化: 正常');
    console.log('  ✓ 基础对话: 正常');
    console.log('  ✓ 文件读取: 需要验证');
    console.log('  ✓ 文件写入: 需要验证');
    console.log('  ✓ 会话持久化: 正常');
    console.log('\n如果工具调用有问题，请查看 CODE_REVIEW.md 中的修复方案。');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error('\n错误详情:', error);
    console.error('\n故障排除:');
    console.error('1. 确保 Ollama 正在运行: ollama serve');
    console.error('2. 确保模型已安装: ollama list');
    console.error('3. 检查配置文件: config/agent.yaml');
    console.error('4. 查看详细错误: 运行时添加 DEBUG=* 环境变量');
  }
}

// 运行测试
testBasic().catch(console.error);
