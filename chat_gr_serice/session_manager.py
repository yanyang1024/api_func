"""
会话管理器 - 管理用户会话和对话历史
"""
import threading
from typing import Dict, List, Optional, Any
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class Message:
    """对话消息"""
    role: str  # 'user' 或 'assistant'
    content: str
    timestamp: datetime = field(default_factory=datetime.now)
    visualization_url: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "role": self.role,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "visualization_url": self.visualization_url
        }


@dataclass
class Session:
    """用户会话"""
    session_id: str
    messages: List[Message] = field(default_factory=list)
    current_run_id: Optional[str] = None
    waiting_for_input: bool = False
    interrupt_context: Optional[Dict[str, Any]] = None
    created_at: datetime = field(default_factory=datetime.now)

    def add_message(self, role: str, content: str, visualization_url: Optional[str] = None):
        """添加消息到会话"""
        message = Message(
            role=role,
            content=content,
            visualization_url=visualization_url
        )
        self.messages.append(message)
        return message

    def get_history_text(self) -> str:
        """获取对话历史的文本格式"""
        history = []
        for msg in self.messages:
            history.append(f"{msg.role}: {msg.content}")
        return "\n".join(history)


class SessionManager:
    """会话管理器 - 线程安全"""

    def __init__(self):
        self._sessions: Dict[str, Session] = {}
        self._lock = threading.Lock()
        self._session_counter = 0

    def create_session(self) -> Session:
        """创建新会话"""
        with self._lock:
            self._session_counter += 1
            session_id = f"session_{self._session_counter}_{int(datetime.now().timestamp())}"
            session = Session(session_id=session_id)
            self._sessions[session_id] = session
            print(f"[SessionManager] 创建会话: {session_id}")
            return session

    def get_session(self, session_id: str) -> Optional[Session]:
        """获取会话"""
        with self._lock:
            return self._sessions.get(session_id)

    def delete_session(self, session_id: str) -> bool:
        """删除会话"""
        with self._lock:
            if session_id in self._sessions:
                del self._sessions[session_id]
                print(f"[SessionManager] 删除会话: {session_id}")
                return True
            return False

    def update_session_run_id(self, session_id: str, run_id: str):
        """更新会话的当前run_id"""
        session = self.get_session(session_id)
        if session:
            session.current_run_id = run_id

    def set_waiting_state(self, session_id: str, waiting: bool, context: Optional[Dict[str, Any]] = None):
        """设置会话等待输入状态"""
        session = self.get_session(session_id)
        if session:
            session.waiting_for_input = waiting
            session.interrupt_context = context

    def get_all_sessions(self) -> List[Session]:
        """获取所有会话"""
        with self._lock:
            return list(self._sessions.values())

    def cleanup_old_sessions(self, max_age_hours: int = 24):
        """清理超时会话"""
        with self._lock:
            now = datetime.now()
            to_delete = []
            for session_id, session in self._sessions.items():
                age = now - session.created_at
                if age.total_seconds() > max_age_hours * 3600:
                    to_delete.append(session_id)

            for session_id in to_delete:
                del self._sessions[session_id]
                print(f"[SessionManager] 清理超时会话: {session_id}")

            return len(to_delete)


# 全局会话管理器实例
session_manager = SessionManager()
