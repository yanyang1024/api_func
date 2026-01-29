#!/usr/bin/env python3
"""
工作流对话机器人 - Gradio界面
支持与工作流智能体的多轮对话，处理中断和恢复状态
"""

import gradio as gr
from typing import Dict, List, Tuple, Optional
import os
import json
from datetime import datetime
from PIL import Image
import io
import time
import hashlib

# ==================== 模拟函数区域 ====================
# 注意：这些是模拟函数，后续请替换为你的实际实现

def start_workflow(user_input: str) -> str:
    """
    启动工作流
    参数: user_input - 用户自然语言字符串
    返回: run_id - 工作流运行ID
    """
    # 模拟生成一个runID
    run_id = f"run_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    print(f"[Mock] 启动工作流 - 用户输入: {user_input}, 生成 runID: {run_id}")
    return run_id

def get_workflow_info(run_id: str) -> Dict:
    """
    通过runID访问工作流信息
    参数: run_id - 工作流运行ID
    返回: 工作流信息字典，包含 status (interrupted/completed) 和相关数据
    """
    # 模拟返回不同的状态
    print(f"[Mock] 获取工作流信息 - runID: {run_id}")

    # 这里模拟不同的情况，实际使用时根据你的逻辑调整
    # 第一次调用返回中断状态，第二次返回完成状态
    mock_response = {
        "run_id": run_id,
        "status": "completed",  # 或 "interrupted"
        "message": "工作流执行成功",
        "data": {}
    }

    return mock_response

def resume_workflow(user_input: str, run_id: str) -> str:
    """
    重启中断的工作流
    参数:
        user_input - 用户自然语言字符串
        run_id - 工作流运行ID
    返回: 更新后的 run_id (可能是同一个或新的)
    """
    print(f"[Mock] 重启工作流 - 用户输入: {user_input}, runID: {run_id}")
    return run_id

# 模拟的分析工具函数
def tool_inline_compare(parameters: dict) -> Dict:
    """内联对比分析工具"""
    print(f"[Mock] 执行 inline_compare - 参数: {parameters}")

    # 创建模拟输出文件
    os.makedirs("outputs", exist_ok=True)
    ppt_path = "outputs/compare_result.pptx"
    csv_path = "outputs/test_results.csv"
    data_path = "outputs/raw_data.csv"

    # 创建空文件作为模拟
    for path in [ppt_path, csv_path, data_path]:
        with open(path, 'w') as f:
            f.write(f"Mock output created at {datetime.now()}")

    # 创建模拟图片
    img1 = Image.new('RGBA', (2000, 1000), color=(255, 100, 100, 255))
    img2 = Image.new('RGBA', (1500, 800), color=(100, 255, 100, 255))

    return {
        "message": "Inline compare Processing completed!",
        "result": {
            "files": [ppt_path, csv_path, data_path],
            "images": [img1, img2]
        }
    }

def tool_statistical_analysis(parameters: dict) -> Dict:
    """统计分析工具"""
    print(f"[Mock] 执行 statistical_analysis - 参数: {parameters}")

    os.makedirs("outputs", exist_ok=True)
    report_path = "outputs/statistical_report.pdf"
    chart_path = "outputs/statistical_chart.csv"

    for path in [report_path, chart_path]:
        with open(path, 'w') as f:
            f.write(f"Mock statistical output at {datetime.now()}")

    img1 = Image.new('RGBA', (1200, 800), color=(100, 100, 255, 255))

    return {
        "message": "Statistical analysis completed!",
        "result": {
            "files": [report_path, chart_path],
            "images": [img1]
        }
    }

def tool_trend_analysis(parameters: dict) -> Dict:
    """趋势分析工具"""
    print(f"[Mock] 执行 trend_analysis - 参数: {parameters}")

    os.makedirs("outputs", exist_ok=True)
    trend_path = "outputs/trend_report.xlsx"
    forecast_path = "outputs/forecast_data.csv"

    for path in [trend_path, forecast_path]:
        with open(path, 'w') as f:
            f.write(f"Mock trend analysis at {datetime.now()}")

    img1 = Image.new('RGBA', (1800, 900), color=(255, 255, 100, 255))
    img2 = Image.new('RGBA', (1600, 800), color=(255, 150, 50, 255))

    return {
        "message": "Trend analysis completed!",
        "result": {
            "files": [trend_path, forecast_path],
            "images": [img1, img2]
        }
    }

