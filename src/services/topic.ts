// @ts-ignore
import {
    elizaLogger,
    type Character,
    type Client as ElizaClient,
    type IAgentRuntime,
    stringToUuid,
    getEmbeddingZeroVector,
    type Content,
    type Memory,
    generateMessageResponse,
    ModelClass,
    composeContext,
} from "@elizaos/core";
// @ts-ignore
import { EventEmitter } from "events";
// @ts-ignore
import { HCS10Client, HCSMessage, Logger } from '@hashgraphonline/standards-sdk'; // Adjusted relative path
import { hederaMessageHandlerTemplate } from '../templates'; // Import the new template

// Placeholder for utility function if needed, or assume it's globally available/imported elsewhere
// const extractAccountId = (operatorId: string): string | null => { /* ... implementation ... */ return null; };

interface AgentConnection {
    agentId: string; // Assuming this corresponds to requesterAccountId
    topicId: string;
    timestamp: Date;
    requesterOperatorId: string;
    connectionRequestId: number; // Sequence number of the connection_request message
}

const logger = elizaLogger;

class TopicClient extends EventEmitter {
    runtime: IAgentRuntime;
    character?: Character; // Assuming Character might be needed later
    client: HCS10Client;
    accountId: string;
    operatorId: string; // Operator ID including shard.realm.num@shard.realm.num
    inboundTopicId: string;
    outboundTopicId: string;
    private connections: Map<string, AgentConnection>;
    private processedMessages: Map<string, Set<number>>;
    // @ts-ignore
    private monitoringInterval: NodeJS.Timeout | null = null;
    private isStopping: boolean = false;

    constructor(runtime: IAgentRuntime) {
        super();
        this.runtime = runtime;
        this.connections = new Map<string, AgentConnection>();
        this.processedMessages = new Map<string, Set<number>>();

        // --- Configuration from Runtime ---
        this.accountId = this.runtime.getSetting("HEDERA_ACCOUNT_ID") as string;
        const privateKey = this.runtime.getSetting("HEDERA_PRIVATE_KEY") as string;
        this.inboundTopicId = this.runtime.getSetting("HEDERA_INBOUND_TOPIC_ID") as string;
        this.outboundTopicId = this.runtime.getSetting("HEDERA_OUTBOUND_TOPIC_ID") as string;
        const network = (this.runtime.getSetting("HEDERA_NETWORK") as string) || 'testnet'; // Default to testnet
        const registryUrl = this.runtime.getSetting("REGISTRY_URL") as string | undefined; // Optional

        if (!this.accountId || !privateKey || !this.inboundTopicId || !this.outboundTopicId) {
            throw new Error("Missing required Hedera settings: ACCOUNT_ID, PRIVATE_KEY, INBOUND_TOPIC_ID, OUTBOUND_TOPIC_ID");
        }

        // Assuming HCS10Client constructor accepts operatorId format like '0.0.12345'
        // and internally derives the full operatorId if needed.
        // Adjust if HCS10Client requires the full 'shard.realm.num@shard.realm.num' format directly.
        this.operatorId = `${this.accountId}@${this.accountId}`; // Placeholder format, adjust if needed

        this.client = new HCS10Client({
            network: network,
            operatorId: this.accountId, // Pass the base account ID
            operatorPrivateKey: privateKey,
            guardedRegistryBaseUrl: registryUrl,
            prettyPrint: true,
            logLevel: 'debug', // Or configure level via settings
            logger: logger, // Pass the shared logger instance
        });

        logger.info('===== TOPIC CLIENT DETAILS =====');
        logger.info(`Account ID: ${this.accountId}`);
        logger.info(`Operator ID used by HCSClient: ${this.accountId}`); // Log what's passed
        logger.info(`Assumed Full Operator ID: ${this.operatorId}`); // Log the derived/assumed full ID
        logger.info(`Inbound Topic: ${this.inboundTopicId}`);
        logger.info(`Outbound Topic: ${this.outboundTopicId}`);
        logger.info(`Network: ${network}`);
        logger.info(`Registry URL: ${registryUrl || 'Not provided'}`);
        logger.info('=====================================');


        // Initialize and start monitoring
        this.initializeAndMonitor();

        // Register any specific Hedera actions if needed
        // this.runtime.registerAction(...);

        // Register any Hedera-specific providers if needed
        // this.runtime.providers.push(...);

        logger.success("TopicClient initialized and monitoring started.");
        // Emit a ready event if needed, similar to DiscordClient's onClientReady
        // this.emit('ready');
    }

