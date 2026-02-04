#!/usr/bin/env python3
"""
增强型转发服务客户端示例

演示如何使用增强型转发服务的API：
1. 提交任务
2. 查询任务状态
3. 轮询等待任务完成
4. 获取服务统计信息
"""

import requests
import time
import json
import argparse
from typing import Optional


class EnhancedProxyClient:
    """增强型转发服务客户端"""

    def __init__(self, base_url: str = "http://localhost:8080"):
        """
        初始化客户端

        Args:
            base_url: 转发服务的基础URL
        """
        self.base_url = base_url.rstrip('/')

    def submit_task(self, api_path: str, data: dict) -> str:
        """
        提交任务到转发服务

        Args:
            api_path: API路径（如 "api/function1"）
            data: 请求数据

        Returns:
            task_id: 任务ID

        Raises:
            Exception: 提交任务失败时抛出异常
        """
        url = f"{self.base_url}/{api_path}"

        print(f"正在提交任务到: {url}")
        print(f"请求数据: {json.dumps(data, indent=2, ensure_ascii=False)}")

        try:
            response = requests.post(url, json=data, timeout=10)
            response.raise_for_status()
            result = response.json()

            if result.get("success"):
                task_id = result["task_id"]
                print(f"✓ 任务提交成功，ID: {task_id}")
                return task_id
            else:
                error_msg = result.get("error", "未知错误")
                raise Exception(f"提交任务失败: {error_msg}")

        except requests.exceptions.RequestException as e:
            raise Exception(f"请求失败: {str(e)}")

    def query_task(self, task_id: str) -> dict:
        """
        查询任务状态（单次查询）

        Args:
            task_id: 任务ID

        Returns:
            任务状态信息
        """
        url = f"{self.base_url}/task/{task_id}"

        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"查询任务失败: {str(e)}")

    def wait_for_task(self, task_id: str,
                     poll_interval: int = 5,
                     timeout: int = 600,
                     verbose: bool = True) -> dict:
        """
        轮询等待任务完成

        Args:
            task_id: 任务ID
            poll_interval: 轮询间隔（秒）
            timeout: 超时时间（秒）
            verbose: 是否打印进度信息

        Returns:
            任务最终结果

        Raises:
            TimeoutError: 任务超时
        """
        start_time = time.time()
        attempt = 0

        print(f"\n开始轮询任务状态（ID: {task_id}）")
        print(f"轮询间隔: {poll_interval}秒，超时时间: {timeout}秒\n")

        while True:
            attempt += 1
            elapsed = time.time() - start_time

            # 检查超时
            if elapsed > timeout:
                raise TimeoutError(
                    f"任务超时（{timeout}秒），已尝试 {attempt} 次，"
                    f"耗时 {elapsed:.1f} 秒"
                )

            # 查询状态
            try:
                result = self.query_task(task_id)
            except Exception as e:
                if verbose:
                    print(f"查询失败（尝试 {attempt}）: {str(e)}")
                    print(f"等待 {poll_interval} 秒后重试...")
                time.sleep(poll_interval)
                continue

            status = result.get("status")
            is_long_task = result.get("data", {}).get("is_long_task", False)

            # 打印进度
            if verbose:
                task_type = "长任务" if is_long_task else "普通任务"
                print(f"[尝试 {attempt}] 状态: {status.upper()} | "
                      f"类型: {task_type} | "
                      f"已耗时: {elapsed:.1f}秒")

            # 任务完成或失败
            if status == "completed":
                print(f"\n✓ 任务执行成功！总耗时: {elapsed:.1f}秒")
                return result

            elif status == "failed":
                error = result.get("error", "未知错误")
                print(f"\n✗ 任务执行失败: {error}")
                return result

            # 任务仍在进行中，继续等待
            time.sleep(poll_interval)

    def get_stats(self) -> dict:
        """
        获取服务统计信息

        Returns:
            统计信息字典
        """
        url = f"{self.base_url}/stats"

        try:
            response = requests.get(url, timeout=5)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"获取统计信息失败: {str(e)}")

    def list_tasks(self, status: Optional[str] = None, limit: int = 50) -> dict:
        """
        列出所有任务

        Args:
            status: 过滤状态（pending, processing, completed, failed）
            limit: 返回数量限制

        Returns:
            任务列表
        """
        url = f"{self.base_url}/tasks"

        params = {}
        if status:
            params["status"] = status
        params["limit"] = limit

        try:
            response = requests.get(url, params=params, timeout=5)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"获取任务列表失败: {str(e)}")

    def cleanup_old_tasks(self, max_age_hours: int = 24) -> dict:
        """
        清理旧任务

        Args:
            max_age_hours: 任务最大保留时间（小时）

        Returns:
            清理结果
        """
        url = f"{self.base_url}/tasks/cleanup"

        params = {"max_age_hours": max_age_hours}

        try:
            response = requests.delete(url, params=params, timeout=30)
            response.raise_for_status()
            return response.json()

        except requests.exceptions.RequestException as e:
            raise Exception(f"清理任务失败: {str(e)}")


def print_separator(char="=", length=70):
    """打印分隔线"""
    print(char * length)


