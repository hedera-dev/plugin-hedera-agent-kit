// Setup mocks before any tests run
import { mock } from "bun:test";

// Create a mock for the problematic module
const hederaAgentKitMock = {
  HederaConversationalAgent: class MockHederaConversationalAgent {
    constructor(signer: any, options: any) {}
    async initialize() {
      return Promise.resolve();
    }
    async createTransaction(params: any) {
      return {
        transactionId: "0.0.123@456.789",
        status: "SUCCESS",
      };
    }
  },
  ServerSigner: class MockServerSigner {
    constructor(accountId: string, privateKey: string, network: string) {}
  },
  AgentOperationalMode: {
    provideBytes: "provideBytes",
    directExecution: "directExecution",
  },
  HederaNetworkType: "testnet" as const,
};

// Mock the module globally
mock.module("@hashgraphonline/hedera-agent-kit", () => hederaAgentKitMock);
