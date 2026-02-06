#!/usr/bin/env python3
"""
增强版HTTP转发服务 - 支持并发控制
用于将请求从B服务器转发到C服务器，具有以下特性:
- 连接池复用
- 并发请求限制
- 请求超时控制
- 熔断机制
- 指标监控

使用方法:
    python3 proxy_server_enhanced.py --target-host <C服务器IP> --target-port 8000 --listen-port 8080
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import socket
import argparse
import sys
import threading
import queue
import time
import json
import uuid
from datetime import datetime
from typing import Tuple, Optional, Dict
from dataclasses import dataclass, field
from collections import deque
import traceback
import io

# 尝试导入更好的HTTP库
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


# ==================== 配置类 ====================

@dataclass
class ProxyConfig:
    """转发服务配置"""
    # 目标服务器
    target_host: str
    target_port: int

    # 监听配置
    listen_host: str = '0.0.0.0'
    listen_port: int = 8080

    # 并发控制
    max_concurrent_requests: int = 50  # 最大并发请求数
    max_queue_size: int = 100  # 请求队列最大长度

    # 超时配置
    connect_timeout: int = 10  # 连接超时(秒)
    read_timeout: int = 120  # 读取超时(秒)，可以动态调整

    # 连接池配置
    pool_connections: int = 20  # 连接池大小
    pool_maxsize: int = 50  # 连接池最大连接数

    # 重试配置
    max_retries: int = 2  # 失败重试次数
    retry_backoff_factor: float = 0.5  # 重试退避因子

    # 熔断配置
    circuit_breaker_threshold: int = 5  # 熔断阈值(连续失败次数)
    circuit_breaker_timeout: int = 60  # 熔断恢复时间(秒)

    # 指标配置
    enable_metrics: bool = True
    metrics_window_size: int = 1000  # 指标窗口大小


# ==================== 指标收集 ====================

@dataclass
class ProxyMetrics:
    """转发服务指标"""
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    timeout_requests: int = 0
    active_requests: int = 0
    queue_rejected: int = 0

    # 响应时间统计
    response_times: deque = field(default_factory=lambda: deque(maxlen=1000))
    recent_errors: deque = field(default_factory=lambda: deque(maxlen=100))

    # 熔断器状态
    consecutive_failures: int = 0
    circuit_open_since: Optional[float] = None

    def record_request(self, duration: float, success: bool, is_timeout: bool = False):
        """记录请求结果"""
        self.total_requests += 1
        self.response_times.append(duration)

        if success:
            self.successful_requests += 1
            self.consecutive_failures = 0
        else:
            self.failed_requests += 1
            self.consecutive_failures += 1
            self.recent_errors.append({
                'time': datetime.now().isoformat(),
                'duration': duration
            })

        if is_timeout:
            self.timeout_requests += 1

    def is_circuit_open(self, config: ProxyConfig) -> bool:
        """检查熔断器是否打开"""
        if self.consecutive_failures >= config.circuit_breaker_threshold:
            if self.circuit_open_since is None:
                self.circuit_open_since = time.time()
                return True

            # 检查是否应该恢复
            if time.time() - self.circuit_open_since > config.circuit_breaker_timeout:
                self.consecutive_failures = 0
                self.circuit_open_since = None
                return False
            return True

        self.circuit_open_since = None
        return False

    def get_stats(self) -> dict:
        """获取统计信息"""
        avg_response_time = (
            sum(self.response_times) / len(self.response_times)
            if self.response_times else 0
        )

        return {
            'total_requests': self.total_requests,
            'successful_requests': self.successful_requests,
            'failed_requests': self.failed_requests,
            'timeout_requests': self.timeout_requests,
            'active_requests': self.active_requests,
            'queue_rejected': self.queue_rejected,
            'success_rate': (
                self.successful_requests / self.total_requests * 100
                if self.total_requests > 0 else 0
            ),
            'avg_response_time': avg_response_time,
            'circuit_open': self.circuit_open_since is not None,
            'consecutive_failures': self.consecutive_failures
        }


# ==================== 任务结果存储 ====================

task_results: Dict[str, Dict] = {}

def store_task_result(task_id: str, result_data: Dict):
    """存储任务结果"""
    task_results[task_id] = {
        'timestamp': datetime.now().isoformat(),
        'result': result_data
    }

def get_task_result(task_id: str) -> Optional[Dict]:
    """获取任务结果"""
    return task_results.get(task_id)


# ==================== 请求工作池 ====================

class RequestWorkerPool:
    """请求处理工作池"""

    def __init__(self, config: ProxyConfig):
        self.config = config
        self.metrics = ProxyMetrics()
        self.semaphore = threading.Semaphore(config.max_concurrent_requests)
        self.request_queue = queue.Queue(maxsize=config.max_queue_size)

        # HTTP会话池
        self.session = None
        if HAS_REQUESTS:
            self._init_session()

        # 启动工作线程
        self.workers = []
        for i in range(config.max_concurrent_requests):
            worker = threading.Thread(target=self._worker_loop, daemon=True)
            worker.start()
            self.workers.append(worker)

    def _init_session(self):
        """初始化requests会话"""
        session = requests.Session()

        # 配置重试策略
        retry_strategy = Retry(
            total=self.config.max_retries,
            backoff_factor=self.config.retry_backoff_factor,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["HEAD", "GET", "OPTIONS", "POST", "PUT", "DELETE"]
        )

        # 配置连接池适配器
        adapter = HTTPAdapter(
            max_retries=retry_strategy,
            pool_connections=self.config.pool_connections,
            pool_maxsize=self.config.pool_maxsize
        )

        session.mount("http://", adapter)
        session.mount("https://", adapter)

        self.session = session

    def _worker_loop(self):
        """工作线程循环"""
        while True:
            try:
                # 等待获取信号量（控制并发）
                self.semaphore.acquire()

                # 从队列获取任务
                task = self.request_queue.get()

                if task is None:  # 哨兵值，退出信号
                    self.semaphore.release()
                    break

                # 执行请求
                callback, args = task
                try:
                    callback(*args)
                except Exception as e:
                    print(f"Worker error: {e}", file=sys.stderr)
                    traceback.print_exc()

                self.request_queue.task_done()
                self.semaphore.release()

            except Exception as e:
                print(f"Worker loop error: {e}", file=sys.stderr)
                if self.semaphore._value < self.config.max_concurrent_requests:
                    self.semaphore.release()

    def submit_request(self, callback, args: tuple) -> bool:
        """提交请求到工作池"""
        try:
            # 非阻塞尝试放入队列
            self.request_queue.put_nowait((callback, args))
            return True
        except queue.Full:
            self.metrics.queue_rejected += 1
            return False

    def get_stats(self) -> dict:
        """获取统计信息"""
        return {
            **self.metrics.get_stats(),
            'queue_size': self.request_queue.qsize(),
            'active_workers': sum(1 for w in self.workers if w.is_alive()),
            'available_slots': self.semaphore._value
        }


# ==================== 增强版处理器 ====================

class EnhancedProxyHTTPRequestHandler(BaseHTTPRequestHandler):
    """增强版HTTP请求转发处理器"""

    # 类变量（由服务器启动时设置）
    config: ProxyConfig = None
    worker_pool: RequestWorkerPool = None

    def log_message(self, format: str, *args):
        """自定义日志格式"""
        sys.stderr.write(f"[Proxy] {self.log_date_time_string()} - {format % args}\n")

    def _send_error_response(self, status_code: int, message: str):
        """发送错误响应"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.end_headers()
        self.wfile.write(message.encode('utf-8'))

    def _forward_request_sync(self) -> Tuple[bytes, int, dict]:
        """
        同步转发请求到目标服务器（使用urllib）

        Returns:
            (response_body, status_code, response_headers)
        """
        import urllib.request

        try:
            # 解析请求URL
            parsed_path = urlparse(self.path)
            path = parsed_path.path
            query = parsed_path.query

            # 构建目标URL
            if query:
                target_url = f"http://{self.config.target_host}:{self.config.target_port}{path}?{query}"
            else:
                target_url = f"http://{self.config.target_host}:{self.config.target_port}{path}"

            # 获取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = self.rfile.read(content_length) if content_length > 0 else None

            # 创建请求
            req = urllib.request.Request(target_url, data=request_body, method=self.command)

            # 复制请求头
            skip_headers = {'host', 'connection', 'accept-encoding', 'content-length'}
            for header, value in self.headers.items():
                if header.lower() not in skip_headers:
                    req.add_header(header, value)

            # 设置超时
            timeout = self.config.connect_timeout + self.config.read_timeout

            # 执行请求
            start_time = time.time()
            with urllib.request.urlopen(req, timeout=timeout) as response:
                response_body = response.read()
                status_code = response.status

                # 收集响应头
                response_headers = {}
                skip_response_headers = {'connection', 'transfer-encoding', 'content-encoding'}
                for header, value in response.headers.items():
                    if header.lower() not in skip_response_headers:
                        response_headers[header] = value

                duration = time.time() - start_time
                return response_body, status_code, response_headers, duration, True, False

        except urllib.error.HTTPError as e:
            error_body = e.read() if e.fp else b''
            return error_body, e.code, {}, 0, False, False

        except urllib.error.URLError as e:
            error_msg = f"Proxy Error: Cannot connect to target {self.config.target_host}:{self.config.target_port}\nReason: {e.reason}"
            return error_msg.encode('utf-8'), 502, {'Content-Type': 'text/plain'}, 0, False, False

        except socket.timeout:
            error_msg = "Proxy Error: Target server timeout"
            return error_msg.encode('utf-8'), 504, {'Content-Type': 'text/plain'}, 0, False, True

        except Exception as e:
            error_msg = f"Proxy Error: {str(e)}"
            return error_msg.encode('utf-8'), 500, {'Content-Type': 'text/plain'}, 0, False, True

    def _forward_request_async(self) -> Tuple[bytes, int, dict]:
        """
        异步转发请求到目标服务器（使用requests）

        Returns:
            (response_body, status_code, response_headers)
        """
        try:
            # 解析请求URL
            parsed_path = urlparse(self.path)
            path = parsed_path.path
            query = parsed_path.query

            # 构建目标URL
            if query:
                target_url = f"http://{self.config.target_host}:{self.config.target_port}{path}?{query}"
            else:
                target_url = f"http://{self.config.target_host}:{self.config.target_port}{path}"

            # 获取请求体
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = self.rfile.read(content_length) if content_length > 0 else None

            # 构建请求头
            headers = {}
            skip_headers = {'host', 'connection', 'accept-encoding', 'content-length'}
            for header, value in self.headers.items():
                if header.lower() not in skip_headers:
                    headers[header] = value

            # 执行请求
            start_time = time.time()
            response = self.worker_pool.session.request(
                method=self.command,
                url=target_url,
                headers=headers,
                data=request_body,
                timeout=(self.config.connect_timeout, self.config.read_timeout),
                allow_redirects=False
            )
            duration = time.time() - start_time

            # 读取响应体
            response_body = response.content

            # 收集响应头
            response_headers = {}
            skip_response_headers = {'connection', 'transfer-encoding', 'content-encoding'}
            for header, value in response.headers.items():
                if header.lower() not in skip_response_headers:
                    response_headers[header] = value

            return response_body, response.status_code, response_headers, duration, True, False

        except requests.exceptions.Timeout:
            error_msg = "Proxy Error: Target server timeout"
            return error_msg.encode('utf-8'), 504, {'Content-Type': 'text/plain'}, 0, False, True

        except requests.exceptions.ConnectionError as e:
            error_msg = f"Proxy Error: Cannot connect to target {self.config.target_host}:{self.config.target_port}\nReason: {str(e)}"
            return error_msg.encode('utf-8'), 502, {'Content-Type': 'text/plain'}, 0, False, False

        except Exception as e:
            error_msg = f"Proxy Error: {str(e)}"
            return error_msg.encode('utf-8'), 500, {'Content-Type': 'text/plain'}, 0, False, True

    def _forward_request(self) -> Tuple[bytes, int, dict]:
        """转发请求到目标服务器（根据可用库选择）"""
        # 检查熔断器
        if self.worker_pool.metrics.is_circuit_open(self.config):
            error_msg = "Proxy Error: Circuit breaker is open, target server is unreachable"
            return error_msg.encode('utf-8'), 503, {'Content-Type': 'text/plain'}

        # 选择请求方法
        if HAS_REQUESTS and self.worker_pool.session:
            return self._forward_request_async()
        else:
            return self._forward_request_sync()

    def _handle_request(self):
        """处理请求（统一入口）"""
        self.worker_pool.metrics.active_requests += 1

        start_time = time.time()
        response_body, status_code, response_headers = self._forward_request()

        # 如果返回了5个值（包含duration和success），则更新指标
        if len(response_body) == 6:
            response_body, status_code, response_headers, duration, success, is_timeout = response_body
        else:
            duration = time.time() - start_time
            success = 200 <= status_code < 500
            is_timeout = status_code == 504

        # 记录指标
        self.worker_pool.metrics.record_request(duration, success, is_timeout)
        self.worker_pool.metrics.active_requests -= 1

        # 发送响应
        self.send_response(status_code)
        for header, value in response_headers.items():
            self.send_header(header, value)
        self.end_headers()
        self.wfile.write(response_body)

    def do_GET(self):
        """处理GET请求"""
        self._handle_request()

    def do_POST(self):
        """处理POST请求"""
        self._handle_request()

    def do_PUT(self):
        """处理PUT请求"""
        self._handle_request()

    def do_DELETE(self):
        """处理DELETE请求"""
        self._handle_request()

    def do_OPTIONS(self):
        """处理OPTIONS请求（用于CORS预检）"""
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.end_headers()


