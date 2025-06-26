import { type IAgentRuntime, elizaLogger } from "@elizaos/core";
import {
  HCS10Client,
  NetworkType,
} from "@hashgraphonline/standards-sdk";
import {
  GetTopicMessagesResult,
  HederaGetTopicMessagesParams,
} from "../types";
import { TxStatus } from "../../../shared/constants";
import { convertTimestampToUTC } from "../../../shared/utils";

export class GetTopicMessagesActionService {
  private logger = elizaLogger;

  async processAction(
    runtime: IAgentRuntime,
    params: HederaGetTopicMessagesParams
  ): Promise<{
    success: boolean;
    data?: {
      messages: any[];
    };
    formattedResponse?: string;
    error?: string;
  }> {
    try {
      // Validate date formats if provided
      if (params.lowerThreshold) {
        const lowerDate = new Date(params.lowerThreshold);
        if (isNaN(lowerDate.getTime())) {
          return {
            success: false,
            error: `Invalid date format for lowerThreshold: ${params.lowerThreshold}`,
          };
        }
      }

      if (params.upperThreshold) {
        const upperDate = new Date(params.upperThreshold);
        if (isNaN(upperDate.getTime())) {
          return {
            success: false,
            error: `Invalid date format for upperThreshold: ${params.upperThreshold}`,
          };
        }
      }

      const accountId = runtime.getSetting("HEDERA_ACCOUNT_ID") as string;
      const privateKey = runtime.getSetting("HEDERA_PRIVATE_KEY") as string;
      const networkType = runtime.getSetting("HEDERA_NETWORK_TYPE") || 
                          runtime.getSetting("HEDERA_NETWORK") as string;

      if (!accountId || !privateKey || !networkType) {
        return {
          success: false,
          error: "Missing required Hedera settings",
        };
      }

      const client = new HCS10Client({
        network: networkType as NetworkType,
        operatorId: accountId,
        operatorPrivateKey: privateKey,
        logLevel: "info",
      });

      // Get messages from the topic
      const messagesResponse = await client.getMessageStream(params.topicId);
      
      let messages = messagesResponse.messages || [];
      
      // Filter by date thresholds if provided
      if (params.lowerThreshold || params.upperThreshold) {
        const lowerTime = params.lowerThreshold ? new Date(params.lowerThreshold).getTime() : 0;
        const upperTime = params.upperThreshold ? new Date(params.upperThreshold).getTime() : Date.now();
        
        messages = messages.filter((msg: any) => {
          if (!msg.created) return false;
          const msgTime = msg.created.getTime();
          return msgTime >= lowerTime && msgTime <= upperTime;
        });
      }

      // Format the response
      let formattedResponse = `Found ${messages.length} messages in topic ${params.topicId}`;
      
      if (messages.length > 0) {
        formattedResponse += ":\n\n";
        messages.forEach((msg: any, index: number) => {
          formattedResponse += `Message ${index + 1}:\n`;
          formattedResponse += `  Sequence #${msg.sequence_number}\n`;
          formattedResponse += `  From: ${msg.operator_id}\n`;
          formattedResponse += `  Time: ${msg.created ? convertTimestampToUTC(msg.created.getTime() / 1000 + "." + (msg.created.getTime() % 1000)) : "Unknown"}\n`;
          formattedResponse += `  Message: ${msg.data}\n`;
          formattedResponse += "\n";
        });
      }

      return {
        success: true,
        data: {
          messages,
        },
        formattedResponse,
      };
    } catch (error) {
      this.logger.error("Error processing get topic messages action:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

// Legacy export for compatibility
export class GetTopicMessageActionService extends GetTopicMessagesActionService {}