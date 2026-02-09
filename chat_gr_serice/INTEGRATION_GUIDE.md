# 工作流集成指南

本文档说明如何将实际的工作流服务集成到系统中。

## 快速替换步骤

### 1. 修改 `workflow_mock.py`

将 `workflow_mock.py` 重命名为 `workflow_service.py`，然后替换以下函数：

```python
# workflow_service.py

class WorkflowService:
    def __init__(self):
        # 初始化您的服务连接
        pass

    def start_workflow(self, user_input: str) -> str:
        """
        启动工作流
        :param user_input: 用户输入的自然语言字符串
        :return: runID
        """
        # TODO: 调用您的工作流启动API
        # 示例：
        # response = your_api.start_workflow(input=user_input)
        # return response.run_id

        raise NotImplementedError("请实现您的工作流启动逻辑")

    def get_workflow_info(self, run_id: str) -> Dict[str, Any]:
        """
        获取工作流信息
        :param run_id: 工作流运行ID
        :return: {
            "run_id": str,
            "status": "interrupt" | "success" | "fail",
            "message": str,
            "visualization_url": str | None,
            "interrupt_info": dict | None  # 仅在interrupt状态时需要
        }
        """
        # TODO: 调用您的查询API
        # 示例：
        # response = your_api.get_status(run_id=run_id)
        # return {
        #     "run_id": response.run_id,
        #     "status": response.status,
        #     "message": response.message,
        #     "visualization_url": response.chart_url,
        #     "interrupt_info": response.context
        # }

        raise NotImplementedError("请实现您的工作流查询逻辑")

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        """
        重启中断的工作流
        :param user_input: 用户补充信息
        :param run_id: 原工作流ID
        :return: 新的runID
        """
        # TODO: 调用您的重启API
        # 示例：
        # response = your_api.restart_workflow(
        #     run_id=run_id,
        #     additional_input=user_input
        # )
        # return response.new_run_id

        raise NotImplementedError("请实现您的工作流重启逻辑")
```

### 2. 更新导入

在 `app.py` 和 `async_processor.py` 中更新导入：

```python
# 修改前
from workflow_mock import workflow_service, WorkflowStatus

# 修改后
from workflow_service import workflow_service, WorkflowStatus
```

### 3. 状态映射

确保您的工作流状态正确映射到系统状态：

```python
class WorkflowStatus(Enum):
    INTERRUPT = "interrupt"  # 工作流中断，需要用户输入
    SUCCESS = "success"      # 工作流成功完成
    FAIL = "fail"           # 工作流失败
```

您的工作流状态应该映射到这三个状态之一。

## 集成示例

### 示例1: REST API集成

```python
import requests

class WorkflowService:
    BASE_URL = "https://your-api.com/workflow"

    def start_workflow(self, user_input: str) -> str:
        response = requests.post(
            f"{self.BASE_URL}/start",
            json={"input": user_input},
            timeout=30
        )
        response.raise_for_status()
        return response.json()["run_id"]

    def get_workflow_info(self, run_id: str) -> Dict[str, Any]:
        response = requests.get(
            f"{self.BASE_URL}/status/{run_id}",
            timeout=10
        )
        response.raise_for_status()
        data = response.json()

        return {
            "run_id": run_id,
            "status": data["status"],  # 确保返回 "interrupt", "success", 或 "fail"
            "message": data.get("message", ""),
            "visualization_url": data.get("chart_url"),
            "interrupt_info": data.get("context")
        }

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        response = requests.post(
            f"{self.BASE_URL}/restart",
            json={
                "run_id": run_id,
                "additional_input": user_input
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()["new_run_id"]
```

### 示例2: SDK集成