# ==================== 指标监控端点 ====================

class MetricsProxyHTTPRequestHandler(EnhancedProxyHTTPRequestHandler):
    """带监控端点的代理处理器"""

    def do_GET(self):
        """处理GET请求（包含监控端点和任务结果查询）"""
        if self.path == '/proxy-metrics' or self.path == '/proxy-health':
            stats = self.worker_pool.get_stats()

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()

            health_status = "healthy" if stats['success_rate'] > 80 else "degraded"
            if stats['circuit_open']:
                health_status = "unhealthy"

            metrics_response = {
                'status': health_status,
                'timestamp': datetime.now().isoformat(),
                'config': {
                    'target': f"{self.config.target_host}:{self.config.target_port}",
                    'max_concurrent_requests': self.config.max_concurrent_requests,
                    'max_queue_size': self.config.max_queue_size,
                    'connect_timeout': self.config.connect_timeout,
                    'read_timeout': self.config.read_timeout
                },
                'metrics': stats
            }

            self.wfile.write(json.dumps(metrics_response, indent=2).encode('utf-8'))
        elif self.path.startswith('/task-result'):
            parsed_url = urlparse(self.path)
            query_params = parse_qs(parsed_url.query)
            task_id = query_params.get('id', [None])[0]

            if not task_id:
                response = {
                    'success': False,
                    'error': 'Missing required parameter: id'
                }
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
                return

            task_result = get_task_result(task_id)

            if task_result:
                response = {
                    'success': True,
                    'id': task_id,
                    'result': task_result.get('result', {}),
                    'timestamp': task_result.get('timestamp')
                }
                status_code = 200
            else:
                response = {
                    'success': False,
                    'error': f'Task not found: {task_id}'
                }
                status_code = 404

            self.send_response(status_code)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            super().do_GET()

    def do_POST(self):
        """处理POST请求（包含任务结果查询端点）"""
        if self.path.startswith('/task-result'):
            content_length = int(self.headers.get('Content-Length', 0))
            request_body = self.rfile.read(content_length) if content_length > 0 else b'{}'

            try:
                request_data = json.loads(request_body.decode('utf-8'))
                task_id = request_data.get('id')

                if not task_id:
                    response = {
                        'success': False,
                        'error': 'Missing required parameter: id'
                    }
                    self.send_response(400)
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps(response).encode('utf-8'))
                    return

                task_result = get_task_result(task_id)

                if task_result:
                    response = {
                        'success': True,
                        'id': task_id,
                        'result': task_result.get('result', {}),
                        'timestamp': task_result.get('timestamp')
                    }
                    status_code = 200
                else:
                    response = {
                        'success': False,
                        'error': f'Task not found: {task_id}'
                    }
                    status_code = 404

                self.send_response(status_code)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))

            except json.JSONDecodeError as e:
                response = {
                    'success': False,
                    'error': f'Invalid JSON: {str(e)}'
                }
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode('utf-8'))
        else:
            super().do_POST()


