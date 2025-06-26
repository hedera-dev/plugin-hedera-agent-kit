import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { setupActionTest } from "./test-utils";
import type { IAgentRuntime } from "@elizaos/core";

// Mock external dependencies
mock.module("@hashgraphonline/standards-sdk", () => ({
  HCS10Client: class MockHCS10Client {
    constructor(config: any) {}
    
    getAccountAndSigner() {
      return { accountId: "0.0.12345" };
    }
    
    retrieveProfile(accountId: string) {
      return Promise.resolve({
        profile: {
          inboundTopicId: "0.0.11111",
          outboundTopicId: "0.0.22222",
        },
      });
    }
    
    getMessages(topicId: string) {
      return Promise.resolve({
        messages: [
          {
            sequence_number: 1,
            operator_id: "test@0.0.99999",
            op: "connection_request",
            data: "Test connection request",
          },
        ],
      });
    }
    
    getMessageStream(topicId: string) {
      return Promise.resolve({
        messages: [
          {
            sequence_number: 1,
            operator_id: "test@0.0.99999",
            data: "Test message",
            created: new Date(),
          },
        ],
      });
    }
    
    handleConnectionRequest(inboundTopicId: string, requesterAccountId: string, sequenceNumber: number) {
      return Promise.resolve({
        connectionTopicId: "0.0.33333",
      });
    }
    
    sendMessage(topicId: string, message: string, memo?: string) {
      return Promise.resolve({
        topicSequenceNumber: { toNumber: () => 2 },
      });
    }
    
    extractAccountFromOperatorId(operatorId: string) {
      if (!operatorId) return null;
      const parts = operatorId.split("@");
      return parts.length === 2 ? parts[1] : null;
    }
    
    getMessageContent(hrl: string) {
      return Promise.resolve("Resolved content from HRL");
    }
  },
  
  ConnectionsManager: class MockConnectionsManager {
    constructor(config: any) {}
    
    fetchConnectionData(accountId: string) {
      return Promise.resolve();
    }
    
    getActiveConnections() {
      return [
        {
          connectionTopicId: "0.0.44444",
          targetAccountId: "0.0.99999",
          status: "established",
          inboundRequestId: 1,
        },
      ];
    }
    
    getAllConnections() {
      return this.getActiveConnections();
    }
    
    getConnectionByTopicId(topicId: string) {
      const connections = this.getActiveConnections();
      return connections.find(c => c.connectionTopicId === topicId);
    }
    
    isConnectionRequestProcessed(topicId: string, sequenceNumber: number) {
      return false;
    }
    
    markConnectionRequestProcessed(topicId: string, sequenceNumber: number) {}
    
    updateOrAddConnection(connection: any) {}
    
    processConnectionMessages(topicId: string, messages: any[]) {}
  },
  
  NetworkType: {
    testnet: "testnet",
    mainnet: "mainnet",
  },
  
  HCSMessage: class MockHCSMessage {
    sequence_number = 1;
    operator_id = "test@0.0.99999";
    data = "Test message";
    created = new Date();
  },
}));

mock.module("@hashgraph/sdk", () => ({
  ScheduleCreateTransaction: class MockScheduleCreateTransaction {
    static fromBytes(bytes: Buffer) {
      return new MockScheduleCreateTransaction();
    }
  },
  TransactionReceipt: class MockTransactionReceipt {},
}));

