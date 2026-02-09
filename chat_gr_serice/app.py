"""
Gradio对话Web应用 - 修复版
"""
import gradio as gr
from typing import List, Tuple, Dict, Any
import asyncio

from workflow_mock import workflow_service, WorkflowStatus
from session_manager import session_manager, Session
from async_processor import async_processor


# ============================================
# 核心业务逻辑函数
# ============================================

async def workflow_callback(session_id: str, result: Dict[str, Any]):
    """工作流状态回调"""
    session = session_manager.get_session(session_id)
    if not session:
        return

    # 根据状态添加消息
    if result["status"] == WorkflowStatus.INTERRUPT:
        session.waiting_for_input = True
        session.add_message("assistant", result["message"])
    elif result["status"] == WorkflowStatus.SUCCESS:
        session.waiting_for_input = False
        session.add_message("assistant", result["message"], result.get("visualization_url"))
    elif result["status"] == WorkflowStatus.FAIL:
        session.waiting_for_input = False
        session.add_message("assistant", result["message"])


def process_user_input(user_message: str, history: List) -> Tuple[List, str, str, str, str]:
    """处理用户输入"""
    if not user_message or not user_message.strip():
        return history, "", "请输入有效消息", "暂无参考信息", "**状态**: 未启动"

    # 获取或创建会话
    sessions = session_manager.get_all_sessions()
    session = sessions[-1] if sessions else session_manager.create_session()

    # 添加用户消息
    session.add_message("user", user_message)

    # 判断是新对话还是中断响应
    if session.waiting_for_input and session.current_run_id:
        # 重启工作流
        run_id = workflow_service.restart_workflow(user_message, session.current_run_id)
        session.waiting_for_input = False
    else:
        # 启动新工作流
        run_id = workflow_service.start_workflow(user_message)

    session.current_run_id = run_id

    # 提交异步任务
    async_processor.submit_task(
        session_id=session.session_id,
        run_id=run_id,
        status_callback=workflow_callback
    )

    # 返回更新后的对话历史
    return (
        format_history(session.messages),
        "",
        "**系统状态**: 正在处理，请稍后点击刷新按钮...",
        "等待工作流完成",
        f"**状态**: 处理中\n\n**RunID**: `{run_id}`"
    )


def format_history(messages: List) -> List[Dict[str, str]]:
    """
    格式化消息历史为Gradio 4.0+格式
    返回: [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
    """
    formatted = []
    for msg in messages:
        formatted.append({
            "role": msg.role,
            "content": msg.content
        })
    return formatted


def get_reference_info(session: Session) -> str:
    """获取参考信息（可视化链接）"""
    for msg in reversed(session.messages):
        if msg.role == "assistant" and msg.visualization_url:
            return f"**可视化链接**: [{msg.visualization_url}]({msg.visualization_url})"
    return "暂无参考信息"


def refresh_ui() -> Tuple[List, str, str, str, str]:
    """刷新UI"""
    sessions = session_manager.get_all_sessions()
    if not sessions:
        return [], "**系统状态**: 无会话", "暂无参考信息", "**会话**: 未创建", "**状态**: 未启动"

    session = sessions[-1]
    return (
        format_history(session.messages),
        f"**系统状态**: {'等待输入' if not session.waiting_for_input else '需补充信息'}",
        get_reference_info(session),
        f"**会话ID**: `{session.session_id}`\n\n**消息数**: {len(session.messages)}",
        f"**状态**: {f'处理中 `{session.current_run_id}`' if session.current_run_id else '未启动'}"
    )


def clear_chat() -> Tuple[List, str, str, str, str]:
    """清空对话"""
    session = session_manager.create_session()
    return (
        [],  # 空列表而不是欢迎消息
        "**系统状态**: 已清空",
        "暂无参考信息",
        f"**会话ID**: `{session.session_id}`",
        "**状态**: 就绪"
    )


def create_new_session() -> Tuple[List, str, str]:
    """创建新会话"""
    session = session_manager.create_session()
    # 返回初始欢迎消息
    return (
        [{"role": "assistant", "content": "👋 您好！我是智能助手，请告诉我您需要什么帮助？"}],
        "**系统状态**: 会话已创建",
        f"**会话ID**: `{session.session_id}`\n\n**状态**: 活跃"
    )


# ============================================
# Gradio界面构建
# ============================================

def build_ui():
    """构建Gradio界面"""
    with gr.Blocks(
        title="智能对话工作流系统",
        theme=gr.themes.Soft()
    ) as app:

        # 标题
        gr.Markdown("# 🤖 智能对话工作流系统")
        gr.Markdown("### 支持异步工作流处理的智能对话系统")

        with gr.Row():
            # 左侧：对话区
            with gr.Column(scale=3):
                chatbot = gr.Chatbot(
                    label="对话历史",
                    height=500,
                    show_copy_button=True,
                    bubble_full_width=False
                )

                with gr.Row():
                    user_input = gr.Textbox(
                        label="您的输入",
                        placeholder="请输入您的问题...",
                        scale=4,
                        lines=2
                    )
                    submit_btn = gr.Button("发送", variant="primary", scale=1)

                with gr.Row():
                    clear_btn = gr.Button("清空对话", variant="secondary")
                    new_session_btn = gr.Button("新建会话", variant="secondary")
                    refresh_btn = gr.Button("🔄 刷新状态", variant="secondary")

                status_info = gr.Markdown("**系统状态**: 就绪")

            # 右侧：信息面板
            with gr.Column(scale=2):
                gr.Markdown("### 📊 参考信息")
                reference_info = gr.Markdown("暂无参考信息")

                gr.Markdown("### 📋 会话信息")
                session_info = gr.Markdown("**会话ID**: 未创建")

                gr.Markdown("### ⚙️ 工作流状态")
                workflow_status = gr.Markdown("**状态**: 未启动")

        # 绑定事件
        submit_btn.click(
            fn=process_user_input,
            inputs=[user_input, chatbot],
            outputs=[chatbot, user_input, status_info, reference_info, workflow_status]
        )

        user_input.submit(
            fn=process_user_input,
            inputs=[user_input, chatbot],
            outputs=[chatbot, user_input, status_info, reference_info, workflow_status]
        )

        clear_btn.click(
            fn=clear_chat,
            outputs=[chatbot, status_info, reference_info, session_info, workflow_status]
        )

        new_session_btn.click(
            fn=create_new_session,
            outputs=[chatbot, status_info, session_info]
        )

        refresh_btn.click(
            fn=refresh_ui,
            outputs=[chatbot, status_info, reference_info, session_info, workflow_status]
        )

        # 页面加载时创建会话（在Blocks上下文内）
        app.load(
            fn=create_new_session,
            outputs=[chatbot, status_info, session_info]
        )

    return app


# ============================================
# 应用启动
# ============================================

def main():
    """主函数"""
    app = build_ui()
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True
    )


if __name__ == "__main__":
    main()
