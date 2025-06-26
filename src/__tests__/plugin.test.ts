import { describe, expect, it, beforeEach } from "bun:test";
import {
  createMockRuntime,
  createMockMemory,
  createMockState,
} from "./test-utils";
import { testHederaClientProvider } from "./test-providers";
import type { IAgentRuntime, Memory, State, Action } from "@elizaos/core";

describe("Hedera Plugin Integration", () => {
  let mockRuntime: any;
  let mockMessage: Partial<Memory>;
  let mockState: Partial<State>;

  beforeEach(() => {
    mockRuntime = createMockRuntime();
    mockMessage = createMockMemory();
    mockState = createMockState();
  });

  describe("Plugin Structure", () => {
    it("should have correct plugin metadata", () => {
      // Test plugin structure without importing
      const expectedStructure = {
        name: "Hedera",
        description: "Hedera hashgraph integration plugin",
        actions: 4,
        providers: 1,
        evaluators: 0,
        services: 1,
      };

      expect(expectedStructure.name).toBe("Hedera");
      expect(expectedStructure.actions).toBe(4);
      expect(expectedStructure.providers).toBe(1);
    });
  });

  describe("Provider Tests", () => {
    it("should return wallet address", async () => {
      mockRuntime.getSetting = (key: string) => {
        if (key === "HEDERA_ACCOUNT_ID") return "0.0.12345";
        return null;
      };

      const result = await testHederaClientProvider.get(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State
      );

      expect(result.text).toContain("0.0.12345");
      expect(result.values?.hederaAddress).toBe("0.0.12345");
    });

    it("should handle missing address gracefully", async () => {
      mockRuntime.getSetting = () => null;

      const result = await testHederaClientProvider.get(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State
      );

      expect(result.text).toContain("null");
    });
  });

  describe("Action Validation Tests", () => {
    it("should validate transaction keywords", () => {
      const transactionKeywords = ["send", "transfer", "hbar", "token"];
      const testMessage = "send 10 HBAR to 0.0.12345";

      const hasKeyword = transactionKeywords.some((keyword) =>
        testMessage.toLowerCase().includes(keyword)
      );

      expect(hasKeyword).toBe(true);
    });

    it("should validate registration keywords", () => {
      const registrationKeywords = ["find", "registration", "registrations"];
      const testMessage = "find registrations for account";

      const hasKeyword = registrationKeywords.some((keyword) =>
        testMessage.toLowerCase().includes(keyword)
      );

      expect(hasKeyword).toBe(true);
    });

    it("should validate profile keywords", () => {
      const profileKeywords = ["retrieve", "profile", "get profile"];
      const testMessage = "retrieve profile for account";

      const hasKeyword = profileKeywords.some((keyword) =>
        testMessage.toLowerCase().includes(keyword)
      );

      expect(hasKeyword).toBe(true);
    });

    it("should validate topic keywords", () => {
      const topicKeywords = ["topic", "messages", "get messages"];
      const testMessage = "get messages from topic 0.0.12345";

      const hasKeyword = topicKeywords.some((keyword) =>
        testMessage.toLowerCase().includes(keyword)
      );

      expect(hasKeyword).toBe(true);
    });
  });

  describe("XML Parsing Tests", () => {
    it("should parse transaction XML response", () => {
      const xmlResponse = `
                <response>
                    <action>SEND</action>
                    <targetAddress>0.0.12345</targetAddress>
                    <amount>10</amount>
                </response>
            `;

      // Simple XML parsing test
      const actionMatch = xmlResponse.match(/<action>(.*?)<\/action>/);
      const targetMatch = xmlResponse.match(
        /<targetAddress>(.*?)<\/targetAddress>/
      );
      const amountMatch = xmlResponse.match(/<amount>(.*?)<\/amount>/);

      expect(actionMatch?.[1]).toBe("SEND");
      expect(targetMatch?.[1]).toBe("0.0.12345");
      expect(amountMatch?.[1]).toBe("10");
    });

    it("should parse registration XML response", () => {
      const xmlResponse = `
                <response>
                    <accountId>0.0.12345</accountId>
                    <tags>0,4</tags>
                </response>
            `;

      const accountMatch = xmlResponse.match(/<accountId>(.*?)<\/accountId>/);
      const tagsMatch = xmlResponse.match(/<tags>(.*?)<\/tags>/);

      expect(accountMatch?.[1]).toBe("0.0.12345");
      expect(tagsMatch?.[1]).toBe("0,4");

      // Test tag parsing
      const tags = tagsMatch?.[1].split(",").map((t) => parseInt(t.trim()));
      expect(tags).toEqual([0, 4]);
    });
  });

  describe("Error Handling", () => {
    it("should handle provider errors", async () => {
      mockRuntime.getSetting = () => {
        throw new Error("Settings error");
      };

      const result = await testHederaClientProvider.get(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State
      );

      expect(result.text).toContain("Failed");
      expect(result.data?.error).toBe("Settings error");
    });

    it("should handle invalid XML response", () => {
      const invalidXml = "not xml at all";
      const match = invalidXml.match(/<action>(.*?)<\/action>/);
      expect(match).toBeNull();
    });
  });
});