describe("Service Tests", () => {
  describe("OpenConvai Service", () => {
    let OpenConvaiClient: any;
    let OpenConvaiClientInterface: any;
    let client: any;
    
    beforeEach(async () => {
      const module = await import("../services/open-convai");
      OpenConvaiClient = module.default || module.OpenConvaiClient;
      OpenConvaiClientInterface = module.OpenConvaiClientInterface;
    });
    
    afterEach(async () => {
      if (client && typeof client.stop === "function") {
        await client.stop();
      }
    });
    
    it("should start OpenConvai client", async () => {
      const { mockRuntime } = setupActionTest();
      
      client = await OpenConvaiClientInterface.start(mockRuntime as IAgentRuntime);
      expect(client).toBeDefined();
      expect(client.accountId).toBe("0.0.12345");
      expect(client.operatorId).toBe("0.0.12345");
    });
    
    it("should handle missing Hedera settings", async () => {
      const { mockRuntime } = setupActionTest();
      mockRuntime.getSetting = mock().mockReturnValue(null);
      
      await expect(
        OpenConvaiClientInterface.start(mockRuntime as IAgentRuntime)
      ).rejects.toThrow("Missing required Hedera settings");
    });
    
    it("should stop OpenConvai client", async () => {
      const { mockRuntime } = setupActionTest();
      
      const result = await OpenConvaiClientInterface.stop(mockRuntime as IAgentRuntime);
      expect(result).toBeUndefined();
    });
    
    it("should initialize client with correct network", async () => {
      const { mockRuntime } = setupActionTest();
      
      // Test mainnet
      mockRuntime.getSetting = mock().mockImplementation((key: string) => {
        if (key === "HEDERA_NETWORK") return "mainnet";
        const settings: Record<string, string> = {
          HEDERA_ACCOUNT_ID: "0.0.12345",
          HEDERA_PRIVATE_KEY: "test-private-key",
        };
        return settings[key];
      });
      
      client = await OpenConvaiClientInterface.start(mockRuntime as IAgentRuntime);
      expect(client).toBeDefined();
    });
    
    it("should handle operator ID override", async () => {
      const { mockRuntime } = setupActionTest();
      mockRuntime.getSetting = mock().mockImplementation((key: string) => {
        if (key === "HEDERA_OPERATOR_ID") return "0.0.54321";
        const settings: Record<string, string> = {
          HEDERA_ACCOUNT_ID: "0.0.12345",
          HEDERA_PRIVATE_KEY: "test-private-key",
          HEDERA_NETWORK: "testnet",
        };
        return settings[key];
      });
      
      client = await OpenConvaiClientInterface.start(mockRuntime as IAgentRuntime);
      expect(client.operatorId).toBe("0.0.54321");
    });
  });
  
  describe("Get Topic Messages Action Service", () => {
    let GetTopicMessagesActionService: any;
    
    beforeEach(async () => {
      const module = await import("../actions/get-topic-messages/services/get-topic-messages-action-service");
      GetTopicMessagesActionService = module.GetTopicMessagesActionService;
    });
    
    it("should process topic messages", async () => {
      const { mockRuntime } = setupActionTest();
      const service = new GetTopicMessagesActionService();
      
      const params = {
        topicId: "0.0.123456",
      };
      
      const result = await service.processAction(mockRuntime as IAgentRuntime, params);
      
      expect(result.success).toBe(true);
      expect(result.data.messages).toHaveLength(1);
      expect(result.data.messages[0].data).toBe("Test message");
    });
    
    it("should handle date thresholds", async () => {
      const { mockRuntime } = setupActionTest();
      const service = new GetTopicMessagesActionService();
      
      const params = {
        topicId: "0.0.123456",
        lowerThreshold: "2025-01-01T00:00:00.000Z",
        upperThreshold: "2025-12-31T23:59:59.999Z",
      };
      
      const result = await service.processAction(mockRuntime as IAgentRuntime, params);
      
      expect(result.success).toBe(true);
      expect(result.data.messages).toBeDefined();
    });
    
    it("should handle invalid date format", async () => {
      const { mockRuntime } = setupActionTest();
      const service = new GetTopicMessagesActionService();
      
      const params = {
        topicId: "0.0.123456",
        lowerThreshold: "invalid-date",
      };
      
      const result = await service.processAction(mockRuntime as IAgentRuntime, params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid date format");
    });
    
    it("should handle missing Hedera settings", async () => {
      const { mockRuntime } = setupActionTest();
      mockRuntime.getSetting = mock().mockReturnValue(null);
      
      const service = new GetTopicMessagesActionService();
      const params = { topicId: "0.0.123456" };
      
      const result = await service.processAction(mockRuntime as IAgentRuntime, params);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required Hedera settings");
    });
    
    it("should format messages correctly", async () => {
      const { mockRuntime } = setupActionTest();
      const service = new GetTopicMessagesActionService();
      
      const params = { topicId: "0.0.123456" };
      const result = await service.processAction(mockRuntime as IAgentRuntime, params);
      
      expect(result.success).toBe(true);
      expect(result.formattedResponse).toContain("Found 1 messages");
      expect(result.formattedResponse).toContain("Sequence #1");
      expect(result.formattedResponse).toContain("From: test@0.0.99999");
      expect(result.formattedResponse).toContain("Message: Test message");
    });
  });
});