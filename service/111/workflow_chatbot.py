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

def poll_workflow_info(run_id: str, max_retries: int = 15, initial_interval: float = 0.5) -> Tuple[Dict, int]:
    """
    轮询工作流信息直到有更新或达到最大重试次数
    使用智能退避策略：初始间隔短，逐渐增加间隔
    参数:
        run_id: 工作流ID
        max_retries: 最大重试次数（默认15次）
        initial_interval: 初始重试间隔秒数（默认0.5秒）
    返回: (workflow_info, attempts) - 工作流信息和实际尝试次数
    """
    print(f"[INFO] 开始轮询工作流 {run_id} 的信息更新...")

    # 获取当前保存的状态作为基准
    last_info = workflow_manager.get_last_workflow_info(run_id)

    for attempt in range(1, max_retries + 1):
        try:
            # 获取最新状态
            workflow_info = get_workflow_info(run_id)

            # 快速退出：如果状态是 completed，立即返回
            if workflow_info.get("status") == "completed":
                print(f"[INFO] 第 {attempt} 次查询: 工作流已完成，立即返回")
                workflow_manager.save_last_workflow_info(run_id, workflow_info)
                return workflow_info, attempt

            # 检查信息是否有变化
            if last_info is None or not compare_workflow_info(last_info, workflow_info):
                # 信息有变化或首次获取
                print(f"[INFO] 第 {attempt} 次查询: 工作流信息已更新")
                workflow_manager.save_last_workflow_info(run_id, workflow_info)
                return workflow_info, attempt

            # 信息未变化，使用指数退避策略计算等待时间
            # 前5次使用0.5秒，之后逐渐增加到最大2秒
            if attempt <= 5:
                current_interval = initial_interval
            else:
                current_interval = min(initial_interval * (1.5 ** (attempt - 5)), 2.0)

            print(f"[INFO] 第 {attempt} 次查询: 工作流信息未变化，等待 {current_interval:.1f} 秒后重试...")
            time.sleep(current_interval)

        except Exception as e:
            print(f"[ERROR] 第 {attempt} 次查询失败: {str(e)}")
            if attempt < max_retries:
                # 出错时也使用退避策略
                current_interval = min(initial_interval * (1.2 ** attempt), 2.0)
                time.sleep(current_interval)
            else:
                # 最后一次尝试失败，返回错误信息
                return {
                    "run_id": run_id,
                    "status": "error",
                    "message": f"查询工作流信息失败: {str(e)}",
                    "data": {}
                }, attempt

    # 达到最大重试次数，信息仍未变化
    print(f"[WARNING] 工作流 {run_id} 在 {max_retries} 次查询后信息仍未变化")
    workflow_info = get_workflow_info(run_id)  # 最后一次获取
    workflow_manager.save_last_workflow_info(run_id, workflow_info)
    return workflow_info, max_retries

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

def format_timeout_response(workflow_info: Dict, run_id: str, attempts: int) -> str:
    """格式化超时响应 - 当轮询多次后工作流信息仍未变化时使用"""
    message = workflow_info.get("message", "工作流正在处理中")
    status = workflow_info.get("status", "unknown")

    # 估算等待时间（使用智能退避策略）
    estimated_wait_time = sum(0.5 if i <= 5 else min(0.5 * (1.5 ** (i - 5)), 2.0) for i in range(1, attempts + 1))

    response = f"⏳ **工作流响应超时**\n\n"
    response += f"抱歉，在工作流处理过程中等待了 {attempts} 次查询（约 {estimated_wait_time:.1f} 秒），\n"
    response += f"但工作流状态没有更新。\n\n"
    response += f"**当前状态**: {status}\n"
    response += f"**最新消息**: {message}\n\n"
    response += "这可能是因为：\n"
    response += "1. 工作流正在处理复杂任务，需要更长时间\n"
    response += "2. 工作流可能遇到了问题\n\n"
    response += "您可以：\n"
    response += "- 点击「🔄 刷新状态」按钮手动检查工作流进度\n"
    response += "- 稍后再试\n"
    response += "- 提供更多信息以帮助工作流继续"

    return response