def tool_correlation_analysis(parameters: dict) -> Dict:
    """相关性分析工具"""
    print(f"[Mock] 执行 correlation_analysis - 参数: {parameters}")

    os.makedirs("outputs", exist_ok=True)
    correlation_path = "outputs/correlation_matrix.csv"
    heatmap_path = "outputs/heatmap_data.csv"

    for path in [correlation_path, heatmap_path]:
        with open(path, 'w') as f:
            f.write(f"Mock correlation analysis at {datetime.now()}")

    img1 = Image.new('RGBA', (1400, 1400), color=(150, 50, 255, 255))

    return {
        "message": "Correlation analysis completed!",
        "result": {
            "files": [correlation_path, heatmap_path],
            "images": [img1]
        }
    }

# 工具函数映射
TOOL_FUNCTIONS = {
    "inline_compare": tool_inline_compare,
    "statistical_analysis": tool_statistical_analysis,
    "trend_analysis": tool_trend_analysis,
    "correlation_analysis": tool_correlation_analysis
}

# ==================== 工作流状态管理 ====================

class WorkflowStateManager:
    """管理工作流状态和对话历史"""

    def __init__(self):
        self.active_workflows: Dict[str, Dict] = {}
        self.conversation_history: Dict[str, List[Dict]] = {}
        # 缓存上一次的工作流信息，用于状态去重
        self.last_workflow_info: Dict[str, Dict] = {}
        # 记录最后一次与用户交互的时间
        self.last_interaction_time: Dict[str, float] = {}

    def save_workflow_state(self, run_id: str, state: dict):
        """保存工作流状态"""
        self.active_workflows[run_id] = state

    def get_workflow_state(self, run_id: str) -> Optional[Dict]:
        """获取工作流状态"""
        return self.active_workflows.get(run_id)

    def save_last_workflow_info(self, run_id: str, info: dict):
        """保存上一次的工作流信息用于比较"""
        self.last_workflow_info[run_id] = info

    def get_last_workflow_info(self, run_id: str) -> Optional[Dict]:
        """获取上一次的工作流信息"""
        return self.last_workflow_info.get(run_id)

    def update_interaction_time(self, run_id: str):
        """更新最后一次交互时间"""
        self.last_interaction_time[run_id] = time.time()

    def get_last_interaction_time(self, run_id: str) -> float:
        """获取最后一次交互时间"""
        return self.last_interaction_time.get(run_id, 0)

    def add_to_history(self, run_id: str, role: str, content: str, metadata: dict = None):
        """添加对话历史"""
        if run_id not in self.conversation_history:
            self.conversation_history[run_id] = []

        self.conversation_history[run_id].append({
            "role": role,
            "content": content,
            "timestamp": datetime.now().isoformat(),
            "metadata": metadata or {}
        })

    def get_history(self, run_id: str) -> List[Dict]:
        """获取对话历史"""
        return self.conversation_history.get(run_id, [])

# 全局状态管理器
workflow_manager = WorkflowStateManager()

# ==================== 辅助函数 ====================

def compare_workflow_info(info1: Dict, info2: Dict) -> bool:
    """
    比较两个工作流信息是否相同
    返回: True 表示相同，False 表示不同
    """
    # 将字典转换为 JSON 字符串后计算哈希值进行比较
    # 排除 timestamp 等可能变化的字段
    def normalize_info(info: Dict) -> str:
        filtered = {
            k: v for k, v in info.items()
            if k not in ['timestamp', 'query_time']
        }
        return json.dumps(filtered, sort_keys=True)

    return normalize_info(info1) == normalize_info(info2)

