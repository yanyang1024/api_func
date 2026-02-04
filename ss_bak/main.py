"""
主应用入口
注册所有函数并启动API服务
"""
from fastapi import FastAPI
from api_service import registry
from sample_functions import (
    function_1, function_2, function_3,
    function_4, function_5, function_6
)

# 注册所有函数到API服务
# 格式：registry.register("/api路径", "函数名")

@registry.register("/api/function1", "function_1")
def wrap_function_1(param1: str, param2: str, param3: int, param4: str, param5: int):
    """包装函数1 - 执行数据分析任务"""
    return function_1(param1, param2, param3, param4, param5)


@registry.register("/api/function2", "function_2")
def wrap_function_2(param1: str, param2: int, param3: str, param4: int, param5: str, param6: int):
    """包装函数2 - 执行批量处理任务"""
    return function_2(param1, param2, param3, param4, param5, param6)


@registry.register("/api/function3", "function_3")
def wrap_function_3(name: str, category: str, count: int, threshold: int, output: str):
    """包装函数3 - 执行报表生成任务"""
    return function_3(name, category, count, threshold, output)


@registry.register("/api/function4", "function_4")
def wrap_function_4(input_file: str, max_records: int, filter_col: str, min_val: int, batch_size: int, offset: int):
    """包装函数4 - 执行数据过滤任务"""
    return function_4(input_file, max_records, filter_col, min_val, batch_size, offset)


@registry.register("/api/function5", "function_5")
def wrap_function_5(title: str, x_label: str, y_label: str, data_points: int, color: str):
    """包装函数5 - 执行可视化任务"""
    return function_5(title, x_label, y_label, data_points, color)


@registry.register("/api/function6", "function_6")
def wrap_function_6(dataset: str, model_type: str, epochs: int, batch_size: int, learning_rate: int, optimizer: str):
    """包装函数6 - 执行模型训练任务"""
    return function_6(dataset, model_type, epochs, batch_size, learning_rate, optimizer)


# 导入app实例（用于uvicorn启动）
from api_service import app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