def format_error_response(error_msg: str, run_id: str) -> str:
    """格式化错误响应"""
    response = f"❌ **工作流出错**\n\n"
    response += f"抱歉，工作流 {run_id} 遇到了错误：\n\n"
    response += f"```\n{error_msg}\n```\n\n"
    response += "请稍后重试或联系技术支持。"

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
    使用轮询机制确保每次用户输入都能得到响应
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

        # 清除旧的缓存状态，确保能检测到工作流恢复后的变化
        workflow_manager.last_workflow_info.pop(active_run_id, None)
        print(f"[DEBUG] 已清除旧的缓存状态，准备检测新状态")

        # 恢复工作流
        resume_workflow(user_input, active_run_id)

        # 使用优化的轮询机制获取更新后的工作流信息（最多等待约7.5秒）
        # 参数: run_id, max_retries=15, initial_interval=0.5
        workflow_info, attempts = poll_workflow_info(active_run_id, max_retries=15, initial_interval=0.5)

        # 更新状态
        workflow_manager.save_workflow_state(active_run_id, workflow_info)
        workflow_manager.update_interaction_time(active_run_id)

        # 根据状态和尝试次数生成响应
        if workflow_info.get("status") == "error":
            # 查询出错
            response = format_error_response(workflow_info.get("message", "未知错误"), active_run_id)
            workflow_manager.add_to_history(active_run_id, "assistant", response)
            history.append([user_input, response])

        elif workflow_info.get("status") == "interrupted":
            # 仍然中断
            if attempts >= 15:
                # 达到最大重试次数，信息仍未变化，返回超时响应
                response = format_timeout_response(workflow_info, active_run_id, attempts)
                workflow_manager.add_to_history(active_run_id, "assistant", response)
                history.append([user_input, response])
            else:
                # 在重试期间得到了更新的中断状态
                response = format_interrupted_response(workflow_info, active_run_id)
                workflow_manager.add_to_history(active_run_id, "assistant", response)
                history.append([user_input, response])

        elif workflow_info.get("status") == "completed":
            # 完成
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
            workflow_manager.add_to_history(active_run_id, "assistant", response)
            history.append([user_input, response])

    else:
        # 没有活跃工作流，启动新的
        print(f"\n[INFO] 启动新的工作流")

        # 启动工作流
        run_id = start_workflow(user_input)

        # 初始化工作流状态
        workflow_manager.add_to_history(run_id, "user", user_input)

        # 使用优化的轮询机制获取工作流信息（最多等待约7.5秒）
        workflow_info, attempts = poll_workflow_info(run_id, max_retries=15, initial_interval=0.5)

        # 保存状态
        workflow_manager.save_workflow_state(run_id, workflow_info)
        workflow_manager.update_interaction_time(run_id)

        # 根据状态生成响应
        if workflow_info.get("status") == "error":
            # 查询出错
            response = format_error_response(workflow_info.get("message", "未知错误"), run_id)
            workflow_manager.add_to_history(run_id, "assistant", response)
            history.append([user_input, response])

        elif workflow_info.get("status") == "interrupted":
            # 中断状态
            if attempts >= 15:
                # 启动后立即超时，说明工作流可能有问题
                response = format_timeout_response(workflow_info, run_id, attempts)
                workflow_manager.add_to_history(run_id, "assistant", response)
                history.append([user_input, response])
            else:
                # 正常的中断状态
                response = format_interrupted_response(workflow_info, run_id)
                workflow_manager.add_to_history(run_id, "assistant", response)
                history.append([user_input, response])

        elif workflow_info.get("status") == "completed":
            # 完成
            response, display_images, file_paths = format_completed_response(workflow_info, run_id)
            workflow_manager.add_to_history(run_id, "assistant", response)
            history.append([user_input, response])

        else:
            # 未知状态
            response = f"⚠️ 未知的工作流状态: {workflow_info.get('status')}"
            workflow_manager.add_to_history(run_id, "assistant", response)
            history.append([user_input, response])

    return history, display_images, file_paths

