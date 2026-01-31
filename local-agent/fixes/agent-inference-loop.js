/**
 * Agent 推理循环补丁
 *
 * 修复工具调用中的问题
 */

/**
 * 修复后的推理循环
 * 替换 src/core/agent.js 中的 runInferenceLoop 方法
 */
export async function runInferenceLoopFixed(params) {
  const { sessionId, message, thinking, images } = params;

  // 1. 获取或创建会话
  let session = this.sessions.get(sessionId);
  if (!session) {
    const sessionFile = `./sessions/${sessionId}.jsonl`;
    session = new SessionManager({
      sessionId,
      storePath: sessionFile,
      contextWindow: this.config.agent.model.contextWindow,
    });
    await session.load();
    this.sessions.set(sessionId, session);
  }

  // 2. 检查上下文窗口
  const contextCheck = session.checkContextWindow();
  if (contextCheck.exceeded) {
    console.log(`[Agent] Context window exceeded (${(contextCheck.usage * 100).toFixed(1)}%), compacting...`);

    // 先构建系统提示词
    const tempSystemPrompt = await this.contextBuilder.build({
      mode: 'full',
      toolNames: this.tools.getAvailableNames(),
      thinkingLevel: thinking,
    });

    await session.compact({
      provider: this.provider,
      systemPrompt: tempSystemPrompt, // ✅ 使用实际提示词
      recentCount: 20,
    });
  }

  // 3. 构建系统提示词
  const systemPrompt = await this.contextBuilder.build({
    mode: 'full',
    toolNames: this.tools.getAvailableNames(),
    thinkingLevel: thinking,
  });

  // 4. 添加用户消息
  await session.addMessage({
    role: 'user',
    content: message,
    images,
  });

  // 5-7. 推理循环
  const maxIterations = 10;
  let iteration = 0;
  let finalResponse = '';

  while (iteration < maxIterations) {
    iteration++;

    // 获取消息历史
    const messages = await session.getMessages();

    console.log(`[Agent] Iteration ${iteration}: ${messages.length} messages, ${session.estimatedTokens} tokens`);

    // 调用 LLM
    let fullContent = '';
    let toolCalls = [];

    try {
      for await (const chunk of this.provider.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools: this.tools.toLLMFormat(),
        stream: true,
      })) {
        if (chunk.content) {
          fullContent += chunk.content;
          finalResponse = fullContent;
          // 可选：显示进度
          if (this.config.agent?.showProgress !== false) {
            process.stdout.write('.');
          }
        }

        if (chunk.toolCalls) {
          toolCalls.push(...chunk.toolCalls);
        }

        if (chunk.done) {
          if (this.config.agent?.showProgress !== false) {
            process.stdout.write('\n');
          }
          break;
        }
      }
    } catch (error) {
      console.error(`[Agent] LLM error: ${error}`);
      throw error;
    }

    // 添加助手响应
    await session.addMessage({
      role: 'assistant',
      content: fullContent,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    });

    // 如果没有工具调用，返回响应
    if (toolCalls.length === 0) {
      console.log(`[Agent] Final response: ${fullContent.substring(0, 100)}...`);
      return fullContent;
    }

    // 执行工具调用
    console.log(`[Agent] Executing ${toolCalls.length} tool(s)...`);

    for (const call of toolCalls) {
      // ✅ 改进的工具名提取
      const toolName = call.function?.name || call.name;

      // ✅ 改进的参数提取
      let toolArgs;
      try {
        if (typeof call.function?.arguments === 'string') {
          toolArgs = JSON.parse(call.function.arguments);
        } else if (call.function?.arguments) {
          toolArgs = call.function.arguments;
        } else if (call.arguments) {
          toolArgs = call.arguments;
        } else {
          console.warn(`[Agent] Tool ${toolName} has no arguments, using empty object`);
          toolArgs = {};
        }
      } catch (error) {
        console.error(`[Agent] Failed to parse arguments for ${toolName}:`, error);
        toolArgs = {};
      }

      // ✅ 生成 toolCallId
      const toolCallId = call.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(`[Agent]   - ${toolName} (id: ${toolCallId})`);

      try {
        const result = await this.tools.execute(toolName, toolArgs);

        // 添加工具结果
        await session.addMessage({
          role: 'tool',
          content: result,
          toolCallId: toolCallId, // ✅ 确保有 ID
        });
      } catch (error) {
        // 添加错误结果
        await session.addMessage({
          role: 'tool',
          content: `Error: ${error.message}`,
          toolCallId: toolCallId,
        });
      }
    }

    // 继续循环，让 LLM 基于工具结果生成最终回复
  }

  throw new Error('Agent exceeded maximum iterations');
}
