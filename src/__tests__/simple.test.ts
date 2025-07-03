import { describe, expect, it } from "bun:test";

describe("Basic Test Suite", () => {
  it("should pass basic math test", () => {
    expect(1 + 1).toBe(2);
  });

  it("should verify test environment is working", () => {
    const testArray = [1, 2, 3];
    expect(testArray).toHaveLength(3);
    expect(testArray).toContain(2);
  });

  it("should handle async tests", async () => {
    const promise = Promise.resolve("test");
    await expect(promise).resolves.toBe("test");
  });
});
