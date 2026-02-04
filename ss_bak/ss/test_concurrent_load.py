#!/usr/bin/env python3
"""
高并发负载测试脚本
测试转发服务在高并发情况下的表现
"""
import argparse
import threading
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta
import statistics

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False
    print("警告: 未安装requests库，将使用urllib，功能受限")


class LoadTestResult:
    """负载测试结果"""
    def __init__(self):
        self.total_requests = 0
        self.successful_requests = 0
        self.failed_requests = 0
        self.timeout_requests = 0
        self.response_times = []
        self.errors = []
        self.lock = threading.Lock()

    def add_result(self, success: bool, response_time: float, error: str = None):
        with self.lock:
            self.total_requests += 1
            if success:
                self.successful_requests += 1
            else:
                self.failed_requests += 1
                if error and 'timeout' in error.lower():
                    self.timeout_requests += 1

            self.response_times.append(response_time)
            if error:
                self.errors.append(error)

    def get_stats(self) -> dict:
        with self.lock:
            if not self.response_times:
                return {
                    'total_requests': self.total_requests,
                    'successful_requests': self.successful_requests,
                    'failed_requests': self.failed_requests,
                    'timeout_requests': self.timeout_requests,
                    'success_rate': 0,
                    'avg_response_time': 0,
                    'min_response_time': 0,
                    'max_response_time': 0,
                    'median_response_time': 0,
                    'p95_response_time': 0,
                    'p99_response_time': 0,
                    'requests_per_second': 0,
                    'error_summary': {}
                }

            sorted_times = sorted(self.response_times)
            total_duration = max(self.response_times) if self.response_times else 0

            # 统计错误
            error_summary = {}
            for error in self.errors:
                error_type = error.split(':')[0] if ':' in error else error
                error_type = error_type.strip()
                error_summary[error_type] = error_summary.get(error_type, 0) + 1

            return {
                'total_requests': self.total_requests,
                'successful_requests': self.successful_requests,
                'failed_requests': self.failed_requests,
                'timeout_requests': self.timeout_requests,
                'success_rate': (self.successful_requests / self.total_requests * 100) if self.total_requests > 0 else 0,
                'avg_response_time': statistics.mean(self.response_times),
                'min_response_time': min(self.response_times),
                'max_response_time': max(self.response_times),
                'median_response_time': statistics.median(self.response_times),
                'p95_response_time': sorted_times[int(len(sorted_times) * 0.95)] if len(sorted_times) >= 20 else sorted_times[-1],
                'p99_response_time': sorted_times[int(len(sorted_times) * 0.99)] if len(sorted_times) >= 100 else sorted_times[-1],
                'requests_per_second': self.total_requests / total_duration if total_duration > 0 else 0,
                'error_summary': error_summary
            }


def make_request(url: str, timeout: int, result: LoadTestResult, request_id: int):
    """执行单个请求"""
    start_time = time.time()

    try:
        if HAS_REQUESTS:
            response = requests.get(url, timeout=timeout)
            success = 200 <= response.status_code < 500
            error = None if success else f"HTTP {response.status_code}"
        else:
            import urllib.request
            with urllib.request.urlopen(url, timeout=timeout) as response:
                success = 200 <= response.status < 500
                error = None if success else f"HTTP {response.status}"

        response_time = time.time() - start_time
        result.add_result(success, response_time, error)

        if request_id % 10 == 0:  # 每10个请求打印一次进度
            print(f"  请求 #{request_id}: {response_time:.2f}s - {'成功' if success else '失败'}")

    except requests.exceptions.Timeout if HAS_REQUESTS else Exception as e:
        response_time = time.time() - start_time
        error_str = f"Timeout: {str(e)}"
        result.add_result(False, response_time, error_str)
        if request_id % 10 == 0:
            print(f"  请求 #{request_id}: {response_time:.2f}s - 超时")

    except Exception as e:
        response_time = time.time() - start_time
        error_str = f"Error: {str(e)}"
        result.add_result(False, response_time, error_str)
        if request_id % 10 == 0:
            print(f"  请求 #{request_id}: {response_time:.2f}s - 错误: {e}")


