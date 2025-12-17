// tests/cli.describe-profile.test.ts

import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("CLI describe profile", () => {
  it("describes a profile in text mode", () => {
    const output = execSync(
      "node dist/index.js describe profile web-dev",
      { encoding: "utf8" }
    );

    expect(output).toMatch(/Profile: web-dev/);
    expect(output).toMatch(/Description:/);
    expect(output).toMatch(/Server:/);
    expect(output).toMatch(/command:/);
    expect(output).toMatch(/kind:/);
  });

  it("describes a profile in json mode", () => {
    const output = execSync(
      "node dist/index.js describe profile web-dev --json",
      { encoding: "utf8" }
    );

    const parsed = JSON.parse(output);

    expect(parsed.id).toBe("web-dev");

    expect(parsed.server).toBeDefined();
    expect(parsed.server.command).toBeDefined();
    expect(parsed.server.kind).toBe("builtin");
  });
});
