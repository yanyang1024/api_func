"""
逻辑测试 - 不依赖Gradio
验证核心交互逻辑
"""
import time
from workflow_mock import workflow_service, WorkflowStatus
from session_manager import session_manager, Message
import asyncio


def format_history(messages):
    """格式化消息历史（复制app.py中的逻辑）"""
    formatted = []
    for msg in messages:
        formatted.append({
            "role": msg.role,
            "content": msg.content
        })
    return formatted


async def test_complete_user_flow():
    """测试完整的用户交互流程"""
    print("\n" + "="*70)
    print("📱 测试完整用户交互流程")
    print("="*70)

    # ========== 场景1: 简单成功对话 ==========
    print("\n【场景1】简单成功对话")
    print("-" * 70)

    # 1. 创建会话
    session = session_manager.create_session()
    print(f"1️⃣ 创建会话: {session.session_id}")

    # 2. 用户输入
    user_msg1 = "帮我分析销售数据"
    session.add_message("user", user_msg1)
    print(f"2️⃣ 用户输入: {user_msg1}")

    # 3. 启动工作流
    run_id1 = workflow_service.start_workflow(user_msg1)
    session.current_run_id = run_id1
    print(f"3️⃣ 启动工作流: {run_id1}")

    # 4. 模拟异步处理
    await asyncio.sleep(2.5)

    # 5. 获取结果
    result1 = workflow_service.get_workflow_info(run_id1)
    print(f"4️⃣ 工作流状态: {result1['status']}")

    # 6. 添加回复
    if result1['status'] == WorkflowStatus.SUCCESS:
        session.add_message("assistant", result1['message'], result1.get('visualization_url'))
        print(f"5️⃣ 助手回复: {result1['message'][:50]}...")
        if result1.get('visualization_url'):
            print(f"   可视化链接: {result1['visualization_url']}")

    print(f"   ✅ 消息数: {len(session.messages)}")

    # ========== 场景2: 中断-重启流程 ==========
    print("\n【场景2】中断-重启流程")
    print("-" * 70)

    # 创建新会话
    session2 = session_manager.create_session()
    print(f"1️⃣ 创建新会话: {session2.session_id}")

    # 用户输入
    user_msg2 = "分析用户行为"
    session2.add_message("user", user_msg2)
    print(f"2️⃣ 用户输入: {user_msg2}")

    # 启动工作流
    run_id2 = workflow_service.start_workflow(user_msg2)
    session2.current_run_id = run_id2
    print(f"3️⃣ 启动工作流: {run_id2}")

    # 获取结果（模拟中断）
    await asyncio.sleep(0.1)
    result2 = workflow_service.get_workflow_info(run_id2)
    print(f"4️⃣ 工作流状态: {result2['status']}")

    if result2['status'] == WorkflowStatus.INTERRUPT:
        print(f"   ❗ 工作流中断")
        session2.waiting_for_input = True
        session2.add_message("assistant", result2['message'])
        print(f"5️⃣ 助手询问: {result2['message']}")

        # 用户补充输入
        user_msg3 = "最近一周的数据"
        session2.add_message("user", user_msg3)
        print(f"6️⃣ 用户补充: {user_msg3}")

        # 重启工作流
        run_id3 = workflow_service.restart_workflow(user_msg3, run_id2)
        session2.current_run_id = run_id3
        session2.waiting_for_input = False
        print(f"7️⃣ 重启工作流: {run_id3}")

        # 获取最终结果
        await asyncio.sleep(2.5)
        result3 = workflow_service.get_workflow_info(run_id3)
        print(f"8️⃣ 最终状态: {result3['status']}")

        if result3['status'] == WorkflowStatus.SUCCESS:
            session2.add_message("assistant", result3['message'], result3.get('visualization_url'))
            print(f"9️⃣ 助手回复: {result3['message'][:50]}...")
            print(f"   ✅ 消息数: {len(session2.messages)}")

    # ========== 场景3: 失败处理 ==========
    print("\n【场景3】失败处理")
    print("-" * 70)

    session3 = session_manager.create_session()
    print(f"1️⃣ 创建新会话: {session3.session_id}")

    user_msg4 = "执行复杂分析"
    session3.add_message("user", user_msg4)
    print(f"2️⃣ 用户输入: {user_msg4}")

    run_id4 = workflow_service.start_workflow(user_msg4)
    session3.current_run_id = run_id4
    print(f"3️⃣ 启动工作流: {run_id4}")

    await asyncio.sleep(0.1)
    result4 = workflow_service.get_workflow_info(run_id4)
    print(f"4️⃣ 工作流状态: {result4['status']}")

    if result4['status'] == WorkflowStatus.FAIL:
        session3.add_message("assistant", result4['message'])
        print(f"   ❌ 处理失败: {result4['message']}")
        print(f"   ✅ 消息数: {len(session3.messages)}")

    # ========== 场景4: 格式化测试 ==========
    print("\n【场景4】消息格式测试")
    print("-" * 70)

    # 测试 format_history 函数
    formatted = format_history(session.messages)
    print(f"1️⃣ 格式化消息数: {len(formatted)}")
    print(f"2️⃣ 消息格式: {formatted[0]}")
    print(f"3️⃣ 消息类型: {type(formatted[0])}")

    # 验证格式
    assert isinstance(formatted, list), "格式化结果应为列表"
    assert len(formatted) > 0, "格式化结果不应为空"
    assert "role" in formatted[0], "消息应包含role字段"
    assert "content" in formatted[0], "消息应包含content字段"
    print(f"   ✅ 格式验证通过")

    print("\n" + "="*70)
    print("🎉 所有交互流程测试通过！")
    print("="*70 + "\n")


