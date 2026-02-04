"""
客户端调用示例
演示如何使用Python调用API服务
"""
import requests
import base64
import json
from PIL import Image
import io
import os
from typing import Dict, List, Any


class APIClient:
    """API客户端封装"""

    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')

    def call_function(self, endpoint: str, **kwargs) -> Dict[str, Any]:
        """
        调用API函数

        Args:
            endpoint: API端点路径，如 "/api/function1"
            **kwargs: 函数参数

        Returns:
            API响应字典
        """
        url = f"{self.base_url}{endpoint}"

        try:
            response = requests.post(url, json=kwargs, timeout=300)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": str(e),
                "message": "请求失败"
            }

    def save_result_files(self, result: Dict, output_dir: str = "downloads"):
        """
        保存API返回的文件和图片

        Args:
            result: API响应结果
            output_dir: 输出目录
        """
        if not result.get('success'):
            print(f"错误: {result.get('error', '未知错误')}")
            return

        # 创建输出目录
        os.makedirs(output_dir, exist_ok=True)

        # 保存文件
        if result.get('files'):
            for file_data in result['files']:
                if file_data.get('data'):  # 检查是否有数据
                    try:
                        file_content = base64.b64decode(file_data['data'])
                        filepath = os.path.join(output_dir, file_data['filename'])
                        with open(filepath, 'wb') as f:
                            f.write(file_content)
                        print(f"✓ 已保存文件: {file_data['filename']} ({file_data['size']} bytes)")
                    except Exception as e:
                        print(f"✗ 保存文件失败 {file_data['filename']}: {e}")

        # 保存图片
        if result.get('images'):
            for img_data in result['images']:
                try:
                    img_bytes = base64.b64decode(img_data['data'])
                    img = Image.open(io.BytesIO(img_bytes))
                    filepath = os.path.join(output_dir, img_data['filename'])
                    img.save(filepath)
                    print(f"✓ 已保存图片: {img_data['filename']} ({img_data['size']})")
                except Exception as e:
                    print(f"✗ 保存图片失败 {img_data['filename']}: {e}")

        # 保存压缩包
        if result.get('archive'):
            try:
                archive_data = result['archive']
                if archive_data.get('data'):
                    archive_content = base64.b64decode(archive_data['data'])
                    archive_path = os.path.join(output_dir, archive_data['filename'])
                    with open(archive_path, 'wb') as f:
                        f.write(archive_content)
                    print(f"✓ 已保存压缩包: {archive_data['filename']} ({archive_data['size']} bytes)")
            except Exception as e:
                print(f"✗ 保存压缩包失败: {e}")

    def get_functions_list(self) -> List[Dict]:
        """获取所有可用函数列表"""
        url = f"{self.base_url}/functions"
        response = requests.get(url)
        return response.json().get('functions', [])

    def health_check(self) -> bool:
        """健康检查"""
        try:
            url = f"{self.base_url}/health"
            response = requests.get(url, timeout=5)
            return response.status_code == 200
        except:
            return False


# ==================== 使用示例 ====================

def example_1_basic_usage():
    """示例1: 基本使用"""
    print("\n" + "="*60)
    print("示例1: 基本使用")
    print("="*60)

    client = APIClient()

    # 调用function1
    result = client.call_function(
        "/api/function1",
        param1="test_data",
        param2="analysis",
        param3=100,
        param4="output",
        param5=50
    )

    print(f"\n消息: {result.get('message')}")
    print(f"成功: {result.get('success')}")
    print(f"文件数量: {len(result.get('files', []))}")
    print(f"图片数量: {len(result.get('images', []))}")

    # 保存结果
    client.save_result_files(result, output_dir="downloads/example1")