def should_notify_user(run_id: str, new_info: Dict) -> bool:
    """
    判断是否应该通知用户
    返回: True 表示需要通知，False 表示跳过（因为信息相同）
    """
    last_info = workflow_manager.get_last_workflow_info(run_id)

    # 如果是第一次获取信息，需要通知
    if last_info is None:
        workflow_manager.save_last_workflow_info(run_id, new_info)
        workflow_manager.update_interaction_time(run_id)
        return True

    # 比较新旧信息
    if compare_workflow_info(last_info, new_info):
        # 信息相同，不通知用户
        print(f"[DEBUG] 工作流 {run_id} 信息未变化，跳过通知")
        return False
    else:
        # 信息不同，更新缓存并通知用户
        workflow_manager.save_last_workflow_info(run_id, new_info)
        workflow_manager.update_interaction_time(run_id)
        print(f"[DEBUG] 工作流 {run_id} 信息已变化，通知用户")
        return True

def check_interrupted_workflows(history: List) -> Tuple[List, List, List]:
    """
    检查中断的工作流状态
    这个函数会被「刷新状态」按钮调用
    返回: (updated_history, display_images, file_paths)
    """
    display_images = []
    file_paths = []
    updated_history = history.copy()

    # 查找所有中断的工作流
    interrupted_run_ids = [
        run_id for run_id, state in workflow_manager.active_workflows.items()
        if state.get("status") == "interrupted"
    ]

    if not interrupted_run_ids:
        # 没有中断的工作流
        return updated_history, display_images, file_paths

    print(f"\n[INFO] 定时检查 {len(interrupted_run_ids)} 个中断工作流的状态")

    for run_id in interrupted_run_ids:
        try:
            # 获取最新状态
            workflow_info = get_workflow_info(run_id)

            # 更新工作流状态
            workflow_manager.save_workflow_state(run_id, workflow_info)

            # 检查是否需要通知用户
            if not should_notify_user(run_id, workflow_info):
                # 信息未变化，跳过
                continue

            # 根据状态生成响应
            if workflow_info.get("status") == "interrupted":
                # 仍然中断，生成响应
                response = format_interrupted_response(workflow_info, run_id)

                # 添加系统提示（不添加到对话历史，避免重复）
                # 这里可以选择是否要添加到历史中
                # workflow_manager.add_to_history(run_id, "assistant", response)
                # updated_history.append([None, response])

                print(f"[INFO] 工作流 {run_id} 仍处于中断状态")

            elif workflow_info.get("status") == "completed":
                # 完成，生成最终响应
                response, imgs, files = format_completed_response(workflow_info, run_id)

                workflow_manager.add_to_history(run_id, "assistant", response)
                updated_history.append([None, response])
                display_images.extend(imgs)
                file_paths.extend(files)

                # 更新状态为已完成
                workflow_manager.save_workflow_state(run_id, {
                    **workflow_info,
                    "status": "completed"
                })

                print(f"[INFO] 工作流 {run_id} 已完成")

        except Exception as e:
            error_msg = f"❌ 检查工作流 {run_id} 时出错: {str(e)}"
            print(f"[ERROR] {error_msg}")

    return updated_history, display_images, file_paths


# ==================== 结果处理函数 ====================

def process_tool_results(tool_output: Dict, run_id: str) -> Tuple[str, List, List]:
    """
    处理工具输出结果，格式化为前端展示
    返回: (summary_text, display_images, file_paths)
    """
    if "result" not in tool_output:
        return tool_output.get("message", "处理完成"), [], []

    result = tool_output["result"]
    files = result.get("files", [])
    images = result.get("images", [])

    display_images = []
    file_paths = []
    summary_parts = []

    # 处理消息
    summary_parts.append(f"✅ {tool_output.get('message', '处理完成')}")

    # 处理图片
    if images:
        summary_parts.append(f"\n📊 生成了 {len(images)} 个可视化图表：")
        for idx, img in enumerate(images, 1):
            if isinstance(img, Image.Image):
                display_images.append(img)
                summary_parts.append(f"  - 图表 {idx}: {img.size[0]}x{img.size[1]} 像素")
            else:
                summary_parts.append(f"  - 图表 {idx}: [非图片对象]")

    # 处理文件
    if files:
        summary_parts.append(f"\n📁 生成了 {len(files)} 个数据文件：")
        for file_path in files:
            if os.path.exists(file_path):
                file_size = os.path.getsize(file_path)
                file_name = os.path.basename(file_path)
                file_paths.append(file_path)
                summary_parts.append(f"  - {file_name} ({file_size} bytes)")
            else:
                summary_parts.append(f"  - {os.path.basename(file_path)} [文件不存在]")

    # 获取历史信息
    history = workflow_manager.get_history(run_id)
    if history:
        summary_parts.append(f"\n💬 对话轮次: {len(history)}")

    summary = "\n".join(summary_parts)
    return summary, display_images, file_paths

