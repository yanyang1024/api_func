import type { Config } from "../config/index.js";

// ============ 沙箱配置 ============

export interface SandboxConfig {
  enabled: boolean;
  memory: string;
  cpu: number;
  networkEnabled: boolean;
  workspaceMount: string;
}

export function resolveSandboxConfig(config: Config): SandboxConfig {
  return {
    enabled: config.agent.enableSandbox,
    memory: config.agent.sandboxMemory,
    cpu: config.agent.sandboxCpu,
    networkEnabled: true,
    workspaceMount: process.cwd(),
  };
}

// ============ 命令执行（带沙箱） ============

export async function executeInSandbox(
  cmd: string,
  config: SandboxConfig
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  if (!config.enabled) {
    // 不使用沙箱，直接执行
    return executeDirectly(cmd);
  }

  // TODO: 实现容器化执行（Docker）
  // 目前返回模拟结果
  console.warn("⚠️ 沙箱模式尚未实现，使用直接执行");

  return executeDirectly(cmd);
}

async function executeDirectly(cmd: string): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const { exec } = await import("child_process");
  const { promisify } = await import("util");

  const execAsync = promisify(exec);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
    });

    return {
      success: true,
      stdout: stdout || "",
      stderr: stderr || "",
      exitCode: 0,
    };
  } catch (error: any) {
    return {
      success: false,
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.code || 1,
    };
  }
}

// ============ 资源限制 ============

export interface ResourceLimits {
  maxMemory: number;
  maxCpu: number;
  maxExecutionTime: number;
  maxOutputSize: number;
}

export function getResourceLimits(): ResourceLimits {
  return {
    maxMemory: 512 * 1024 * 1024, // 512MB
    maxCpu: 1.0,
    maxExecutionTime: 30000, // 30秒
    maxOutputSize: 1024 * 1024, // 1MB
  };
}
