import { describe, expect, it } from "bun:test";
import hederaPlugin from "../index";

describe("Hedera Plugin Integration", () => {
  it("should export a valid plugin structure", () => {
    expect(hederaPlugin).toBeDefined();
    expect(hederaPlugin.name).toBe("Hedera");
    expect(hederaPlugin.description).toBe("Hedera hashgraph integration plugin");
    expect(hederaPlugin.providers).toBeArray();
    expect(hederaPlugin.actions).toBeArray();
    expect(hederaPlugin.evaluators).toBeArray();
    expect(hederaPlugin.services).toBeArray();
  });

  it("should have correct provider", () => {
    expect(hederaPlugin.providers).toHaveLength(1);
    const provider = hederaPlugin.providers[0];
    expect(provider.name).toBe("hederaClient");
  });

  it("should have correct actions", () => {
    expect(hederaPlugin.actions).toHaveLength(4);
    const actionNames = hederaPlugin.actions.map(a => a.name);
    expect(actionNames).toContain("HEDERA_CREATE_TRANSACTION");
    expect(actionNames).toContain("HEDERA_FIND_REGISTRATIONS");
    expect(actionNames).toContain("HEDERA_RETRIEVE_PROFILE");
    expect(actionNames).toContain("HEDERA_GET_TOPIC_MESSAGES");
  });

  it("should have empty evaluators", () => {
    expect(hederaPlugin.evaluators).toHaveLength(0);
  });
  
  it("should have correct services", () => {
    // Services are loaded dynamically, so we check if the array exists
    expect(hederaPlugin.services).toBeDefined();
    expect(Array.isArray(hederaPlugin.services)).toBe(true);
  });
});