def demo_submit_and_wait():
    """演示：提交任务并等待完成"""
    print_separator()
    print("演示 1: 提交任务并等待完成")
    print_separator()

    # 创建客户端
    client = EnhancedProxyClient("http://localhost:8080")

    # 提交任务
    task_id = client.submit_task("api/function1", {
        "param1": "test_value_1",
        "param2": "test_value_2",
        "param3": 100,
        "param4": "test_value_4",
        "param5": 200
    })

    # 等待任务完成
    result = client.wait_for_task(
        task_id,
        poll_interval=3,
        timeout=300,
        verbose=True
    )

    # 显示结果
    print_separator()
    print("任务结果:")
    print_separator()
    print(json.dumps(result, indent=2, ensure_ascii=False))


def demo_check_stats():
    """演示：查看服务统计"""
    print_separator()
    print("演示 2: 查看服务统计信息")
    print_separator()

    client = EnhancedProxyClient("http://localhost:8080")

    try:
        stats = client.get_stats()
        print("\n服务统计:")
        print(json.dumps(stats, indent=2, ensure_ascii=False))

        # 打印关键信息
        print("\n关键指标:")
        print(f"  总任务数: {stats['total_tasks']}")
        print(f"  已完成: {stats['completed_tasks']}")
        print(f"  失败: {stats['failed_tasks']}")
        print(f"  长任务: {stats['long_tasks']}")
        print(f"  当前队列大小: {stats['queue_size']}")
        print(f"  活跃任务: {stats['active_tasks']}/{stats['max_concurrent']}")

    except Exception as e:
        print(f"✗ 获取统计信息失败: {str(e)}")


def demo_list_tasks():
    """演示：列出所有任务"""
    print_separator()
    print("演示 3: 列出所有任务")
    print_separator()

    client = EnhancedProxyClient("http://localhost:8080")

    try:
        # 列出所有任务
        all_tasks = client.list_tasks(limit=20)
        print(f"\n总任务数: {all_tasks['count']}")
        print(f"\n最近 {len(all_tasks['tasks'])} 个任务:")

        for i, task in enumerate(all_tasks['tasks'], 1):
            status_icon = {
                "pending": "⏳",
                "processing": "⚙️",
                "completed": "✅",
                "failed": "❌"
            }.get(task['status'], "❓")

            print(f"  {i}. {status_icon} {task['task_id'][:8]}... | "
                  f"状态: {task['status']} | "
                  f"长任务: {'是' if task['is_long_task'] else '否'}")

    except Exception as e:
        print(f"✗ 获取任务列表失败: {str(e)}")


def demo_cleanup():
    """演示：清理旧任务"""
    print_separator()
    print("演示 4: 清理旧任务")
    print_separator()

    client = EnhancedProxyClient("http://localhost:8080")

    try:
        # 清理24小时前的任务
        result = client.cleanup_old_tasks(max_age_hours=24)
        print(f"\n{result['message']}")

    except Exception as e:
        print(f"✗ 清理失败: {str(e)}")


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='增强型转发服务客户端示例',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 运行所有演示
  python3 enhanced_client_example.py --demo all

  # 只演示提交任务
  python3 enhanced_client_example.py --demo submit

  # 提交自定义任务
  python3 enhanced_client_example.py --custom-task --param1 value1 --param2 100

  # 查看统计信息
  python3 enhanced_client_example.py --stats

  # 列出所有任务
  python3 enhanced_client_example.py --list-tasks
        """
    )

    parser.add_argument(
        '--url',
        default='http://localhost:8080',
        help='转发服务URL（默认: http://localhost:8080）'
    )

    parser.add_argument(
        '--demo',
        choices=['all', 'submit', 'stats', 'list', 'cleanup'],
        help='运行指定演示'
    )

    parser.add_argument(
        '--stats',
        action='store_true',
        help='查看服务统计信息'
    )

    parser.add_argument(
        '--list-tasks',
        action='store_true',
        help='列出所有任务'
    )

    parser.add_argument(
        '--cleanup',
        action='store_true',
        help='清理旧任务'
    )

    parser.add_argument(
        '--task-id',
        help='查询指定任务状态'
    )

    parser.add_argument(
        '--wait',
        action='store_true',
        help='等待任务完成（与--task-id配合使用）'
    )

    args = parser.parse_args()

    # 如果没有指定任何操作，显示帮助
    if not any([args.demo, args.stats, args.list_tasks, args.cleanup, args.task_id]):
        parser.print_help()
        return

    try:
        # 运行演示
        if args.demo == 'all':
            demo_submit_and_wait()
            print("\n")
            demo_check_stats()
            print("\n")
            demo_list_tasks()
            print("\n")
            demo_cleanup()

        elif args.demo == 'submit':
            demo_submit_and_wait()

        elif args.demo == 'stats':
            demo_check_stats()

        elif args.demo == 'list':
            demo_list_tasks()

        elif args.demo == 'cleanup':
            demo_cleanup()

        # 单独的命令
        elif args.stats:
            demo_check_stats()

        elif args.list_tasks:
            demo_list_tasks()

        elif args.cleanup:
            demo_cleanup()

        elif args.task_id:
            client = EnhancedProxyClient(args.url)

            if args.wait:
                # 等待任务完成
                result = client.wait_for_task(args.task_id, verbose=True)
                print("\n任务结果:")
                print(json.dumps(result, indent=2, ensure_ascii=False))
            else:
                # 查询一次
                result = client.query_task(args.task_id)
                print("任务状态:")
                print(json.dumps(result, indent=2, ensure_ascii=False))

    except KeyboardInterrupt:
        print("\n\n用户中断")
    except Exception as e:
        print(f"\n✗ 错误: {str(e)}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
