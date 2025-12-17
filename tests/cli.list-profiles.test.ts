import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";

describe("CLI list profiles", () => {
  it("lists profiles in text mode", () => {
    const output = execSync(
      "node dist/index.js list profiles",
      { encoding: "utf8" }
    );

    expect(output).toMatch(/Available profiles/);
    expect(output).toMatch(/web-dev/);
  });

  it("lists profiles in json mode", () => {
    const output = execSync(
      "node dist/index.js list profiles --json",
      { encoding: "utf8" }
    );

    const parsed = JSON.parse(output);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe("web-dev");
  });
});
