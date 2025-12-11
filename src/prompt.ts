import readline from "node:readline";
import { createRequest } from "./jsonrpc.js";
import type { MCPProcess } from "./runner.js";

export function startPrompt(mcp: MCPProcess): void {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 200
  });

  console.log("mcp> Type JSON-RPC requests, or 'exit' to quit.");

  rl.on("line", line => {
    if (line.trim() === "exit") {
      rl.close();
      process.exit(0);
    }

    try {
      const parsed = JSON.parse(line.trim());
      const req = createRequest(parsed.method, parsed.params);
      mcp.send(req);
    } catch {
      console.log("Invalid JSON. Example:");
      console.log(`{"method":"providers.list","params":{}}`);
    }
  });
}
