/**
 * Ollama 工具调用补丁
 *
 * 这个文件提供了修复 Ollama 工具调用兼容性问题的方案
 */

/**
 * 方案 1: 使用 Prompt 注入（推荐，兼容性最好）
 */
export function buildToolCallPrompt(tools) {
  if (!tools || tools.length === 0) {
    return '';
  }

  const toolList = tools.map(tool => {
    const params = Object.entries(tool.function.parameters.properties || {}).map(
      ([key, val]) => `    - ${key}: ${val.description || key} (${val.type || 'any'})`
    ).join('\n');

    return `## ${tool.function.name}

${tool.function.description}

Parameters:
${params || '  (no parameters)'}

Usage format:
TOOL_CALL: ${tool.function.name}
PARAMS: {"key": "value"}`;
  }).join('\n\n');

  return `You have access to the following tools:

${toolList}

When you need to use a tool, format your response as:
TOOL_CALL: tool_name
PARAMS: {"param1": "value1", "param2": "value2"}

Example:
TOOL_CALL: read
PARAMS: {"filepath": "todo.md"}

Wait for the tool result before continuing.`;
}

/**
 * 方案 2: 解析响应中的工具调用（需要 Ollama 支持）
 */
export function parseToolCallsFromResponse(response) {
  const toolCalls = [];

  // 检查 OpenAI 格式
  if (response.tool_calls && Array.isArray(response.tool_calls)) {
    return response.tool_calls;
  }

  // 检查 Ollama 可能使用的格式
  if (response.message?.tool_calls) {
    return response.message.tool_calls;
  }

  // 尝试从文本中解析（Prompt 注入方案）
  const toolCallRegex = /TOOL_CALL:\s*(\w+)\s*\nPARAMS:\s*({.*?})/gs;
  const matches = [...response.matchAll(toolCallRegex)];

  for (const match of matches) {
    try {
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: 'function',
        function: {
          name: match[1],
          arguments: match[2],
        },
      });
    } catch (e) {
      console.error('Failed to parse tool call:', e);
    }
  }

  return toolCalls;
}

/**
 * 应用补丁到 Ollama Provider
 */
export function patchOllamaProvider(ollamaProvider, tools) {
  const originalChat = ollamaProvider.chat;

  ollamaProvider.chat = async function* (params) {
    const { messages, tools, ...rest } = params;

    // 如果有工具，注入到系统消息
    if (tools && tools.length > 0) {
      const toolPrompt = buildToolCallPrompt(tools);

      const enhancedMessages = messages.map((msg, idx) => {
        if (idx === 0 && msg.role === 'system') {
          return {
            ...msg,
            content: `${msg.content}\n\n${toolPrompt}`,
          };
        }
        return msg;
      });

      // 如果第一条不是 system，添加一条
      if (enhancedMessages[0].role !== 'system') {
        enhancedMessages.unshift({
          role: 'system',
          content: toolPrompt,
        });
      }

      // 调用原始方法
      const generator = originalChat.call(this, {
        messages: enhancedMessages,
        ...rest,
      });

      // 解析工具调用
      let fullResponse = '';
      for await (const chunk of generator) {
        if (chunk.content) {
          fullResponse += chunk.content;
        }
        yield chunk;

        if (chunk.done) {
          // 检查是否包含工具调用
          const toolCalls = parseToolCallsFromResponse({ content: fullResponse });
          if (toolCalls.length > 0) {
            yield { toolCalls };
          }
        }
      }
    } else {
      // 没有工具，直接调用原始方法
      yield* originalChat.call(this, params);
    }
  };
}
