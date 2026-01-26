import datetime
import uuid

import gradio as gr
from PIL import Image, ImageDraw, ImageFont

RUN_STORE = {}


def initial_state():
    return {
        "history": [],
        "pending_run_id": None,
        "summary": "",
        "last_files": [],
        "last_gallery": [],
    }


def mock_start_workflow(user_text):
    run_id = str(uuid.uuid4())
    interrupted = "中断" in user_text or "不确定" in user_text or len(user_text.strip()) < 6
    RUN_STORE[run_id] = {
        "user_text": user_text,
        "interrupted": interrupted,
        "stage": "started",
    }
    return run_id


def mock_get_workflow_result(run_id):
    data = RUN_STORE.get(run_id)
    if not data:
        return {"status": "completed", "params": build_params("默认请求")}
    if data["interrupted"]:
        return {
            "status": "interrupted",
            "question": "工作流需要补充信息：请说明目标与数据范围",
            "context": {"user_text": data["user_text"]},
        }
    return {"status": "completed", "params": build_params(data["user_text"])}


def mock_restart_workflow(run_id, user_text):
    data = RUN_STORE.get(run_id, {})
    data["followup_text"] = user_text
    data["stage"] = "restarted"
    data["interrupted"] = False
    RUN_STORE[run_id] = data
    merged_text = f'{data.get("user_text", "")} {user_text}'.strip()
    return {"status": "completed", "params": build_params(merged_text)}


def build_params(text):
    count = max(1, min(4, max(1, len(text) // 6)))
    return {"title": f"分析: {text[:20]}", "count": count, "raw": text}


def mock_analysis_tools(params):
    files = [
        r"outputs\report.pptx",
        r"outputs\t_test.csv",
        r"outputs\rawdata.csv",
    ]
    images = [make_image(params["title"], i + 1) for i in range(params["count"])]
    return {
        "message": "Inline compare Processing completed!",
        "result": {"files": files, "images": images},
    }


def make_image(title, index):
    img = Image.new("RGBA", (2000, 1000), (245, 248, 255, 255))
    draw = ImageDraw.Draw(img)
    text = f"{title} - 图像{index}"
    try:
        font = ImageFont.truetype("arial.ttf", 60)
    except Exception:
        font = ImageFont.load_default()
    draw.text((80, 120), text, fill=(35, 45, 80, 255), font=font)
    draw.rectangle([(80, 260), (1920, 920)], outline=(60, 90, 140, 255), width=6)
    return img


def normalize_tool_output(tool_output):
    message = tool_output.get("message", "")
    result = tool_output.get("result", {})
    files = list(result.get("files", []))
    images = list(result.get("images", []))
    gallery_items = []
    for i, img in enumerate(images):
        gallery_items.append((img, f"图像{i + 1}"))
    return message, files, gallery_items


def build_summary(prev_summary, params, message, files, gallery):
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = [
        f"时间: {timestamp}",
        f"状态: 完成",
        f"解析参数: {params}",
        f"工具消息: {message}",
        f"文件: {', '.join(files) if files else '无'}",
        f"图片数量: {len(gallery)}",
    ]
    current = "\n".join(lines)
    if prev_summary:
        return f"{prev_summary}\n\n{current}"
    return current


def process_completed_result(params, prev_summary):
    tool_output = mock_analysis_tools(params)
    message, files, gallery = normalize_tool_output(tool_output)
    summary = build_summary(prev_summary, params, message, files, gallery)
    return summary, files, gallery


def handle_user_message(user_message, state):
    if not state:
        state = initial_state()
    history = state["history"]
    if state["pending_run_id"]:
        result = mock_restart_workflow(state["pending_run_id"], user_message)
        summary, files, gallery = process_completed_result(result["params"], state["summary"])
        assistant_msg = summary.split("\n\n")[-1]
        history = history + [(user_message, assistant_msg)]
        state.update(
            {
                "history": history,
                "pending_run_id": None,
                "summary": summary,
                "last_files": files,
                "last_gallery": gallery,
            }
        )
        return history, state, files, gallery, summary
    run_id = mock_start_workflow(user_message)
    result = mock_get_workflow_result(run_id)
    if result["status"] == "interrupted":
        assistant_msg = f'工作流中断，需要补充信息：{result.get("question", "请补充信息")}'
        history = history + [(user_message, assistant_msg)]
        state.update(
            {
                "history": history,
                "pending_run_id": run_id,
            }
        )
        return history, state, state["last_files"], state["last_gallery"], state["summary"]
    summary, files, gallery = process_completed_result(result["params"], state["summary"])
    assistant_msg = summary.split("\n\n")[-1]
    history = history + [(user_message, assistant_msg)]
    state.update(
        {
            "history": history,
            "summary": summary,
            "last_files": files,
            "last_gallery": gallery,
        }
    )
    return history, state, files, gallery, summary


with gr.Blocks() as demo:
    gr.Markdown("工作流对话演示")
    chatbot = gr.Chatbot(label="对话", height=420)
    summary_view = gr.Markdown(label="汇总")
    gallery_view = gr.Gallery(label="图片结果", columns=2, height=300)
    files_view = gr.JSON(label="文件路径")
    state = gr.State(value=initial_state())
    user_input = gr.Textbox(label="输入", placeholder="请输入对话内容")
    send_btn = gr.Button("发送")

    def on_send(message, state_value):
        history, new_state, files, gallery, summary = handle_user_message(message, state_value)
        return "", history, new_state, files, gallery, summary

    send_btn.click(
        fn=on_send,
        inputs=[user_input, state],
        outputs=[user_input, chatbot, state, files_view, gallery_view, summary_view],
    )
    user_input.submit(
        fn=on_send,
        inputs=[user_input, state],
        outputs=[user_input, chatbot, state, files_view, gallery_view, summary_view],
    )


if __name__ == "__main__":
    demo.launch()