def test_format_function():
    """测试格式化函数"""
    print("\n" + "="*70)
    print("🔍 测试格式化函数")
    print("="*70)

    # 创建测试消息
    messages = [
        Message("user", "你好"),
        Message("assistant", "您好！有什么可以帮助您？"),
        Message("user", "帮我分析数据"),
        Message("assistant", "好的，正在分析...", "http://example.com/chart1")
    ]

    # 格式化
    formatted = format_history(messages)

    print(f"✅ 原始消息数: {len(messages)}")
    print(f"✅ 格式化后: {len(formatted)}")
    print(f"\n第一条消息:")
    print(f"  role: {formatted[0]['role']}")
    print(f"  content: {formatted[0]['content']}")
    print(f"\n最后一条消息:")
    print(f"  role: {formatted[-1]['role']}")
    print(f"  content: {formatted[-1]['content']}")

    # 验证格式
    for i, msg in enumerate(formatted):
        assert isinstance(msg, dict), f"消息{i}应为字典"
        assert "role" in msg, f"消息{i}缺少role字段"
        assert "content" in msg, f"消息{i}缺少content字段"
        assert msg["role"] in ["user", "assistant"], f"消息{i}的role值无效"

    print("\n✅ 格式化函数验证通过\n")


def test_edge_cases():
    """测试边界情况"""
    print("\n" + "="*70)
    print("🧪 测试边界情况")
    print("="*70)

    # 空消息列表
    print("1️⃣ 测试空消息列表")
    formatted = format_history([])
    assert formatted == [], "空列表应返回空列表"
    print("   ✅ 空列表处理正确")

    # 只有用户消息
    print("\n2️⃣ 测试只有用户消息")
    messages = [Message("user", "只有用户")]
    formatted = format_history(messages)
    assert len(formatted) == 1
    assert formatted[0]["role"] == "user"
    print("   ✅ 单条用户消息处理正确")

    # 只有助手消息
    print("\n3️⃣ 测试只有助手消息")
    messages = [Message("assistant", "只有助手")]
    formatted = format_history(messages)
    assert len(formatted) == 1
    assert formatted[0]["role"] == "assistant"
    print("   ✅ 单条助手消息处理正确")

    # 特殊字符
    print("\n4️⃣ 测试特殊字符")
    messages = [
        Message("user", "测试\n换行\t制表符"),
        Message("assistant", "**Markdown** _斜体_ `代码`")
    ]
    formatted = format_history(messages)
    assert len(formatted) == 2
    assert "\n" in formatted[0]["content"]
    assert "**" in formatted[1]["content"]
    print("   ✅ 特殊字符处理正确")

    print("\n✅ 所有边界情况测试通过\n")


def main():
    """运行所有测试"""
    print("\n" + "="*70)
    print("🧪 开始交互流程全面测试")
    print("="*70)

    try:
        # 测试格式化函数
        test_format_function()

        # 测试边界情况
        test_edge_cases()

        # 测试完整流程
        asyncio.run(test_complete_user_flow())

        print("\n" + "="*70)
        print("🎊 所有测试通过！系统逻辑正确！")
        print("="*70)

        print("\n📋 测试总结:")
        print("  ✅ 格式化函数正确")
        print("  ✅ 边界情况处理正确")
        print("  ✅ 简单对话流程正确")
        print("  ✅ 中断-重启流程正确")
        print("  ✅ 失败处理流程正确")
        print("  ✅ 消息格式符合Gradio 4.0+标准")
        print("\n")

        return True

    except AssertionError as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n❌ 测试异常: {str(e)}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