    private async initializeAndMonitor(): Promise<void> {
        try {
            await this.loadConnectionsFromOutboundTopic();
            await this.prepopulateProcessedMessages();
            this.startMonitoringLoop();
        } catch (error) {
            logger.error("Failed during initialization:", error);
            // Handle initialization error appropriately, maybe retry or shutdown
        }
    }

    async stop() {
        logger.info("Stopping TopicClient monitoring...");
        this.isStopping = true;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        // Add any other cleanup needed for HCS10Client if available
        // e.g., await this.client.close();
        logger.success("TopicClient stopped.");
        // @ts-ignore
        this.emit('stopped'); // Emit stopped event
    }

    // --- Adapted Hedera Logic as Class Methods ---

    private extractAccountId(operatorId: string): string | null {
        if (!operatorId) return null;
        const parts = operatorId.split('@');
        return parts.length === 2 ? parts[1] : null;
    }


    private async loadConnectionsFromOutboundTopic(): Promise<{
        connections: Map<string, AgentConnection>;
        lastProcessedTimestamp: Date;
    }> {
        logger.info('Loading existing connections from outbound topic');

        const outboundMessagesResponse = await this.client.getMessages(this.outboundTopicId);
        const outboundMessages = outboundMessagesResponse.messages;
        const connections = new Map<string, AgentConnection>();
        let lastTimestamp = new Date(0);

        logger.info(`Found ${outboundMessages.length} messages in outbound topic`);

        outboundMessages.sort((a: HCSMessage, b: HCSMessage) => {
            if (!a.created || !b.created) return 0;
            return a.created.getTime() - b.created.getTime();
        });

        const inboundMessagesResponse = await this.client.getMessages(this.inboundTopicId);
        const inboundMessages = inboundMessagesResponse.messages;
        const inboundMessagesMap = new Map<number, HCSMessage>();
        inboundMessages.forEach((m: HCSMessage) => {
            if (typeof m.sequence_number === 'number' && m.sequence_number > 0) {
                inboundMessagesMap.set(m.sequence_number, m);
            }
        });

        for (const message of outboundMessages) {
            if (!message.created) continue;
            if (message.created.getTime() > lastTimestamp.getTime()) {
                lastTimestamp = message.created;
            }

            if (
                message.op === 'connection_created' &&
                message.connection_topic_id &&
                typeof message.connection_request_id === 'number'
            ) {
                const connectionRequest = inboundMessagesMap.get(
                    message.connection_request_id
                );

                if (
                    connectionRequest &&
                    connectionRequest.op === 'connection_request' &&
                    connectionRequest.operator_id &&
                    connectionRequest.created
                ) {
                    const requesterOperatorId = connectionRequest.operator_id;
                    const requesterAccountId = this.extractAccountId(requesterOperatorId);

                    if (requesterAccountId) {
                        logger.debug(
                            `Connection record found: requesterOperatorId=${requesterOperatorId}, topicId=${message.connection_topic_id}, requestId=${message.connection_request_id}`
                        );

                        connections.set(message.connection_topic_id, {
                            agentId: requesterAccountId,
                            topicId: message.connection_topic_id,
                            timestamp: message.created,
                            requesterOperatorId: requesterOperatorId,
                            connectionRequestId: message.connection_request_id,
                        });

                        logger.info(
                            `Loaded connection: ${requesterOperatorId} (request #${message.connection_request_id}) -> ${message.connection_topic_id}`
                        );
                    } else {
                        logger.warn(
                            `Could not extract accountId from operatorId ${requesterOperatorId} for request #${message.connection_request_id}`
                        );
                    }
                } else {
                    logger.warn(
                        `Could not find matching 'connection_request' (op: ${connectionRequest?.op}, operator_id: ${connectionRequest?.operator_id}) on inbound topic for connection_request_id ${message.connection_request_id}`
                    );
                }
            } else if (
                message.op === 'close_connection' &&
                message.connection_topic_id
            ) {
                if (connections.has(message.connection_topic_id)) {
                    connections.delete(message.connection_topic_id);
                    logger.info(
                        `Removed closed connection based on outbound record for topic ${message.connection_topic_id}`
                    );
                }
            }
        }

        logger.info(
            `Finished loading. ${connections.size} active connections found, last outbound timestamp: ${lastTimestamp}`
        );
        return { connections, lastProcessedTimestamp: lastTimestamp };
    }


