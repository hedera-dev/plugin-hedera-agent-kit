import { describe, expect, it } from "bun:test";
import { z } from "zod";

describe("Schema Validation Tests", () => {
  describe("Find Registrations Schema", () => {
    it("should validate correct input", async () => {
      const { findRegistrationsParamsSchema } = await import(
        "../actions/find-registrations/schema"
      );

      const validInput = {
        accountId: "0.0.12345",
        tags: [0, 4],
      };

      const result = findRegistrationsParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountId).toBe("0.0.12345");
        expect(result.data.tags).toEqual([0, 4]);
      }
    });

    it("should handle optional fields", async () => {
      const { findRegistrationsParamsSchema } = await import(
        "../actions/find-registrations/schema"
      );

      // Both fields are optional
      const emptyInput = {};
      const result = findRegistrationsParamsSchema.safeParse(emptyInput);
      expect(result.success).toBe(true);
    });

    it("should validate tags as number array", async () => {
      const { findRegistrationsParamsSchema } = await import(
        "../actions/find-registrations/schema"
      );

      const invalidTags = {
        accountId: "0.0.12345",
        tags: ["0", "4"], // Should be numbers, not strings
      };

      const result = findRegistrationsParamsSchema.safeParse(invalidTags);
      expect(result.success).toBe(false);
    });
  });

  describe("Retrieve Profile Schema", () => {
    it("should validate correct input", async () => {
      const { retrieveProfileParamsSchema } = await import(
        "../actions/retrieve-profile/schema"
      );

      const validInput = {
        accountId: "0.0.12345",
        disableCache: false,
      };

      const result = retrieveProfileParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.accountId).toBe("0.0.12345");
        expect(result.data.disableCache).toBe(false);
      }
    });

    it("should handle optional fields", async () => {
      const { retrieveProfileParamsSchema } = await import(
        "../actions/retrieve-profile/schema"
      );

      // All fields are optional
      const emptyInput = {};

      const result = retrieveProfileParamsSchema.safeParse(emptyInput);
      expect(result.success).toBe(true);
    });
  });

  describe("Get Topic Messages Schema", () => {
    it("should validate correct input", async () => {
      const { hederaGetTopicMessagesParamsSchema } = await import(
        "../actions/get-topic-messages/schema"
      );

      const validInput = {
        topicId: "0.0.12345",
        lowerThreshold: null,
        upperThreshold: null,
      };

      const result = hederaGetTopicMessagesParamsSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topicId).toBe("0.0.12345");
      }
    });

    it("should handle threshold values", async () => {
      const { hederaGetTopicMessagesParamsSchema } = await import(
        "../actions/get-topic-messages/schema"
      );

      const inputWithThresholds = {
        topicId: "0.0.12345",
        lowerThreshold: "2024-01-01T00:00:00Z",
        upperThreshold: "2024-12-31T23:59:59Z",
      };

      const result =
        hederaGetTopicMessagesParamsSchema.safeParse(inputWithThresholds);
      expect(result.success).toBe(true);
    });

    it("should reject missing topic ID", async () => {
      const { hederaGetTopicMessagesParamsSchema } = await import(
        "../actions/get-topic-messages/schema"
      );

      const result = hederaGetTopicMessagesParamsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("Hedera Account ID Validation", () => {
    it("should validate standard account IDs", () => {
      const accountIdSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

      expect(accountIdSchema.safeParse("0.0.12345").success).toBe(true);
      expect(accountIdSchema.safeParse("0.0.1").success).toBe(true);
      expect(accountIdSchema.safeParse("1.2.3456789").success).toBe(true);
    });

    it("should reject invalid account IDs", () => {
      const accountIdSchema = z.string().regex(/^\d+\.\d+\.\d+$/);

      expect(accountIdSchema.safeParse("0.0").success).toBe(false);
      expect(accountIdSchema.safeParse("0.0.0.0").success).toBe(false);
      expect(accountIdSchema.safeParse("abc.def.ghi").success).toBe(false);
      expect(accountIdSchema.safeParse("12345").success).toBe(false);
    });
  });

  describe("Transaction Action Validation", () => {
    it("should validate transaction actions", () => {
      const actionSchema = z.enum([
        "SEND",
        "ASSOCIATE_TOKEN",
        "DISSOCIATE_TOKEN",
        "APPROVE_ALLOWANCE",
      ]);

      expect(actionSchema.safeParse("SEND").success).toBe(true);
      expect(actionSchema.safeParse("ASSOCIATE_TOKEN").success).toBe(true);
      expect(actionSchema.safeParse("DISSOCIATE_TOKEN").success).toBe(true);
      expect(actionSchema.safeParse("APPROVE_ALLOWANCE").success).toBe(true);
      expect(actionSchema.safeParse("INVALID_ACTION").success).toBe(false);
    });
  });
});
