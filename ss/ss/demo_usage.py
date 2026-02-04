#!/usr/bin/env python3
"""
增强型转发服务使用演示

这个脚本演示了如何使用增强型转发服务的主要功能
"""

import time
import json


def demo_basic_usage():
    """演示基本使用流程"""
    print("=" * 70)
    print("增强型转发服务使用演示")
    print("=" * 70)
    print()

    print("步骤1: 启动增强型转发服务")
    print("-" * 70)
    print("命令:")
    print("  python3 enhanced_proxy_server.py \\")
    print("    --target-host 192.168.1.100 \\")
    print("    --target-port 8000 \\")
    print("    --listen-port 8080 \\")
    print("    --max-concurrent 10 \\")
    print("    --num-workers 5")
    print()
    print("或使用启动脚本:")
    print("  ./start_enhanced_proxy.sh --target-host 192.168.1.100")
    print()

    print("步骤2: 使用Python客户端提交任务")
    print("-" * 70)
    print("代码:")
    print("""
    from enhanced_client_example import EnhancedProxyClient

    # 创建客户端
    client = EnhancedProxyClient("http://localhost:8080")

    # 提交任务
    task_id = client.submit_task("api/function1", {
        "param1": "value1",
        "param2": "value2",
        "param3": 100,
        "param4": "value4",
        "param5": 200
    })

    print(f"任务已提交，ID: {task_id}")
    """)
    print()

    print("步骤3: 查询任务状态")
    print("-" * 70)
    print("代码:")
    print("""
    # 方式1: 单次查询
    status = client.query_task(task_id)
    print(f"任务状态: {status['status']}")

    # 方式2: 轮询等待完成
    result = client.wait_for_task(
        task_id,
        poll_interval=5,  # 每5秒查询一次
        timeout=600,      # 最长等待10分钟
        verbose=True      # 显示进度
    )

    if result['success']:
        print("任务执行成功!")
        print(f"结果: {result['result']}")
    else:
        print(f"任务执行失败: {result['error']}")
    """)
    print()

    print("步骤4: 查看服务统计")
    print("-" * 70)
    print("代码:")
    print("""
    stats = client.get_stats()

    print("服务统计:")
    print(f"  总任务数: {stats['total_tasks']}")
    print(f"  已完成: {stats['completed_tasks']}")
    print(f"  失败: {stats['failed_tasks']}")
    print(f"  长任务: {stats['long_tasks']}")
    print(f"  当前队列: {stats['queue_size']}")
    print(f"  活跃任务: {stats['active_tasks']}")
    """)
    print()


def demo_curl_commands():
    """演示使用curl命令"""
    print("=" * 70)
    print("使用curl命令调用API")
    print("=" * 70)
    print()

    print("1. 提交任务")
    print("-" * 70)
    print("""
curl -X POST http://localhost:8080/api/function1 \\
  -H "Content-Type: application/json" \\
  -d '{
    "param1": "value1",
    "param2": "value2",
    "param3": 100,
    "param4": "value4",
    "param5": 200
  }'

# 返回:
# {
#   "success": true,
#   "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#   "status": "pending",
#   "message": "任务已创建"
# }
    """)
    print()

    print("2. 查询任务状态")
    print("-" * 70)
    print("""
curl http://localhost:8080/task/a1b2c3d4-e5f6-7890-abcd-ef1234567890

# 返回:
# {
#   "success": true,
#   "task_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
#   "status": "processing",
#   "data": {
#     "is_long_task": true,
#     "created_at": "2026-02-04T18:30:00"
#   }
# }
    """)
    print()

    print("3. 查看服务统计")
    print("-" * 70)
    print("""
curl http://localhost:8080/stats

# 返回:
# {
#   "total_tasks": 150,
#   "completed_tasks": 120,
#   "failed_tasks": 5,
#   "long_tasks": 25,
#   "current_queue_size": 10,
#   "max_concurrent": 10
# }
    """)
    print()

    print("4. 列出所有任务")
    print("-" * 70)
    print("""
curl http://localhost:8080/tasks

# 返回所有任务的列表
    """)
    print()

    print("5. 清理旧任务")
    print("-" * 70)
    print("""
curl -X DELETE "http://localhost:8080/tasks/cleanup?max_age_hours=24"

# 返回:
# {
#   "success": true,
#   "removed_count": 42
# }
    """)
    print()