def run_load_test(url: str, total_requests: int, concurrent: int, timeout: int, duration: int = None):
    """
    运行负载测试

    Args:
        url: 测试URL
        total_requests: 总请求数
        concurrent: 并发数
        timeout: 请求超时（秒）
        duration: 测试持续时间（秒），如果指定则忽略total_requests
    """
    result = LoadTestResult()
    start_time = time.time()

    print("=" * 70)
    print("负载测试开始")
    print("=" * 70)
    print(f"目标URL: {url}")
    print(f"并发数: {concurrent}")
    print(f"总请求数: {total_requests}")
    print(f"请求超时: {timeout}秒")
    if duration:
        print(f"测试持续时间: {duration}秒")
    print("=" * 70)

    try:
        if duration:
            # 基于时间的测试
            print(f"\n开始持续{duration}秒的负载测试...\n")

            def worker():
                request_id = 0
                while time.time() - start_time < duration:
                    request_id += 1
                    make_request(url, timeout, result, request_id)
                    time.sleep(0.01)  # 小延迟，避免过于密集

            threads = []
            for i in range(concurrent):
                t = threading.Thread(target=worker, daemon=True)
                t.start()
                threads.append(t)

            # 等待测试完成
            for t in threads:
                t.join()

        else:
            # 基于请求数的测试
            print(f"\n开始{total_requests}个请求的负载测试...\n")

            with ThreadPoolExecutor(max_workers=concurrent) as executor:
                futures = []
                for i in range(1, total_requests + 1):
                    future = executor.submit(make_request, url, timeout, result, i)
                    futures.append(future)

                # 等待所有请求完成
                for future in as_completed(futures):
                    pass

    except KeyboardInterrupt:
        print("\n\n测试被用户中断")

    total_duration = time.time() - start_time

    # 打印结果
    print("\n" + "=" * 70)
    print("负载测试完成")
    print("=" * 70)
    print(f"总测试时间: {total_duration:.2f}秒")

    stats = result.get_stats()
    print(f"\n请求统计:")
    print(f"  总请求数: {stats['total_requests']}")
    print(f"  成功请求: {stats['successful_requests']}")
    print(f"  失败请求: {stats['failed_requests']}")
    print(f"  超时请求: {stats['timeout_requests']}")
    print(f"  成功率: {stats['success_rate']:.2f}%")
    print(f"  吞吐量: {stats['requests_per_second']:.2f} 请求/秒")

    if stats['response_times']:
        print(f"\n响应时间统计:")
        print(f"  平均: {stats['avg_response_time']:.3f}秒")
        print(f"  最小: {stats['min_response_time']:.3f}秒")
        print(f"  最大: {stats['max_response_time']:.3f}秒")
        print(f"  中位数: {stats['median_response_time']:.3f}秒")
        print(f"  P95: {stats['p95_response_time']:.3f}秒")
        print(f"  P99: {stats['p99_response_time']:.3f}秒")

    if stats['error_summary']:
        print(f"\n错误汇总:")
        for error_type, count in stats['error_summary'].items():
            print(f"  {error_type}: {count}次")

    print("=" * 70)

    # 返回是否测试通过（成功率>90%且超时率<5%）
    timeout_rate = (stats['timeout_requests'] / stats['total_requests'] * 100) if stats['total_requests'] > 0 else 0
    passed = stats['success_rate'] >= 90 and timeout_rate < 5

    if passed:
        print("\n✅ 测试通过！服务在高并发下表现良好")
    else:
        print("\n⚠️  测试未通过，建议调整并发参数")

    return passed


def main():
    parser = argparse.ArgumentParser(
        description='高并发负载测试',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本测试：100个请求，10个并发
  python3 test_concurrent_load.py --url http://localhost:8080/api/health

  # 高并发测试：1000个请求，50个并发
  python3 test_concurrent_load.py --url http://localhost:8080/api/health \\
    --total-requests 1000 --concurrent 50

  # 持续测试：运行60秒
  python3 test_concurrent_load.py --url http://localhost:8080/api/health \\
    --duration 60 --concurrent 100

  # 测试慢速后端（5分钟超时）
  python3 test_concurrent_load.py --url http://localhost:8080/api/slow-function \\
    --timeout 300 --concurrent 20
        """
    )

    parser.add_argument(
        '--url',
        required=True,
        help='测试URL'
    )

    parser.add_argument(
        '--total-requests',
        type=int,
        default=100,
        help='总请求数（默认: 100）'
    )

    parser.add_argument(
        '--concurrent',
        type=int,
        default=10,
        help='并发数（默认: 10）'
    )

    parser.add_argument(
        '--timeout',
        type=int,
        default=30,
        help='请求超时，秒（默认: 30）'
    )

    parser.add_argument(
        '--duration',
        type=int,
        help='测试持续时间（秒），指定后将忽略--total-requests'
    )

    args = parser.parse_args()

    # 运行测试
    passed = run_load_test(
        url=args.url,
        total_requests=args.total_requests,
        concurrent=args.concurrent,
        timeout=args.timeout,
        duration=args.duration
    )

    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
