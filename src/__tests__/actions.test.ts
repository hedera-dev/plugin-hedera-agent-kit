import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";
import { setupActionTest } from "./test-utils";
import type { Memory, State, HandlerCallback, IAgentRuntime } from "@elizaos/core";

describe("Action Tests", () => {
  // Clear all mocks after each test
  afterEach(() => {
    mock.restore();
  });

  describe("Find Registrations Action", () => {
    let findRegistrationsAction: any;
    let mockCallback: ReturnType<typeof mock>;
    
    beforeEach(async () => {
      mockCallback = mock();
      
      // Set up module mocks before importing
      mock.module("@hashgraphonline/standards-sdk", () => ({
        HCS10Client: class MockHCS10Client {
          constructor(config: any) {}
          
          async findRegistrations(options: any) {
            return {
              success: true,
              registrations: options._mockEmpty ? [] : [
                {
                  accountId: "0.0.12345",
                  status: "active",
                  metadata: {
                    display_name: "Test Agent",
                    bio: "A test agent",
                    aiAgent: {
                      model: "gpt-4",
                      capabilities: [0, 4],
                    },
                  },
                  inboundTopicId: "0.0.54321",
                  outboundTopicId: "0.0.54322",
                  createdAt: new Date().toISOString(),
                },
              ],
            };
          }
        },
        
        NetworkType: {
          testnet: "testnet",
          mainnet: "mainnet",
        },
        
        AIAgentCapability: {
          0: "TEXT_GENERATION",
          4: "CODE_GENERATION",
        },
      }));
      
      // Import after mocking
      const module = await import("../actions/find-registrations/index");
      findRegistrationsAction = module.findRegistrationsAction;
    });
    
    it("should find registrations successfully", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest({
        stateOverrides: {
          values: {
            lastMessage: "Find agents on Hedera",
            recentMessages: "Find agents on Hedera",
          },
        },
      });
      
      mockRuntime.useModel = mock().mockResolvedValue(`
        <response>
          <accountId>0.0.12345</accountId>
          <tags>0,4</tags>
        </response>
      `);
      
      const result = await findRegistrationsAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
      const callArgs = mockCallback.mock.calls[0][0];
      expect(callArgs.text).toContain("Found 1 agent registrations");
      expect(callArgs.text).toContain("Test Agent");
      expect(callArgs.content.registrations).toHaveLength(1);
    });
    
    it("should handle validation failure", async () => {
      const { mockRuntime } = setupActionTest();
      mockRuntime.getSetting = mock().mockReturnValue(null);
      
      const result = await findRegistrationsAction.validate(mockRuntime as IAgentRuntime);
      expect(result).toBe(false);
    });
    
    it("should handle no registrations found", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest();
      
      // Re-mock the module to return empty registrations
      mock.module("@hashgraphonline/standards-sdk", () => ({
        HCS10Client: class MockHCS10Client {
          constructor(config: any) {}
          async findRegistrations(options: any) {
            return {
              success: true,
              registrations: [],
            };
          }
        },
        NetworkType: { testnet: "testnet", mainnet: "mainnet" },
        AIAgentCapability: { 0: "TEXT_GENERATION", 4: "CODE_GENERATION" },
      }));
      
      mockRuntime.useModel = mock().mockResolvedValue(`
        <response>
          <accountId></accountId>
        </response>
      `);
      
      const result = await findRegistrationsAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalledWith({
        text: "No agent registrations found matching your criteria.",
      });
    });
  });
  
  describe("Retrieve Profile Action", () => {
    let retrieveProfileAction: any;
    let mockCallback: ReturnType<typeof mock>;
    
    beforeEach(async () => {
      mockCallback = mock();
      
      // Set up module mocks before importing
      mock.module("@hashgraphonline/standards-sdk", () => ({
        HCS10Client: class MockHCS10Client {
          constructor(config: any) {}
          
          async retrieveProfile(accountId: string) {
            if (accountId === "0.0.99999") {
              return {
                success: false,
                error: "Profile not found",
              };
            }
            return {
              success: true,
              profile: {
                displayName: "Test Profile",
                bio: "Test bio",
                inboundTopicId: "0.0.11111",
                outboundTopicId: "0.0.22222",
              },
            };
          }
        },
        
        NetworkType: {
          testnet: "testnet",
          mainnet: "mainnet",
        },
      }));
      
      // Import after mocking
      const module = await import("../actions/retrieve-profile/index");
      retrieveProfileAction = module.retrieveProfileAction;
    });
    
    it("should retrieve profile successfully", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest({
        stateOverrides: {
          values: {
            lastMessage: "Get profile for account 0.0.12345",
          },
        },
      });
      
      mockRuntime.useModel = mock().mockResolvedValue(`
        <response>
          <accountId>0.0.12345</accountId>
        </response>
      `);
      
      const result = await retrieveProfileAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
      const callArgs = mockCallback.mock.calls[0][0];
      expect(callArgs.text).toContain("Retrieved profile for account 0.0.12345");
      expect(callArgs.text).toContain("Test Profile");
    });
    
    it("should handle profile not found", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest();
      
      mockRuntime.useModel = mock().mockResolvedValue(`
        <response>
          <accountId>0.0.99999</accountId>
        </response>
      `);
      
      const result = await retrieveProfileAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(false);
      expect(mockCallback).toHaveBeenCalled();
      const callArgs = mockCallback.mock.calls[0][0];
      expect(callArgs.text).toContain("Error retrieving profile");
    });
  });
  
  describe("Get Topic Messages Action", () => {
    let getTopicMessagesAction: any;
    let mockCallback: ReturnType<typeof mock>;
    
    beforeEach(async () => {
      mockCallback = mock();
      
      // Set up module mocks before importing
      mock.module("@hashgraphonline/standards-sdk", () => ({
        HCS10Client: class MockHCS10Client {
          constructor(config: any) {}
          
          async getMessageStream(topicId: string) {
            return {
              messages: [
                {
                  sequence_number: 1,
                  data: "Test message",
                  created: new Date(),
                },
              ],
            };
          }
        },
        
        NetworkType: {
          testnet: "testnet",
          mainnet: "mainnet",
        },
      }));
      
      // Import after mocking
      const module = await import("../actions/get-topic-messages/get-topic-messages");
      getTopicMessagesAction = module.getTopicMessagesAction;
    });
    
    it("should get topic messages successfully", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest({
        stateOverrides: {
          values: {
            lastMessage: "Show messages from topic 0.0.123456",
          },
        },
      });
      
      mockRuntime.useModel = mock().mockResolvedValue(`
        <response>
          <topicId>0.0.123456</topicId>
        </response>
      `);
      
      const result = await getTopicMessagesAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
      const callArgs = mockCallback.mock.calls[0][0];
      expect(callArgs.text).toContain("Found 1 messages");
      expect(callArgs.text).toContain("Test message");
    });
    
    it("should handle date thresholds", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest({
        stateOverrides: {
          values: {
            lastMessage: "Show messages from topic 0.0.123456 after 2025-01-01",
          },
        },
      });
      
      mockRuntime.useModel = mock().mockResolvedValue(`
        <response>
          <topicId>0.0.123456</topicId>
          <lowerThreshold>2025-01-01T00:00:00.000Z</lowerThreshold>
        </response>
      `);
      
      const result = await getTopicMessagesAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
    });
  });
  
  describe("Create Transaction Action", () => {
    let createTransactionAction: any;
    let mockCallback: ReturnType<typeof mock>;
    
    beforeEach(async () => {
      mockCallback = mock();
      
      // Set up module mocks before importing
      mock.module("@hashgraphonline/standards-sdk", () => ({
        HCS10Client: class MockHCS10Client {
          constructor(config: any) {}
          extractAccountFromOperatorId(operatorId: string) {
            return operatorId ? "0.0.12345" : null;
          }
        },
        HCSMessage: class MockHCSMessage {
          operator_id = "test@0.0.12345";
        },
        NetworkType: {
          testnet: "testnet",
          mainnet: "mainnet",
        },
      }));
      
      mock.module("@hashgraphonline/hedera-agent-kit", () => ({
        HederaConversationalAgent: class MockHederaConversationalAgent {
          constructor(config: any) {}
          async initialize() {}
          async processMessage(message: string) {
            return {
              message: "Transaction processed",
              transactionBytes: "mockTransactionBytes",
              notes: ["Test note"],
            };
          }
        },
        ServerSigner: class MockServerSigner {
          constructor(accountId: any, privateKey: any, network: any) {}
        },
        AgentOperationalMode: {
          provideBytes: "provideBytes",
          directExecution: "directExecution",
        },
        HederaNetworkType: {
          testnet: "testnet",
          mainnet: "mainnet",
        },
      }));
      
      // Import after mocking
      const module = await import("../actions/create-transaction/create-transaction");
      createTransactionAction = module.createTransactionAction;
    });
    
    it("should create transaction successfully", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest({
        messageOverrides: {
          content: {
            text: "Transfer 100 HBAR to 0.0.54321",
            content: {
              message: {
                operator_id: "test@0.0.12345",
              },
            },
          },
        },
      });
      
      const result = await createTransactionAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(true);
      expect(mockCallback).toHaveBeenCalled();
      const callArgs = mockCallback.mock.calls[0][0];
      expect(callArgs.text).toContain("Transaction processed");
      expect(callArgs.content.transactionBytes).toBe("mockTransactionBytes");
    });
    
    it("should handle missing message content", async () => {
      const { mockRuntime, mockMessage, mockState } = setupActionTest({
        messageOverrides: {
          content: null,
        },
      });
      
      const result = await createTransactionAction.handler(
        mockRuntime as IAgentRuntime,
        mockMessage as Memory,
        mockState as State,
        undefined,
        mockCallback as HandlerCallback
      );
      
      expect(result).toBe(false);
      expect(mockCallback).toHaveBeenCalledWith({
        text: "No user message found to process for transaction.",
        content: {
          error: "No user message found to process for transaction.",
        },
      });
    });
    
    it("should validate with all required settings", async () => {
      const { mockRuntime } = setupActionTest();
      process.env.OPENAI_API_KEY = "test-key";
      
      const result = await createTransactionAction.validate(mockRuntime as IAgentRuntime);
      expect(result).toBe(true);
      
      delete process.env.OPENAI_API_KEY;
    });
    
    it("should fail validation without OpenAI key", async () => {
      const { mockRuntime } = setupActionTest();
      delete process.env.OPENAI_API_KEY;
      
      const result = await createTransactionAction.validate(mockRuntime as IAgentRuntime);
      expect(result).toBe(false);
    });
  });
});