def demo_long_task_handling():
    """演示长任务处理"""
    print("=" * 70)
    print("长任务处理示例")
    print("=" * 70)
    print()

    print("场景: 执行一个需要10分钟的任务")
    print("-" * 70)
    print("""
# 1. 提交任务（立即返回）
task_id = client.submit_task("api/function6", {
    "dataset": "large_dataset.csv",
    "model_type": "deep_learning",
    "epochs": 1000,
    "batch_size": 32,
    "learning_rate": 1,
    "optimizer": "adam"
})

print(f"任务已提交: {task_id}")
# 输出: 任务已提交: a1b2c3d4-e5f6-7890-abcd-ef1234567890

# 2. 轮询查询状态（不会阻塞其他请求）
import time

for i in range(20):  # 最多查询20次
    status = client.query_task(task_id)
    state = status['status']

    print(f"第{i+1}次查询: {state}")

    if state == 'completed':
        print("任务完成!")
        print(f"结果: {status['result']}")
        break
    elif state == 'failed':
        print("任务失败!")
        print(f"错误: {status['error']}")
        break

    time.sleep(30)  # 每30秒查询一次

# 3. 也可以使用自动轮询
result = client.wait_for_task(
    task_id,
    poll_interval=30,  # 每30秒查询
    timeout=720,       # 最长等待12分钟
    verbose=True       # 显示进度
)
    """)
    print()

    print("优势:")
    print("-" * 70)
    print("✓ 立即返回task_id，不会阻塞客户端")
    print("✓ 可以随时查询任务进度")
    print("✓ 长任务不会阻塞其他请求")
    print("✓ 支持超时配置（最长10分钟）")
    print("✓ 自动识别长任务（> 5分钟）")
    print()


def demo_performance_comparison():
    """演示性能对比"""
    print("=" * 70)
    print("性能对比: 原版 vs 增强版")
    print("=" * 70)
    print()

    comparison_table = """
| 指标           | 原版 (proxy_server.py) | 增强版 (enhanced_proxy_server.py) |
|----------------|------------------------|----------------------------------|
| 并发模型       | 同步阻塞               | 异步非阻塞                       |
| 并发能力       | ~10                    | ~100+                           |
| 队列管理       | 无                     | 有（可配置）                     |
| 长任务支持     | 超时失败               | 异步执行 + 状态查询              |
| 响应延迟       | 等待任务完成           | 立即返回task_id                  |
| 状态查询       | 不支持                 | 支持                             |
| 统计监控       | 无                     | 详细统计                         |
| 适用场景       | 低并发、短任务         | 高并发、长任务                   |
    """

    print(comparison_table)
    print()


def demo_configuration_tuning():
    """演示配置调优"""
    print("=" * 70)
    print("配置调优建议")
    print("=" * 70)
    print()

    print("1. 低配置服务器 (2核4G)")
    print("-" * 70)
    print("""
python3 enhanced_proxy_server.py \\
    --target-host 192.168.1.100 \\
    --max-concurrent 5 \\
    --max-queue-size 50 \\
    --num-workers 3

说明:
- max_concurrent: 5 = CPU核心数的2.5倍
- max_queue_size: 50 = 适中的队列大小
- num_workers: 3 = 略小于max_concurrent
    """)
    print()

    print("2. 中等配置服务器 (4核8G)")
    print("-" * 70)
    print("""
python3 enhanced_proxy_server.py \\
    --target-host 192.168.1.100 \\
    --max-concurrent 10 \\
    --max-queue-size 100 \\
    --num-workers 5

说明:
- 默认配置，适合大多数场景
    """)
    print()

    print("3. 高配置服务器 (8核16G+)")
    print("-" * 70)
    print("""
python3 enhanced_proxy_server.py \\
    --target-host 192.168.1.100 \\
    --max-concurrent 50 \\
    --max-queue-size 500 \\
    --num-workers 20

说明:
- max_concurrent: 50 = CPU核心数的6倍+
- max_queue_size: 500 = 大队列缓冲
- num_workers: 20 = 充足的后台处理能力
    """)
    print()


def main():
    """主函数"""
    print()
    print("*" * 70)
    print("*" + " " * 68 + "*")
    print("*" + "  增强型转发服务 - 完整使用演示".center(68) + "*")
    print("*" + " " * 68 + "*")
    print("*" * 70)
    print()

    # 演示1: 基本使用
    demo_basic_usage()

    # 演示2: curl命令
    demo_curl_commands()

    # 演示3: 长任务处理
    demo_long_task_handling()

    # 演示4: 性能对比
    demo_performance_comparison()

    # 演示5: 配置调优
    demo_configuration_tuning()

    print("=" * 70)
    print("更多文档和示例")
    print("=" * 70)
    print()
    print("完整使用指南:")
    print("  - ENHANCED_PROXY_README.md")
    print()
    print("快速参考:")
    print("  - ENHANCED_PROXY_QUICKSTART.md")
    print()
    print("版本对比:")
    print("  - PROXY_COMPARISON.md")
    print()
    print("优化总结:")
    print("  - OPTIMIZATION_SUMMARY.md")
    print()
    print("客户端示例:")
    print("  - enhanced_client_example.py")
    print()
    print("测试脚本:")
    print("  - ./test_enhanced_proxy.sh")
    print()


if __name__ == "__main__":
    main()