# ==================== 服务器启动 ====================

def run_proxy_server(config: ProxyConfig):
    """
    启动增强版代理服务器

    Args:
        config: 代理配置
    """
    # 创建工作池
    worker_pool = RequestWorkerPool(config)

    # 设置处理器类变量
    MetricsProxyHTTPRequestHandler.config = config
    MetricsProxyHTTPRequestHandler.worker_pool = worker_pool

    # 创建服务器
    server_address = (config.listen_host, config.listen_port)
    httpd = HTTPServer(server_address, MetricsProxyHTTPRequestHandler)

    print("=" * 70)
    print("增强版HTTP转发服务已启动")
    print("=" * 70)
    print(f"监听地址: {config.listen_host}:{config.listen_port}")
    print(f"目标地址: {config.target_host}:{config.target_port}")
    print(f"\n并发控制配置:")
    print(f"  最大并发请求数: {config.max_concurrent_requests}")
    print(f"  请求队列大小: {config.max_queue_size}")
    print(f"  连接超时: {config.connect_timeout}秒")
    print(f"  读取超时: {config.read_timeout}秒")
    print(f"  连接池大小: {config.pool_connections}")
    print(f"  失败重试次数: {config.max_retries}")
    print(f"  熔断阈值: {config.circuit_breaker_threshold}次连续失败")
    print(f"\n监控端点:")
    print(f"  http://{config.listen_host}:{config.listen_port}/proxy-metrics")
    print(f"  http://{config.listen_host}:{config.listen_port}/proxy-health")
    print(f"\n任务结果查询端点:")
    print(f"  POST http://{config.listen_host}:{config.listen_port}/task-result")
    print(f"  请求参数: {{\"id\": \"任务ID\"}}")
    print(f"  返回: {{\"success\": true, \"id\": \"...\", \"result\": {{...}}, \"timestamp\": \"...\"}}")
    print(f"\n使用方式:")
    print(f"  客户端访问: http://{config.listen_host}:{config.listen_port}/api/function1")
    print(f"  将被转发到:   http://{config.target_host}:{config.target_port}/api/function1")
    print("\n按 Ctrl+C 停止服务")
    print("=" * 70)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n服务器已停止")
        print(f"\n最终统计:")
        stats = worker_pool.get_stats()
        for key, value in stats.items():
            print(f"  {key}: {value}")
        httpd.shutdown()


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description='增强版HTTP转发服务 - 支持并发控制',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基本使用
  python3 proxy_server_enhanced.py --target-host 192.168.1.100 --target-port 8000

  # 自定义并发和超时
  python3 proxy_server_enhanced.py --target-host 192.168.1.100 \\
    --max-concurrent-requests 100 --read-timeout 300

  # 查看监控指标
  curl http://localhost:8080/proxy-metrics

  # 查询任务结果
  curl http://localhost:8080/task-result?id=your_task_id

  # POST查询任务结果
  curl -X POST http://localhost:8080/task-result -H "Content-Type: application/json" -d '{"id":"your_task_id"}'
        """
    )

    # 必需参数
    parser.add_argument(
        '--target-host',
        required=True,
        help='目标服务器IP地址（C服务器）'
    )

    # 目标服务器配置
    parser.add_argument(
        '--target-port',
        type=int,
        default=8000,
        help='目标服务器端口（默认: 8000）'
    )

    # 监听配置
    parser.add_argument(
        '--listen-host',
        default='0.0.0.0',
        help='监听地址（默认: 0.0.0.0）'
    )

    parser.add_argument(
        '--listen-port',
        type=int,
        default=8080,
        help='监听端口（默认: 8080）'
    )

    # 并发控制配置
    parser.add_argument(
        '--max-concurrent-requests',
        type=int,
        default=50,
        help='最大并发请求数（默认: 50）'
    )

    parser.add_argument(
        '--max-queue-size',
        type=int,
        default=100,
        help='请求队列最大长度（默认: 100）'
    )

    # 超时配置
    parser.add_argument(
        '--connect-timeout',
        type=int,
        default=10,
        help='连接超时，秒（默认: 10）'
    )

    parser.add_argument(
        '--read-timeout',
        type=int,
        default=120,
        help='读取超时，秒（默认: 120，可根据需要调整到300）'
    )

    # 连接池配置
    parser.add_argument(
        '--pool-connections',
        type=int,
        default=20,
        help='连接池大小（默认: 20）'
    )

    parser.add_argument(
        '--pool-maxsize',
        type=int,
        default=50,
        help='连接池最大连接数（默认: 50）'
    )

    # 重试配置
    parser.add_argument(
        '--max-retries',
        type=int,
        default=2,
        help='失败重试次数（默认: 2）'
    )

    parser.add_argument(
        '--retry-backoff-factor',
        type=float,
        default=0.5,
        help='重试退避因子（默认: 0.5）'
    )

    # 熔断配置
    parser.add_argument(
        '--circuit-breaker-threshold',
        type=int,
        default=5,
        help='熔断阈值-连续失败次数（默认: 5）'
    )

    parser.add_argument(
        '--circuit-breaker-timeout',
        type=int,
        default=60,
        help='熔断恢复时间，秒（默认: 60）'
    )

    args = parser.parse_args()

    if not args.target_host:
        parser.error('--target-host is required')

    print("=" * 70)
    print("参数解析确认")
    print("=" * 70)
    print(f"目标服务器: {args.target_host}:{args.target_port}")
    print(f"监听地址:   {args.listen_host}:{args.listen_port}")
    print(f"最大并发:   {args.max_concurrent_requests}")
    print(f"读取超时:   {args.read_timeout}秒")
    print("=" * 70)

    config = ProxyConfig(
        target_host=args.target_host,
        target_port=args.target_port,
        listen_host=args.listen_host,
        listen_port=args.listen_port,
        max_concurrent_requests=args.max_concurrent_requests,
        max_queue_size=args.max_queue_size,
        connect_timeout=args.connect_timeout,
        read_timeout=args.read_timeout,
        pool_connections=args.pool_connections,
        pool_maxsize=args.pool_maxsize,
        max_retries=args.max_retries,
        retry_backoff_factor=args.retry_backoff_factor,
        circuit_breaker_threshold=args.circuit_breaker_threshold,
        circuit_breaker_timeout=args.circuit_breaker_timeout
    )

    run_proxy_server(config)


if __name__ == "__main__":
    main()
