import { IAgentRuntime, Memory, Provider, State } from "@elizaos/core";

/**
 * Provides the context with info about the connected Hedera wallet
 */
export const HederaAccountDetails: Provider = {
  name: "hederaAccountDetails",
  description: "Provides Hedera account details",

  async get(
    runtime: IAgentRuntime,
    _message: Memory,
    _state: State
  ): Promise<{ text?: string; values?: Record<string, any>; data?: Record<string, any> }> {
    try {
      const address = runtime.getSetting("HEDERA_ACCOUNT_ID");

      return {
        text: `
When user asks for "operators Hedera Account ID", respond with: ${address}.
When user asks for "my Hedera Account ID", respond with: ${address}.
When user asks for "my Hedera Wallet Address", respond with: ${address}.
  `,
        values: {
          operatorAccountId: address,
          operatorAddress: address,
          myAccountId: address,
        },
        data: {
          hederaAccountId: address,
          operatorInfo: {
            accountId: address,
            aliases: ["operator", "me", "myself", "I", "we"]
          },
          myInfo: {
            accountId: address,
            aliases: ["me", "myself", "I", "we"]
          }
        }
      };

    } catch (error) {
      console.error("Error in Hedera operator details provider", error);
      return {
        text: "Unable to retrieve operator details",
        values: { error: true },
        data: { error: error }
      };
    }
  },
};