def example_2_all_functions():
    """示例2: 调用所有6个函数"""
    print("\n" + "="*60)
    print("示例2: 调用所有函数")
    print("="*60)

    client = APIClient()

    # Function 1
    print("\n[1/6] 调用 function1...")
    result = client.call_function(
        "/api/function1",
        param1="sales_data",
        param2="q1_report",
        param3=2024,
        param4="regional",
        param5=5000
    )
    client.save_result_files(result, "downloads/example2/func1")

    # Function 2
    print("\n[2/6] 调用 function2...")
    result = client.call_function(
        "/api/function2",
        param1="batch_process",
        param2=1000,
        param3="high_priority",
        param4=5,
        param5="fast",
        param6=10
    )
    client.save_result_files(result, "downloads/example2/func2")

    # Function 3
    print("\n[3/6] 调用 function3...")
    result = client.call_function(
        "/api/function3",
        name="monthly_report",
        category="finance",
        count=30,
        threshold=80,
        output="detailed"
    )
    client.save_result_files(result, "downloads/example2/func3")

    # Function 4
    print("\n[4/6] 调用 function4...")
    result = client.call_function(
        "/api/function4",
        input_file="data.csv",
        max_records=1000,
        filter_col="status",
        min_val=10,
        batch_size=50,
        offset=0
    )
    client.save_result_files(result, "downloads/example2/func4")

    # Function 5
    print("\n[5/6] 调用 function5...")
    result = client.call_function(
        "/api/function5",
        title="Sales Trend",
        x_label="Month",
        y_label="Revenue",
        data_points=12,
        color="blue"
    )
    client.save_result_files(result, "downloads/example2/func5")

    # Function 6
    print("\n[6/6] 调用 function6...")
    result = client.call_function(
        "/api/function6",
        dataset="imagenet",
        model_type="resnet50",
        epochs=50,
        batch_size=32,
        learning_rate=1,
        optimizer="adam"
    )
    client.save_result_files(result, "downloads/example2/func6")


def example_3_error_handling():
    """示例3: 错误处理"""
    print("\n" + "="*60)
    print("示例3: 错误处理")
    print("="*60)

    client = APIClient()

    # 故意传递错误参数
    result = client.call_function(
        "/api/function1",
        param1="test",
        # 缺少必需参数
    )

    if not result.get('success'):
        print(f"✗ 捕获到错误: {result.get('error')}")
    else:
        print("✓ 请求成功")


def example_4_list_functions():
    """示例4: 列出所有可用函数"""
    print("\n" + "="*60)
    print("示例4: 列出所有可用函数")
    print("="*60)

    client = APIClient()

    functions = client.get_functions_list()

    print(f"\n共有 {len(functions)} 个函数可用:\n")

    for func in functions:
        print(f"名称: {func['name']}")
        print(f"路由: {func['route']}")
        print(f"说明: {func.get('doc', '无描述')}")
        print("-" * 40)


def example_5_health_check():
    """示例5: 健康检查"""
    print("\n" + "="*60)
    print("示例5: 健康检查")
    print("="*60)

    client = APIClient()

    if client.health_check():
        print("✓ 服务运行正常")
    else:
        print("✗ 服务不可用")


def example_6_with_retry():
    """示例6: 带重试机制的调用"""
    print("\n" + "="*60)
    print("示例6: 带重试机制的调用")
    print("="*60)

    client = APIClient()

    max_retries = 3
    for attempt in range(max_retries):
        try:
            result = client.call_function(
                "/api/function1",
                param1="retry_test",
                param2="analysis",
                param3=100,
                param4="output",
                param5=50
            )

            if result.get('success'):
                print(f"✓ 第 {attempt + 1} 次尝试成功")
                client.save_result_files(result, "downloads/example6")
                break
            else:
                print(f"✗ 第 {attempt + 1} 次尝试失败: {result.get('error')}")

        except Exception as e:
            print(f"✗ 第 {attempt + 1} 次尝试异常: {e}")

        if attempt < max_retries - 1:
            print(f"等待 2 秒后重试...")
            import time
            time.sleep(2)