    private async prepopulateProcessedMessages(): Promise<void> {
        logger.info('Pre-populating processed messages for existing connections...');
        const topicsToRemove = new Set<string>();

        for (const topicId of this.connections.keys()) {
            if (!this.processedMessages.has(topicId)) {
                this.processedMessages.set(topicId, new Set<number>());
            }
            const processedSet = this.processedMessages.get(topicId)!;
            let messageCount = 0;

            try {
                const history = await this.client.getMessageStream(topicId);
                for (const msg of history.messages) {
                    if (typeof msg.sequence_number === 'number' && msg.sequence_number > 0) {
                        // Mark *all* messages initially to avoid reprocessing history.
                        // The monitoring loop logic will handle skipping own messages based on operator_id.
                        if (!processedSet.has(msg.sequence_number)) {
                            processedSet.add(msg.sequence_number);
                            messageCount++;
                        }
                    }
                }
                logger.debug(`Pre-populated ${messageCount} messages for topic ${topicId}. Total processed: ${processedSet.size}`);
            } catch (error: any) {
                logger.warn(`Failed to pre-populate messages for topic ${topicId}: ${error.message}. It might be closed or invalid.`);
                if (error.message && (error.message.includes('INVALID_TOPIC_ID') || error.message.includes('TopicId Does Not Exist'))) {
                    topicsToRemove.add(topicId); // Mark for removal after iteration
                }
                // Continue to next topic even if one fails
            }
        }

        // Remove connections for topics that failed prepopulation due to being invalid/deleted
        for (const topicId of topicsToRemove) {
            logger.warn(`Removing connection ${topicId} due to error during pre-population.`);
            this.connections.delete(topicId);
            this.processedMessages.delete(topicId);
        }

        // Also ensure inbound topic processed set exists
        if (!this.processedMessages.has(this.inboundTopicId)) {
            this.processedMessages.set(this.inboundTopicId, new Set<number>());
        }
        // Optionally pre-populate inbound topic as well if needed, though less critical than connection topics.
        // try {
        //     const inboundHistory = await this.client.getMessageStream(this.inboundTopicId);
        //     const inboundProcessed = this.processedMessages.get(this.inboundTopicId)!;
        //     inboundHistory.messages.forEach(msg => {
        //         if (typeof msg.sequence_number === 'number' && msg.sequence_number > 0) {
        //              inboundProcessed.add(msg.sequence_number);
        //         }
        //     });
        //     logger.debug(`Pre-populated inbound topic ${this.inboundTopicId}. Total processed: ${inboundProcessed.size}`);
        // } catch (error) {
        //      logger.error(`Failed to pre-populate inbound topic ${this.inboundTopicId}:`, error);
        // }

        logger.info('Finished pre-populating processed messages.');
    }

    private startMonitoringLoop(): void {
        if (this.monitoringInterval) {
            logger.warn("Monitoring loop already running.");
            return;
        }
        logger.info(`Starting monitoring loop with interval: 5000 ms`); // Example interval
        this.monitoringInterval = setInterval(async () => {
            if (this.isStopping) return;
            await this.monitoringTick();
        }, 5000); // Adjust interval as needed

        // Run first tick immediately?
        // this.monitoringTick();
    }

    private async monitoringTick(): Promise<void> {
        logger.debug("Running monitoring tick...");
        try {
            // 1. Reload connections state from outbound topic to detect new connections
            const { connections: updatedConnections } = await this.loadConnectionsFromOutboundTopic();

            // Update connections by merging with updated connections
            const currentTrackedTopics = new Set(this.connections.keys());
            for (const [topicId, connection] of updatedConnections.entries()) {
                if (!currentTrackedTopics.has(topicId)) {
                    // New connection found
                    this.connections.set(topicId, connection);
                    if (!this.processedMessages.has(topicId)) {
                        this.processedMessages.set(topicId, new Set<number>());
                    }
                    logger.info(
                        `Discovered new connection topic during reload: ${topicId} for ${connection.requesterOperatorId}`
                    );
                } else {
                    // Update existing connection
                    this.connections.set(topicId, connection);
                }
            }

            // Remove connections that are no longer present in the reloaded set
            for (const topicId of currentTrackedTopics) {
                if (!updatedConnections.has(topicId)) {
                    logger.info(`Removed connection topic (likely closed via outbound record): ${topicId}`);
                    this.connections.delete(topicId);
                    this.processedMessages.delete(topicId);
                }
            }

            // 2. Process Inbound Topic (Connection Requests)
            await this.processInboundTopic();

            // 3. Process Active Connection Topics
            await this.processConnectionTopics();
        } catch (error) {
            logger.error(`Error in monitoring tick:`, error);
        }
        logger.debug("Monitoring tick finished.");
    }

