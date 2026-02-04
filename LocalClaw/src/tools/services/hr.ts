import type { Tool, ToolContext } from "../../agent/types.js";
import type { Config } from "../../config/index.js";

// ============ HR 系统工具 ============

export function createHRServiceTools(config: Config["services"]["hr"]): Tool[] {
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

  // 查询员工信息
  const employeeTool: Tool = {
    name: "hr_get_employee",
    description: "查询员工基本信息",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "员工工号" },
        name: { type: "string", description: "员工姓名（模糊查询）" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/employees`;
        const queryParams = new URLSearchParams();

        if (params.employeeId) {
          queryParams.set("id", String(params.employeeId));
        }
        if (params.name) {
          queryParams.set("name", String(params.name));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`HR API 错误: ${response.status}`);
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
          error: `查询员工失败: ${error}`,
        };
      }
    },
  };

  // 查询部门信息
  const departmentTool: Tool = {
    name: "hr_get_department",
    description: "查询部门信息",
    inputSchema: {
      type: "object",
      properties: {
        departmentId: { type: "string", description: "部门ID" },
        parentId: { type: "string", description: "上级部门ID" },
      },
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/departments`;
        const queryParams = new URLSearchParams();

        if (params.departmentId) {
          queryParams.set("id", String(params.departmentId));
        }
        if (params.parentId) {
          queryParams.set("parent_id", String(params.parentId));
        }

        if (queryParams.toString()) {
          url += `?${queryParams.toString()}`;
        }

        const response = await fetch(url, { headers });

        if (!response.ok) {
          throw new Error(`HR API 错误: ${response.status}`);
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
          error: `查询部门失败: ${error}`,
        };
      }
    },
  };

  // 请假审批
  const leaveTool: Tool = {
    name: "hr_leave_request",
    description: "提交请假申请",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "员工工号" },
        leaveType: {
          type: "string",
          enum: ["年假", "事假", "病假", "婚假", "产假", "陪产假"],
          description: "请假类型",
        },
        startDate: { type: "string", description: "开始日期 YYYY-MM-DD" },
        endDate: { type: "string", description: "结束日期 YYYY-MM-DD" },
        reason: { type: "string", description: "请假原因" },
      },
      required: ["employeeId", "leaveType", "startDate", "endDate", "reason"],
    },
    async execute(params, context) {
      try {
        const response = await fetch(`${baseUrl}/leave-requests`, {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });

        if (!response.ok) {
          throw new Error(`HR API 错误: ${response.status}`);
        }

        const data = await response.json();
        return {
          success: true,
          output: {
            requestId: data.id,
            status: data.status,
            message: "请假申请已提交",
          },
        };
      } catch (error) {
        return {
          success: false,
          output: null,
          error: `提交请假申请失败: ${error}`,
        };
      }
    },
  };

  // 查询考勤
  const attendanceTool: Tool = {
    name: "hr_get_attendance",
    description: "查询考勤记录",
    inputSchema: {
      type: "object",
      properties: {
        employeeId: { type: "string", description: "员工工号" },
        month: { type: "string", description: "月份 YYYY-MM" },
      },
      required: ["employeeId"],
    },
    async execute(params, context) {
      try {
        let url = `${baseUrl}/attendance`;
        const queryParams = new URLSearchParams({
          employee_id: String(params.employeeId),
        });

        if (params.month) {
          queryParams.set("month", String(params.month));
        }

        const response = await fetch(`${url}?${queryParams.toString()}`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`HR API 错误: ${response.status}`);
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
          error: `查询考勤失败: ${error}`,
        };
      }
    },
  };

  return [employeeTool, departmentTool, leaveTool, attendanceTool];
}