def format_interrupted_response(workflow_info: Dict, run_id: str) -> str:
    """格式化中断状态响应"""
    message = workflow_info.get("message", "工作流需要更多信息才能继续")

    response = f"⏸️ **工作流已暂停**\n\n{message}\n\n"
    response += "请提供需要的信息以继续工作流。"

    return response

def format_completed_response(workflow_info: Dict, run_id: str) -> Tuple[str, List, List]:
    """格式化完成状态响应"""
    # 获取解析的参数
    data = workflow_info.get("data", {})
    extracted_params = data.get("parameters", {})

    response_parts = []
    response_parts.append("✅ **工作流执行完成**\n")

    # 显示提取的参数
    if extracted_params:
        response_parts.append("\n📋 **解析的参数：**\n")
        for key, value in extracted_params.items():
            response_parts.append(f"  - {key}: {value}")

    # 调用相应的工具函数
    all_display_images = []
    all_file_paths = []
    tool_results = []

    # 假设 workflow_info 中包含了需要调用的工具信息
    tools_to_run = data.get("tools", [])

    if not tools_to_run:
        # 如果没有指定工具，使用默认工具或参数推断
        # 这里模拟根据参数选择工具
        if "compare" in str(extracted_params).lower():
            tools_to_run = ["inline_compare"]
        elif "statistical" in str(extracted_params).lower():
            tools_to_run = ["statistical_analysis"]
        else:
            # 默认运行 inline_compare
            tools_to_run = ["inline_compare"]

    for tool_name in tools_to_run:
        if tool_name in TOOL_FUNCTIONS:
            try:
                print(f"\n[INFO] 调用工具: {tool_name}")
                tool_output = TOOL_FUNCTIONS[tool_name](extracted_params)
                tool_results.append(tool_output)

                # 处理每个工具的结果
                summary, display_images, file_paths = process_tool_results(tool_output, run_id)
                response_parts.append(f"\n{summary}")
                all_display_images.extend(display_images)
                all_file_paths.extend(file_paths)

            except Exception as e:
                error_msg = f"❌ 工具 {tool_name} 执行失败: {str(e)}"
                response_parts.append(f"\n{error_msg}")
                print(f"[ERROR] {error_msg}")

    final_response = "\n".join(response_parts)
    return final_response, all_display_images, all_file_paths

# ==================== 对话处理逻辑 ====================

