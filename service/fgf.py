import pandas as pd
import os
from pathlib import Path

def merge_xlsx_files(input_folder, output_file):
    """
    合并多个XLSX文件到一个XLSX文件中，每个原文件作为一个子表
    
    Args:
        input_folder (str): 包含XLSX文件的文件夹路径
        output_file (str): 合并后的输出文件路径
    
    Returns:
        bool: 合并成功返回True，否则返回False
    """
    try:
        # 获取所有XLSX文件
        input_path = Path(input_folder)
        xlsx_files = list(input_path.glob("*.xlsx"))
        
        if not xlsx_files:
            print("未找到任何XLSX文件")
            return False
        
        # 创建ExcelWriter对象
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            for file_path in xlsx_files:
                try:
                    # 读取Excel文件
                    df = pd.read_excel(file_path)
                    
                    # 使用文件名（不含扩展名）作为工作表名称
                    sheet_name = file_path.stem
                    
                    # 如果工作表名称超过31个字符，进行截断
                    if len(sheet_name) > 31:
                        sheet_name = sheet_name[:31]
                    
                    # 写入到新的工作表
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
                    
                    print(f"已处理: {file_path.name} -> 工作表: {sheet_name}")
                    
                except Exception as e:
                    print(f"处理文件 {file_path.name} 时出错: {e}")
                    continue
        
        print(f"\n合并完成！输出文件: {output_file}")
        print(f"共处理了 {len(xlsx_files)} 个文件")
        return True
        
    except Exception as e:
        print(f"合并过程中出错: {e}")
        return False

# 使用示例
if __name__ == "__main__":
    # 示例用法
    input_dir = "input_xlsx_files"  # 包含XLSX文件的文件夹
    output_path = "merged_output.xlsx"  # 输出文件路径
    
    # 调用合并函数
    success = merge_xlsx_files(input_dir, output_path)
    
    if success:
        print("文件合并成功！")
    else:
        print("文件合并失败！")


我来帮您创建一个Python函数来合并多个XLSX文件。首先让我检查一下当前目录中是否有相关的Python文件或依赖项。
        
            
toolName: view_folder
            
status: success
          
d:\apiservice_build\service
          

        
            
toolName: search_by_regex
            
status: success
          
query: pandas|openpyxl|xlsx
          
我看到当前目录中没有Python文件，也没有检测到pandas或openpyxl相关的依赖。让我为您创建一个完整的Python函数来合并多个XLSX文件。

```python d:\apiservice_build\service\merge_xlsx.py
import pandas as pd
import os
from pathlib import Path

def merge_xlsx_files(input_folder, output_file):
    """
    合并多个XLSX文件到一个XLSX文件中，每个原文件作为一个子表
    
    Args:
        input_folder (str): 包含XLSX文件的文件夹路径
        output_file (str): 合并后的输出文件路径
    
    Returns:
        bool: 合并成功返回True，否则返回False
    """
    try:
        # 获取所有XLSX文件
        input_path = Path(input_folder)
        xlsx_files = list(input_path.glob("*.xlsx"))
        
        if not xlsx_files:
            print("未找到任何XLSX文件")
            return False
        
        # 创建ExcelWriter对象
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            for file_path in xlsx_files:
                try:
                    # 读取Excel文件
                    df = pd.read_excel(file_path)
                    
                    # 使用文件名（不含扩展名）作为工作表名称
                    sheet_name = file_path.stem
                    
                    # 如果工作表名称超过31个字符，进行截断
                    if len(sheet_name) > 31:
                        sheet_name = sheet_name[:31]
                    
                    # 写入到新的工作表
                    df.to_excel(writer, sheet_name=sheet_name, index=False)
                    
                    print(f"已处理: {file_path.name} -> 工作表: {sheet_name}")
                    
                except Exception as e:
                    print(f"处理文件 {file_path.name} 时出错: {e}")
                    continue
        
        print(f"\n合并完成！输出文件: {output_file}")
        print(f"共处理了 {len(xlsx_files)} 个文件")
        return True
        
    except Exception as e:
        print(f"合并过程中出错: {e}")
        return False

# 使用示例
if __name__ == "__main__":
    # 示例用法
    input_dir = "input_xlsx_files"  # 包含XLSX文件的文件夹
    output_path = "merged_output.xlsx"  # 输出文件路径
    
    # 调用合并函数
    success = merge_xlsx_files(input_dir, output_path)
    
    if success:
        print("文件合并成功！")
    else:
        print("文件合并失败！")
```

## 功能说明

这个Python函数具有以下特点：

1. **自动查找XLSX文件**：自动扫描指定文件夹中的所有`.xlsx`文件
2. **保持原文件名**：每个原文件的内容会作为一个单独的工作表，工作表名称使用原文件名（不含扩展名）
3. **错误处理**：包含完善的异常处理，即使某个文件处理失败也不会影响其他文件
4. **工作表名称限制**：自动处理工作表名称长度限制（Excel限制工作表名最多31个字符）

## 安装依赖

在使用前，您需要安装必要的Python库：

```bash
pip install pandas openpyxl
```

## 使用方法

1. 将需要合并的XLSX文件放在一个文件夹中（例如 `input_xlsx_files`）
2. 修改代码中的 `input_dir` 和 `output_path` 变量为您的实际路径
3. 运行脚本：`python merge_xlsx.py`

## 示例

假设您有以下文件：
- `销售数据.xlsx` → 工作表名称为"销售数据"
- `库存信息.xlsx` → 工作表名称为"库存信息" 
- `客户列表.xlsx` → 工作表名称为"客户列表"

合并后的文件将包含这三个工作表，每个工作表对应一个原文件的内容。

您可以根据需要修改代码中的路径和参数。这个函数会处理大多数常见的XLSX文件合并需求。