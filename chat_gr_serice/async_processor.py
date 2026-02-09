"""
异步任务处理器 - 处理长时间运行的工作流
"""
import asyncio
import threading
from typing import Dict, Optional, Callable, Any
from datetime import datetime
import queue
from concurrent.futures import ThreadPoolExecutor

from workflow_mock import workflow_service, WorkflowStatus
from session_manager import Session, session_manager


class AsyncTask:
    """异步任务"""
    def __init__(self, task_id: str, session_id: str, run_id: str,
                 status_callback: Optional[Callable] = None):
        self.task_id = task_id
        self.session_id = session_id
        self.run_id = run_id
        self.status_callback = status_callback
        self.created_at = datetime.now()
        self.completed = False
        self.result = None

    async def run(self):
        """执行异步任务"""
        print(f"[AsyncProcessor] 任务开始: {self.task_id}, run_id: {self.run_id}")

        try:
            # 模拟长时间运行的工作流
            # 实际使用时，这里会轮询工作流状态
            await asyncio.sleep(2)  # 模拟工作流执行时间

            # 获取工作流结果
            result = workflow_service.get_workflow_info(self.run_id)

            print(f"[AsyncProcessor] 任务完成: {self.task_id}, 状态: {result['status']}")

            self.completed = True
            self.result = result

            # 执行回调
            if self.status_callback:
                await self.status_callback(self.session_id, result)

            return result

        except Exception as e:
            print(f"[AsyncProcessor] 任务异常: {self.task_id}, 错误: {str(e)}")
            error_result = {
                "run_id": self.run_id,
                "status": WorkflowStatus.FAIL,
                "message": f"处理异常: {str(e)}",
                "visualization_url": None
            }
            self.completed = True
            self.result = error_result

            if self.status_callback:
                await self.status_callback(self.session_id, error_result)

            return error_result


class AsyncProcessor:
    """异步处理器 - 管理所有异步任务"""

    def __init__(self, max_workers: int = 10):
        self._tasks: Dict[str, AsyncTask] = {}
        self._task_counter = 0
        self._lock = threading.Lock()
        self.max_workers = max_workers
        self._executor = ThreadPoolExecutor(max_workers=max_workers)
        self._loop = None
        self._event_queue = queue.Queue()

        # 启动事件循环线程
        self._start_event_loop()

    def _start_event_loop(self):
        """在后台线程中启动事件循环"""
        def run_loop():
            self._loop = asyncio.new_event_loop()
            asyncio.set_event_loop(self._loop)
            self._loop.run_forever()

        thread = threading.Thread(target=run_loop, daemon=True)
        thread.start()
        print("[AsyncProcessor] 事件循环线程已启动")

    def _run_coroutine(self, coro):
        """在事件循环中运行协程"""
        if self._loop:
            asyncio.run_coroutine_threadsafe(coro, self._loop)

    def submit_task(self, session_id: str, run_id: str,
                    status_callback: Optional[Callable] = None) -> str:
        """提交新的异步任务"""
        with self._lock:
            self._task_counter += 1
            task_id = f"task_{self._task_counter}_{int(datetime.now().timestamp())}"

            task = AsyncTask(
                task_id=task_id,
                session_id=session_id,
                run_id=run_id,
                status_callback=status_callback
            )

            self._tasks[task_id] = task
            print(f"[AsyncProcessor] 提交任务: {task_id}, session: {session_id}, run: {run_id}")

            # 在事件循环中运行任务
            self._run_coroutine(task.run())

            return task_id

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        with self._lock:
            task = self._tasks.get(task_id)
            if task:
                return {
                    "task_id": task.task_id,
                    "session_id": task.session_id,
                    "run_id": task.run_id,
                    "completed": task.completed,
                    "result": task.result,
                    "created_at": task.created_at.isoformat()
                }
            return None

    def cleanup_completed_tasks(self, max_age_minutes: int = 30):
        """清理已完成的旧任务"""
        with self._lock:
            now = datetime.now()
            to_delete = []

            for task_id, task in self._tasks.items():
                if task.completed:
                    age = now - task.created_at
                    if age.total_seconds() > max_age_minutes * 60:
                        to_delete.append(task_id)

            for task_id in to_delete:
                del self._tasks[task_id]
                print(f"[AsyncProcessor] 清理已完成任务: {task_id}")

            return len(to_delete)

    def get_active_tasks_count(self) -> int:
        """获取活跃任务数量"""
        with self._lock:
            return sum(1 for task in self._tasks.values() if not task.completed)


# 全局异步处理器实例
async_processor = AsyncProcessor()
