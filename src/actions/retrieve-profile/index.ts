import {
    Action,
    elizaLogger,
    type IAgentRuntime,
    type Memory,
    type State,
    HandlerCallback,
    composeContext,
    ModelClass,
    generateObjectDeprecated,
} from "@elizaos/core";
import { retrieveProfileParamsSchema } from "./schema";
import {
    HCS10Client,
    NetworkType,
    AIAgentCapability,
} from "@hashgraphonline/standards-sdk";
import { retrieveProfileTemplate } from "../../templates";

interface TopicInfoShape {
    topic_id?: string;
    memo?: string;
    created_timestamp?: string;
    inboundTopic?: string;
    outboundTopic?: string;
    profileTopicId?: string;
    [key: string]: any;
}


/**
 * Action to retrieve an HCS-11 profile associated with a Hedera account.
 */
export const retrieveProfileAction: Action = {
    name: "HEDERA_RETRIEVE_PROFILE",
    description: "Retrieve an HCS-11 profile from a Hedera account",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: unknown,
        callback?: HandlerCallback
    ) => {
        try {
            const logger = elizaLogger;

            state.lastMessage =
                state.recentMessagesData[1]?.content?.text || "";

            const context = composeContext({
                state,
                template: retrieveProfileTemplate,
                templatingEngine: "handlebars",
            });

            const extractedData = await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            logger.info("Extracted profile retrieval params:", extractedData);

            const params = retrieveProfileParamsSchema.parse(extractedData);

            const accountId = runtime.getSetting("HEDERA_ACCOUNT_ID") as string;
            const privateKey = runtime.getSetting(
                "HEDERA_PRIVATE_KEY"
            ) as string;
            const networkType = runtime.getSetting(
                "HEDERA_NETWORK_TYPE"
            ) as string;

            if (!accountId || !privateKey || !networkType) {
                throw new Error("Missing required Hedera settings");
            }

            const hcs10Client = new HCS10Client({
                network: networkType as NetworkType,
                operatorId: accountId,
                operatorPrivateKey: privateKey,
                logLevel: "info",
            });

            const targetAccountId = params.accountId || accountId;
            logger.info(`Retrieving profile for account: ${targetAccountId}`);

            const result = await hcs10Client.retrieveProfile(
                targetAccountId,
                params.disableCache
            );

            if (!result.success || !result.profile) {
                throw new Error(
                    `Error retrieving profile: ${result.error || "Profile not found"}`
                );
            }

            const profile = result.profile;

            let responseText = `Retrieved profile for account ${targetAccountId}:\n\n`;

            let displayName = "N/A";
            if (typeof profile.displayName === "string") {
                displayName = profile.displayName;
            } else if (typeof profile.display_name === "string") {
                displayName = profile.display_name;
            }

            let profileType = "N/A";
            if (profile.type === 1) {
                profileType = "AI Agent";
            } else if (profile.type === 0) {
                profileType = "Personal";
            } else if (typeof profile.type !== "undefined") {
                profileType = String(profile.type);
            }

            responseText += `Display Name: ${displayName}\n`;
            responseText += `Type: ${profileType}\n`;
            responseText += `Alias: ${profile.alias || "N/A"}\n`;
            responseText += `Bio: ${profile.bio || "N/A"}\n`;

            const inboundTopicId =
                profile.inboundTopicId || profile.inbound_topic_id;
            if (inboundTopicId) {
                responseText += `Inbound Topic: ${inboundTopicId}\n`;
            }

            const outboundTopicId =
                profile.outboundTopicId || profile.outbound_topic_id;
            if (outboundTopicId) {
                responseText += `Outbound Topic: ${outboundTopicId}\n`;
            }

            const aiAgent = profile.aiAgent || profile.ai_agent;
            if (aiAgent) {
                responseText += `\nAI Agent:\n`;

                let agentType = "N/A";
                if (aiAgent.type === 0) {
                    agentType = "Manual";
                } else if (aiAgent.type === 1) {
                    agentType = "Autonomous";
                } else if (typeof aiAgent.type !== "undefined") {
                    agentType = String(aiAgent.type);
                }

                responseText += `  Type: ${agentType}\n`;
                responseText += `  Model: ${aiAgent.model || "N/A"}\n`;
                responseText += `  Creator: ${aiAgent.creator || "N/A"}\n`;

                if (
                    Array.isArray(aiAgent.capabilities) &&
                    aiAgent.capabilities.length > 0
                ) {
                    responseText += `  Capabilities:\n`;
                    aiAgent.capabilities.forEach((cap) => {
                        const enumValue = Number(cap);
                        if (
                            !isNaN(enumValue) &&
                            enumValue in AIAgentCapability
                        ) {
                            responseText += `    - ${AIAgentCapability[enumValue]} (${enumValue})\n`;
                        } else {
                            responseText += `    - Capability ${cap}\n`;
                        }
                    });
                }
            }

            if (
                profile.properties &&
                typeof profile.properties === "object" &&
                Object.keys(profile.properties).length > 0
            ) {
                responseText += `\nProperties:\n`;
                for (const [key, value] of Object.entries(profile.properties)) {
                    responseText += `  ${key}: ${JSON.stringify(value)}\n`;
                }
            }

            if (result.topicInfo) {
                responseText += `\nTopic Info:\n`;

                const topicInfo = result.topicInfo as TopicInfoShape;

                if (topicInfo.inboundTopic) {
                    responseText += `  Inbound Topic: ${topicInfo.inboundTopic}\n`;
                }

                if (topicInfo.outboundTopic) {
                    responseText += `  Outbound Topic: ${topicInfo.outboundTopic}\n`;
                }

                if (topicInfo.profileTopicId) {
                    responseText += `  Profile Topic ID: ${topicInfo.profileTopicId}\n`;
                }

                if (topicInfo.topic_id) {
                    responseText += `  Topic ID: ${topicInfo.topic_id}\n`;
                }

                if (topicInfo.memo) {
                    responseText += `  Description: ${topicInfo.memo}\n`;
                }

                if (topicInfo.created_timestamp) {
                    responseText += `  Created: ${new Date(topicInfo.created_timestamp).toLocaleString()}\n`;
                }
            }

            await callback?.({
                text: responseText.trim(),
                content: {
                    profile: result.profile,
                    topicInfo: result.topicInfo,
                },
            });

            return true;
        } catch (error) {
            elizaLogger.error("Error during profile retrieval:", error);

            await callback?.({
                text: `Error retrieving profile: ${error.message}`,
                content: { error: error.message },
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
                user: "{{user}}",
                content: {
                    text: "Get the HCS-11 profile for account 0.0.12345",
                    action: "HEDERA_RETRIEVE_PROFILE",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: "",
                    action: "HEDERA_RETRIEVE_PROFILE",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Retrieve your current agent profile",
                    action: "HEDERA_RETRIEVE_PROFILE",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: "",
                    action: "HEDERA_RETRIEVE_PROFILE",
                },
            },
        ],
    ],
    similes: [
        "HEDERA_GET_PROFILE",
        "HEDERA_FETCH_PROFILE",
        "HEDERA_SHOW_PROFILE",
    ],
};