    private async processInboundTopic(): Promise<void> {
        logger.debug(`Processing inbound topic: ${this.inboundTopicId}`);
        if (!this.processedMessages.has(this.inboundTopicId)) {
            this.processedMessages.set(this.inboundTopicId, new Set<number>());
        }
        const inboundProcessed = this.processedMessages.get(this.inboundTopicId)!;

        try {
            const inboundMessagesResponse = await this.client.getMessages(this.inboundTopicId);
            const messages = inboundMessagesResponse.messages;

            messages.sort((a: HCSMessage, b: HCSMessage) => {
                const seqA = typeof a.sequence_number === 'number' ? a.sequence_number : 0;
                const seqB = typeof b.sequence_number === 'number' ? b.sequence_number : 0;
                return seqA - seqB;
            });

            for (const message of messages) {
                if (!message.created || typeof message.sequence_number !== 'number' || message.sequence_number <= 0) continue;

                if (!inboundProcessed.has(message.sequence_number)) {
                    inboundProcessed.add(message.sequence_number); // Mark as processed immediately

                    // Skip messages sent by this agent instance - using endsWith check as in the example
                    if (message.operator_id && message.operator_id.endsWith(`@${this.accountId}`)) {
                        logger.debug(`Skipping own inbound message #${message.sequence_number}`);
                        continue;
                    }

                    if (message.op === 'connection_request') {
                        logger.info(`Processing inbound connection request #${message.sequence_number} from ${message.operator_id}`);
                        const newTopicId = await this.handleConnectionRequest(message);
                        if (newTopicId && !this.processedMessages.has(newTopicId)) {
                            this.processedMessages.set(newTopicId, new Set<number>());
                            logger.info(`Now monitoring new connection topic: ${newTopicId}`);
                        }
                    } else if (message.op === 'connection_created') {
                        logger.info(`Received connection_created confirmation #${message.sequence_number} on inbound topic for topic ${message.connection_topic_id}`);
                    } else {
                        logger.debug(`Ignoring non-connection_request message op '${message.op}' on inbound topic #${message.sequence_number}`);
                    }
                }
            }
        } catch (error) {
            logger.error(`Error processing inbound topic ${this.inboundTopicId}:`, error);
        }
    }

