import { describe, it, expect, beforeEach } from "vitest";
import { SessionManager, createSessionManager } from "../src/core/session-manager.js";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, "test-data", `session-test-${Date.now()}`);

describe("SessionManager", () => {
  let sessionManager: SessionManager;

  beforeEach(async () => {
    await fs.mkdir(TEST_DIR, { recursive: true });
    sessionManager = createSessionManager(TEST_DIR);
    await sessionManager.initialize();
  });

  it("should create a new session", async () => {
    const session = await sessionManager.createSession("test-agent", "/workspace");

    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    expect(session.agentId).toBe("test-agent");
    expect(session.messages).toEqual([]);
  });

  it("should get session by id", async () => {
    const created = await sessionManager.createSession("test-agent", "/workspace");
    const retrieved = await sessionManager.getSession(created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
  });

  it("should add messages to session", async () => {
    const session = await sessionManager.createSession("test-agent", "/workspace");
    
    await sessionManager.addMessage(session.id, {
      role: "user",
      content: "Hello",
      timestamp: Date.now(),
    });

    const messages = await sessionManager.getMessages(session.id);
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe("Hello");
  });

  it("should list sessions", async () => {
    await sessionManager.createSession("agent-1", "/workspace/1");
    await sessionManager.createSession("agent-2", "/workspace/2");
    await sessionManager.createSession("agent-1", "/workspace/3");

    const allSessions = await sessionManager.listSessions();
    expect(allSessions.length).toBe(3);

    const agent1Sessions = await sessionManager.listSessions("agent-1");
    expect(agent1Sessions.length).toBe(2);
  });

  it("should delete session", async () => {
    const session = await sessionManager.createSession("test-agent", "/workspace");
    
    await sessionManager.deleteSession(session.id);
    
    const retrieved = await sessionManager.getSession(session.id);
    expect(retrieved).toBeNull();
  });

  it("should export and import session", async () => {
    const session = await sessionManager.createSession("test-agent", "/workspace");
    await sessionManager.addMessage(session.id, {
      role: "user",
      content: "Test message",
      timestamp: Date.now(),
    });

    const exported = await sessionManager.exportSession(session.id);
    expect(exported).toBeDefined();

    const imported = await sessionManager.importSession(exported!, "new-agent");
    expect(imported.agentId).toBe("new-agent");
    expect(imported.messages.length).toBe(1);
  });

  it("should get session stats", async () => {
    await sessionManager.createSession("agent-1", "/workspace/1");
    const session2 = await sessionManager.createSession("agent-2", "/workspace/2");
    await sessionManager.addMessage(session2.id, { role: "user", content: "Hi", timestamp: Date.now() });

    const stats = await sessionManager.getSessionStats();
    
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalMessages).toBe(1);
  });
});
