"""
API服务测试脚本
用于验证所有API端点是否正常工作
"""
import requests
import json
from typing import Dict, Any


class APITester:
    """API测试器"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.passed = 0
        self.failed = 0
        self.results = []

    def test(self, name: str, method: str, endpoint: str, data: Dict = None):
        """执行单个测试"""
        print(f"\n{'='*60}")
        print(f"测试: {name}")
        print(f"{'='*60}")
        print(f"方法: {method} {endpoint}")

        if data:
            print(f"参数: {json.dumps(data, indent=2)}")

        try:
            url = f"{self.base_url}{endpoint}"

            if method.upper() == "GET":
                response = requests.get(url, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, timeout=300)
            else:
                raise ValueError(f"不支持的HTTP方法: {method}")

            # 检查响应状态
            response.raise_for_status()
            result = response.json()

            # 验证响应格式
            if endpoint != "/health" and endpoint != "/" and endpoint != "/functions":
                if 'success' not in result:
                    print("✗ 失败: 响应缺少 'success' 字段")
                    self.failed += 1
                    return

                if not result.get('success'):
                    print(f"✗ 失败: {result.get('error', '未知错误')}")
                    self.failed += 1
                    return

            # 测试通过
            print("✓ 通过")

            # 显示关键信息
            if result.get('message'):
                print(f"  消息: {result['message']}")

            if result.get('files'):
                print(f"  文件数: {len(result['files'])}")

            if result.get('images'):
                print(f"  图片数: {len(result['images'])}")

            self.passed += 1
            self.results.append({
                'name': name,
                'status': 'PASS',
                'response_time': response.elapsed.total_seconds()
            })

        except requests.exceptions.ConnectionError:
            print("✗ 失败: 无法连接到服务器")
            print(f"  请确保服务正在运行: python main.py")
            self.failed += 1
            self.results.append({'name': name, 'status': 'FAIL', 'error': 'Connection refused'})

        except requests.exceptions.Timeout:
            print("✗ 失败: 请求超时")
            self.failed += 1
            self.results.append({'name': name, 'status': 'FAIL', 'error': 'Timeout'})

        except Exception as e:
            print(f"✗ 失败: {str(e)}")
            self.failed += 1
            self.results.append({'name': name, 'status': 'FAIL', 'error': str(e)})

    def print_summary(self):
        """打印测试总结"""
        print("\n" + "="*60)
        print("测试总结")
        print("="*60)
        total = self.passed + self.failed
        print(f"总计: {total}")
        print(f"通过: {self.passed} ✓")
        print(f"失败: {self.failed} ✗")
        print(f"成功率: {(self.passed/total*100):.1f}%" if total > 0 else "N/A")

        if self.failed > 0:
            print("\n失败的测试:")
            for result in self.results:
                if result['status'] == 'FAIL':
                    print(f"  ✗ {result['name']}: {result.get('error', 'Unknown error')}")


def run_all_tests():
    """运行所有测试"""
    print("\n" + "="*60)
    print("Python API 服务测试套件")
    print("="*60)
    print("\n正在检查服务状态...")

    tester = APITester()

    # 1. 健康检查
    tester.test("健康检查", "GET", "/health")

    # 如果服务不可用，提前退出
    if tester.failed > 0:
        print("\n❌ 服务未运行，请先启动服务:")
        print("   python main.py")
        return

    # 2. 根路径
    tester.test("根路径信息", "GET", "/")

    # 3. 函数列表
    tester.test("函数列表", "GET", "/functions")

    # 4. Function 1 (5个参数)
    tester.test(
        "Function 1 - 数据分析",
        "POST",
        "/api/function1",
        {
            "param1": "test_data",
            "param2": "analysis",
            "param3": 100,
            "param4": "output",
            "param5": 50
        }
    )

    # 5. Function 2 (6个参数)
    tester.test(
        "Function 2 - 批量处理",
        "POST",
        "/api/function2",
        {
            "param1": "batch_001",
            "param2": 500,
            "param3": "priority",
            "param4": 3,
            "param5": "normal",
            "param6": 20
        }
    )

    # 6. Function 3 (5个参数)
    tester.test(
        "Function 3 - 报表生成",
        "POST",
        "/api/function3",
        {
            "name": "monthly_report",
            "category": "finance",
            "count": 30,
            "threshold": 80,
            "output": "detailed"
        }
    )

    # 7. Function 4 (6个参数)
    tester.test(
        "Function 4 - 数据过滤",
        "POST",
        "/api/function4",
        {
            "input_file": "sales.csv",
            "max_records": 1000,
            "filter_col": "status",
            "min_val": 10,
            "batch_size": 50,
            "offset": 0
        }
    )

    # 8. Function 5 (5个参数)
    tester.test(
        "Function 5 - 可视化",
        "POST",
        "/api/function5",
        {
            "title": "Sales Trend",
            "x_label": "Month",
            "y_label": "Revenue",
            "data_points": 12,
            "color": "blue"
        }
    )

    # 9. Function 6 (6个参数)
    tester.test(
        "Function 6 - 模型训练",
        "POST",
        "/api/function6",
        {
            "dataset": "imagenet",
            "model_type": "resnet50",
            "epochs": 10,
            "batch_size": 32,
            "learning_rate": 1,
            "optimizer": "adam"
        }
    )

    # 10. 错误处理测试
    tester.test(
        "错误处理 - 缺少参数",
        "POST",
        "/api/function1",
        {
            "param1": "test"
            # 故意缺少其他必需参数
        }
    )

    # 打印总结
    tester.print_summary()


def interactive_test():
    """交互式测试"""
    print("\n" + "="*60)
    print("交互式API测试")
    print("="*60)

    tester = APITester()

    print("\n可用测试:")
    print("1. 健康检查")
    print("2. Function 1")
    print("3. Function 2")
    print("4. Function 3")
    print("5. Function 4")
    print("6. Function 5")
    print("7. Function 6")
    print("8. 运行所有测试")

    choice = input("\n选择测试 (1-8): ").strip()

    if choice == "1":
        tester.test("健康检查", "GET", "/health")
    elif choice == "2":
        tester.test("Function 1", "POST", "/api/function1", {
            "param1": "test", "param2": "demo", "param3": 100, "param4": "out", "param5": 50
        })
    elif choice == "3":
        tester.test("Function 2", "POST", "/api/function2", {
            "param1": "test", "param2": 100, "param3": "demo", "param4": 1, "param5": "fast", "param6": 5
        })
    elif choice == "4":
        tester.test("Function 3", "POST", "/api/function3", {
            "name": "test", "category": "demo", "count": 10, "threshold": 50, "output": "simple"
        })
    elif choice == "5":
        tester.test("Function 4", "POST", "/api/function4", {
            "input_file": "test.csv", "max_records": 100, "filter_col": "id", "min_val": 1, "batch_size": 10, "offset": 0
        })
    elif choice == "6":
        tester.test("Function 5", "POST", "/api/function5", {
            "title": "Test", "x_label": "X", "y_label": "Y", "data_points": 10, "color": "red"
        })
    elif choice == "7":
        tester.test("Function 6", "POST", "/api/function6", {
            "dataset": "test", "model_type": "cnn", "epochs": 5, "batch_size": 16, "learning_rate": 1, "optimizer": "sgd"
        })
    elif choice == "8":
        run_all_tests()
    else:
        print("无效选择")

    tester.print_summary()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "-i":
        interactive_test()
    else:
        run_all_tests()