```python
from your_workflow_sdk import WorkflowClient

class WorkflowService:
    def __init__(self):
        self.client = WorkflowClient(
            api_key="your-api-key",
            endpoint="https://your-workflow-service.com"
        )

    def start_workflow(self, user_input: str) -> str:
        workflow = self.client.start(input=user_input)
        return workflow.id

    def get_workflow_info(self, run_id: str) -> Dict[str, Any]:
        workflow = self.client.get(run_id)

        # 状态映射
        status_map = {
            "WAITING_INPUT": "interrupt",
            "COMPLETED": "success",
            "FAILED": "fail",
            "ERROR": "fail"
        }

        return {
            "run_id": run_id,
            "status": status_map.get(workflow.status, "fail"),
            "message": workflow.result_message,
            "visualization_url": workflow.chart_url,
            "interrupt_info": workflow.context if workflow.status == "WAITING_INPUT" else None
        }

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        new_workflow = self.client.resume(
            run_id=run_id,
            additional_input=user_input
        )
        return new_workflow.id
```

### 示例3: 消息队列集成

```python
import pika
import uuid
import json

class WorkflowService:
    def __init__(self):
        self.connection = pika.BlockingConnection(
            pika.ConnectionParameters('localhost')
        )
        self.channel = self.connection.channel()
        self.response_queue = self.channel.queue_declare(queue='', exclusive=True).method.queue
        self.channel.basic_consume(
            queue=self.response_queue,
            on_message_callback=self._on_response,
            auto_ack=True
        )
        self.corr_id = None
        self.response = None

    def _on_response(self, ch, method, props, body):
        if self.corr_id == props.correlation_id:
            self.response = json.loads(body)

    def _call(self, message):
        self.response = None
        self.corr_id = str(uuid.uuid4())
        self.channel.basic_publish(
            exchange='',
            routing_key='workflow_queue',
            properties=pika.BasicProperties(
                reply_to=self.response_queue,
                correlation_id=self.corr_id,
            ),
            body=json.dumps(message)
        )
        while self.response is None:
            self.connection.process_data_events(time_limit=1)
        return self.response

    def start_workflow(self, user_input: str) -> str:
        response = self._call({
            "action": "start",
            "input": user_input
        })
        return response["run_id"]

    def get_workflow_info(self, run_id: str) -> Dict[str, Any]:
        response = self._call({
            "action": "status",
            "run_id": run_id
        })
        return {
            "run_id": run_id,
            "status": response["status"],
            "message": response.get("message"),
            "visualization_url": response.get("chart_url"),
            "interrupt_info": response.get("context")
        }

    def restart_workflow(self, user_input: str, run_id: str) -> str:
        response = self._call({
            "action": "restart",
            "run_id": run_id,
            "additional_input": user_input
        })
        return response["new_run_id"]
```

## 测试集成

集成完成后，运行测试脚本验证：

```bash
python test_app.py
```

确保所有测试通过后再启动Web应用。

## 常见问题

### Q1: 工作流处理时间很长怎么办？

系统已实现异步处理，长时间运行不会阻塞界面。用户可以点击"刷新状态"按钮查看最新进度。

### Q2: 如何处理工作流超时？

在 `async_processor.py` 中添加超时处理：

```python
async def run(self):
    try:
        # 添加超时限制
        result = await asyncio.wait_for(
            self._fetch_workflow_result(),
            timeout=300.0  # 5分钟超时
        )
        return result
    except asyncio.TimeoutError:
        return {
            "status": WorkflowStatus.FAIL,
            "message": "工作流处理超时，请稍后重试"
        }
```

### Q3: 如何添加认证？

在工作流服务中添加认证头：

```python
def start_workflow(self, user_input: str) -> str:
    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {self.api_key}"},
        json={"input": user_input}
    )
    return response.json()["run_id"]
```

## 配置调整

根据实际工作流特性，调整 `config.py` 中的配置：

```python
# 如果工作流处理时间较长，增加超时时间
WORKFLOW_TIMEOUT_SECONDS = 600  # 10分钟

# 如果需要更高并发，增加worker数量
MAX_ASYNC_WORKERS = 20

# 如果轮询间隔需要调整
WORKFLOW_POLL_INTERVAL_SECONDS = 2  # 每2秒查询一次
```