    private async processConnectionTopics(): Promise<void> {
        const topicsToProcess = Array.from(this.connections.keys());
        logger.debug(`Processing ${topicsToProcess.length} active connection topics.`);

        for (const topicId of topicsToProcess) {
            // Double-check connection still exists, as it might be removed by loadConnections or close_connection message
            if (!this.connections.has(topicId)) {
                logger.warn(`Skipping processing for topic ${topicId} as it's no longer in the active connections map.`);
                if (this.processedMessages.has(topicId)) this.processedMessages.delete(topicId);
                continue;
            }

            if (!this.processedMessages.has(topicId)) {
                logger.warn(`Processed message set missing for active topic ${topicId}. Initializing.`);
                this.processedMessages.set(topicId, new Set<number>());
            }
            const processedSet = this.processedMessages.get(topicId)!;

            try {
                const messagesResponse = await this.client.getMessageStream(topicId);
                const messages = messagesResponse.messages;

                messages.sort((a: HCSMessage, b: HCSMessage) => {
                    const seqA = typeof a.sequence_number === 'number' ? a.sequence_number : 0;
                    const seqB = typeof b.sequence_number === 'number' ? b.sequence_number : 0;
                    return seqA - seqB;
                });

                for (const message of messages) {
                    if (!message.created || typeof message.sequence_number !== 'number' || message.sequence_number <= 0) continue;

                    if (!processedSet.has(message.sequence_number)) {
                        processedSet.add(message.sequence_number); // Mark as processed

                        // Skip messages sent by this agent instance - using endsWith check as in the example
                        if (message.operator_id && message.operator_id.endsWith(`@${this.accountId}`)) {
                            logger.debug(`Skipping own message #${message.sequence_number} on connection topic ${topicId}`);
                            continue;
                        }

                        if (message.op === 'message') {
                            logger.info(`Processing message #${message.sequence_number} on topic ${topicId}`);
                            await this.handleStandardMessage(message, topicId);
                        } else if (message.op === 'close_connection') {
                            logger.info(`Received close_connection message #${message.sequence_number} on topic ${topicId}. Removing topic from monitoring.`);
                            this.connections.delete(topicId);
                            this.processedMessages.delete(topicId);
                            break;
                        } else {
                            logger.debug(`Ignoring non-'message'/'close_connection' op '${message.op}' on connection topic ${topicId}#${message.sequence_number}`);
                        }
                    }
                }
            } catch (error: any) {
                if (error.message && (error.message.includes('INVALID_TOPIC_ID') || error.message.includes('TopicId Does Not Exist'))) {
                    logger.warn(`Connection topic ${topicId} likely deleted or expired. Removing from monitoring.`);
                    this.connections.delete(topicId);
                    this.processedMessages.delete(topicId);
                } else {
                    logger.error(`Error processing connection topic ${topicId}:`, error);
                }
            }
        }
    }


    private async handleConnectionRequest(message: HCSMessage): Promise<string | null> {
        if (!message.operator_id) {
            logger.warn('Missing operator_id in connection request');
            return null;
        }
        if (!message.created) {
            logger.warn('Missing created timestamp in connection request');
            return null;
        }
        if (typeof message.sequence_number !== 'number' || message.sequence_number <= 0) {
            logger.warn(`Invalid sequence_number in connection request: ${message.sequence_number}`);
            return null;
        }

        const requesterOperatorId = message.operator_id;
        const requesterAccountId = this.extractAccountId(requesterOperatorId);
        if (!requesterAccountId) {
            logger.warn(`Invalid operator_id format in connection request: ${requesterOperatorId}`);
            return null;
        }

        logger.info(`Handling connection request #${message.sequence_number} from ${requesterOperatorId}`);
        logger.debug(`Extracted requester account ID: ${requesterAccountId} from operator ID: ${requesterOperatorId}`);

        // Check if this exact request (by operator and request sequence number) already resulted in a connection
        for (const existingConn of this.connections.values()) {
            if (existingConn.requesterOperatorId === requesterOperatorId && existingConn.connectionRequestId === message.sequence_number) {
                logger.warn(`Connection already exists for request #${message.sequence_number} from ${requesterOperatorId}. Topic: ${existingConn.topicId}`);
                // Ensure this topic is being monitored
                if (!this.processedMessages.has(existingConn.topicId)) {
                    this.processedMessages.set(existingConn.topicId, new Set<number>());
                }
                return existingConn.topicId;
            }
        }

        try {
            // Handle case where requesterAccountId might contain unexpected characters or format
            if (!requesterAccountId.match(/^[0-9]+\.[0-9]+\.[0-9]+$/)) {
                logger.warn(`Account ID format may be invalid: ${requesterAccountId}`);
                // Try to extract a valid account ID format if possible
                const accountMatch = requesterOperatorId.match(/([0-9]+\.[0-9]+\.[0-9]+)@([0-9]+\.[0-9]+\.[0-9]+)/);
                if (accountMatch && accountMatch[2]) {
                    logger.info(`Trying alternative account ID: ${accountMatch[2]}`);
                    // Use the part after @ if it matches the expected format
                    const altAccountId = accountMatch[2];

                    // Use HCSClient to handle the request
                    const { connectionTopicId, confirmedConnectionSequenceNumber } = await this.client.handleConnectionRequest(
                        this.inboundTopicId,
                        altAccountId, // Try using the reformatted account ID
                        message.sequence_number
                    );

                    // Continue with connection confirmation...
                    await this.finalizeConnection(connectionTopicId, confirmedConnectionSequenceNumber, message, requesterOperatorId, altAccountId);
                    return connectionTopicId;
                }
            }

            // Use HCSClient to handle the request with original account ID
            logger.debug(`Calling handleConnectionRequest with inboundTopicId=${this.inboundTopicId}, requesterAccountId=${requesterAccountId}, sequence=${message.sequence_number}`);
            const { connectionTopicId, confirmedConnectionSequenceNumber } = await this.client.handleConnectionRequest(
                this.inboundTopicId,
                requesterAccountId,
                message.sequence_number
            );

            // Continue with connection confirmation
            await this.finalizeConnection(connectionTopicId, confirmedConnectionSequenceNumber, message, requesterOperatorId, requesterAccountId);
            return connectionTopicId;

        } catch (error) {
            logger.error(`Error handling connection request #${message.sequence_number} from ${requesterOperatorId}:`, error);

            // Try alternative approach if the error is a 404
            if (error.message && error.message.includes('404')) {
                logger.info(`Trying alternative approach for connection request from ${requesterOperatorId}`);

                // Try extracting account ID from the first part of operatorId instead
                const parts = requesterOperatorId.split('@');
                if (parts.length === 2 && parts[0].match(/^[0-9]+\.[0-9]+\.[0-9]+$/)) {
                    const alternativeAccountId = parts[0];
                    logger.info(`Trying with alternative account ID: ${alternativeAccountId}`);

                    try {
                        const { connectionTopicId, confirmedConnectionSequenceNumber } = await this.client.handleConnectionRequest(
                            this.inboundTopicId,
                            alternativeAccountId,
                            message.sequence_number
                        );

                        await this.finalizeConnection(connectionTopicId, confirmedConnectionSequenceNumber, message, requesterOperatorId, alternativeAccountId);
                        return connectionTopicId;
                    } catch (altError) {
                        logger.error(`Alternative approach also failed: ${altError}`);
                    }
                }
            }

            // Ensure the request is marked processed even if handling failed
            const inboundProcessed = this.processedMessages.get(this.inboundTopicId);
            if (inboundProcessed && message.sequence_number) {
                inboundProcessed.add(message.sequence_number);
            }
            return null;
        }
    }

