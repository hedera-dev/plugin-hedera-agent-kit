import { HederaProvider } from "../../../providers/client";
import {
    GetTopicMessagesResult,
    HederaGetTopicMessagesParams,
} from "../types.ts";
import { TopicId } from "@hashgraph/sdk";
import { HederaNetworkType } from "@hashgraphonline/hedera-agent-kit";
import { convertStringToTimestamp } from "../../../shared/utils.ts";
import { TxStatus } from "../../../shared/constants.ts";

export class GetTopicMessageActionService {
    constructor(private hederaProvider: HederaProvider) {
        this.hederaProvider = hederaProvider;
    }

    async execute(
        params: HederaGetTopicMessagesParams,
        networkType: HederaNetworkType
    ): Promise<GetTopicMessagesResult> {
        const agentKit = this.hederaProvider.getHederaAgentKit();

        const result = await agentKit.getTopicMessages(
            TopicId.fromString(params.topicId),
            networkType,
            params.lowerThreshold != "null"
                ? convertStringToTimestamp(params.lowerThreshold)
                : undefined,
            params.upperThreshold != "null"
                ? convertStringToTimestamp(params.upperThreshold)
                : undefined
        );

        return {
            status: TxStatus.SUCCESS,
            messages: result,
        };
    }
}
