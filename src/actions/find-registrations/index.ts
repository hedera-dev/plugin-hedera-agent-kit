import {
  Action,
  elizaLogger,
  type IAgentRuntime,
  type Memory,
  type State,
  HandlerCallback,
  composePromptFromState,
  ModelType,
  parseKeyValueXml,
} from "@elizaos/core";
import { findRegistrationsParamsSchema } from "./schema";
import {
  HCS10Client,
  NetworkType,
  AIAgentProfile,
} from "@hashgraphonline/standards-sdk";

// Define AIAgentCapability enum locally if not exported
const AIAgentCapability: Record<number, string> = {
  0: "TEXT_GENERATION",
  1: "IMAGE_GENERATION",
  2: "IMAGE_PROCESSING",
  3: "AUDIO_PROCESSING",
  4: "CODE_GENERATION",
  5: "DATA_ANALYSIS",
  6: "TRANSLATION",
  7: "SUMMARIZATION",
  8: "CONVERSATION",
  9: "TASK_PLANNING",
  10: "WEB_SEARCH",
  11: "FILE_PROCESSING",
  12: "EXTERNAL_API",
};
import { findRegistrationsTemplate } from "../../templates";

/**
 * Action to search for HCS-10 agent registrations using the configured registry.
 */
export const findRegistrationsAction: Action = {
  name: "HEDERA_FIND_REGISTRATIONS",
  description: "Find AI agent registrations in the Hedera registry",
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: unknown,
    callback?: HandlerCallback
  ) => {
    try {
      const logger = elizaLogger;

      if (!state) {
        state = await runtime.composeState(_message);
      }

      state.lastMessage = state.recentMessagesData?.[1]?.content?.text || 
                          state.recentMessagesData?.[0]?.content?.text || 
                          _message?.content?.text || 
                          "";

      const prompt = composePromptFromState({
        state,
        template: findRegistrationsTemplate,
      });

      const xmlResult = await runtime.useModel(ModelType.TEXT_SMALL, {
        prompt,
      });

      const extractedData = parseKeyValueXml(xmlResult);
      if (!extractedData) {
        throw new Error("Failed to parse XML result");
      }

      // Parse comma-separated tags if present
      if (extractedData.tags && typeof extractedData.tags === "string") {
        extractedData.tags = extractedData.tags
          .split(",")
          .map((tag) => parseInt(tag.trim(), 10));
      }

      logger.info("Extracted registration search params:", extractedData);

      const params = findRegistrationsParamsSchema.parse(extractedData);

      const accountId = runtime.getSetting("HEDERA_ACCOUNT_ID") as string;
      const privateKey = runtime.getSetting("HEDERA_PRIVATE_KEY") as string;
      const networkType = runtime.getSetting("HEDERA_NETWORK_TYPE") as string;

      if (!accountId || !privateKey || !networkType) {
        throw new Error("Missing required Hedera settings");
      }

      const hcs10Client = new HCS10Client({
        network: networkType as NetworkType,
        operatorId: accountId,
        operatorPrivateKey: privateKey,
        logLevel: "info",
      });

      const options = {
        accountId: params.accountId,
        network: networkType,
      };

      if (params.tags) {
        (options as any).tags = params.tags.map(String);
      }

      const result = await hcs10Client.findRegistrations(options);
      logger.info("Find registrations result:", result);

      if (!result.success || result.error) {
        throw new Error(
          `Error finding registrations: ${result.error || "Unknown error"}`
        );
      }

      if (!result.registrations || result.registrations.length === 0) {
        await callback?.({
          text: "No agent registrations found matching your criteria.",
        });
        return true;
      }

      const registrations = result.registrations.map((reg) => {
        const metadata = reg.metadata;

        return {
          name: String(metadata.display_name || "N/A"),
          description: String(metadata.bio || "N/A"),
          accountId: reg.accountId || "Unknown",
          status: reg.status || "Unknown",
          model: String((metadata.aiAgent && metadata.aiAgent.model) || "N/A"),
          capabilities: processCapabilities(metadata),
          inboundTopicId: reg.inboundTopicId || "Unknown",
          outboundTopicId: reg.outboundTopicId || "Unknown",
          createdAt: reg.createdAt || "Unknown",
        };
      });

      let responseText = `Found ${registrations.length} agent registrations:\n\n`;

      registrations.forEach((reg, index) => {
        responseText += `${index + 1}. ${reg.name}\n`;
        responseText += `   Account ID: ${reg.accountId}\n`;
        responseText += `   Description: ${reg.description}\n`;
        responseText += `   Status: ${reg.status}\n`;

        if (reg.capabilities && reg.capabilities.length > 0) {
          responseText += `   Capabilities:\n`;
          reg.capabilities.forEach((cap) => {
            responseText += `     - ${cap}\n`;
          });
        }

        responseText += `   Inbound Topic: ${reg.inboundTopicId}\n`;
        responseText += `   Outbound Topic: ${reg.outboundTopicId}\n\n`;
      });

      await callback?.({
        text: responseText.trim(),
        content: { registrations: result.registrations },
      });

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      elizaLogger.error("Error during find registrations:", error);

      await callback?.({
        text: `Error finding agent registrations: ${errorMessage}`,
        content: { error: errorMessage },
      });

      return false;
    }
  },
  validate: async (runtime) => {
    const accountId = runtime.getSetting("HEDERA_ACCOUNT_ID");
    const privateKey = runtime.getSetting("HEDERA_PRIVATE_KEY");
    const networkType = runtime.getSetting("HEDERA_NETWORK_TYPE");

    return !!(accountId && privateKey && networkType);
  },
  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Find agent registrations on Hedera",
          action: "HEDERA_FIND_REGISTRATIONS",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "",
          action: "HEDERA_FIND_REGISTRATIONS",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Find agent with account ID 0.0.12345",
          action: "HEDERA_FIND_REGISTRATIONS",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "",
          action: "HEDERA_FIND_REGISTRATIONS",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Find all agents with TEXT_GENERATION capability",
          action: "HEDERA_FIND_REGISTRATIONS",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "",
          action: "HEDERA_FIND_REGISTRATIONS",
        },
      },
    ],
  ],
  similes: [
    "HEDERA_SEARCH_REGISTRATIONS",
    "HEDERA_FIND_AGENTS",
    "HEDERA_LIST_REGISTRATIONS",
  ],
};

function processCapabilities(metadata: AIAgentProfile): string[] {
  if (metadata.aiAgent && Array.isArray(metadata.aiAgent.capabilities)) {
    return metadata.aiAgent.capabilities.map((cap: number | string) => {
      const enumValue = Number(cap);
      if (enumValue in AIAgentCapability) {
        return `${AIAgentCapability[enumValue]} (${enumValue})`;
      }
      return `Capability ${cap}`;
    });
  }

  return [];
}