def create_gradio_interface():
    """创建 Gradio 界面"""

    custom_css = """
    /* 全局样式 */
    .gradio-container {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
        background: #f5f7fa !important;
        min-height: 100vh;
        color: #111827;
    }

    /* 主容器 */
    .gradio-container > .main {
        background-color: #ffffff;
        border-radius: 16px;
        padding: 28px;
        margin: 20px;
        border: 1px solid #e5e7eb;
        box-shadow: 0 12px 30px rgba(17, 24, 39, 0.08);
    }

    /* 标题样式 */
    .gradio-container .markdown {
        color: #111827;
        font-size: 16px;
    }

    /* 聊天界面 */
    .chatbot {
        background: #f9fafb;
        border-radius: 14px !important;
        border: 1px solid #e5e7eb;
    }

    /* 用户消息气泡 */
    .chatbot .user-message {
        background: #2563eb !important;
        color: #ffffff !important;
        border-radius: 16px 16px 4px 16px !important;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
        margin: 8px 0;
        padding: 12px 16px;
    }

    /* 机器人消息气泡 */
    .chatbot .bot-message {
        background: #ffffff !important;
        color: #111827 !important;
        border-radius: 16px 16px 16px 4px !important;
        box-shadow: 0 2px 8px rgba(17, 24, 39, 0.06);
        border: 1px solid #e5e7eb;
        margin: 8px 0;
        padding: 12px 16px;
    }

    /* 输入框样式 */
    .gradio-container input[type="text"], .gradio-container textarea {
        background-color: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 15px;
        transition: all 0.2s ease;
        box-shadow: none;
    }

    .gradio-container input[type="text"]:focus, .gradio-container textarea:focus {
        border-color: #2563eb;
        box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
        outline: none;
    }

    /* 按钮样式 */
    .gradio-container button {
        border-radius: 10px !important;
        font-weight: 600 !important;
        transition: all 0.2s ease !important;
        box-shadow: none !important;
        border: 1px solid #d1d5db !important;
        padding: 10px 18px !important;
        font-size: 14px !important;
        background: #ffffff !important;
        color: #111827 !important;
    }

    .gradio-container button:hover {
        background: #f9fafb !important;
    }

    .gradio-container button:active {
        transform: translateY(1px) !important;
    }

    /* 主要按钮 */
    .gradio-container button.primary {
        background: #2563eb !important;
        color: #ffffff !important;
        border-color: #2563eb !important;
    }

    .gradio-container button.primary:hover {
        background: #1d4ed8 !important;
        border-color: #1d4ed8 !important;
    }

    /* 次要按钮 */
    .gradio-container button.secondary {
        background: #6b7280 !important;
        color: #ffffff !important;
        border-color: #6b7280 !important;
    }

    .gradio-container button.secondary:hover {
        background: #4b5563 !important;
        border-color: #4b5563 !important;
    }

    /* 停止按钮 */
    .gradio-container button.stop {
        background: #374151 !important;
        color: #ffffff !important;
        border-color: #374151 !important;
    }

    .gradio-container button.stop:hover {
        background: #1f2937 !important;
        border-color: #1f2937 !important;
    }

    /* 图库样式 */
    #results_gallery {
        background: #ffffff;
        border-radius: 14px;
        padding: 14px;
        border: 1px solid #e5e7eb;
    }

    /* 折叠面板样式 */
    .gradio-container .accordion {
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        background-color: #f9fafb;
    }

    .gradio-container .accordion button {
        background: #2563eb !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        border: none !important;
    }

    /* 示例区域样式 */
    .gradio-container .examples {
        background: #f9fafb;
        border-radius: 14px;
        padding: 18px;
        border: 1px dashed #d1d5db;
    }

    /* 标签样式 */
    .gradio-container label {
        color: #4b5563;
        font-weight: 600;
        font-size: 14px;
        margin-bottom: 8px;
    }

    /* 文件上传区域 */
    .gradio-container .file-container {
        border: 1px dashed #d1d5db;
        border-radius: 10px;
        background: #ffffff;
        padding: 16px;
        transition: all 0.2s ease;
    }

    .gradio-container .file-container:hover {
        border-color: #2563eb;
        background: #f9fafb;
    }

    /* 滚动条样式 */
    ::-webkit-scrollbar {
        width: 10px;
        height: 10px;
    }

    ::-webkit-scrollbar-track {
        background: #f3f4f6;
        border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
    }

    /* 动画效果 */
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .gradio-container > .main {
        animation: fadeIn 0.35s ease-out;
    }

    /* 状态指示器 */
    .status-indicator {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        margin-right: 8px;
        animation: pulse 2s infinite;
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    /* 响应式设计 */
    @media (max-width: 768px) {
        .gradio-container > .main {
            padding: 16px;
            margin: 10px;
        }
    }
    """

    with gr.Blocks(css=custom_css, title="🤖 智能工作流助手", theme=gr.themes.Soft()) as app:

        # 顶部标题区
        gr.HTML("""
        <div style="text-align: center; margin-bottom: 24px; padding: 18px; background: #f9fafb; border-radius: 14px; border: 1px solid #e5e7eb;">
            <h1 style="color: #111827; margin: 0; font-size: 30px; font-weight: 700;">🤖 智能工作流助手</h1>
            <p style="color: #6b7280; margin: 8px 0 0 0; font-size: 14px;">
                支持 AI 智能体的多轮对话 · 自动处理中断和恢复状态 · 实时结果展示
            </p>
        </div>
        """)

        # 特性说明
        gr.HTML("""
        <div style="background: #ffffff; padding: 14px 18px; border-radius: 12px; margin-bottom: 18px; border: 1px solid #e5e7eb;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="color: #2563eb; font-weight: 600;">⚡ 优化特性：</span>
                <span style="color: #374151;">智能轮询机制</span>
                <span style="color: #d1d5db;">•</span>
                <span style="color: #374151;">自动超时处理</span>
                <span style="color: #d1d5db;">•</span>
                <span style="color: #374151;">实时状态刷新</span>
                <span style="color: #d1d5db;">•</span>
                <span style="color: #374151;">可视化结果展示</span>
            </div>
        </div>
        """)

        with gr.Row():
            # 左侧：对话区域
            with gr.Column(scale=2):
                chatbot = gr.Chatbot(
                    label="💬 对话历史",
                    height=500,
                    bubble_full_width=False,
                    avatar_images=(None, "🤖"),
                    show_label=True
                )

                with gr.Row():
                    with gr.Column(scale=4):
                        msg_input = gr.Textbox(
                            label="",
                            placeholder="✨ 请输入您的需求...（支持自然语言描述）",
                            lines=2,
                            show_label=False,
                            container=False
                        )
                    with gr.Column(scale=1, min_width=120):
                        submit_btn = gr.Button("📤 发送", variant="primary", size="lg")

                with gr.Row():
                    refresh_btn = gr.Button("🔄 刷新状态", variant="secondary", scale=1)
                    clear_btn = gr.Button("🗑️ 清空对话", variant="stop", scale=1)

            # 右侧：结果展示区域
            with gr.Column(scale=1):
                gr.HTML("""
                <div style="text-align: center; margin: 12px 0; padding: 10px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
                    <h3 style="color: #111827; margin: 0; font-size: 16px; font-weight: 600;">📊 分析结果</h3>
                </div>
                """)

                results_gallery = gr.Gallery(
                    label="📈 生成的图表",
                    show_label=True,
                    elem_id="results_gallery",
                    columns=1,
                    rows=5,
                    height="auto",
                    object_fit="contain"
                )

                gr.HTML("""
                <div style="text-align: center; margin: 16px 0 10px 0; padding: 10px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
                    <h3 style="color: #111827; margin: 0; font-size: 14px; font-weight: 600;">📁 生成文件</h3>
                </div>
                """)

                files_output = gr.File(
                    label="",
                    file_count="multiple",
                    interactive=False,
                    show_label=False
                )

        # 状态信息区域
        with gr.Accordion("🔧 系统状态信息", open=False):
            with gr.Row():
                with gr.Column():
                    status_info = gr.Textbox(
                        label="📊 当前状态",
                        value="✅ 系统准备就绪",
                        interactive=False
                    )
                with gr.Column():
                    active_workflows_info = gr.JSON(
                        label="🔄 活跃的工作流",
                        value={},
                        visible=True
                    )

        # 示例问题区域
        gr.HTML("""
        <div style="text-align: center; margin: 22px 0 12px 0; padding: 10px; background: #f9fafb; border-radius: 10px; border: 1px solid #e5e7eb;">
            <h3 style="color: #111827; margin: 0; font-size: 16px; font-weight: 600;">💡 快速开始 - 点击示例</h3>
        </div>
        """)

        examples = gr.Examples(
            examples=[
                ["帮我对比分析一下数据集A和数据集B的差异"],
                ["对销售数据进行统计分析，生成可视化报告"],
                ["分析过去一年的数据趋势，并预测未来走向"],
                ["计算各个变量之间的相关性，绘制热力图"]
            ],
            inputs=msg_input,
            label=None,
            examples_per_page=4
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
            # 返回5个值以匹配 outputs: [chatbot, results_gallery, files_output, status_info, active_workflows_info]
            return [], [], [], "对话已清空", {}

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
