import { spawn } from "child_process";
export class MCPProcess {
    args;
    proc = null;
    constructor(args) {
        this.args = args;
    }
    /**
     * Entry point — parses CLI flags and executes the MCP workflow.
     */
    start() {
        if (this.args.length === 0) {
            console.error("Error: no command provided. Try: mcp --help");
            process.exit(1);
        }
        const [subcommand, ...rest] = this.args;
        if (subcommand === "run") {
            this.startServer(rest);
            return;
        }
        console.error(`Unknown command: ${subcommand}`);
        process.exit(1);
    }
    /**
     * Starts the MCP server process and pipes STDIN/STDOUT.
     */
    startServer(rest) {
        if (rest.length === 0) {
            console.error("Error: mcp run requires a command to execute.");
            process.exit(1);
        }
        const full = rest.join(" "); // --> "node dist/server.js"
        const [bin, ...args] = full.split(" "); // --> bin="node", args=["dist/server.js"]
        this.proc = spawn(bin, args, {
            stdio: ["pipe", "pipe", "pipe"], // enable JSON-RPC streaming
        });
        // Pipe MCP server output → stdout
        this.proc.stdout.on("data", (chunk) => {
            process.stdout.write(chunk);
        });
        // Pipe CLI input → MCP server input
        process.stdin.on("data", (chunk) => {
            this.proc?.stdin.write(chunk);
        });
        this.proc.on("exit", (code) => {
            console.log(`\n[MCP server exited: ${code}]`);
            process.exit(code ?? 0);
        });
    }
    /**
     * Sends a JSON-RPC payload to the MCP server over STDIN.
     */
    send(payload) {
        if (!this.proc) {
            console.error("Cannot send: MCP server is not running.");
            return;
        }
        this.proc.stdin.write(JSON.stringify(payload) + "\n");
    }
}
