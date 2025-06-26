import { describe, expect, it } from "bun:test";

describe("Template Tests", () => {
  describe("Find Registrations Template", () => {
    it("should have correct template structure", async () => {
      const { findRegistrationsTemplate } = await import("../templates/index");

      expect(findRegistrationsTemplate).toBeDefined();
      expect(findRegistrationsTemplate).toContain("Extract parameters for searching agent registrations");
      expect(findRegistrationsTemplate).toContain("<response>");
      expect(findRegistrationsTemplate).toContain("<accountId>");
      expect(findRegistrationsTemplate).toContain("<tags>");
      expect(findRegistrationsTemplate).toContain("</response>");
    });

    it("should include example format", async () => {
      const { findRegistrationsTemplate } = await import("../templates/index");

      expect(findRegistrationsTemplate).toContain("0.0.12345");
      expect(findRegistrationsTemplate).toContain("0,4");
    });
  });

  describe("Retrieve Profile Template", () => {
    it("should have correct template structure", async () => {
      const { retrieveProfileTemplate } = await import("../templates/index");

      expect(retrieveProfileTemplate).toBeDefined();
      expect(retrieveProfileTemplate).toContain("Extract parameters for retrieving an HCS-11 profile");
      expect(retrieveProfileTemplate).toContain("<response>");
      expect(retrieveProfileTemplate).toContain("<accountId>");
      expect(retrieveProfileTemplate).toContain("<disableCache>");
      expect(retrieveProfileTemplate).toContain("</response>");
    });
  });

  describe("HBAR Transfer Template", () => {
    it("should have correct template structure", async () => {
      const { hederaHBARTransferTemplate } = await import("../templates/index");

      expect(hederaHBARTransferTemplate).toBeDefined();
      expect(hederaHBARTransferTemplate).toContain("Extract the following information about the requested HBAR transfer");
      expect(hederaHBARTransferTemplate).toContain("amount");
      expect(hederaHBARTransferTemplate).toContain("accountId");
      expect(hederaHBARTransferTemplate).toContain("```json");
    });
  });

  describe("Hedera Message Handler Template", () => {
    it("should have correct template structure", async () => {
      const { hederaMessageHandlerTemplate } = await import("../templates/index");

      expect(hederaMessageHandlerTemplate).toBeDefined();
      expect(hederaMessageHandlerTemplate).toContain("Generate dialog and actions for the character");
      expect(hederaMessageHandlerTemplate).toContain("{{agentName}}");
      expect(hederaMessageHandlerTemplate).toContain("{{bio}}");
      expect(hederaMessageHandlerTemplate).toContain("{{recentMessages}}");
    });
  });

  describe("Get Topic Messages Template", () => {
    it("should have correct template structure", async () => {
      const { getTopicMessagesTemplate } = await import("../templates/index");

      expect(getTopicMessagesTemplate).toBeDefined();
      expect(getTopicMessagesTemplate).toContain("Extract information from user prompt");
      expect(getTopicMessagesTemplate).toContain("<response>");
      expect(getTopicMessagesTemplate).toContain("<topicId>");
      expect(getTopicMessagesTemplate).toContain("<lowerThreshold>");
      expect(getTopicMessagesTemplate).toContain("<upperThreshold>");
      expect(getTopicMessagesTemplate).toContain("</response>");
    });
  });
});
