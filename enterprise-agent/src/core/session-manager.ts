import * as fs from "node:fs/promises";
import * as path from "node:path";
import { v4 as uuidv4 } from "uuid";
import { Message, SessionInfo } from "../types.js";

export interface SessionStorage {
  sessions: Map<string, SessionData>;
  metadata: Map<string, SessionMetadata>;
}

export interface SessionData {
  id: string;
  agentId: string;
  workspaceDir: string;
  messages: Message[];
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionMetadata {
  id: string;
  title?: string;
  tags?: string[];
  summary?: string;
  pinned?: boolean;
}

export class SessionManager {
  private storage: SessionStorage;
  private sessionDir: string;
  private metadataDir: string;

  constructor(sessionDir: string) {
    this.sessionDir = sessionDir;
    this.metadataDir = path.join(sessionDir, ".metadata");
    this.storage = {
      sessions: new Map(),
      metadata: new Map(),
    };
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.sessionDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
    
    // 加载现有会话
    await this.loadAllSessions();
  }

  async createSession(agentId: string, workspaceDir: string): Promise<SessionData> {
    const sessionId = uuidv4();
    const now = Date.now();

    const session: SessionData = {
      id: sessionId,
      agentId,
      workspaceDir,
      messages: [],
      createdAt: now,
      lastActiveAt: now,
    };

    this.storage.sessions.set(sessionId, session);
    await this.saveSession(session);

    return session;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return this.storage.sessions.get(sessionId) || null;
  }

  async getSessionByWorkspace(workspaceDir: string): Promise<SessionData | null> {
    for (const session of this.storage.sessions.values()) {
      if (session.workspaceDir === workspaceDir) {
        return session;
      }
    }
    return null;
  }

  async addMessage(sessionId: string, message: Message): Promise<void> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    session.messages.push(message);
    session.lastActiveAt = Date.now();
    
    await this.saveSession(session);
  }

  async getMessages(sessionId: string): Promise<Message[]> {
    const session = this.storage.sessions.get(sessionId);
    return session?.messages || [];
  }

  async getMessagesAfter(sessionId: string, timestamp: number): Promise<Message[]> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    return session.messages.filter(m => m.timestamp > timestamp);
  }

  async setMessages(sessionId: string, messages: Message[]): Promise<void> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) {
      throw new Error(`会话不存在: ${sessionId}`);
    }

    session.messages = messages;
    session.lastActiveAt = Date.now();
    
    await this.saveSession(session);
  }

  async deleteSession(sessionId: string): Promise<void> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // 删除会话文件
    const sessionPath = path.join(this.sessionDir, `${sessionId}.json`);
    await fs.rm(sessionPath, { force: true });

    // 删除元数据
    const metadataPath = path.join(this.metadataDir, `${sessionId}.json`);
    await fs.rm(metadataPath, { force: true });

    this.storage.sessions.delete(sessionId);
    this.storage.metadata.delete(sessionId);
  }

  async clearAllSessions(): Promise<void> {
    for (const sessionId of this.storage.sessions.keys()) {
      await this.deleteSession(sessionId);
    }
  }

  async listSessions(agentId?: string): Promise<SessionInfo[]> {
    const sessions: SessionInfo[] = [];

    for (const session of this.storage.sessions.values()) {
      if (!agentId || session.agentId === agentId) {
        const metadata = this.storage.metadata.get(session.id);
        sessions.push({
          id: session.id,
          agentId: session.agentId,
          createdAt: session.createdAt,
          lastActiveAt: session.lastActiveAt,
          messageCount: session.messages.length,
          workspaceDir: session.workspaceDir,
        });
      }
    }

    // 按最后活跃时间排序
    sessions.sort((a, b) => b.lastActiveAt - a.lastActiveAt);

    return sessions;
  }

  async updateMetadata(
    sessionId: string,
    metadata: Partial<SessionMetadata>
  ): Promise<void> {
    const existing = this.storage.metadata.get(sessionId) || { id: sessionId };
    const updated = { ...existing, ...metadata };
    this.storage.metadata.set(sessionId, updated);

    // 持久化元数据
    const metadataPath = path.join(this.metadataDir, `${sessionId}.json`);
    await fs.writeFile(metadataPath, JSON.stringify(updated, null, 2));
  }

  async getMetadata(sessionId: string): Promise<SessionMetadata | null> {
    return this.storage.metadata.get(sessionId) || null;
  }

  private async loadAllSessions(): Promise<void> {
    try {
      const files = await fs.readdir(this.sessionDir);
      
      for (const file of files) {
        if (file.endsWith(".json") && !file.startsWith(".")) {
          const sessionId = file.replace(".json", "");
          const sessionPath = path.join(this.sessionDir, file);
          
          try {
            const content = await fs.readFile(sessionPath, "utf-8");
            const session = JSON.parse(content) as SessionData;
            this.storage.sessions.set(sessionId, session);
          } catch {
            // 忽略损坏的会话文件
          }
        }
      }

      // 加载元数据
      const metadataFiles = await fs.readdir(this.metadataDir);
      for (const file of metadataFiles) {
        if (file.endsWith(".json")) {
          const sessionId = file.replace(".json", "");
          const metadataPath = path.join(this.metadataDir, file);
          
          try {
            const content = await fs.readFile(metadataPath, "utf-8");
            const metadata = JSON.parse(content) as SessionMetadata;
            this.storage.metadata.set(sessionId, metadata);
          } catch {
            // 忽略损坏的元数据文件
          }
        }
      }
    } catch {
      // 目录可能不存在，忽略错误
    }
  }

  private async saveSession(session: SessionData): Promise<void> {
    const sessionPath = path.join(this.sessionDir, `${session.id}.json`);
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  async exportSession(sessionId: string): Promise<string | null> {
    const session = this.storage.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return JSON.stringify(session, null, 2);
  }

  async importSession(data: string, agentId: string): Promise<SessionData> {
    const imported = JSON.parse(data) as SessionData;
    
    const newSession: SessionData = {
      ...imported,
      id: uuidv4(),
      agentId,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    this.storage.sessions.set(newSession.id, newSession);
    await this.saveSession(newSession);

    return newSession;
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    oldestSession?: number;
    newestSession?: number;
  }> {
    let totalMessages = 0;
    let oldestSession = Infinity;
    let newestSession = 0;

    for (const session of this.storage.sessions.values()) {
      totalMessages += session.messages.length;
      if (session.createdAt < oldestSession) {
        oldestSession = session.createdAt;
      }
      if (session.createdAt > newestSession) {
        newestSession = session.createdAt;
      }
    }

    return {
      totalSessions: this.storage.sessions.size,
      totalMessages,
      oldestSession: oldestSession === Infinity ? undefined : oldestSession,
      newestSession: newestSession === 0 ? undefined : newestSession,
    };
  }
}

export const createSessionManager = (sessionDir: string): SessionManager => {
  return new SessionManager(sessionDir);
};
