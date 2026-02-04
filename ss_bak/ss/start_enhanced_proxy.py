#!/usr/bin/env python3
"""
从配置文件启动增强版转发服务
"""
import argparse
import json
import sys
from proxy_server_enhanced import ProxyConfig, run_proxy_server


def load_config(config_file: str) -> ProxyConfig:
    """从JSON文件加载配置"""
    with open(config_file, 'r') as f:
        data = json.load(f)

    return ProxyConfig(
        target_host=data['target']['host'],
        target_port=data['target']['port'],
        listen_host=data['listen']['host'],
        listen_port=data['listen']['port'],
        max_concurrent_requests=data['concurrency']['max_concurrent_requests'],
        max_queue_size=data['concurrency']['max_queue_size'],
        connect_timeout=data['timeout']['connect_timeout'],
        read_timeout=data['timeout']['read_timeout'],
        pool_connections=data['connection_pool']['pool_connections'],
        pool_maxsize=data['connection_pool']['pool_maxsize'],
        max_retries=data['retry']['max_retries'],
        retry_backoff_factor=data['retry']['retry_backoff_factor'],
        circuit_breaker_threshold=data['circuit_breaker']['threshold'],
        circuit_breaker_timeout=data['circuit_breaker']['timeout']
    )


def main():
    parser = argparse.ArgumentParser(
        description='从配置文件启动增强版转发服务'
    )
    parser.add_argument(
        '--config',
        default='proxy_config.json',
        help='配置文件路径（默认: proxy_config.json）'
    )
    parser.add_argument(
        '--target-host',
        help='覆盖配置文件中的目标主机'
    )
    parser.add_argument(
        '--read-timeout',
        type=int,
        help='覆盖配置文件中的读取超时（秒）'
    )
    parser.add_argument(
        '--max-concurrent',
        type=int,
        help='覆盖配置文件中的最大并发数'
    )

    args = parser.parse_args()

    try:
        config = load_config(args.config)

        # 命令行参数覆盖配置文件
        if args.target_host:
            config.target_host = args.target_host
        if args.read_timeout:
            config.read_timeout = args.read_timeout
        if args.max_concurrent:
            config.max_concurrent_requests = args.max_concurrent

        run_proxy_server(config)

    except FileNotFoundError:
        print(f"错误: 配置文件 {args.config} 不存在", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"错误: 配置文件格式不正确: {e}", file=sys.stderr)
        sys.exit(1)
    except KeyError as e:
        print(f"错误: 配置文件缺少必需字段: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
