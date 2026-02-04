import type { Tool } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

// ============ OA 系统工具 ============

export function createOATools(config: Config["services"]["oa"]): Tool[] {
  if (!config?.enabled || !config.baseUrl) {
    return [];
  }

  const baseUrl = config.baseUrl;
  const apiKey = config.apiKey;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  // 审批列表
  const approvalListTool: Tool = {
    name: "oa_approval_list",
    description: "获取待审批列表",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "approved", "rejected"],
          description: "审批状态",
        },
        page: { type: "number", description: "页码" },
        limit: { type: "number", description: "每页数量" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/approvals`;
        const queryParams = new URLSearchParams();

        if (params.status) {
          queryParams.set("status", String(params.status));
        }
        if (params.page) {
          queryParams.set("page", String(params.page));
        }
        if (params.limit) {
          queryParams.set("limit", String(params.limit));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`OA API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: data,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `获取审批列表失败: ${error}`,
        };
      }
    },
  };

  // 发起审批
  const createApprovalTool: Tool = {
    name: "oa_create_approval",
    description: "发起审批流程",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["请假", "报销", "采购", "用印", "出差"],
          description: "审批类型",
        },
        title: { type: "string", description: "审批标题" },
        content: { type: "string", description: "审批内容" },
        approvers: {
          type: "array",
          items: { type: "string" },
          description: "审批人列表",
        },
        attachments: {
          type: "array",
          items: { type: "string" },
          description: "附件URL列表",
        },
      },
      required: ["type", "title", "content", "approvers"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/approvals`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`OA API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            approvalId: data.id,
            status: "pending",
            message: "审批已发起",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `发起审批失败: ${error}`,
        };
      }
    },
  };

  // 审批操作
  const approvalActionTool: Tool = {
    name: "oa_approval_action",
    description: "审批操作（通过/拒绝）",
    inputSchema: {
      type: "object",
      properties: {
        approvalId: { type: "string", description: "审批ID" },
        action: {
          type: "string",
          enum: ["approve", "reject"],
          description: "操作类型",
        },
        comment: { type: "string", description: "审批意见" },
      },
      required: ["approvalId", "action"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/approvals/${params.approvalId}/action`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            action: params.action,
            comment: params.comment,
          }),
        });

        if (!response.ok) {
          throw new Error(`OA API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            approvalId: params.approvalId,
            action: params.action,
            message: `审批已${params.action === "approve" ? "通过" : "拒绝"}`,
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `审批操作失败: ${error}`,
        };
      }
    },
  };

  // 公告列表
  const noticeListTool: Tool = {
    name: "oa_notice_list",
    description: "获取公司公告列表",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "公告分类" },
        page: { type: "number", description: "页码" },
        limit: { type: "number", description: "每页数量" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/notices`;
        const queryParams = new URLSearchParams();

        if (params.category) {
          queryParams.set("category", String(params.category));
        }
        if (params.page) {
          queryParams.set("page", String(params.page));
        }
        if (params.limit) {
          queryParams.set("limit", String(params.limit));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`OA API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: data,
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `获取公告列表失败: ${error}`,
        };
      }
    },
  };

  return [approvalListTool, createApprovalTool, approvalActionTool, noticeListTool];
}
