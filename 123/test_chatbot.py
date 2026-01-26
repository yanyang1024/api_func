#!/usr/bin/env python3
"""
简单测试脚本 - 验证工作流对话机器人的基本功能
"""

from workflow_chatbot import (
    start_workflow,
    get_workflow_info,
    resume_workflow,
    TOOL_FUNCTIONS,
    process_tool_results,
    workflow_manager
)
from PIL import Image
import json

def test_mock_functions():
    """测试模拟函数"""
    print("=" * 60)
    print("测试 1: 模拟函数测试")
    print("=" * 60)

    # 测试启动工作流
    print("\n1.1 测试启动工作流")
    user_input = "帮我对比数据集A和B"
    run_id = start_workflow(user_input)
    print(f"✅ 启动工作流成功，runID: {run_id}")

    # 测试获取工作流信息
    print("\n1.2 测试获取工作流信息")
    workflow_info = get_workflow_info(run_id)
    print(f"✅ 工作流信息: {json.dumps(workflow_info, indent=2, ensure_ascii=False)}")

    # 测试恢复工作流
    print("\n1.3 测试恢复工作流")
    new_run_id = resume_workflow("补充信息：使用t检验方法", run_id)
    print(f"✅ 恢复工作流成功，runID: {new_run_id}")

def test_tool_functions():
    """测试工具函数"""
    print("\n" + "=" * 60)
    print("测试 2: 工具函数测试")
    print("=" * 60)

    test_params = {
        "dataset1": "A",
        "dataset2": "B",
        "method": "t-test"
    }

    for tool_name, tool_func in TOOL_FUNCTIONS.items():
        print(f"\n2.{list(TOOL_FUNCTIONS.keys()).index(tool_name) + 1} 测试工具: {tool_name}")
        try:
            result = tool_func(test_params)
            print(f"✅ 工具执行成功")
            print(f"   消息: {result.get('message')}")
            print(f"   文件数: {len(result.get('result', {}).get('files', []))}")
            print(f"   图片数: {len(result.get('result', {}).get('images', []))}")

            # 测试结果处理
            summary, display_items = process_tool_results(result, "test_run_id")
            print(f"   摘要长度: {len(summary)} 字符")
            print(f"   展示项数: {len(display_items)}")

        except Exception as e:
            print(f"❌ 工具执行失败: {e}")

def test_workflow_manager():
    """测试工作流状态管理"""
    print("\n" + "=" * 60)
    print("测试 3: 状态管理器测试")
    print("=" * 60)

    # 清空状态
    workflow_manager.active_workflows.clear()
    workflow_manager.conversation_history.clear()

    # 测试保存状态
    print("\n3.1 测试保存工作流状态")
    test_run_id = "test_run_001"
    test_state = {
        "status": "interrupted",
        "message": "需要更多信息",
        "data": {}
    }
    workflow_manager.save_workflow_state(test_run_id, test_state)
    print(f"✅ 保存状态成功")

    # 测试获取状态
    print("\n3.2 测试获取工作流状态")
    retrieved_state = workflow_manager.get_workflow_state(test_run_id)
    print(f"✅ 获取状态成功: {json.dumps(retrieved_state, indent=2, ensure_ascii=False)}")

    # 测试添加历史
    print("\n3.3 测试添加对话历史")
    workflow_manager.add_to_history(test_run_id, "user", "测试用户输入", {"test": True})
    workflow_manager.add_to_history(test_run_id, "assistant", "测试助手回复")
    print(f"✅ 添加历史成功")

    # 测试获取历史
    print("\n3.4 测试获取对话历史")
    history = workflow_manager.get_history(test_run_id)
    print(f"✅ 获取历史成功，条目数: {len(history)}")
    for idx, item in enumerate(history, 1):
        print(f"   {idx}. [{item['role']}]: {item['content'][:50]}...")

def test_process_user_message():
    """测试完整的消息处理流程"""
    print("\n" + "=" * 60)
    print("测试 4: 完整对话流程测试")
    print("=" * 60)

    # 清空状态
    workflow_manager.active_workflows.clear()
    workflow_manager.conversation_history.clear()

    print("\n4.1 第一轮对话：启动工作流")
    history = []
    user_input_1 = "帮我对比分析数据集A和B"
    updated_history, display_items = process_user_message(user_input_1, history)
    print(f"✅ 处理完成")
    print(f"   对话轮次: {len(updated_history)}")
    if updated_history:
        print(f"   助手回复: {updated_history[0][1][:100]}...")

    print("\n4.2 第二轮对话：恢复工作流（如果有中断）")
    if workflow_manager.active_workflows:
        user_input_2 = "请使用t检验方法进行对比"
        updated_history, display_items = process_user_message(user_input_2, updated_history)
        print(f"✅ 处理完成")
        print(f"   对话轮次: {len(updated_history)}")
        if len(updated_history) > 1:
            print(f"   助手回复: {updated_history[1][1][:100]}...")

    print("\n4.3 状态摘要")
    print(f"   活跃工作流数: {len(workflow_manager.active_workflows)}")
    print(f"   对话历史数: {len(workflow_manager.conversation_history)}")

def main():
    """运行所有测试"""
    print("\n🧪 开始测试工作流对话机器人\n")

    try:
        test_mock_functions()
        test_tool_functions()
        test_workflow_manager()
        test_process_user_message()

        print("\n" + "=" * 60)
        print("✅ 所有测试完成！")
        print("=" * 60)
        print("\n💡 提示：")
        print("   1. 这些是模拟函数，请替换为你的实际实现")
        print("   2. 运行 'python workflow_chatbot.py' 启动 Gradio 界面")
        print("   3. 访问 http://localhost:7860 使用对话界面\n")

    except Exception as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
