import fs from "node:fs";
import path from "node:path";
import type { MCPClientProfile } from "../profiles/types.js";

export interface ExecutionPlan {
  command: string;
  args: string[];
  source: "local-bin" | "npm-exec" | "npx";
}

function hasLocalBin(command: string): boolean {
  const binPath = path.join(
    process.cwd(),
    "node_modules",
    ".bin",
    command
  );

  return fs.existsSync(binPath);
}

export async function planExecution(
  profile: MCPClientProfile
): Promise<ExecutionPlan> {
  const { command, autoInstall } = profile.server;

  // 1) local node_modules/.bin
  if (hasLocalBin(command)) {
    return {
      command,
      args: [],
      source: "local-bin",
    };
  }

  // 2) npm exec (preferred auto-install path)
  if (autoInstall) {
    return {
      command: "npm",
      args: ["exec", command],
      source: "npm-exec",
    };
  }

  // 3) fallback npx
  return {
    command: "npx",
    args: [command],
    source: "npx",
  };
}
