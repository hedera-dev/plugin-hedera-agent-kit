import {
  composePromptFromState,
  parseKeyValueXml,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  ModelType,
  State,
} from "@elizaos/core";
import { HederaGetTopicMessagesParams } from "./types.ts";
import { hederaGetTopicMessagesParamsSchema } from "./schema.ts";
import { GetTopicMessagesActionService } from "./services/get-topic-messages-action-service.ts";
import { getTopicMessagesTemplate } from "../../templates";

export const getTopicMessagesAction = {
  name: "HEDERA_GET_TOPIC_MESSAGES",
  description:
    "Action for fetching messages from a topic by its ID, with the option to filter messages by upper and lower thresholds.",
  handler: async (
    runtime: IAgentRuntime,
    _message: Memory,
    state?: State,
    _options?: { [key: string]: unknown },
    callback?: HandlerCallback
  ) => {
    if (!state) {
      state = await runtime.composeState(_message);
    }
    state.lastMessage = state.recentMessagesData?.[1]?.content?.text || 
                        state.recentMessagesData?.[0]?.content?.text || 
                        _message?.content?.text || 
                        "";

    const prompt = composePromptFromState({
      state: state,
      template: getTopicMessagesTemplate,
    });

    const xmlResult = await runtime.useModel(ModelType.TEXT_SMALL, {
      prompt,
    });

    const hederaGetTopicMessagesContent = parseKeyValueXml(xmlResult);
    if (!hederaGetTopicMessagesContent) {
      throw new Error("Failed to parse XML result");
    }

    const paramOptions: HederaGetTopicMessagesParams = {
      topicId: hederaGetTopicMessagesContent.topicId,
      lowerThreshold: hederaGetTopicMessagesContent.lowerThreshold || null,
      upperThreshold: hederaGetTopicMessagesContent.upperThreshold || null,
    };

    console.log(`Extracted data: ${JSON.stringify(paramOptions, null, 2)}`);

    try {
      const validationResult =
        hederaGetTopicMessagesParamsSchema.safeParse(paramOptions);

      if (!validationResult.success) {
        const errorMessages = validationResult.error.errors.map(
          (e) => `Field "${e.path.join(".")}" failed validation: ${e.message}`
        );
        throw new Error(
          `Error during parsing data from users prompt: ${errorMessages.join(", ")}`
        );
      }

      const service = new GetTopicMessagesActionService();
      const response = await service.processAction(runtime, validationResult.data);

      if (callback) {
        if (response.success) {
          await callback({
            text: response.formattedResponse || "Messages retrieved successfully",
          });
        } else {
          await callback({
            text: `Error: ${response.error}`,
            content: { error: response.error },
          });
        }
      }

      return response.success;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error fetching messages. Error:", error);

      if (callback) {
        await callback({
          text: `Error fetching messages. Error: ${errorMessage}`,
          content: { error: errorMessage },
        });
      }
      return false;
    }
  },
  template: getTopicMessagesTemplate,
  validate: async (runtime: IAgentRuntime) => {
    const privateKey = runtime.getSetting("HEDERA_PRIVATE_KEY");
    const accountAddress = runtime.getSetting("HEDERA_ACCOUNT_ID");
    const selectedNetworkType = runtime.getSetting("HEDERA_NETWORK_TYPE");

    return !!(privateKey && accountAddress && selectedNetworkType);
  },
  examples: [
    [
      {
        name: "{{user}}",
        content: {
          text: "Get messages from a topic {{0.0.123456}}.",
          action: "HEDERA_GET_TOPIC_MESSAGES",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "",
          action: "HEDERA_GET_TOPIC_MESSAGES",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Show me all messages from a topic {{0.0.123456}}, that have been posted since {{05.02.2025 14:14:14:144}}.",
          action: "HEDERA_GET_TOPIC_MESSAGES",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "",
          action: "HEDERA_GET_TOPIC_MESSAGES",
        },
      },
    ],
    [
      {
        name: "{{user}}",
        content: {
          text: "Show me all messages from a topic {{0.0.123456}}, that have been posted between {{05.02.2025 14:14:14:144}} and {{08.02.2025 20:14:20:144}}.",
          action: "HEDERA_GET_TOPIC_MESSAGES",
        },
      },
      {
        name: "{{assistant}}",
        content: {
          text: "",
          action: "HEDERA_GET_TOPIC_MESSAGES",
        },
      },
    ],
  ],

  similes: [
    "HEDERA_GET_TOPIC_MESSAGES",
    "HEDERA_GET_HCS_MESSAGES",
    "HCS_FETCH_MESSAGES",
  ],
};
