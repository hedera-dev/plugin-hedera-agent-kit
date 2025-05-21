import type { Plugin } from "@elizaos/core";
import { hederaClientProvider } from "./providers/client";
import { OpenConvaiClientInterface } from "./services/open-convai.ts";
import { findRegistrationsAction } from "./actions/find-registrations/index.ts";
import { retrieveProfileAction } from "./actions/retrieve-profile/index.ts";
import { createTransactionAction } from "./actions/create-transaction/create-transaction.ts";

export const hederaPlugin: Plugin = {
    name: "Hedera",
    description: "Hedera hashgraph integration plugin",
    providers: [hederaClientProvider],
    evaluators: [],
    clients: [OpenConvaiClientInterface],
    services: [],
    actions: [
        createTransactionAction,
        findRegistrationsAction,
        retrieveProfileAction
    ],
};

export default hederaPlugin;
