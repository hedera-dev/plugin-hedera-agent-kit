import {
    Action,
    HandlerCallback,
    type IAgentRuntime,
    type Memory,
    type State,
} from "@elizaos/core";
import { HederaProvider } from "../../providers/client/index.ts";

export const createTransactionAction: Action = {
    name: "HEDERA_CREATE_TRANSACTION",
    description:
        "Processes a natural language request to create and execute a transaction on the Hedera network.",
    handler: async (
        runtime: IAgentRuntime,
        _message: Memory,
        state: State,
        _options: unknown,
        callback?: HandlerCallback
    ) => {
        try {
            const userMessageContent =
                _message?.content?.text ||
                state.recentMessagesData?.[0]?.content?.text;

            if (!userMessageContent) {
                await callback?.({
                    text: "No user message found to process for transaction.",
                    content: {
                        error: "No user message found to process for transaction.",
                    },
                });
                return false;
            }

            const hederaProvider = new HederaProvider(runtime);
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
                    text: "Transaction request processed, but no specific result to report.",
                    content: {
                        info: "Transaction request processed, but no specific result to report.",
                    },
                });
            }

            return true;
        } catch (error) {
            console.error("Error during Hedera transaction processing:", error);
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            await callback?.({
                text: `Error during Hedera transaction processing: ${errorMessage}`,
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
                    text: "On Hedera, create a new HCS topic with the memo 'Weekly project updates'.",
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"op":"schedule_create","schedule_id":"0.0.XXXXXX", "description":"Scheduled transaction for creating a new topic. User (0.0.UserAcc) will be payer.","payer_account_id_scheduled_tx":"0.0.UserAcc", "notes":[]}`,
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Transfer 150 hbar to Hedera account 0.0.12345 and memo it 'Payment for services'.",
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"op":"schedule_create","schedule_id":"0.0.YYYYYY", "description":"Scheduled HBAR transfer of 150 to 0.0.12345. User (0.0.UserAcc) will be payer.","payer_account_id_scheduled_tx":"0.0.UserAcc", "notes":["Memo 'Payment for services' was applied."]}`,
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Mint 500 units of my Hedera NFT collection with token ID 0.0.78901.",
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"op":"schedule_create","schedule_id":"0.0.ZZZZZZ", "description":"Scheduled NFT mint of 500 units for token 0.0.78901. User (0.0.UserAcc) will be payer.","payer_account_id_scheduled_tx":"0.0.UserAcc", "notes":[]}`,
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Associate Hedera token 0.0.98765 with my account.",
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"op":"schedule_create","schedule_id":"0.0.AAAAAA", "description":"Scheduled token association for token 0.0.98765. User (0.0.UserAcc) will be payer.","payer_account_id_scheduled_tx":"0.0.UserAcc", "notes":[]}`,
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
        ],
        [
            {
                user: "{{user}}",
                content: {
                    text: "Create a new Hedera fungible token named 'SuperCoin' with symbol 'SPC', initial supply of 1 million hbar, and 2 decimal places.",
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
            {
                user: "{{assistant}}",
                content: {
                    text: `{"success":true,"op":"schedule_create","schedule_id":"0.0.BBBBBB", "description":"Scheduled creation of fungible token 'SuperCoin' (SPC). User (0.0.UserAcc) will be payer.","payer_account_id_scheduled_tx":"0.0.UserAcc", "notes":["Initial supply set to 100000000 (1 million with 2 decimals)."]}`,
                    action: "HEDERA_CREATE_TRANSACTION",
                },
            },
        ],
    ],
    similes: [
        "HEDERA_PERFORM_TRANSACTION",
        "HEDERA_EXECUTE_OPERATION",
        "HEDERA_PROCESS_REQUEST",
        "HEDERA_SUBMIT_TRANSACTION",
    ],
};
