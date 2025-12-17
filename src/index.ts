#!/usr/bin/env node

// src/index.ts
import { MCPProcess } from "./runner.js";
import { createRequest } from "./jsonrpc.js";
import { getProfile, listProfiles } from "./profiles/index.js";
import { planExecution } from "./execution/planner.js";
import { MCPClientProfile } from "./profiles/types.js";

type ExecutionContext =
  | {
      kind: "explicit";
      command: string;
    }
  | {
      kind: "profile";
      profile: MCPClientProfile;
      command: string;
    };

type MaybeJSONRPC = {
  id?: number | string;
  jsonrpc?: string;
  method?: string;
  params?: unknown;
};

function printUsage(): void {
  console.error(`
General MCP Client
------------------

Usage:
  mcp run "<serverCommand>"
  mcp run --profile web-dev
  mcp run --profile <profile>
  mcp list profiles
  mcp list profiles --json
  mcp describe profile web-dev
  mcp describe profile <profile>

Examples:
  # Run against any MCP-compliant server
  echo '{"jsonrpc":"2.0","id":1,"method":"providers.list"}' |
    mcp run "node dist/server.js"

  # Run with a built-in profile
  echo '{"jsonrpc":"2.0","id":1,"method":"providers.list"}' |
    mcp run --profile web-dev

Environment Variables:
  MCP_DEBUG=1    Enables verbose debug output (framing, handshake, events)
  MCP_PROFILE_SERVER      Override profile server command (advanced)

Debug example:
  MCP_DEBUG=1 mcp run "node dist/server.js"

Compatible with:
  - Any MCP-compliant server
  - The General MCP Server (reference implementation)

More documentation:
  https://dapo.run/mcp
`);
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    return;
  }

  let profileId: string | undefined;
  
  // very simple flag parsing (no dependency)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--profile") {
      if (!args[i + 1]) {
        console.error("--profile requires a value");
        process.exitCode = 1;
        return;
      }
      profileId = args[i + 1];
      args.splice(i, 2);
      break;
    }
  } 

  let dryRun = false;
  let jsonOutput = false;
  let explain = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dry-run") {
      dryRun = true;
      args.splice(i, 1);
      i--;
      continue;
    }

    if (args[i] === "--json") {
      jsonOutput = true;
      args.splice(i, 1);
      i--;
      continue;
    }

    if (args[i] === "--explain") {
      explain = true;
      args.splice(i, 1);
      i--;
      continue;
    }    
  }

  const explainLines: string[] = [];

  // ---------------------------------------
  // COMMAND: list profiles
  // ---------------------------------------
  if (args[0] === "list") {
    if (args[1] === "profiles") {
      const profiles = listProfiles();

      if (jsonOutput) {
        console.log(JSON.stringify(profiles, null, 2));
        return;
      }

      if (profiles.length === 0) {
        console.log("No profiles available.");
        return;
      }

      console.log("Available profiles:\n");

      for (const p of profiles) {
        console.log(
          `  ${p.id.padEnd(8)} ${p.description}`
        );
      }

      return;
    }

    console.error(`Unknown list target: ${args[1] ?? ""}

  Usage:
    mcp list profiles
    mcp list profiles --json
  `);
    process.exitCode = 1;
    return;
  }

  // ---------------------------------------
  // COMMAND: describe profile
  // ---------------------------------------
  if (args[0] === "describe") {
    if (args[1] === "profile") {
      const profileId = args[2];

      if (!profileId) {
        console.error(`Missing profile id.

  Usage:
    mcp describe profile <profile>
  `);
        process.exitCode = 1;
        return;
      }

      const profile = getProfile(profileId);

      if (!profile) {
        console.error(`Unknown profile: ${profileId}`);
        process.exitCode = 1;
        return;
      }

      if (jsonOutput) {
        console.log(JSON.stringify(profile, null, 2));
        return;
      }

      console.log(`Profile: ${profile.id}\n`);

      console.log("Description:");
      console.log(`  ${profile.description}\n`);

      console.log("Server:");
      console.log(`  command: ${profile.server.command}`);
      console.log(`  kind: ${profile.server.kind}`);

      if (profile.server.autoInstall) {
        console.log(`  auto-install: yes`);
      }

      if (profile.server.package) {
        console.log(`  package: ${profile.server.package}`);
      }

      console.log("");

      if (profile.ui?.enabled) {
        console.log("UI:");
        console.log("  enabled: yes");
        if (profile.ui.hint) {
          console.log(`  hint: ${profile.ui.hint}`);
        }
        console.log("");
      }

      if (profile.plugins.length > 0) {
        console.log("Plugins:");
        for (const p of profile.plugins) {
          console.log(`  - ${p.name} (${p.entry})`);
        }
      } else {
        console.log("Plugins:");
        console.log("  (none)");
      }

      if (profile.notes && profile.notes.length > 0) {
        console.log("\nNotes:");
        for (const note of profile.notes) {
          console.log(`  - ${note}`);
        }
      }

      return;
    }

    console.error(`Unknown describe target: ${args[1] ?? ""}

  Usage:
    mcp describe profile <profile>
  `);
    process.exitCode = 1;
    return;
  }

  if (args[0] !== "run") {

    console.error(`Unknown command: ${args[0]}

  Usage:
    mcp run "node dist/server.js"
    mcp run --profile web-dev
    mcp run --profile <profile>
    mcp list profiles

  More documentation:
    https://dapo.run/mcp
  `);
    process.exitCode = 1;
    return;
  }

  let execution: ExecutionContext;

  // 1) If a profile was provided, ALWAYS prefer profile execution.
  if (profileId) {
    const profile = getProfile(profileId);
    explainLines.push(`Mode: profile (${profileId})`);

    if (!profile) {
      console.error(`Unknown profile: ${profileId}`);
      process.exitCode = 1;
      return;
    }

    execution = {
      kind: "profile",
      profile,
      command: process.env.MCP_PROFILE_SERVER ?? profile.server.command,
    };
  } else {
    explainLines.push(`Mode: explicit`);
    
    // 2) Otherwise try to treat the first non-flag token after "run" as explicit command.
    const maybeCmd = args
      .slice(1) // tokens after "run"
      .find((t) => !t.startsWith("-"));

    if (maybeCmd) {
      execution = {
        kind: "explicit",
        command: maybeCmd,
      };
    } else {
      console.error(`Missing server command.

    Examples:
      mcp run "node dist/server.js"
      mcp run --profile web-dev
      mcp run --profile <profile>

    More documentation:
      https://dapo.run/mcp    
    `);
      process.exitCode = 1;
      return;
    }
  }

  const hasProfileServerOverride =
    execution.kind === "profile" &&
    process.env.MCP_PROFILE_SERVER !== undefined;

  let command: string;
  let cmdArgs: string[];
  let executionSource: "explicit" | "local-bin" | "npm-exec" | "npx";

  if (
    execution.kind === "profile" &&
    execution.profile.server.kind === "builtin" &&
    !hasProfileServerOverride
  ) {
    explainLines.push("Server kind: builtin");
    explainLines.push("Execution planner: enabled");

    const plan = await planExecution(execution.profile);

    if (plan.source === "local-bin") {
      explainLines.push("Local binary: found");
    } else {
      explainLines.push("Local binary: not found");
      explainLines.push("Auto-install: enabled");
    }

    explainLines.push(
      `Selected execution: ${plan.source} (${[plan.command, ...plan.args].join(" ")})`
    );    

    command = plan.command;
    cmdArgs = plan.args;
    executionSource = plan.source;

    if (process.env.MCP_DEBUG) {
      process.stderr.write(
        `[CLIENT] Using ${plan.source} execution\n`
      );
    }
  } else {
    explainLines.push("Execution planner: skipped");
    explainLines.push(
      `Selected execution: explicit (${execution.command})`
    );

    const cmd = execution.command.split(" ");

    command = cmd[0];
    cmdArgs = cmd.slice(1);
    executionSource = "explicit";
  }

  if (dryRun) {
    if (jsonOutput) {
      console.log(
        JSON.stringify(
          {
            mode: execution.kind,
            profile:
              execution.kind === "profile"
                ? execution.profile.id
                : undefined,
            explain: explain ? explainLines : undefined,
            plan: {
              command,
              args: cmdArgs,
              source: executionSource,
            },
          },
          null,
          2
        )
      );
    } else {
      if (explain && !jsonOutput) {
        console.log("Execution explanation:");
        for (const line of explainLines) {
          console.log(`- ${line}`);
        }
        console.log("");
      }

      console.log("Execution plan:");
      console.log(`  resolver: ${executionSource}`);
      console.log(
        `  command: ${[command, ...cmdArgs].join(" ")}`
      );
    }

    return;
  }

  const proc = new MCPProcess({
    command,
    args: cmdArgs
  });

  // optional debug logs
  proc.on("stderr", (msg) => process.stderr.write(String(msg)));

  if (process.env.MCP_DEBUG) {
    proc.on("exit", ({ code, signal }) => {
      process.stderr.write(
        `[CLIENT] Child process exit code=${code} signal=${String(signal)}\n`
      );
    });
    proc.on("error", (err) => {
      process.stderr.write(`[CLIENT] Child process error: ${String(err)}\n`);
    });
  }

  // staring server + handshake
  await proc.start();

  if (process.stdin.isTTY) {
    if (process.env.MCP_DEBUG) {
      process.stderr.write(
        "[CLIENT] No stdin detected (TTY). Server started successfully.\n"
      );
    }
    await proc.close();
    return;
  }

  const stdinData = await readStdin();

  if (!stdinData.trim()) {
    if (process.env.MCP_DEBUG) {
      process.stderr.write("[CLIENT] No stdin data, nothing to send.\n");
    }
    await proc.close();
    return;
  }

  let payloads: MaybeJSONRPC[];

  // 1) trying by whole JSON
  try {
    const parsed = JSON.parse(stdinData) as MaybeJSONRPC | MaybeJSONRPC[];
    payloads = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // 2) trying by lines
    const lines = stdinData
      .split("\n")
      .map((x) => x.trim())
      .filter((x) => x.length > 0);

    payloads = lines.map((line) => JSON.parse(line) as MaybeJSONRPC);
  }

  try {
    for (const payload of payloads) {
      const base = payload;

      const isFullJsonRpc =
        base.id !== undefined &&
        typeof base.jsonrpc === "string" &&
        base.jsonrpc.length > 0;

      const req = isFullJsonRpc
        ? (base as unknown) // JSONRPCRequest match
        : createRequest(base.method ?? "", base.params);

      const response = await proc.send(req as never);

      process.stdout.write(
        JSON.stringify(response, null, 2) + "\n"
      );
    }
  } finally {
    await proc.close();
  }
}

main()
  .then(() => {
    // success here
    if (process.exitCode === undefined) {
      process.exitCode = 0;
    }
  })
  .catch((err) => {
    console.error(
      err instanceof Error ? err.message : String(err)
    );
    process.exitCode = 1;
  });