    // Helper method to finalize a connection after successful creation
    private async finalizeConnection(
        connectionTopicId: string,
        confirmedConnectionSequenceNumber: number,
        message: HCSMessage,
        requesterOperatorId: string,
        accountId: string
    ): Promise<void> {
        // Record the confirmation on our outbound topic
        await this.client.recordOutboundConnectionConfirmation({
            outboundTopicId: this.outboundTopicId,
            connectionRequestId: message.sequence_number,
            confirmedRequestId: confirmedConnectionSequenceNumber,
            connectionTopicId: connectionTopicId,
            operatorId: this.operatorId,
            memo: `Connection established with ${requesterOperatorId}`,
        });

        // Update internal state
        const newConnection: AgentConnection = {
            agentId: accountId,
            topicId: connectionTopicId,
            timestamp: new Date(),
            requesterOperatorId: requesterOperatorId,
            connectionRequestId: message.sequence_number,
        };

        this.connections.set(connectionTopicId, newConnection);
        if (!this.processedMessages.has(connectionTopicId)) {
            this.processedMessages.set(connectionTopicId, new Set<number>());
        }

        logger.info(`Added new connection to map: ${connectionTopicId} for ${requesterOperatorId}`);

        // Send welcome message
        try {
            await this.client.sendMessage(
                connectionTopicId,
                `Hello from ${this.runtime.character?.name || 'Hedera Agent'}! Connection established.`,
                'Greeting message after connection established'
            );
            logger.info(`Sent welcome message to new connection topic ${connectionTopicId}`);
        } catch (sendError) {
            logger.error(`Failed to send welcome message to ${connectionTopicId}:`, sendError);
        }

        logger.success(`Connection established with ${requesterOperatorId} on topic ${connectionTopicId}`);
    }

