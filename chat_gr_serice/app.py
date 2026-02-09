"""
Gradio对话Web应用
主应用程序
"""
import gradio as gr
from typing import List, Tuple, Optional, Dict, Any
import time

from workflow_mock import workflow_service, WorkflowStatus
from session_manager import session_manager, Session
from async_processor import async_processor


class ChatApplication:
    """对话应用主类"""

    def __init__(self):
        self.app = None
        self._build_interface()

    def _build_interface(self):
        """构建Gradio界面"""
        with gr.Blocks(
            title="智能对话工作流系统",
            theme=gr.themes.Soft(),
            css=self._get_custom_css()
        ) as self.app:
            gr.Markdown("# 🤖 智能对话工作流系统")
            gr.Markdown("支持异步工作流处理的智能对话系统")

            with gr.Row():
                with gr.Column(scale=3):
                    # 对话历史区域
                    self.chatbot = gr.Chatbot(
                        label="对话历史",
                        height=500,
                        show_copy_button=True,
                        bubble_full_width=False,
                        avatar_images=(
                            "👤",  # 用户头像
                            "🤖"   # 助手头像
                        )
                    )

                    # 输入区域
                    with gr.Row():
                        self.user_input = gr.Textbox(
                            label="您的输入",
                            placeholder="请输入您的问题...",
                            scale=4,
                            lines=2
                        )
                        self.submit_btn = gr.Button("发送", variant="primary", scale=1)

                    # 控制按钮
                    with gr.Row():
                        self.clear_btn = gr.Button("清空对话", variant="secondary")
                        self.new_session_btn = gr.Button("新建会话", variant="secondary")
                        self.refresh_btn = gr.Button("🔄 刷新状态", variant="secondary")

                    # 状态显示
                    self.status_info = gr.Markdown("**系统状态**: 就绪")

                with gr.Column(scale=2):
                    # 参考信息区域
                    gr.Markdown("### 📊 参考信息")
                    self.reference_info = gr.Markdown(
                        "暂无参考信息",
                        height=200
                    )

                    # 会话信息
                    gr.Markdown("### 📋 会话信息")
                    self.session_info = gr.Markdown(
                        "**会话ID**: 未创建\n\n**状态**: 等待开始",
                        height=150
                    )

                    # 工作流状态
                    gr.Markdown("### ⚙️ 工作流状态")
                    self.workflow_status = gr.Markdown(
                        "**状态**: 未启动",
                        height=100
                    )

            # 绑定事件
            self.submit_btn.click(
                fn=self.handle_user_input,
                inputs=[self.user_input],
                outputs=[self.chatbot, self.user_input, self.status_info,
                        self.reference_info, self.session_info, self.workflow_status]
            )

            self.user_input.submit(
                fn=self.handle_user_input,
                inputs=[self.user_input],
                outputs=[self.chatbot, self.user_input, self.status_info,
                        self.reference_info, self.session_info, self.workflow_status]
            )

            self.clear_btn.click(
                fn=self.clear_chat,
                outputs=[self.chatbot, self.status_info, self.reference_info,
                        self.session_info, self.workflow_status]
            )

            self.new_session_btn.click(
                fn=self.create_new_session,
                outputs=[self.chatbot, self.status_info, self.session_info]
            )

            self.refresh_btn.click(
                fn=self.refresh_ui,
                outputs=[self.chatbot, self.status_info, self.reference_info,
                        self.session_info, self.workflow_status]
            )

        # 应用启动时创建初始会话
        self.app.load(
            fn=self.create_new_session,
            outputs=[self.chatbot, self.status_info, self.session_info]
        )

    def _get_custom_css(self) -> str:
        """自定义CSS样式"""
        return """
        .chatbot-container {
            font-family: 'Microsoft YaHei', Arial, sans-serif;
        }
        .message.user {
            background-color: #e3f2fd;
        }
        .message.assistant {
            background-color: #f5f5f5;
        }
        """

    def create_new_session(self) -> Tuple[List, str, str]:
        """创建新会话"""
        session = session_manager.create_session()
        session_info_text = f"**会话ID**: `{session.session_id}`\n\n**状态**: 活跃\n\n**创建时间**: {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}"

        welcome_message = "👋 您好！我是智能助手，可以帮您处理各种数据分析任务。请告诉我您需要什么帮助？"

        return (
            [[None, welcome_message]],
            "**系统状态**: 会话已创建",
            session_info_text
        )

    def clear_chat(self) -> Tuple[List, str, str, str, str]:
        """清空对话"""
        session = session_manager.create_session()
        session_info_text = f"**会话ID**: `{session.session_id}`\n\n**状态**: 活跃\n\n**创建时间**: {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}"

        return (
            [],
            "**系统状态**: 对话已清空",
            "暂无参考信息",
            session_info_text,
            "**状态**: 未启动"
        )

    def refresh_ui(self) -> Tuple[List, str, str, str, str, str]:
        """刷新UI状态"""
        # 获取当前会话
        sessions = session_manager.get_all_sessions()
        if not sessions:
            return (
                [],
                "**系统状态**: 无活跃会话",
                "暂无参考信息",
                "**会话ID**: 未创建\n\n**状态**: 等待开始",
                "**状态**: 未启动"
            )

        session = sessions[-1]

        # 格式化对话历史
        chat_history = self._format_chatbot_messages(session.messages)

        # 获取参考信息
        reference_info = self.get_reference_info(session)

        # 更新会话信息
        session_status = "等待输入" if not session.waiting_for_input else "等待补充信息"
        session_info_text = f"**会话ID**: `{session.session_id}`\n\n**状态**: {session_status}\n\n**消息数**: {len(session.messages)}"

        # 更新工作流状态
        if session.current_run_id:
            workflow_status_text = f"**状态**: 处理中\n\n**RunID**: `{session.current_run_id}`"
        else:
            workflow_status_text = "**状态**: 未启动"

        system_status = "就绪" if not session.waiting_for_input else "等待用户补充信息"

        return (
            chat_history,
            f"**系统状态**: {system_status}",
            reference_info,
            session_info_text,
            workflow_status_text
        )

    def handle_user_input(
        self,
        user_message: str
    ) -> Tuple[List, str, str, str, str, str]:
        """
        处理用户输入的主函数
        """
        if not user_message or not user_message.strip():
            return (
                [],
                "",
                "**系统状态**: 请输入有效消息",
                "暂无参考信息",
                "**会话ID**: 未创建\n\n**状态**: 等待开始",
                "**状态**: 未启动"
            )

        # 获取当前会话（使用最新的会话）
        sessions = session_manager.get_all_sessions()
        if not sessions:
            session = session_manager.create_session()
        else:
            session = sessions[-1]

        # 添加用户消息到会话
        session.add_message("user", user_message)

        # 更新界面 - 显示用户消息
        chat_history = self._format_chatbot_messages(session.messages)

        # 检查是否是响应工作流的中断
        if session.waiting_for_input and session.current_run_id:
            # 这是第二轮对话 - 重启工作流
            return self._handle_interrupt_response(session, user_message, chat_history)
        else:
            # 这是新对话 - 启动新工作流
            return self._handle_new_conversation(session, user_message, chat_history)

    def _handle_new_conversation(
        self,
        session: Session,
        user_message: str,
        chat_history: List
    ) -> Tuple[List, str, str, str, str, str]:
        """处理新对话 - 启动工作流"""
        try:
            # 启动工作流
            run_id = workflow_service.start_workflow(user_message)
            session.current_run_id = run_id

            print(f"[App] 启动工作流: session={session.session_id}, run={run_id}")

            # 提交异步任务处理工作流
            task_id = async_processor.submit_task(
                session_id=session.session_id,
                run_id=run_id,
                status_callback=self._workflow_status_callback
            )

            # 返回初始响应（等待工作流完成）
            session_info_text = f"**会话ID**: `{session.session_id}`\n\n**状态**: 处理中\n\n**当前RunID**: `{run_id}`"
            workflow_status_text = f"**状态**: 处理中\n\n**RunID**: `{run_id}`\n\n**TaskID**: `{task_id}`"

            return (
                chat_history,
                "",
                "**系统状态**: 正在处理您的请求...",
                "暂无参考信息",
                session_info_text,
                workflow_status_text
            )

        except Exception as e:
            error_msg = f"启动工作流失败: {str(e)}"
            session.add_message("assistant", error_msg)
            chat_history = self._format_chatbot_messages(session.messages)

            return (
                chat_history,
                "",
                f"**系统状态**: {error_msg}",
                "暂无参考信息",
                f"**会话ID**: `{session.session_id}`\n\n**状态**: 错误",
                "**状态**: 错误"
            )

    def _handle_interrupt_response(
        self,
        session: Session,
        user_message: str,
        chat_history: List
    ) -> Tuple[List, str, str, str, str, str]:
        """处理中断响应 - 重启工作流"""
        try:
            old_run_id = session.current_run_id

            # 重启工作流
            new_run_id = workflow_service.restart_workflow(user_message, old_run_id)
            session.current_run_id = new_run_id
            session.waiting_for_input = False

            print(f"[App] 重启工作流: session={session.session_id}, old_run={old_run_id}, new_run={new_run_id}")

            # 提交异步任务处理工作流
            task_id = async_processor.submit_task(
                session_id=session.session_id,
                run_id=new_run_id,
                status_callback=self._workflow_status_callback
            )

            session_info_text = f"**会话ID**: `{session.session_id}`\n\n**状态**: 处理中\n\n**当前RunID**: `{new_run_id}`"
            workflow_status_text = f"**状态**: 重启处理中\n\n**RunID**: `{new_run_id}`\n\n**TaskID**: `{task_id}`"

            return (
                chat_history,
                "",
                "**系统状态**: 正在继续处理...",
                "暂无参考信息",
                session_info_text,
                workflow_status_text
            )

        except Exception as e:
            error_msg = f"重启工作流失败: {str(e)}"
            session.add_message("assistant", error_msg)
            chat_history = self._format_chatbot_messages(session.messages)
            session.waiting_for_input = False

            return (
                chat_history,
                "",
                f"**系统状态**: {error_msg}",
                "暂无参考信息",
                f"**会话ID**: `{session.session_id}`\n\n**状态**: 错误",
                "**状态**: 错误"
            )

    async def _workflow_status_callback(self, session_id: str, result: Dict[str, Any]):
        """工作流状态回调函数（异步）"""
        print(f"[App] 工作流回调: session={session_id}, status={result['status']}")

        # 获取会话
        session = session_manager.get_session(session_id)
        if not session:
            print(f"[App] 会话不存在: {session_id}")
            return

        # 根据状态处理结果
        status = result["status"]

        if status == WorkflowStatus.INTERRUPT:
            # 中断 - 需要用户输入
            session.waiting_for_input = True
            session.interrupt_context = result.get("interrupt_info", {})
            session.add_message("assistant", result["message"])

        elif status == WorkflowStatus.SUCCESS:
            # 成功完成
            session.waiting_for_input = False
            session.add_message(
                "assistant",
                result["message"],
                visualization_url=result.get("visualization_url")
            )

        elif status == WorkflowStatus.FAIL:
            # 失败
            session.waiting_for_input = False
            session.add_message("assistant", result["message"])

    def _format_chatbot_messages(self, messages) -> List:
        """格式化消息为Chatbot显示格式"""
        formatted = []
        for msg in messages:
            if msg.role == "user":
                formatted.append([msg.content, None])
            else:
                if formatted and formatted[-1][1] is None:
                    formatted[-1][1] = msg.content
                else:
                    formatted.append([None, msg.content])
        return formatted

    def get_reference_info(self, session: Session) -> str:
        """获取参考信息"""
        if not session.messages:
            return "暂无参考信息"

        # 获取最新的一条助手消息的可视化链接
        for msg in reversed(session.messages):
            if msg.role == "assistant" and msg.visualization_url:
                return f"**可视化链接**: [{msg.visualization_url}]({msg.visualization_url})\n\n点击链接查看详细分析图表"

        return "暂无参考信息"

    def launch(self, server_name: str = "127.0.0.1", server_port: int = 7860, **kwargs):
        """启动应用"""
        print("=" * 60)
        print("🚀 智能对话工作流系统启动中...")
        print("=" * 60)
        print(f"📍 服务地址: http://{server_name}:{server_port}")
        print(f"📊 活跃会话: {len(session_manager.get_all_sessions())}")
        print(f"⚙️  活跃任务: {async_processor.get_active_tasks_count()}")
        print("=" * 60)

        self.app.launch(
            server_name=server_name,
            server_port=server_port,
            **kwargs
        )


def main():
    """主函数"""
    app = ChatApplication()
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True
    )


if __name__ == "__main__":
    main()
