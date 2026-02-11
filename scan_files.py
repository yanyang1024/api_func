import os
from typing import List, Tuple


def scan_files_by_size(directory: str, descending: bool = True) -> List[str]:
    """
    递归扫描目录下所有文件，并按文件大小排序返回文件路径列表。

    Args:
        directory: 要扫描的目录路径
        descending: 是否按降序排列（大文件在前），默认为True

    Returns:
        按文件大小排序的文件路径列表

    Raises:
        ValueError: 如果目录不存在
    """
    if not os.path.isdir(directory):
        raise ValueError(f"目录不存在: {directory}")

    file_list: List[Tuple[str, int]] = []

    for root, dirs, files in os.walk(directory):
        for filename in files:
            filepath = os.path.join(root, filename)
            try:
                size = os.path.getsize(filepath)
                file_list.append((filepath, size))
            except OSError:
                # 跳过无法访问的文件
                continue

    # 按大小排序
    file_list.sort(key=lambda x: x[1], reverse=descending)

    # 返回文件路径列表
    return [filepath for filepath, _ in file_list]


def scan_files_with_size(directory: str, descending: bool = True) -> List[Tuple[str, int]]:
    """
    递归扫描目录下所有文件，并按文件大小排序返回文件路径和大小。

    Args:
        directory: 要扫描的目录路径
        descending: 是否按降序排列（大文件在前），默认为True

    Returns:
        按文件大小排序的 (文件路径, 文件大小) 元组列表
    """
    if not os.path.isdir(directory):
        raise ValueError(f"目录不存在: {directory}")

    file_list: List[Tuple[str, int]] = []

    for root, dirs, files in os.walk(directory):
        for filename in files:
            filepath = os.path.join(root, filename)
            try:
                size = os.path.getsize(filepath)
                file_list.append((filepath, size))
            except OSError:
                continue

    file_list.sort(key=lambda x: x[1], reverse=descending)
    return file_list


if __name__ == "__main__":
    # 示例用法
    import sys

    if len(sys.argv) > 1:
        target_dir = sys.argv[1]
    else:
        target_dir = "."

    print(f"扫描目录: {target_dir}\n")

    # 只获取文件路径
    files = scan_files_by_size(target_dir)
    print(f"共找到 {len(files)} 个文件:\n")

    # 获取文件路径和大小
    files_with_size = scan_files_with_size(target_dir)
    for filepath, size in files_with_size[:20]:  # 只显示前20个
        print(f"{size:>12,} bytes  {filepath}")

    if len(files_with_size) > 20:
        print(f"\n... 还有 {len(files_with_size) - 20} 个文件")
