"""
样例函数模块
模拟6个不同参数的函数，实际使用时替换为你的真实函数
"""
import pandas as pd
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import io
import os
from typing import Dict, List, Tuple


def create_sample_image(text: str, width: int = 800, height: int = 600) -> Image.Image:
    """创建样例图片"""
    img = Image.new('RGBA', (width, height), color=(73, 109, 137))
    draw = ImageDraw.Draw(img)

    # 绘制一些简单的图形
    draw.rectangle([50, 50, width-50, height-50], outline=(255, 255, 255), width=3)
    draw.ellipse([100, 100, 300, 300], fill=(255, 100, 100))

    # 添加文本
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 40)
    except:
        font = ImageFont.load_default()

    draw.text((width//2, height//2), text, fill=(255, 255, 255), font=font, anchor="mm")

    return img


def create_sample_csv(data: dict, filename: str) -> str:
    """创建样例CSV文件"""
    df = pd.DataFrame(data)
    os.makedirs("outputs", exist_ok=True)
    filepath = os.path.join("outputs", filename)
    df.to_csv(filepath, index=False)
    return filepath


def function_1(param1: str, param2: str, param3: int, param4: str, param5: int) -> Dict:
    """
    样例函数1 - 5个参数
    实际使用时替换为你的真实函数
    """
    # 模拟处理逻辑
    data = {
        'id': range(1, 11),
        'param1': [param1] * 10,
        'param2': [param2] * 10,
        'param3': [param3] * 10,
        'param4': [param4] * 10,
        'param5': [param5] * 10,
        'value': np.random.randn(10).tolist()
    }

    csv_file = create_sample_csv(data, f"function1_{param1}.csv")

    # 创建多个图片
    images = [
        create_sample_image(f"Func1 - {param1}", 800, 600),
        create_sample_image(f"Chart - {param2}", 1000, 500),
        create_sample_image(f"Analysis - {param3}", 600, 400)
    ]

    return {
        "message": f"Function 1 Processing completed for {param1}!",
        "result": {
            "files": [csv_file, f"report_{param1}.ppt", f"rawdata_{param1}.csv"],
            "images": images
        }
    }


def function_2(param1: str, param2: int, param3: str, param4: int, param5: str, param6: int) -> Dict:
    """
    样例函数2 - 6个参数
    """
    data = {
        'id': range(1, 16),
        'param1': [param1] * 15,
        'param2': [param2] * 15,
        'param3': [param3] * 15,
        'value1': np.random.randint(1, 100, 15).tolist(),
        'value2': np.random.randn(15).tolist()
    }

    csv_file = create_sample_csv(data, f"function2_{param1}.csv")

    images = [
        create_sample_image(f"Func2 Analysis", 1200, 800),
        create_sample_image(f"Data: {param1}", 900, 600)
    ]

    return {
        "message": f"Function 2 completed with {param6} iterations!",
        "result": {
            "files": [csv_file, "summary.ppt", "details.csv"],
            "images": images
        }
    }


def function_3(name: str, category: str, count: int, threshold: int, output: str) -> Dict:
    """
    样例函数3 - 5个参数（不同命名）
    """
    data = {
        'index': range(1, 21),
        'name': [name] * 20,
        'category': [category] * 20,
        'count': [count] * 20,
        'threshold': [threshold] * 20,
        'metric': np.random.random(20).tolist()
    }

    csv_file = create_sample_csv(data, f"function3_{name}.csv")

    images = [
        create_sample_image(f"Report: {name}", 1000, 700),
        create_sample_image(f"Category: {category}", 800, 600),
        create_sample_image(f"Output: {output}", 600, 500)
    ]

    return {
        "message": f"Function 3 generated report for {name}!",
        "result": {
            "files": [csv_file, "presentation.pptx", "raw_data.csv"],
            "images": images
        }
    }


def function_4(input_file: str, max_records: int, filter_col: str, min_val: int, batch_size: int, offset: int) -> Dict:
    """
    样例函数4 - 6个参数
    """
    data = {
        'record_id': range(1, 26),
        'input_file': [input_file] * 25,
        'filter_col': [filter_col] * 25,
        'min_val': [min_val] * 25,
        'batch_size': [batch_size] * 25,
        'offset': [offset] * 25,
        'score': np.random.uniform(0, 100, 25).tolist()
    }

    csv_file = create_sample_csv(data, f"function4_{input_file}.csv")

    images = [
        create_sample_image(f"File: {input_file}", 1100, 750),
        create_sample_image(f"Filtered by {filter_col}", 900, 600)
    ]

    return {
        "message": f"Function 4 processed {max_records} records!",
        "result": {
            "files": [csv_file, "results.ppt", "source.csv"],
            "images": images
        }
    }


def function_5(title: str, x_label: str, y_label: str, data_points: int, color: str) -> Dict:
    """
    样例函数5 - 5个参数
    """
    data = {
        'point_id': range(1, data_points + 1),
        'title': [title] * data_points,
        'x_label': [x_label] * data_points,
        'y_label': [y_label] * data_points,
        'color': [color] * data_points,
        'x_value': np.random.randn(data_points).tolist(),
        'y_value': np.random.randn(data_points).tolist()
    }

    csv_file = create_sample_csv(data, f"function5_{title}.csv")

    images = [
        create_sample_image(f"Chart: {title}", 1000, 600),
        create_sample_image(f"Color: {color}", 800, 800),
        create_sample_image(f"Points: {data_points}", 700, 500),
        create_sample_image(f"Axis: {x_label} vs {y_label}", 900, 600)
    ]

    return {
        "message": f"Function 5 created visualization: {title}!",
        "result": {
            "files": [csv_file, "chart.ppt", "data.csv"],
            "images": images
        }
    }


def function_6(dataset: str, model_type: str, epochs: int, batch_size: int, learning_rate: int, optimizer: str) -> Dict:
    """
    样例函数6 - 6个参数
    """
    data = {
        'epoch': range(1, epochs + 1),
        'dataset': [dataset] * epochs,
        'model_type': [model_type] * epochs,
        'batch_size': [batch_size] * epochs,
        'learning_rate': [learning_rate] * epochs,
        'optimizer': [optimizer] * epochs,
        'loss': np.random.uniform(0, 1, epochs).tolist(),
        'accuracy': np.random.uniform(0.7, 0.99, epochs).tolist()
    }

    csv_file = create_sample_csv(data, f"function6_{dataset}.csv")

    images = [
        create_sample_image(f"Model: {model_type}", 1200, 800),
        create_sample_image(f"Dataset: {dataset}", 1000, 600),
        create_sample_image(f"Optimizer: {optimizer}", 800, 600)
    ]

    return {
        "message": f"Function 6 trained model on {dataset}!",
        "result": {
            "files": [csv_file, "model_report.ppt", "training_data.csv"],
            "images": images
        }
    }
