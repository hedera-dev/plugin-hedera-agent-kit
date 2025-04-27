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
import { findRegistrationsParamsSchema } from "./schema";
import {
    HCS10Client,
    NetworkType,
    AIAgentCapability,
    AIAgentProfile,
} from "@hashgraphonline/standards-sdk";
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
                template: findRegistrationsTemplate,
                templatingEngine: "handlebars",
            });

            const extractedData = await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.SMALL,
            });

            logger.info("Extracted registration search params:", extractedData);

            const params = findRegistrationsParamsSchema.parse(extractedData);

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
                    model: String(
                        (metadata.aiAgent && metadata.aiAgent.model) || "N/A"
                    ),
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
            elizaLogger.error("Error during find registrations:", error);

            await callback?.({
                text: `Error finding agent registrations: ${error.message}`,
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
                    text: "Find agent registrations on Hedera",
                    action: "HEDERA_FIND_REGISTRATIONS",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: "",
                    action: "HEDERA_FIND_REGISTRATIONS",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Find agent with account ID 0.0.12345",
                    action: "HEDERA_FIND_REGISTRATIONS",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: "",
                    action: "HEDERA_FIND_REGISTRATIONS",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Find all agents with TEXT_GENERATION capability",
                    action: "HEDERA_FIND_REGISTRATIONS",
                },
            },
            {
                user: "{{assistant}}",
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
        return metadata.aiAgent.capabilities.map((cap) => {
            const enumValue = Number(cap);
            if (enumValue in AIAgentCapability) {
                return `${AIAgentCapability[enumValue]} (${enumValue})`;
            }
            return `Capability ${cap}`;
        });
    }

    return [];
}
