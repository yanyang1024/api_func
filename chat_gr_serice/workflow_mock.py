"""
工作流服务的模拟函数
后续替换为实际的工作流服务调用
"""
import time
import random
from typing import Dict, Any, Optional
from enum import Enum


class WorkflowStatus(Enum):
    """工作流状态枚举"""
    INTERRUPT = "interrupt"  # 中断，需要用户输入
    SUCCESS = "success"      # 完成
    FAIL = "fail"           # 失败


class WorkflowService:
    """工作流服务模拟类"""

    def __init__(self):
        self.run_counter = 0

    def start_workflow(self, user_input: str) -> str:
        """
        启动工作流
        :param user_input: 用户输入的自然语言字符串
        :return: runID - 用于后续查询工作流状态
        """
        self.run_counter += 1
        run_id = f"run_{self.run_counter}_{int(time.time())}"

        # 模拟：根据用户输入决定是否需要中断
        # 如果输入包含"分析"或"详细"等信息，则模拟需要中断
        print(f"[Workflow] 启动工作流: {run_id}, 用户输入: {user_input}")

        return run_id

    def get_workflow_info(self, run_id: str) -> Dict[str, Any]:
        """
        通过runID获取工作流信息
        :param run_id: 工作流运行ID
        :return: 包含status, message, visualization_url等信息的字典
        """
        # 模拟：根据run_id的奇偶性决定状态
        run_num = int(run_id.split('_')[1])

        # 模拟不同的状态
        if run_num % 3 == 0:
            # 模拟中断状态
            return {
                "run_id": run_id,
                "status": WorkflowStatus.INTERRUPT,
                "message": "需要更多信息：请提供您想分析的数据范围和时间周期",
                "visualization_url": None,
                "interrupt_info": {
                    "question": "请提供您想分析的数据范围和时间周期",
                    "context": "正在为用户准备数据分析报告"
                }
            }
        elif run_num % 3 == 1:
            # 模拟成功状态
            return {
                "run_id": run_id,
                "status": WorkflowStatus.SUCCESS,
                "message": f"分析完成！根据您的需求，我已生成详细的分析报告。数据显示过去一个月增长了25%，主要来自于产品A和产品B的贡献。",
                "visualization_url": f"https://example.com/chart/{run_id}",
                "visualization_type": "chart"
            }
        else:
            # 模拟失败状态
            return {
                "run_id": run_id,
                "status": WorkflowStatus.FAIL,
                "message": "处理失败：系统内部错误，请稍后重试",
                "visualization_url": None,
                "error": "Internal server error"
            }

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        """
        重启中断的工作流
        :param user_input: 用户输入的补充信息
        :param run_id: 原工作流的runID
        :return: 新的runID
        """
        new_run_counter = int(run_id.split('_')[1]) + 1000
        new_run_id = f"run_{new_run_counter}_{int(time.time())}"

        print(f"[Workflow] 重启工作流: {new_run_id}, 原runID: {run_id}, 用户输入: {user_input}")

        return new_run_id


# 全局实例
workflow_service = WorkflowService()