def process_user_message(user_input: str, history: List) -> Tuple[List, List, List]:
    """
    处理用户消息的主要逻辑
    返回: (updated_history, display_images, file_paths)
    """
    # 检查是否有活跃的工作流
    active_run_id = None

    # 查找最近的中断工作流
    for run_id, state in workflow_manager.active_workflows.items():
        if state.get("status") == "interrupted":
            active_run_id = run_id
            break

    display_images = []
    file_paths = []

    if active_run_id:
        # 有中断的工作流，需要恢复
        print(f"\n[INFO] 检测到中断的工作流: {active_run_id}")

        # 添加用户输入到历史
        workflow_manager.add_to_history(active_run_id, "user", user_input)

        # 恢复工作流
        resume_workflow(user_input, active_run_id)

        # 获取更新后的工作流信息
        workflow_info = get_workflow_info(active_run_id)

        # 更新状态
        workflow_manager.save_workflow_state(active_run_id, workflow_info)

        # 根据状态生成响应
        if workflow_info.get("status") == "interrupted":
            # 仍然中断 - 使用状态去重逻辑
            if should_notify_user(active_run_id, workflow_info):
                # 信息有变化，通知用户
                response = format_interrupted_response(workflow_info, active_run_id)
                workflow_manager.add_to_history(active_run_id, "assistant", response)
                history.append([user_input, response])
            else:
                # 信息未变化，不重复提示
                print(f"[INFO] 工作流 {active_run_id} 信息未变化，跳过重复提示")
                # 仍然添加用户消息，但不添加助手响应
                history.append([user_input, None])

        elif workflow_info.get("status") == "completed":
            # 完成 - 清除状态缓存，确保完成信息能显示
            workflow_manager.save_last_workflow_info(active_run_id, {})

            response, display_images, file_paths = format_completed_response(workflow_info, active_run_id)
            workflow_manager.add_to_history(active_run_id, "assistant", response)
            history.append([user_input, response])

            # 更新状态为已完成
            workflow_manager.save_workflow_state(active_run_id, {
                **workflow_info,
                "status": "completed"
            })

        else:
            # 未知状态
            response = f"⚠️ 未知的工作流状态: {workflow_info.get('status')}"
            history.append([user_input, response])

    else:
        # 没有活跃工作流，启动新的
        print(f"\n[INFO] 启动新的工作流")

        # 启动工作流
        run_id = start_workflow(user_input)

        # 初始化工作流状态
        workflow_manager.add_to_history(run_id, "user", user_input)

        # 获取工作流信息
        workflow_info = get_workflow_info(run_id)

        # 保存状态
        workflow_manager.save_workflow_state(run_id, workflow_info)

        # 根据状态生成响应
        if workflow_info.get("status") == "interrupted":
            # 使用状态去重逻辑
            should_notify_user(run_id, workflow_info)  # 初始化状态缓存
            response = format_interrupted_response(workflow_info, run_id)
            workflow_manager.add_to_history(run_id, "assistant", response)
            history.append([user_input, response])

        elif workflow_info.get("status") == "completed":
            response, display_images, file_paths = format_completed_response(workflow_info, run_id)
            workflow_manager.add_to_history(run_id, "assistant", response)
            history.append([user_input, response])

        else:
            response = f"⚠️ 未知的工作流状态: {workflow_info.get('status')}"
            history.append([user_input, response])

    return history, display_images, file_paths

