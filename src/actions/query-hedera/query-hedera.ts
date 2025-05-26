import {
    Action,
    HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { HederaProvider } from "../../providers/client/index.ts";
import { HCSMessage } from "@hashgraphonline/standards-sdk";
import { HCS10Client } from "@hashgraphonline/standards-sdk";
import { HederaNetworkType } from "@hashgraphonline/hedera-agent-kit";

export const queryHederaAction: Action = {
    name: "HEDERA_QUERY_NETWORK",
    description:
        "Query information from the Hedera network including account balances, token details, NFT ownership, transaction status, HBAR prices, and topic information. Use this action when users ask about checking, getting, showing, or retrieving any Hedera network data. Keywords: balance, check, get, show, what, how much, account, token, nft, transaction, hbar, hedera, info, information, details, status, price, topic, my account, my balance, my tokens, my nfts.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: unknown,
        callback?: HandlerCallback
    ) => {
        try {
            const content =
                _message?.content || state.recentMessagesData?.[0]?.content;
            const userMessageContent = content?.text;
            const hcsMessage = (
                content?.content as unknown as {
                    message: HCSMessage;
                }
            )?.message as HCSMessage;

            const hederaClient = new HCS10Client({
                operatorId: runtime.getSetting("HEDERA_ACCOUNT_ID"),
                operatorPrivateKey: runtime.getSetting("HEDERA_PRIVATE_KEY"),
                network: runtime.getSetting(
                    "HEDERA_NETWORK"
                ) as HederaNetworkType,
            });

            const userAccountId = hederaClient.extractAccountFromOperatorId(
                hcsMessage?.operator_id
            );

            if (!userMessageContent) {
                await callback?.({
                    text: "No user message found to process for query.",
                    content: {
                        error: "No user message found to process for query.",
                    },
                });
                return false;
            }

            const hederaProvider = new HederaProvider(runtime, userAccountId);
            const hederaAgentKit = await hederaProvider.getHederaAgentKit();

            const result =
                await hederaAgentKit.processMessage(userMessageContent);

            if (result) {
                await callback?.({
                    text: result.message,
                    content: result,
                });
            } else {
                await callback?.({
                    text: "Query request processed, but no specific result to report.",
                    content: {
                        info: "Query request processed, but no specific result to report.",
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during Hedera query processing:", error);
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            await callback?.({
                text: `Error during Hedera query processing: ${errorMessage}`,
                content: { error: errorMessage },
            });
            return false;
        }
    },
    validate: async (runtime) => {
        const privateKey = runtime.getSetting("HEDERA_PRIVATE_KEY");
        const accountAddress = runtime.getSetting("HEDERA_ACCOUNT_ID");
        const openAIKey = process.env.OPENAI_API_KEY;

        return !!(privateKey && accountAddress && openAIKey);
    },
    examples: [
        [
            {
                user: "{{user}}",
                content: {
                    text: "What is the HBAR balance for account 0.0.12345?",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"accountId":"0.0.12345","balance":150.5,"unit":"HBAR"}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "whats the HBAR balance of my hedera account?",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"accountId":"0.0.12345","balance":42.75,"unit":"HBAR"}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "check my account balance",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"accountId":"0.0.12345","balance":89.25,"unit":"HBAR"}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "how much HBAR do I have?",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"accountId":"0.0.12345","balance":125.0,"unit":"HBAR"}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Get information about Hedera token 0.0.98765",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"tokenInfo":{"token_id":"0.0.98765","name":"MyToken","symbol":"MTK","type":"FUNGIBLE_COMMON","total_supply":"1000000","decimals":2}}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Show me the NFTs owned by account 0.0.54321",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"accountId":"0.0.54321","nftCount":3,"nfts":[{"token_id":"0.0.11111","serial_number":1},{"token_id":"0.0.22222","serial_number":5},{"token_id":"0.0.33333","serial_number":12}]}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Get details for transaction 0.0.12345-1234567890-123456789",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"transactionIdOrHash":"0.0.12345-1234567890-123456789","transaction":{"consensus_timestamp":"1234567890.123456789","transaction_id":"0.0.12345-1234567890-123456789","result":"SUCCESS"}}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "What is the current HBAR price in USD?",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"date":"2024-01-15T10:30:00.000Z","priceUsd":0.085,"currency":"USD"}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Show me information about HCS topic 0.0.67890",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"topicInfo":{"topic_id":"0.0.67890","memo":"Project updates topic","admin_key":"302a300506032b6570032100...","submit_key":"302a300506032b6570032100..."}}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Get account information for 0.0.98765",
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"accountInfo":{"account":"0.0.98765","balance":{"balance":1500000000},"key":"302a300506032b6570032100...","memo":"My Hedera account"}}`,
                    action: "HEDERA_QUERY_NETWORK",
                },
            },
        ],
    ],
    similes: [
        "HEDERA_GET_INFO",
        "HEDERA_FETCH_DATA", 
        "HEDERA_CHECK_STATUS",
        "HEDERA_LOOKUP_DETAILS",
        "HEDERA_RETRIEVE_INFO",
        "HEDERA_CHECK_BALANCE",
        "HEDERA_GET_BALANCE",
        "HEDERA_ACCOUNT_INFO",
        "HEDERA_TOKEN_INFO",
        "HEDERA_NFT_INFO",
        "HEDERA_TRANSACTION_INFO",
        "CHECK_HEDERA_ACCOUNT",
        "GET_HEDERA_DATA",
        "SHOW_HEDERA_INFO",
        "LOOKUP_HEDERA",
        "QUERY_HEDERA",
    ],
};
 