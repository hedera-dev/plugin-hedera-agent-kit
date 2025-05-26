import type { Plugin } from "@elizaos/core";
import { hederaClientProvider } from "./providers/client";
import { OpenConvaiClientInterface } from "./services/open-convai.ts";
import { findRegistrationsAction } from "./actions/find-registrations/index.ts";
import { retrieveProfileAction } from "./actions/retrieve-profile/index.ts";
import { createTransactionAction } from "./actions/create-transaction/create-transaction.ts";
import { queryHederaAction } from "./actions/query-hedera/index.ts";

export const hederaPlugin: Plugin = {
    name: "Hedera",
    description: "Hedera hashgraph integration plugin",
    providers: [hederaClientProvider],
    evaluators: [],
    clients: [OpenConvaiClientInterface],
    services: [],
    actions: [
        createTransactionAction,
        queryHederaAction,
        findRegistrationsAction,
        retrieveProfileAction,
    ],
};

export default hederaPlugin;