def example_7_save_metadata():
    """示例7: 保存元数据信息"""
    print("\n" + "="*60)
    print("示例7: 保存元数据信息")
    print("="*60)

    client = APIClient()

    result = client.call_function(
        "/api/function1",
        param1="metadata_test",
        param2="analysis",
        param3=100,
        param4="output",
        param5=50
    )

    # 保存元数据到JSON
    metadata = {
        "success": result.get('success'),
        "message": result.get('message'),
        "files_count": len(result.get('files', [])),
        "images_count": len(result.get('images', [])),
        "has_archive": result.get('archive') is not None,
        "files": [
            {
                "filename": f['filename'],
                "size": f['size'],
                "type": f['content_type']
            }
            for f in result.get('files', [])
        ],
        "images": [
            {
                "filename": img['filename'],
                "size": img['size'],
                "format": img['format']
            }
            for img in result.get('images', [])
        ]
    }

    if result.get('archive'):
        metadata['archive'] = {
            "filename": result['archive']['filename'],
            "size": result['archive']['size'],
            "type": result['archive']['content_type']
        }

    os.makedirs("downloads/example7", exist_ok=True)
    with open("downloads/example7/metadata.json", 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)

    print("✓ 元数据已保存到 downloads/example7/metadata.json")
    print(json.dumps(metadata, indent=2, ensure_ascii=False))

    # 同时保存文件、图片和压缩包
    client.save_result_files(result, "downloads/example7")


def example_8_download_archive():
    """示例8: 下载压缩包"""
    print("\n" + "="*60)
    print("示例8: 下载压缩包")
    print("="*60)

    client = APIClient()

    result = client.call_function(
        "/api/function5",
        title="Archive Test",
        x_label="Time",
        y_label="Value",
        data_points=20,
        color="red"
    )

    if result.get('success'):
        print(f"\n消息: {result.get('message')}")
        print(f"文件数量: {len(result.get('files', []))}")
        print(f"图片数量: {len(result.get('images', []))}")

        if result.get('archive'):
            print(f"\n✓ 压缩包已生成:")
            print(f"  - 文件名: {result['archive']['filename']}")
            print(f"  - 大小: {result['archive']['size']} bytes")
            print(f"  - 类型: {result['archive']['content_type']}")

            # 只保存压缩包
            os.makedirs("downloads/example8", exist_ok=True)
            archive_data = result['archive']
            archive_content = base64.b64decode(archive_data['data'])
            archive_path = os.path.join("downloads/example8", archive_data['filename'])

            with open(archive_path, 'wb') as f:
                f.write(archive_content)

            print(f"\n✓ 压缩包已保存到: {archive_path}")
            print("  你可以直接解压此文件来获取所有输出文件")
        else:
            print("\n✗ 未生成压缩包")
    else:
        print(f"\n✗ 请求失败: {result.get('error')}")


# ==================== 主程序 ====================

def main():
    """运行所有示例"""
    print("\n" + "="*60)
    print("Python API 客户端调用示例")
    print("="*60)
    print("\n请确保API服务正在运行: python main.py")
    print("服务地址: http://localhost:8000")

    # 等待用户确认
    input("\n按Enter键开始运行示例...")

    try:
        # 运行示例
        example_5_health_check()
        example_4_list_functions()
        example_1_basic_usage()
        example_3_error_handling()
        example_7_save_metadata()
        example_6_with_retry()
        example_8_download_archive()

        # 运行所有函数（需要更多时间）
        choice = input("\n是否运行所有6个函数示例？(y/n): ")
        if choice.lower() == 'y':
            example_2_all_functions()

        print("\n" + "="*60)
        print("所有示例运行完成!")
        print("="*60)
        print("\n查看生成的文件:")
        print("  - downloads/example1/")
        print("  - downloads/example2/")
        print("  - downloads/example6/")
        print("  - downloads/example7/")
        print("  - downloads/example8/ (压缩包示例)")

    except KeyboardInterrupt:
        print("\n\n用户中断")
    except Exception as e:
        print(f"\n✗ 发生错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
