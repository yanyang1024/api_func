"""
测试脚本 - 验证修复后的功能
演示PIL图片对象序列化和空字符串容错处理
"""
import sys
import os

# 添加项目路径
sys.path.insert(0, '/home/yy/ss')

from PIL import Image
from typing import Dict


def mock_inline_compare_function(param1: str, param2: str) -> Dict:
    """
    模拟你的 Inline Compare 函数
    演示返回格式的正确用法
    """
    # 模拟生成一些文件路径（可能包含空字符串）
    ppt_file_path = ""  # 假设没有生成PPT文件
    csv_file_path = "/home/yy/ss/outputs/test_data.csv"
    rawdata_csv_path = ""  # 假设原始数据文件不存在

    # 创建 outputs 目录
    os.makedirs("outputs", exist_ok=True)

    # 创建一个测试 CSV 文件
    import pandas as pd
    df = pd.DataFrame({
        'id': [1, 2, 3],
        'value': [10, 20, 30]
    })
    df.to_csv(csv_file_path, index=False)

    # 创建一些测试图片（PIL 图片对象）
    images = [
        Image.new('RGB', (2000, 1000), color='red'),
        Image.new('RGB', (800, 600), color='blue'),
        Image.new('RGBA', (1024, 768), color=(255, 0, 0, 128))
    ]

    # 返回符合要求的格式
    return {
        "message": "Inline compare Processing completed!",
        "result": {
            "files": [ppt_file_path, csv_file_path, rawdata_csv_path],  # 包含空字符串
            "images": images  # PIL 图片对象列表
        }
    }


def test_process_function_result():
    """测试 process_function_result 函数"""
    print("="*60)
    print("测试 process_function_result 函数")
    print("="*60)

    from api_service import process_function_result

    # 调用模拟函数
    result = mock_inline_compare_function("test", "analysis")
    print(f"\n原始返回值:")
    print(f"  消息: {result['message']}")
    print(f"  文件路径: {result['result']['files']}")
    print(f"  图片数量: {len(result['result']['images'])}")
    print(f"  图片类型: {[type(img).__name__ for img in result['result']['images']]}")

    # 处理结果
    processed = process_function_result(result)

    print(f"\n处理后的结果:")
    print(f"  消息: {processed['message']}")
    print(f"  文件数量: {len(processed['files'])}")
    print(f"  图片数量: {len(processed['images'])}")

    # 验证文件处理（空字符串应该被过滤）
    print(f"\n文件详情:")
    for i, file_obj in enumerate(processed['files']):
        print(f"  文件 {i+1}: {file_obj.filename} ({file_obj.size} bytes)")

    # 验证图片处理（PIL对象应该被转换为base64）
    print(f"\n图片详情:")
    for i, img_obj in enumerate(processed['images']):
        print(f"  图片 {i+1}: {img_obj.filename} ({img_obj.size}) - {img_obj.format}")

    # 测试 JSON 序列化
    print(f"\n测试 JSON 序列化:")
    try:
        import json
        json_str = json.dumps(processed, default=str)
        print(f"  ✓ JSON 序列化成功！")
        print(f"  JSON 长度: {len(json_str)} 字符")
    except Exception as e:
        print(f"  ✗ JSON 序列化失败: {e}")
        return False

    return True


def test_create_zip_archive():
    """测试压缩包创建功能"""
    print("\n" + "="*60)
    print("测试 create_zip_archive 函数")
    print("="*60)

    from api_service import create_zip_archive, file_to_base64
    from PIL import Image
    import io
    import base64

    # 创建一些测试文件
    os.makedirs("outputs", exist_ok=True)

    # 创建测试 CSV
    import pandas as pd
    csv_path = "/home/yy/ss/outputs/test1.csv"
    df = pd.DataFrame({'a': [1, 2, 3], 'b': [4, 5, 6]})
    df.to_csv(csv_path, index=False)

    # 创建测试图片
    img1 = Image.new('RGB', (800, 600), color='red')
    img2 = Image.new('RGB', (1024, 768), color='blue')

    # 转换为 Base64Image
    from api_service import image_to_base64
    base64_images = [
        image_to_base64(img1, "image1.png"),
        image_to_base64(img2, "image2.png")
    ]

    print(f"\n测试文件:")
    print(f"  文件: {csv_path}")
    print(f"  图片数量: {len(base64_images)}")

    # 创建压缩包
    print(f"\n创建压缩包...")
    try:
        archive = create_zip_archive(
            [csv_path],
            base64_images,
            zip_name="test_archive.zip"
        )

        print(f"  ✓ 压缩包创建成功!")
        print(f"  文件名: {archive.filename}")
        print(f"  大小: {archive.size} bytes")
        print(f"  类型: {archive.content_type}")
        print(f"  Base64 长度: {len(archive.data)} 字符")

        # 保存压缩包到文件
        archive_content = base64.b64decode(archive.data)
        archive_path = "/home/yy/ss/outputs/test_download.zip"
        with open(archive_path, 'wb') as f:
            f.write(archive_content)

        print(f"\n  ✓ 压缩包已保存到: {archive_path}")
        print(f"  你可以解压此文件验证内容")

        return True

    except Exception as e:
        print(f"  ✗ 创建压缩包失败: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """运行所有测试"""
    print("\n" + "="*60)
    print("修复功能测试")
    print("="*60)

    results = []

    # 测试1: 处理函数结果
    try:
        result1 = test_process_function_result()
        results.append(("process_function_result", result1))
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        results.append(("process_function_result", False))

    # 测试2: 创建压缩包
    try:
        result2 = test_create_zip_archive()
        results.append(("create_zip_archive", result2))
    except Exception as e:
        print(f"\n✗ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        results.append(("create_zip_archive", False))

    # 总结
    print("\n" + "="*60)
    print("测试总结")
    print("="*60)

    for test_name, passed in results:
        status = "✓ 通过" if passed else "✗ 失败"
        print(f"  {test_name}: {status}")

    all_passed = all(r[1] for r in results)

    print("\n" + "="*60)
    if all_passed:
        print("所有测试通过! ✓")
    else:
        print("部分测试失败! ✗")
    print("="*60)

    return all_passed


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
