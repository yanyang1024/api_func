import { ApiResponse, NotificationPayload } from "../core/types.js";

export interface NotificationServiceConfig {
  type: "email" | "webhook" | "sms" | "log";
  smtp?: {
    host: string;
    port: number;
    user: string;
    password: string;
    from: string;
  };
  webhook?: {
    url: string;
    headers?: Record<string, string>;
  };
}

export interface NotificationResult {
  id: string;
  type: string;
  recipients: string[];
  status: "pending" | "sent" | "failed";
  sentAt?: number;
  error?: string;
}

export class NotificationService {
  private config: NotificationServiceConfig;
  private sentNotifications: Map<string, NotificationResult> = new Map();

  constructor(config: NotificationServiceConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    console.log(`通知服务初始化，类型: ${this.config.type}`);
  }

  async send(payload: NotificationPayload): Promise<ApiResponse<NotificationResult>> {
    const result: NotificationResult = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: payload.type,
      recipients: payload.recipients,
      status: "pending",
    };

    try {
      switch (payload.type) {
        case "email":
          await this.sendEmail(payload, result);
          break;
        case "webhook":
          await this.sendWebhook(payload, result);
          break;
        case "sms":
          await this.sendSms(payload, result);
          break;
        case "log":
          await this.sendLog(payload, result);
          break;
        default:
          throw new Error(`不支持的通知类型: ${payload.type}`);
      }

      result.status = "sent";
      result.sentAt = Date.now();
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : "未知错误";
    }

    this.sentNotifications.set(result.id, result);

    return {
      success: result.status === "sent",
      data: result,
      error: result.error,
      statusCode: result.status === "sent" ? 200 : 500,
    };
  }

  private async sendEmail(
    payload: NotificationPayload,
    result: NotificationResult
  ): Promise<void> {
    if (!this.config.smtp) {
      throw new Error("SMTP配置未设置");
    }

    // 模拟发送邮件
    console.log(`[邮件] 发送给: ${payload.recipients.join(", ")}`);
    console.log(`[邮件] 主题: ${payload.subject}`);
    console.log(`[邮件] 内容: ${payload.content}`);
    
    // 实际实现时需要使用nodemailer等库
  }

  private async sendWebhook(
    payload: NotificationPayload,
    result: NotificationResult
  ): Promise<void> {
    if (!this.config.webhook) {
      throw new Error("Webhook配置未设置");
    }

    const response = await fetch(this.config.webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.config.webhook.headers,
      },
      body: JSON.stringify({
        recipients: payload.recipients,
        subject: payload.subject,
        content: payload.content,
        priority: payload.priority,
        timestamp: Date.now(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook请求失败: ${response.status}`);
    }
  }

  private async sendSms(
    payload: NotificationPayload,
    result: NotificationResult
  ): Promise<void> {
    // 模拟发送短信
    console.log(`[短信] 发送给: ${payload.recipients.join(", ")}`);
    console.log(`[短信] 内容: ${payload.content}`);
  }

  private async sendLog(
    payload: NotificationPayload,
    result: NotificationResult
  ): Promise<void> {
    console.log(`[通知] [${payload.priority || "normal"}]`);
    console.log(`  收件人: ${payload.recipients.join(", ")}`);
    console.log(`  主题: ${payload.subject}`);
    console.log(`  内容: ${payload.content}`);
  }

  async getNotificationHistory(limit: number = 50): Promise<ApiResponse<NotificationResult[]>> {
    const notifications = Array.from(this.sentNotifications.values())
      .sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
      .slice(0, limit);

    return {
      success: true,
      data: notifications,
      statusCode: 200,
    };
  }

  async getNotification(id: string): Promise<ApiResponse<NotificationResult | null>> {
    const notification = this.sentNotifications.get(id) || null;
    
    return {
      success: true,
      data: notification,
      statusCode: notification ? 200 : 404,
    };
  }

  async clearHistory(): Promise<ApiResponse> {
    this.sentNotifications.clear();
    
    return {
      success: true,
      statusCode: 200,
    };
  }

  async sendBulk(payloads: NotificationPayload[]): Promise<ApiResponse<NotificationResult[]>> {
    const results: NotificationResult[] = [];
    
    for (const payload of payloads) {
      const result = await this.send(payload);
      if (result.data) {
        results.push(result.data);
      }
    }

    return {
      success: results.length === payloads.length,
      data: results,
      statusCode: 200,
    };
  }
}

export const createNotificationService = (
  config: NotificationServiceConfig
): NotificationService => {
  return new NotificationService(config);
};
