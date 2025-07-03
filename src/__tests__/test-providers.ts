// Test version of providers that doesn't import problematic modules
import {
  type IAgentRuntime,
  type Memory,
  type State,
  type ProviderResult,
} from "@elizaos/core";

export const testHederaClientProvider = {
  name: "hederaClient",
  async get(
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State
  ): Promise<ProviderResult> {
    try {
      const agentName = state?.agentName || "The agent";
      const address = runtime.getSetting("HEDERA_ACCOUNT_ID");

      return {
        text: `${agentName}'s Hedera Wallet Address: ${address}`,
        values: {
          hederaAddress: address,
        },
      };
    } catch (error) {
      console.error("Error in Hedera client provider:", error);
      return {
        text: "Failed to retrieve Hedera wallet address",
        data: {
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  },
};
