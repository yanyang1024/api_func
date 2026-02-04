import type { Tool } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

// ============ 邮件服务工具 ============

export function createMailTools(config: Config["services"]["mail"]): Tool[] {
  if (!config?.enabled || !config.smtpHost) {
    return [];
  }

  // 发送邮件
  const sendMailTool: Tool = {
    name: "mail_send",
    description: "发送邮件",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string", format: "email" },
          description: "收件人列表",
        },
        cc: {
          type: "array",
          items: { type: "string", format: "email" },
          description: "抄送人列表",
        },
        subject: { type: "string", description: "邮件主题" },
        body: { type: "string", description: "邮件内容（支持HTML）" },
        attachments: {
          type: "array",
          items: { type: "string" },
          description: "附件路径列表",
        },
      },
      required: ["to", "subject", "body"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${config.smtpHost}/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${config.user}:${config.password}`
            ).toString("base64")}`,
          },
          body: JSON.stringify({
            from: config.user,
            to: params.to,
            cc: params.cc || [],
            subject: params.subject,
            body: params.body,
            attachments: params.attachments || [],
          }),
        });

        if (!response.ok) {
          throw new Error(`邮件服务 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            messageId: data.messageId,
            sentTo: params.to,
            message: "邮件发送成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `发送邮件失败: ${error}`,
        };
      }
    },
  };

  // 发送模板邮件
  const sendTemplateMailTool: Tool = {
    name: "mail_send_template",
    description: "发送模板邮件",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "array",
          items: { type: "string", format: "email" },
          description: "收件人列表",
        },
        templateId: { type: "string", description: "邮件模板ID" },
        variables: {
          type: "object",
          description: "模板变量",
        },
      },
      required: ["to", "templateId"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${config.smtpHost}/send-template`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(
              `${config.user}:${config.password}`
            ).toString("base64")}`,
          },
          body: JSON.stringify({
            from: config.user,
            to: params.to,
            templateId: params.templateId,
            variables: params.variables || {},
          }),
        });

        if (!response.ok) {
          throw new Error(`邮件服务 API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            messageId: data.messageId,
            templateId: params.templateId,
            message: "模板邮件发送成功",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `发送模板邮件失败: ${error}`,
        };
      }
    },
  };

  return [sendMailTool, sendTemplateMailTool];
}
