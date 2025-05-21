import { IAgentRuntime, Memory, State } from "@elizaos/core";
import { AgentOperationalMode, HederaConversationalAgent, ServerSigner } from "@hashgraphonline/hedera-agent-kit";

export class HederaProvider {
    private readonly agentKit: Promise<HederaConversationalAgent>;

    constructor(_runtime: IAgentRuntime) {
        this.agentKit = initAgentKit(_runtime);
    }

    async getHederaAgentKit(): Promise<HederaConversationalAgent> {
        return this.agentKit;
    }
}

export const initAgentKit = async (_runtime: IAgentRuntime): Promise<HederaConversationalAgent> => {
    const accountID = _runtime.getSetting("HEDERA_ACCOUNT_ID");
    const privateKeyString = _runtime.getSetting("HEDERA_PRIVATE_KEY");
    const agentMode = _runtime.getSetting("HEDERA_AGENT_MODE") || "provideBytes";
    const signer = new ServerSigner(accountID, privateKeyString, "testnet");
    let hederaAgentKit: HederaConversationalAgent;
    try {
        hederaAgentKit = new HederaConversationalAgent(signer, {
            operationalMode: agentMode as AgentOperationalMode,
            userAccountId: accountID,
            verbose: false,
            openAIApiKey: process.env.OPENAI_API_KEY!,
            scheduleUserTransactionsInBytesMode: false,
        });
        await hederaAgentKit.initialize();
        return hederaAgentKit;
    } catch (error) {
        console.error("Error initialising HederaAgentKit: ", error);
    }
    return hederaAgentKit;
};


export const hederaClientProvider = {
    async get(
        runtime: IAgentRuntime,
        _message: Memory,
        state?: State
    ): Promise<string | null> {
        try {
            const agentName = state?.agentName || "The agent";
            const address = runtime.getSetting("HEDERA_ACCOUNT_ID");

            return `${agentName}'s Hedera Wallet Address: ${address}`;
        } catch (error) {
            console.error("Error in Hedera client provider:", error);
            return null;
        }
    },
};
