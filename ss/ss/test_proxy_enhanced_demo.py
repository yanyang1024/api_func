#!/usr/bin/env python3
"""
简单演示脚本 - 展示增强版转发服务的基本功能
"""
import time
import json

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("警告: 未安装requests库，功能受限")


def test_health_check():
    """测试健康检查"""
    print("\n" + "="*50)
    print("测试1: 健康检查")
    print("="*50)

    if not HAS_REQUESTS:
        print("跳过（需要requests库）")
        return

    try:
        response = requests.get("http://localhost:8080/proxy-health", timeout=5)
        data = response.json()
        print(f"状态: {data.get('status')}")
        print(f"✅ 健康检查通过")
    except Exception as e:
        print(f"❌ 错误: {e}")


def test_metrics():
    """测试指标端点"""
    print("\n" + "="*50)
    print("测试2: 查看指标")
    print("="*50)

    if not HAS_REQUESTS:
        print("跳过（需要requests库）")
        return

    try:
        response = requests.get("http://localhost:8080/proxy-metrics", timeout=5)
        data = response.json()

        print(f"\n服务状态: {data.get('status')}")
        print(f"目标服务器: {data['config']['target']}")
        print(f"\n配置:")
        for key, value in data['config'].items():
            if key != 'target':
                print(f"  {key}: {value}")

        print(f"\n指标:")
        metrics = data['metrics']
        print(f"  总请求数: {metrics['total_requests']}")
        print(f"  成功请求: {metrics['successful_requests']}")
        print(f"  失败请求: {metrics['failed_requests']}")
        print(f"  成功率: {metrics['success_rate']:.2f}%")
        print(f"  平均响应时间: {metrics['avg_response_time']:.3f}秒")
        print(f"  当前活跃: {metrics['active_requests']}")
        print(f"  队列长度: {metrics['queue_size']}")
        print(f"  可用槽位: {metrics['available_slots']}")

        if metrics.get('response_times'):
            print(f"\n响应时间统计:")
            print(f"  最小: {metrics['min_response_time']:.3f}秒")
            print(f"  最大: {metrics['max_response_time']:.3f}秒")
            print(f"  中位数: {metrics['median_response_time']:.3f}秒")

        print(f"\n✅ 指标获取成功")
    except Exception as e:
        print(f"❌ 错误: {e}")


def test_simple_request():
    """测试简单请求"""
    print("\n" + "="*50)
    print("测试3: 转发请求")
    print("="*50)

    if not HAS_REQUESTS:
        print("跳过（需要requests库）")
        return

    # 假设后端有 /health 端点
    test_url = "http://localhost:8080/health"

    print(f"发送请求到: {test_url}")

    try:
        start = time.time()
        response = requests.get(test_url, timeout=10)
        elapsed = time.time() - start

        print(f"状态码: {response.status_code}")
        print(f"响应时间: {elapsed:.3f}秒")
        print(f"✅ 请求成功")
    except requests.exceptions.Timeout:
        print(f"❌ 请求超时")
    except Exception as e:
        print(f"❌ 错误: {e}")


def test_concurrent_requests():
    """测试并发请求"""
    print("\n" + "="*50)
    print("测试4: 并发请求")
    print("="*50)

    if not HAS_REQUESTS:
        print("跳过（需要requests库）")
        return

    import threading

    test_url = "http://localhost:8080/health"
    num_requests = 10
    num_concurrent = 5

    results = {'success': 0, 'failed': 0, 'lock': threading.Lock()}

    def make_request(request_id):
        try:
            start = time.time()
            response = requests.get(test_url, timeout=10)
            elapsed = time.time() - start

            with results['lock']:
                if response.status_code == 200:
                    results['success'] += 1
                else:
                    results['failed'] += 1

            print(f"  请求#{request_id}: {response.status_code} - {elapsed:.3f}秒")
        except Exception as e:
            with results['lock']:
                results['failed'] += 1
            print(f"  请求#{request_id}: 失败 - {e}")

    print(f"发送 {num_requests} 个请求，并发数 {num_concurrent}")

    # 使用线程池
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=num_concurrent) as executor:
        futures = [executor.submit(make_request, i) for i in range(1, num_requests + 1)]
        for future in futures:
            future.result()

    print(f"\n结果: 成功 {results['success']}, 失败 {results['failed']}")
    print(f"✅ 并发测试完成")


def main():
    """主函数"""
    print("\n" + "="*60)
    print("  增强版转发服务 - 功能演示")
    print("="*60)

    if not HAS_REQUESTS:
        print("\n⚠️  警告: 未安装requests库")
        print("   建议安装: pip install requests")
        print("   当前仅展示基本功能\n")

    # 检查服务是否运行
    if HAS_REQUESTS:
        try:
            requests.get("http://localhost:8080/proxy-health", timeout=2)
        except Exception:
            print("❌ 转发服务未启动")
            print("\n请先启动服务:")
            print("  ./start_proxy_with_concurrency_control.sh")
            print("  或:")
            print("  python3 proxy_server_enhanced.py --target-host <目标IP>")
            return

    # 运行测试
    test_health_check()
    test_metrics()
    test_simple_request()
    test_concurrent_requests()

    print("\n" + "="*60)
    print("  演示完成！")
    print("="*60)
    print("\n下一步:")
    print("  1. 查看详细文档: cat CONCURRENCY_CONTROL_GUIDE.md")
    print("  2. 运行负载测试: python3 test_concurrent_load.py --help")
    print("  3. 监控服务状态: curl http://localhost:8080/proxy-metrics | jq")
    print()


if __name__ == "__main__":
    main()