    private async handleStandardMessage(message: HCSMessage, connectionTopicId: string): Promise<void> {
        if (message.data === undefined) {
            logger.warn(`Received message #${message.sequence_number} on ${connectionTopicId} with undefined data. Skipping.`);
            return;
        }

        // Validate topic ID format (redundant if already validated, but safe)
        if (!connectionTopicId || !connectionTopicId.match(/^[0-9]+\.[0-9]+\.[0-9]+$/)) {
            logger.error(`Invalid connection topic ID format passed to handleStandardMessage: ${connectionTopicId}`);
            return;
        }

        // Identify the user/agent associated with this connection topic
        const connectionInfo = this.connections.get(connectionTopicId);
        if (!connectionInfo) {
            logger.error(`Cannot process message #${message.sequence_number} from topic ${connectionTopicId}: No connection info found.`);
            return;
        }

        let messageContent: string = message.data;

        // Resolve hcs:// links if necessary
        if (messageContent.startsWith('hcs://')) {
            try {
                const content = await this.client.getMessageContent(messageContent);
                // Ensure content is string, handle potential non-string returns if API allows
                messageContent = typeof content === 'string' ? content : JSON.stringify(content);
                logger.debug(`Resolved hcs:// link to content: "${messageContent.substring(0, 50)}..."`);
            } catch (error) {
                logger.error(`Failed to resolve message content for hcs:// link ${messageContent} on topic ${connectionTopicId}:`, error);
                await this.sendResponse(connectionTopicId, "Error: Could not resolve message content link.");
                return; // Stop processing if content cannot be resolved
            }
        }

        try {
            logger.info(`Processing message from topic ${connectionTopicId}: "${messageContent.substring(0, 100)}..."`);

            // Generate UUIDs for mapping to Eliza concepts
            const roomId = stringToUuid(`${connectionTopicId}-${this.runtime.agentId}`);
            const userIdUUID = stringToUuid(`${connectionInfo.requesterOperatorId}-${this.runtime.agentId}`);

            // Use operator ID as username/name or extract something more friendly if available
            const userName = connectionInfo.requesterOperatorId;
            const name = connectionInfo.requesterOperatorId;

            // Ensure the connection exists in Eliza state
            await this.runtime.ensureConnection(
                userIdUUID,
                roomId,
                userName,
                name,
                'hedera'
            );

            // Generate unique message ID
            const messageId = stringToUuid(`${connectionTopicId}-${message.sequence_number}-${this.runtime.agentId}`);

            // Create content object
            const content: Content = {
                text: messageContent,
                source: 'hedera',
                // Include any other relevant metadata from the HCSMessage
                // inReplyTo: if message is a reply to another message, add that here
            };

            // Create user message memory object
            const memory: Memory = {
                id: messageId,
                userId: userIdUUID,
                agentId: this.runtime.agentId,
                roomId,
                content,
                createdAt: message.created?.getTime() || Date.now(),
                embedding: getEmbeddingZeroVector(), // Will be updated with actual embedding
            };

            // Add embedding and save to memory
            await this.runtime.messageManager.addEmbeddingToMemory(memory);
            await this.runtime.messageManager.createMemory(memory);

            // Compose state with additional context
            const state = await this.runtime.composeState(memory, {
                hederaClient: this.client,
                hederaMessage: message,
                connectionTopicId,
                agentName: this.runtime.character?.name || 'Hedera Agent',
                userName: userName, // Add userName to state for template
                userId: userIdUUID, // Add userId to state for template
                agentId: this.runtime.agentId, // Add agentId to state for template
            });

            // Use the correct template for composing general context
            const context = composeContext({
                state,
                template: hederaMessageHandlerTemplate // Use the general message handler template
            });

            // Log the composed context before generating response
            logger.debug(`Composed context for message #${message.sequence_number}:`, context);

            // Determine if we should respond
            // We could add conditions here, but for now we'll always respond
            const shouldRespond = true;
            logger.debug(`Decision to respond for message #${message.sequence_number}: ${shouldRespond}`);

            if (shouldRespond) {
                logger.info(`Generating response for message #${message.sequence_number} on topic ${connectionTopicId}`);

                // Generate response using the runtime, passing the composed context
                const responseContent = await this._generateResponse(memory, state, context); // Pass context here

                logger.debug(`Generated response content for message #${message.sequence_number}:`, responseContent);

                // Set reference to the original message
                responseContent.inReplyTo = messageId;

                if (!responseContent.text) {
                    logger.warn(`Empty response generated for message #${message.sequence_number}`);
                    return;
                }

                // Define callback for handling the response
                const callback = async (content: Content): Promise<Memory[]> => {
                    try {
                        logger.info(`Sending response to topic ${connectionTopicId}: "${content.text?.substring(0, 100)}..."`);

                        // Send the message via Hedera
                        const sentMessage = await this.sendResponse(connectionTopicId, content.text || "");

                        // Create memory for the sent message
                        const responseMemory: Memory = {
                            id: stringToUuid(`${connectionTopicId}-response-${Date.now()}-${this.runtime.agentId}`),
                            userId: this.runtime.agentId,
                            agentId: this.runtime.agentId,
                            content: {
                                ...content,
                                inReplyTo: messageId,
                            },
                            roomId,
                            embedding: getEmbeddingZeroVector(),
                            createdAt: Date.now(),
                        };

                        // Save response memory
                        await this.runtime.messageManager.createMemory(responseMemory);

                        return [responseMemory];
                    } catch (error) {
                        logger.error(`Error sending response to topic ${connectionTopicId}:`, error);
                        return [];
                    }
                };

                // Process immediate response
                const responseMemories = await callback(responseContent);

                // Update state with the recent message
                const updatedState = await this.runtime.updateRecentMessageState(state);

                // Process any actions that might be triggered
                await this.runtime.processActions(memory, responseMemories, updatedState, callback);

                // Optional: Call evaluate to gather feedback/analytics
                await this.runtime.evaluate(memory, updatedState, shouldRespond);
            }
        } catch (error) {
            logger.error(`Error processing message #${message.sequence_number} on topic ${connectionTopicId}:`, error);
            // Send an error response back to the user
            await this.sendResponse(connectionTopicId, "I encountered an error processing your message. Please try again later.");
        }
    }

