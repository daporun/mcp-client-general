import { describe, it, expect, beforeEach, vi  } from "vitest";
import fs from "node:fs";

import { planExecution } from "../../src/execution/planner.js";
import type { MCPClientProfile } from "../../src/profiles/types.js";

// --- mock fs.existsSync ---
vi.mock("node:fs", () => ({
  default: {
    existsSync: vi.fn(),
  },
}));

const mockExistsSync = vi.mocked(fs.existsSync);

function createProfile(
  overrides?: Partial<MCPClientProfile>
): MCPClientProfile {
  return {
    id: "test",
    description: "test profile",
    server: {
      kind: "builtin",
      command: "mcp-server-general",
      autoInstall: true,
      package: "mcp-server-general",
    },
    plugins: [],
    ...overrides,
  };
}

describe("execution planner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses local-bin when node_modules/.bin command exists", async () => {
    mockExistsSync.mockReturnValue(true);

    const profile = createProfile();

    const plan = await planExecution(profile);

    expect(plan).toEqual({
      command: "mcp-server-general",
      args: [],
      source: "local-bin",
    });

    expect(mockExistsSync).toHaveBeenCalledOnce();
  });

  it("uses npm exec when local-bin is missing and autoInstall is true", async () => {
    mockExistsSync.mockReturnValue(false);

    const profile = createProfile({
      server: {
        kind: "builtin",
        command: "mcp-server-general",
        autoInstall: true,
        package: "mcp-server-general",
      },
    });

    const plan = await planExecution(profile);

    expect(plan).toEqual({
      command: "npm",
      args: ["exec", "mcp-server-general"],
      source: "npm-exec",
    });
  });

  it("falls back to npx when autoInstall is false", async () => {
    mockExistsSync.mockReturnValue(false);

    const profile = createProfile({
      server: {
        kind: "builtin",
        command: "mcp-server-general",
        autoInstall: false,
      },
    });

    const plan = await planExecution(profile);

    expect(plan).toEqual({
      command: "npx",
      args: ["mcp-server-general"],
      source: "npx",
    });
  });
});
