import { describe, it, expect } from "vitest";
import { limitHistoryTurns, checkContextWindow, SessionManager } from "../src/context/index.js";

describe("上下文管理", () => {
  describe("limitHistoryTurns", () => {
    it("应该保留所有消息如果不超过限制", () => {
      const messages = [
        { role: "user", content: "问题1", timestamp: 1 },
        { role: "assistant", content: "回答1", timestamp: 2 },
        { role: "user", content: "问题2", timestamp: 3 },
      ];

      const result = limitHistoryTurns(messages, 5);
      expect(result.length).toBe(3);
    });

    it("应该截断早期消息如果超过限制", () => {
      const messages = Array.from({ length: 10 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `消息 ${i + 1}`,
        timestamp: i + 1,
      }));

      const result = limitHistoryTurns(messages, 3);
      expect(result.length).toBe(6); // 3 轮 = 6 条消息
    });

    it("应该处理空消息数组", () => {
      const result = limitHistoryTurns([], 5);
      expect(result.length).toBe(0);
    });

    it("应该处理零限制", () => {
      const messages = [{ role: "user", content: "test", timestamp: 1 }];
      const result = limitHistoryTurns(messages, 0);
      expect(result.length).toBe(1);
    });
  });

  describe("checkContextWindow", () => {
    it("应该正确检测正常状态", () => {
      const messages = [
        { role: "user", content: "短消息", timestamp: 1 },
      ];

      const result = checkContextWindow(messages, 1000);
      expect(result.isOverflow).toBe(false);
      expect(result.warning).toBe(false);
    });

    it("应该检测溢出状态", () => {
      const longMessage = { role: "user", content: "x".repeat(200000), timestamp: 1 };
      const messages = [longMessage];

      const result = checkContextWindow(messages, 1000);
      expect(result.isOverflow).toBe(true);
    });

    it("应该检测警告状态", () => {
      // 创建使用率 > 80% 的消息
      const content = "x".repeat(85000); // 约 21250 tokens
      const messages = [{ role: "user", content, timestamp: 1 }];

      const result = checkContextWindow(messages, 100000);
      expect(result.warning).toBe(true);
      expect(result.isOverflow).toBe(false);
    });
  });

  describe("SessionManager", () => {
    it("应该创建会话", () => {
      const manager = new SessionManager();
      const session = manager.createSession("test:1");

      expect(session.id).toBeDefined();
      expect(session.key).toBe("test:1");
      expect(session.messages.length).toBe(0);
    });

    it("应该获取会话", () => {
      const manager = new SessionManager();
      manager.createSession("test:2");
      const session = manager.getSession("test:2");

      expect(session).toBeDefined();
      expect(session?.key).toBe("test:2");
    });

    it("应该添加消息", () => {
      const manager = new SessionManager();
      manager.createSession("test:3");

      manager.addMessage("test:3", {
        role: "user",
        content: "测试消息",
        timestamp: Date.now(),
      });

      const messages = manager.getMessages("test:3");
      expect(messages.length).toBe(1);
      expect(messages[0].content).toBe("测试消息");
    });

    it("应该清空会话", () => {
      const manager = new SessionManager();
      manager.createSession("test:4");
      manager.addMessage("test:4", { role: "user", content: "test", timestamp: 1 });

      manager.clearSession("test:4");

      const messages = manager.getMessages("test:4");
      expect(messages.length).toBe(0);
    });

    it("应该删除会话", () => {
      const manager = new SessionManager();
      manager.createSession("test:5");

      const result = manager.deleteSession("test:5");
      expect(result).toBe(true);

      const session = manager.getSession("test:5");
      expect(session).toBeUndefined();
    });

    it("应该列出所有会话", () => {
      const manager = new SessionManager();
      manager.createSession("test:6");
      manager.createSession("test:7");

      const sessions = manager.listSessions();
      expect(sessions.length).toBe(2);
    });
  });
});
