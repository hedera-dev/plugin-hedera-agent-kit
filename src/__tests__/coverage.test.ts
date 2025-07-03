import { describe, expect, it } from "bun:test";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));

describe("Coverage Requirements", () => {
  it("should have all required source files", () => {
    const requiredFiles = [
      "index.ts",
      "providers/client/index.ts",
      "actions/create-transaction/create-transaction.ts",
      "actions/find-registrations/index.ts",
      "actions/retrieve-profile/index.ts",
      "actions/get-topic-messages/get-topic-messages.ts",
      "templates/index.ts",
      "shared/utils.ts",
    ];

    requiredFiles.forEach(file => {
      const filePath = join(__dirname, "..", file);
      expect(existsSync(filePath)).toBe(true);
    });
  });

  it("should have test files for all major components", () => {
    const testFiles = [
      "actions.test.ts",
      "providers.test.ts",
      "services.test.ts",
      "schemas.test.ts",
      "templates.test.ts",
      "utils.test.ts",
      "plugin.test.ts",
      "integration.test.ts",
    ];

    testFiles.forEach(file => {
      const filePath = join(__dirname, file);
      expect(existsSync(filePath)).toBe(true);
    });
  });

  it("should have proper TypeScript configuration", () => {
    const tsConfigPath = join(__dirname, "../..", "tsconfig.json");
    expect(existsSync(tsConfigPath)).toBe(true);
  });

  it("should have package.json with proper scripts", () => {
    const packageJsonPath = join(__dirname, "../..", "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);
    
    const packageJson = require(packageJsonPath);
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts.test).toBeDefined();
    expect(packageJson.scripts.build).toBeDefined();
    expect(packageJson.scripts.lint).toBeDefined();
  });
});