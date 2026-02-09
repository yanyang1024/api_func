"""
测试脚本 - 验证各模块功能
"""
import asyncio
import time
from workflow_mock import workflow_service, WorkflowStatus
from session_manager import session_manager
from async_processor import async_processor


def test_workflow_service():
    """测试工作流服务"""
    print("\n" + "="*60)
    print("测试工作流服务")
    print("="*60)

    # 测试启动工作流
    user_input = "请分析最近一个月的销售数据"
    run_id = workflow_service.start_workflow(user_input)
    print(f"✓ 启动工作流: {run_id}")

    # 测试获取工作流信息
    time.sleep(0.1)  # 等待一小段时间
    info = workflow_service.get_workflow_info(run_id)
    print(f"✓ 工作流状态: {info['status']}")
    print(f"✓ 返回消息: {info['message'][:50]}...")

    # 测试重启工作流
    new_run_id = workflow_service.restart_workflow("所有数据", run_id)
    print(f"✓ 重启工作流: {new_run_id}")

    print("✅ 工作流服务测试通过\n")


def test_session_manager():
    """测试会话管理器"""
    print("\n" + "="*60)
    print("测试会话管理器")
    print("="*60)

    # 创建会话
    session = session_manager.create_session()
    print(f"✓ 创建会话: {session.session_id}")

    # 添加消息
    session.add_message("user", "测试消息1")
    session.add_message("assistant", "测试回复1", visualization_url="http://example.com/chart1")
    print(f"✓ 添加消息: 当前共 {len(session.messages)} 条")

    # 更新run_id
    session_manager.update_session_run_id(session.session_id, "test_run_123")
    print(f"✓ 更新runID: {session.current_run_id}")

    # 获取会话
    retrieved = session_manager.get_session(session.session_id)
    assert retrieved is not None
    print(f"✓ 获取会话: {retrieved.session_id}")

    # 获取所有会话
    all_sessions = session_manager.get_all_sessions()
    print(f"✓ 会话总数: {len(all_sessions)}")

    print("✅ 会话管理器测试通过\n")


async def test_async_processor():
    """测试异步处理器"""
    print("\n" + "="*60)
    print("测试异步处理器")
    print("="*60)

    # 创建回调函数
    callback_called = False

    async def test_callback(session_id, result):
        nonlocal callback_called
        callback_called = True
        print(f"✓ 回调触发: session={session_id}, status={result['status']}")

    # 创建会话
    session = session_manager.create_session()

    # 启动工作流
    run_id = workflow_service.start_workflow("测试异步处理")

    # 提交异步任务
    task_id = async_processor.submit_task(
        session_id=session.session_id,
        run_id=run_id,
        status_callback=test_callback
    )
    print(f"✓ 提交任务: {task_id}")

    # 等待任务完成
    await asyncio.sleep(3)

    # 检查任务状态
    status = async_processor.get_task_status(task_id)
    print(f"✓ 任务完成: {status['completed']}")
    print(f"✓ 活跃任务数: {async_processor.get_active_tasks_count()}")

    assert callback_called, "回调未被调用"
    assert status['completed'], "任务未完成"

    print("✅ 异步处理器测试通过\n")


def test_integration():
    """集成测试"""
    print("\n" + "="*60)
    print("集成测试 - 完整流程")
    print("="*60)

    # 1. 创建会话
    session = session_manager.create_session()
    print(f"1️⃣ 创建会话: {session.session_id}")

    # 2. 用户输入
    user_input = "帮我分析最近一周的用户行为数据"
    session.add_message("user", user_input)
    print(f"2️⃣ 用户输入: {user_input}")

    # 3. 启动工作流
    run_id = workflow_service.start_workflow(user_input)
    session.current_run_id = run_id
    print(f"3️⃣ 启动工作流: {run_id}")

    # 4. 检查状态（模拟异步处理）
    time.sleep(0.1)
    workflow_info = workflow_service.get_workflow_info(run_id)
    print(f"4️⃣ 工作流状态: {workflow_info['status']}")

    # 5. 处理结果
    if workflow_info['status'] == WorkflowStatus.INTERRUPT:
        print("5️⃣ 工作流中断，需要用户补充信息")
        session.waiting_for_input = True
        session.interrupt_context = workflow_info.get('interrupt_info', {})
        session.add_message("assistant", workflow_info['message'])

        # 模拟用户补充输入
        second_input = "重点关注移动端用户"
        session.add_message("user", second_input)
        print(f"6️⃣ 用户补充: {second_input}")

        # 重启工作流
        new_run_id = workflow_service.restart_workflow(second_input, run_id)
        session.current_run_id = new_run_id
        print(f"7️⃣ 重启工作流: {new_run_id}")

        # 获取最终结果
        time.sleep(0.1)
        final_info = workflow_service.get_workflow_info(new_run_id)
        print(f"8️⃣ 最终状态: {final_info['status']}")

        if final_info['status'] == WorkflowStatus.SUCCESS:
            session.add_message(
                "assistant",
                final_info['message'],
                visualization_url=final_info.get('visualization_url')
            )
            print(f"9️⃣ 处理完成")
            print(f"🔟 可视化链接: {final_info.get('visualization_url')}")

    print(f"\n📊 最终会话消息数: {len(session.messages)}")
    for i, msg in enumerate(session.messages, 1):
        print(f"   {i}. [{msg.role}] {msg.content[:50]}...")

    print("\n✅ 集成测试通过\n")


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("🧪 开始测试")
    print("="*60)

    try:
        # 测试各个模块
        test_workflow_service()
        test_session_manager()
        asyncio.run(test_async_processor())
        test_integration()

        print("\n" + "="*60)
        print("🎉 所有测试通过！")
        print("="*60 + "\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