def create_gradio_interface():
    """创建 Gradio 界面"""

    custom_css = """
    .chat-container {
        height: 600px;
    }
    .message {
        padding: 10px;
        margin: 5px 0;
        border-radius: 8px;
    }
    """

    with gr.Blocks(css=custom_css, title="工作流对话机器人") as app:

        gr.Markdown("# 🤖 工作流对话机器人")
        gr.Markdown("支持与工作流智能体的多轮对话，自动处理中断和恢复状态")
        gr.Markdown("⚙️ **优化特性：** 相同信息只提示一次，点击「🔄 刷新状态」按钮检查工作流进度")

        with gr.Row():
            with gr.Column(scale=2):
                chatbot = gr.Chatbot(
                    label="对话历史",
                    height=500,
                    bubble_full_width=False,
                    avatar_images=(None, "🤖")
                )

                with gr.Row():
                    msg_input = gr.Textbox(
                        label="输入消息",
                        placeholder="请输入您的需求...",
                        scale=4,
                        lines=2
                    )
                    submit_btn = gr.Button("发送", variant="primary", scale=1)
                    refresh_btn = gr.Button("🔄 刷新状态", variant="secondary", scale=1)
                    clear_btn = gr.Button("清空对话", variant="stop", scale=1)

            with gr.Column(scale=1):
                gr.Markdown("### 📊 结果展示")
                results_gallery = gr.Gallery(
                    label="生成的图表",
                    show_label=True,
                    elem_id="results_gallery",
                    columns=1,
                    rows=5,
                    height="auto",
                    object_fit="contain"
                )

                gr.Markdown("### 📁 生成的文件")
                files_output = gr.File(
                    label="下载文件",
                    file_count="multiple",
                    interactive=False
                )

        # 状态信息
        with gr.Accordion("🔧 状态信息", open=False):
            status_info = gr.Textbox(
                label="当前状态",
                value="准备就绪",
                interactive=False
            )
            active_workflows_info = gr.JSON(
                label="活跃的工作流",
                value={}
            )

        # 示例问题
        gr.Markdown("### 💡 示例问题")
        examples = gr.Examples(
            examples=[
                ["帮我对比分析一下数据集A和数据集B的差异"],
                ["对销售数据进行统计分析"],
                ["分析过去一年的数据趋势"],
                ["计算各个变量之间的相关性"]
            ],
            inputs=msg_input,
            label="点击示例快速开始"
        )

        def handle_submit(user_input, history):
            """处理提交"""
            if not user_input.strip():
                return history, [], "请输入消息", {}

            updated_history, display_images, file_paths = process_user_message(user_input, history)

            # 更新状态信息
            active_count = sum(
                1 for s in workflow_manager.active_workflows.values()
                if s.get("status") == "interrupted"
            )

            status_msg = f"活跃工作流数: {active_count} | 总对话数: {len(workflow_manager.conversation_history)}"

            # display_images 已经是 PIL Image 对象列表，可以直接用于画廊
            gallery_images = display_images

            # file_paths 已经是文件路径列表
            output_files = file_paths

            print(f"\n[DEBUG] 返回 {len(gallery_images)} 个图片")
            print(f"[DEBUG] 返回 {len(output_files)} 个文件: {output_files}")

            return (
                updated_history,
                gallery_images,
                output_files,
                status_msg,
                workflow_manager.active_workflows
            )

        def handle_clear():
            """清空对话"""
            workflow_manager.active_workflows.clear()
            workflow_manager.conversation_history.clear()
            workflow_manager.last_workflow_info.clear()
            workflow_manager.last_interaction_time.clear()
            return [], [], "对话已清空", {}

        def handle_refresh(history, gallery_images, file_paths):
            """手动刷新工作流状态"""
            updated_history, new_images, new_files = check_interrupted_workflows(history)

            # 合并图片和文件
            all_images = list(gallery_images) + new_images if gallery_images else new_images
            all_files = list(file_paths) + new_files if file_paths else new_files

            # 更新状态信息
            active_count = sum(
                1 for s in workflow_manager.active_workflows.values()
                if s.get("status") == "interrupted"
            )

            status_msg = f"活跃工作流数: {active_count} | 总对话数: {len(workflow_manager.conversation_history)}"

            return (
                updated_history,
                all_images,
                all_files,
                status_msg,
                workflow_manager.active_workflows
            )

        # 事件绑定
        submit_btn.click(
            handle_submit,
            inputs=[msg_input, chatbot],
            outputs=[chatbot, results_gallery, files_output, status_info, active_workflows_info]
        ).then(
            lambda: "",
            outputs=[msg_input]
        )

        msg_input.submit(
            handle_submit,
            inputs=[msg_input, chatbot],
            outputs=[chatbot, results_gallery, files_output, status_info, active_workflows_info]
        ).then(
            lambda: "",
            outputs=[msg_input]
        )

        clear_btn.click(
            handle_clear,
            outputs=[chatbot, results_gallery, files_output, status_info, active_workflows_info]
        )

        # 绑定刷新按钮事件
        refresh_btn.click(
            handle_refresh,
            inputs=[chatbot, results_gallery, files_output],
            outputs=[chatbot, results_gallery, files_output, status_info, active_workflows_info]
        )

    return app

# ==================== 主程序入口 ====================

if __name__ == "__main__":
    print("=" * 60)
    print("工作流对话机器人 - Gradio界面")
    print("=" * 60)
    print("\n[INFO] 正在启动服务器...")
    print("[INFO] 模拟函数已加载，后续请替换为实际实现\n")

    # 创建输出目录
    os.makedirs("outputs", exist_ok=True)

    # 创建并启动应用
    app = create_gradio_interface()

    # 启动服务器
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True,
        quiet=False
    )