    /**
     * Generate a response to the user's message
     */
    private async _generateResponse(memory: Memory, state: any, context: string): Promise<Content> { // Accept context as parameter
        try {
            // Log the context being passed to the LLM
            logger.debug('Context passed to generateMessageResponse:', context);

            // Use the runtime's response generation approach, passing the full context
            const response = await generateMessageResponse({
                runtime: this.runtime,
                context: context, // Pass the composed context here
                modelClass: ModelClass.LARGE,
            });

            logger.debug("Raw response from LLM:", response);

            // If the runtime handles this differently, adjust accordingly
            return response;
        } catch (error) {
            logger.error('Error generating response:', error);
            return {
                text: "I'm having trouble generating a response right now. Please try again later.",
                source: 'hedera',
            };
        }
    }

    private async sendResponse(topicId: string, response: string): Promise<any> {
        try {
            logger.info(`Sending response to topic ${topicId}: "${response.substring(0, 100)}..."`);
            const memo = `Agent response on ${topicId}`; // Add a descriptive memo
            const sentMessage = await this.client.sendMessage(topicId, response, memo);
            logger.success(`Response sent successfully to topic ${topicId}, sequence #: ${sentMessage.sequence_number}`);

            // Mark our own sent message as "processed" immediately
            const processedSet = this.processedMessages.get(topicId);
            if (processedSet && sentMessage.sequence_number) {
                processedSet.add(sentMessage.sequence_number);
            }

            return sentMessage;
        } catch (error) {
            logger.error(`Failed to send response to topic ${topicId}:`, error);
            // Handle send failure (e.g., if topic was deleted between processing and sending)
            if (error.message && (error.message.includes('INVALID_TOPIC_ID') || error.message.includes('TopicId Does Not Exist'))) {
                logger.warn(`Topic ${topicId} appears invalid while trying to send response. Removing connection.`);
                this.connections.delete(topicId);
                this.processedMessages.delete(topicId);
            }
            throw error; // Re-throw to allow proper error handling upstream
        }
    }

}

// --- Eliza Client Interface Export ---
export const TopicClientInterface: ElizaClient = {
    // Remove the name property as indicated by the linter
    // name: 'hedera',
    start: async (runtime: IAgentRuntime) => new TopicClient(runtime),
    // Add stop method matching the required signature
    stop: async (runtime: IAgentRuntime): Promise<void> => {
        // This function signature matches the type requirement.
        // The actual stop logic is in the TopicClient instance method.
        // We might need to find the instance via runtime if direct access isn't possible,
        // but for type checking, this signature should suffice.
        // Placeholder implementation:
        elizaLogger.info("TopicClientInterface stop called via runtime - instance stop should be handled elsewhere.");
        // If runtime provides a way to get the client instance, call its stop method:
        // const client = runtime.getClient('hedera'); // Hypothetical method
        // if (client) await client.stop();
        return Promise.resolve();
    },
}; 