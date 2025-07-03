import {
  elizaLogger,
  type Character,
  type IAgentRuntime,
  stringToUuid,
  type Content,
  type Memory,
  composePromptFromState,
  ModelTypeName,
} from "@elizaos/core";
import { EventEmitter } from "events";
import {
  HCS10Client,
  HCSMessage,
  IConnectionsManager,
  ConnectionsManager,
  NetworkType,
} from "@hashgraphonline/standards-sdk";
import { ScheduleCreateTransaction, TransactionReceipt } from "@hashgraph/sdk";
import { hederaMessageHandlerTemplate } from "../templates";
import { AgentResponse } from "@hashgraphonline/hedera-agent-kit";

const logger = elizaLogger;
const TOPIC_ID_REGEX = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function extractAccountId(operatorId: string): string | null {
  if (!operatorId) return null;
  const parts = operatorId.split("@");
  return parts.length === 2 ? parts[1] : null;
}

class OpenConvaiClient extends EventEmitter {
  runtime: IAgentRuntime;
  character?: Character;
  client: HCS10Client;
  accountId: string;
  operatorId: string;
  inboundTopicId: string = "";
  outboundTopicId: string = "";
  private processedMessages: Map<string, Set<number>> = new Map();
  private lastProcessedTimestamps: Map<string, number> = new Map();
  private messagesInProcess: Map<string, Set<number>> = new Map();
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isStopping: boolean = false;
  private connectionsManager: IConnectionsManager;

  constructor(runtime: IAgentRuntime) {
    super();
    this.runtime = runtime;

    this.accountId = this.runtime.getSetting("HEDERA_ACCOUNT_ID") as string;
    const privateKey = this.runtime.getSetting("HEDERA_PRIVATE_KEY") as string;
    const network =
      (this.runtime.getSetting("HEDERA_NETWORK") as string) || "testnet";

    if (!this.accountId || !privateKey) {
      throw new Error(
        "Missing required Hedera settings: ACCOUNT_ID, PRIVATE_KEY"
      );
    }

    this.operatorId =
      (this.runtime.getSetting("HEDERA_OPERATOR_ID") as string) ||
      this.accountId;

    logger.info("Creating HCS10Client with parameters:", {
      network: network as NetworkType,
      operatorId: this.operatorId,
      prettyPrint: true,
      logLevel: "debug",
    });

    this.client = new HCS10Client({
      network: network as NetworkType,
      operatorId: this.operatorId,
      operatorPrivateKey: privateKey,
      prettyPrint: true,
      logLevel: "debug",
    });

    this.connectionsManager = new ConnectionsManager({
      baseClient: this.client,
      logLevel: "debug",
    });

    logger.info("===== TOPIC CLIENT DETAILS =====");
    logger.info(`Account ID: ${this.accountId}`);
    logger.info(
      `Operator ID used by HCSClient: ${this.client.getAccountAndSigner().accountId}`
    );
    logger.info(`Network: ${network}`);
    logger.info("=====================================");

    this.initializeAndMonitor();
  }

  /**
   * Initializes the client by fetching profile info and starting monitoring.
   */
  private async initializeAndMonitor(): Promise<void> {
    logger.info("Initializing OpenConvaiClient...");
    try {
      const profile = await this.client.retrieveProfile(this.accountId);
      if (
        !profile?.profile?.inboundTopicId ||
        !profile?.profile?.outboundTopicId
      ) {
        throw new Error(
          `Profile or communication topics missing for account ${this.accountId}`
        );
      }
      this.inboundTopicId = profile.profile.inboundTopicId;
      this.outboundTopicId = profile.profile.outboundTopicId;
      logger.info(
        `Retrieved Inbound Topic: ${this.inboundTopicId}, Outbound Topic: ${this.outboundTopicId}`
      );

      await this.prepopulateProcessedMessages();
      this.startMonitoringLoop();
      logger.success("TopicClient initialized and monitoring started.");
    } catch (error) {
      logger.error("Failed during initialization:", error);
      throw error;
    }
  }

  /**
   * Stops the monitoring loop.
   */
  async stop() {
    logger.info("Stopping TopicClient monitoring...");
    this.isStopping = true;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    logger.success("TopicClient stopped.");
    this.emit("stopped");
  }

  /**
   * Validates if a string is a valid Hedera topic ID.
   */
  private _isValidTopicId(topicId: string | undefined): boolean {
    return Boolean(topicId && TOPIC_ID_REGEX.test(topicId));
  }

  /**
   * Initializes tracking maps for a given topic ID.
   */
  private _initializeTopicTracking(
    topicId: string,
    setInitialTimestamp = false
  ): void {
    if (!this.processedMessages.has(topicId)) {
      this.processedMessages.set(topicId, new Set<number>());
    }
    if (!this.messagesInProcess.has(topicId)) {
      this.messagesInProcess.set(topicId, new Set<number>());
    }
    if (setInitialTimestamp && !this.lastProcessedTimestamps.has(topicId)) {
      this.lastProcessedTimestamps.set(topicId, Date.now() - ONE_DAY_MS);
    }
  }

  /**
   * Removes a topic ID from all tracking maps.
   */
  private _cleanupTopicTracking(topicId: string): void {
    this.processedMessages.delete(topicId);
    this.messagesInProcess.delete(topicId);
    this.lastProcessedTimestamps.delete(topicId);
    logger.debug(`Cleaned up tracking for topic ${topicId}`);
  }

  /**
   * Handles common errors when fetching message streams, cleaning up tracking if topic is invalid.
   */
  private _handleTopicFetchError(error: unknown, topicId: string): void {
    if (
      error instanceof Error &&
      (error.message?.includes("INVALID_TOPIC_ID") ||
        error.message?.includes("TopicId Does Not Exist"))
    ) {
      logger.warn(
        `Connection topic ${topicId} likely deleted or expired. Cleaning up tracking.`
      );
      this._cleanupTopicTracking(topicId);
      const conn = this.connectionsManager.getConnectionByTopicId(topicId);
      if (conn && conn.status !== "closed") {
        this.connectionsManager.updateOrAddConnection({
          ...conn,
          status: "closed",
          closedReason: "Topic no longer exists",
          closeMethod: "admin_key",
        });
      }
    } else {
      logger.error(`Error processing topic ${topicId}:`, error);
    }
  }

  /**
   * Initializes the tracking maps for processed messages and timestamps.
   * Fetches existing connection data and message history to avoid reprocessing.
   */
  private async prepopulateProcessedMessages(): Promise<void> {
    logger.info(
      "Pre-populating processed messages for existing connections..."
    );

    await this.connectionsManager.fetchConnectionData(this.accountId);
    const activeConnections = this.connectionsManager.getActiveConnections();
    logger.info(
      `Found ${activeConnections.length} active connections to pre-populate`
    );

    this._initializeTopicTracking(this.inboundTopicId);

    try {
      const inboundHistory = await this.client.getMessageStream(
        this.inboundTopicId
      );
      for (const msg of inboundHistory.messages) {
        if (msg.op === "connection_request") {
          for (const conn of activeConnections) {
            if (conn.inboundRequestId === msg.sequence_number) {
              logger.debug(
                `Pre-marking connection request #${msg.sequence_number} as processed`
              );
              this.connectionsManager.markConnectionRequestProcessed(
                this.inboundTopicId,
                msg.sequence_number
              );
              break;
            }
          }
        }
      }
    } catch (error) {
      this._handleTopicFetchError(error, this.inboundTopicId);
    }

    for (const conn of activeConnections) {
      const topicId = conn.connectionTopicId;
      if (!this._isValidTopicId(topicId)) {
        logger.warn(
          `Skipping invalid topic ID format during pre-population: ${topicId}`
        );
        continue;
      }

      this._initializeTopicTracking(topicId, true);
      const processedSet = this.processedMessages.get(topicId)!;

      try {
        const history = await this.client.getMessageStream(topicId);
        let lastTimestampForTopic =
          this.lastProcessedTimestamps.get(topicId) || Date.now() - ONE_DAY_MS;

        const ourMessages = history.messages.filter(
          (m) => m?.operator_id?.includes(this.accountId) && m.created
        );

        if (ourMessages.length > 0) {
          if (ourMessages[0].created) {
            lastTimestampForTopic = ourMessages[0].created.getTime();
            logger.info(
              `Found last response timestamp: ${ourMessages[0].created.toISOString()} for topic ${topicId}`
            );
          }
        }
        this.lastProcessedTimestamps.set(topicId, lastTimestampForTopic);

        const replyRegex = /^\[Reply to #(\d+)\]/;

        for (const msg of history.messages) {
          if (
            msg?.operator_id?.includes(this.accountId) &&
            msg.sequence_number > 0
          ) {
            processedSet.add(msg.sequence_number);

            if (typeof msg.data === "string") {
              const match = msg.data.match(replyRegex);
              if (match && match[1]) {
                const originalSequenceNumber = parseInt(match[1], 10);
                if (!isNaN(originalSequenceNumber)) {
                  processedSet.add(originalSequenceNumber);
                  logger.debug(
                    `Pre-marking original message #${originalSequenceNumber} as processed due to reply #${msg.sequence_number}`
                  );
                }
              }
            }
          }
        }
        logger.debug(
          `Pre-populated ${processedSet.size} sequence numbers for topic ${topicId}. Last timestamp: ${new Date(lastTimestampForTopic).toISOString()}`
        );
      } catch (error: unknown) {
        this._handleTopicFetchError(error, topicId);
      }
    }

    logger.info("Finished pre-populating processed messages.");
  }

  private startMonitoringLoop(): void {
    if (this.monitoringInterval) {
      logger.warn("Monitoring loop already running.");
      return;
    }
    logger.info(`Starting monitoring loop with interval: 5000 ms`);
    this.monitoringInterval = setInterval(async () => {
      if (this.isStopping) {
        return;
      }
      await this.monitoringTick();
    }, 5000);
    logger.info("Started monitoring for connections and messages");
  }

  private async monitoringTick(): Promise<void> {
    logger.debug("Running monitoring tick...");
    try {
      await this.connectionsManager.fetchConnectionData(this.accountId);
      await this.watchConnectionRequests();
      await this.watchConnectionTopics();
    } catch (error) {
      logger.error(`Error in monitoring tick:`, error);
    }
    logger.debug("Monitoring tick finished.");
  }

  /**
   * Processes the inbound topic for new connection requests.
   */
  private async watchConnectionRequests(): Promise<void> {
    if (!this._isValidTopicId(this.inboundTopicId)) {
      logger.warn(`Invalid inbound topic ID: ${this.inboundTopicId}`);
      return;
    }
    logger.debug(`Processing inbound topic: ${this.inboundTopicId}`);
    this._initializeTopicTracking(this.inboundTopicId);
    const inboundProcessed = this.processedMessages.get(this.inboundTopicId)!;

    try {
      const inboundMessagesResponse = await this.client.getMessages(
        this.inboundTopicId
      );
      const messages = inboundMessagesResponse.messages;

      for (const message of messages) {
        if (!message.sequence_number || message.sequence_number <= 0) continue;

        if (!inboundProcessed.has(message.sequence_number)) {
          inboundProcessed.add(message.sequence_number);

          if (message.operator_id?.endsWith(`@${this.accountId}`)) {
            logger.debug(
              `Skipping own inbound message #${message.sequence_number}`
            );
            continue;
          }

          if (message.op === "connection_request") {
            if (
              this.connectionsManager.isConnectionRequestProcessed(
                this.inboundTopicId,
                message.sequence_number
              )
            ) {
              logger.debug(
                `Skipping already processed connection request #${message.sequence_number}`
              );
              continue;
            }

            const requesterAccountId = this.client.extractAccountFromOperatorId(
              message.operator_id
            );
            if (!requesterAccountId || !message.operator_id) {
              logger.warn(
                `Invalid or missing operator_id in connection request #${message.sequence_number}: ${message.operator_id}`
              );
              continue;
            }

            let existingConnection;
            for (const conn of this.connectionsManager.getAllConnections()) {
              if (conn.inboundRequestId === message.sequence_number) {
                existingConnection = conn;
                break;
              }
            }

            if (existingConnection) {
              logger.info(
                `Using existing connection for request #${message.sequence_number}: Topic ${existingConnection.connectionTopicId} with ${requesterAccountId}`
              );
              this.connectionsManager.markConnectionRequestProcessed(
                this.inboundTopicId,
                message.sequence_number
              );
              continue;
            }

            logger.info(
              `Processing inbound connection request #${message.sequence_number} from ${message.operator_id}`,
              message
            );
            const newTopicId = await this.handleConnectionRequest(message);
            if (newTopicId) {
              this._initializeTopicTracking(newTopicId, true);
              logger.info(`Now monitoring new connection topic: ${newTopicId}`);
            }
          } else if (message.op === "connection_created") {
            logger.info(
              `Received connection_created confirmation #${message.sequence_number} on inbound topic for topic ${message.connection_topic_id}`
            );
          } else {
            logger.debug(
              `Ignoring non-connection_request message op '${message.op}' on inbound topic #${message.sequence_number}`
            );
          }
        }
      }
    } catch (error) {
      this._handleTopicFetchError(error, this.inboundTopicId);
    }
  }

  /**
   * Processes active connection topics for new messages.
   */
  private async watchConnectionTopics(): Promise<void> {
    const activeConnections = this.connectionsManager.getActiveConnections();
    logger.debug(
      `Processing ${activeConnections.length} active connection topics.`
    );

    for (const conn of activeConnections) {
      const topicId = conn.connectionTopicId;
      if (!this._isValidTopicId(topicId)) {
        logger.warn(
          `Skipping processing for invalid connection topic ID format: ${topicId}`
        );
        continue;
      }

      this._initializeTopicTracking(topicId, true);

      const lastTimestamp = this.lastProcessedTimestamps.get(topicId)!;
      const processedSet = this.processedMessages.get(topicId)!;
      const inProcessSet = this.messagesInProcess.get(topicId)!;

      try {
        const messagesResponse = await this.client.getMessageStream(topicId);
        const messages = messagesResponse.messages;

        this.connectionsManager.processConnectionMessages(topicId, messages);

        const currentConnState =
          this.connectionsManager.getConnectionByTopicId(topicId);
        if (!currentConnState || currentConnState.status === "closed") {
          logger.info(
            `Connection topic ${topicId} is closed or removed. Cleaning up tracking.`
          );
          this._cleanupTopicTracking(topicId);
          continue;
        }

        const newMessages = messages.filter(
          (m) =>
            m?.created?.getTime() > lastTimestamp &&
            !m?.operator_id?.includes(this.accountId) &&
            !processedSet?.has(m.sequence_number) &&
            !inProcessSet?.has(m.sequence_number)
        );

        for (const message of newMessages) {
          if (!message?.sequence_number) continue;

          inProcessSet.add(message.sequence_number);
          try {
            logger.info(
              `Processing message #${message.sequence_number} on topic ${topicId}`
            );
            await this.handleMessage(message, topicId);
            processedSet.add(message.sequence_number);
            if (message.created) {
              this.lastProcessedTimestamps.set(
                topicId,
                message.created.getTime()
              );
            }
          } catch (error: unknown) {
            logger.error(
              `Error handling message #${message.sequence_number} on topic ${topicId}:`,
              error
            );
          } finally {
            inProcessSet.delete(message.sequence_number);
          }
        }
      } catch (error: unknown) {
        this._handleTopicFetchError(error, topicId);
      }
    }
  }

  /**
   * Handles an incoming connection request message.
   */
  private async handleConnectionRequest(
    message: HCSMessage
  ): Promise<string | null> {
    const requesterOperatorId = message.operator_id!;
    const requesterAccountId =
      this.client.extractAccountFromOperatorId(requesterOperatorId)!;
    const sequenceNumber = message.sequence_number!;

    logger.info(
      `Handling new connection request #${sequenceNumber} from ${requesterOperatorId}`
    );

    try {
      const { connectionTopicId } = await this.client.handleConnectionRequest(
        this.inboundTopicId,
        requesterAccountId,
        sequenceNumber
      );

      this.connectionsManager.markConnectionRequestProcessed(
        this.inboundTopicId,
        sequenceNumber
      );

      await this.finalizeConnection(
        connectionTopicId,
        message,
        requesterOperatorId,
        requesterAccountId
      );

      return connectionTopicId;
    } catch (error) {
      logger.error(
        `Error handling connection request #${sequenceNumber} from ${requesterOperatorId}:`,
        error
      );
      const inboundProcessed = this.processedMessages.get(this.inboundTopicId);
      if (inboundProcessed) {
        inboundProcessed.add(sequenceNumber);
      }
      return null;
    }
  }

  /**
   * Finalizes a connection after creation and sending a welcome message.
   */
  private async finalizeConnection(
    connectionTopicId: string,
    originalRequestMessage: HCSMessage,
    requesterOperatorId: string,
    accountId: string
  ): Promise<void> {
    try {
      const uniqueRequestKey = `inb-${originalRequestMessage.sequence_number}:${requesterOperatorId}`;

      this.connectionsManager.updateOrAddConnection({
        connectionTopicId,
        targetAccountId: accountId,
        status: "established",
        isPending: false,
        needsConfirmation: false,
        created: new Date(),
        inboundRequestId: originalRequestMessage.sequence_number,
        uniqueRequestKey,
        originTopicId: this.inboundTopicId,
        processed: true,
        memo: `Connection established with ${requesterOperatorId}`,
      });

      this._initializeTopicTracking(connectionTopicId, true);

      logger.info(
        `Connection established with ${requesterOperatorId} on topic ${connectionTopicId}`
      );

      const welcomeMessage = `Hello from ${this.runtime.character?.name || "Hedera Agent"}! Connection established.`;
      const sentReceipt = await this.sendResponse(
        connectionTopicId,
        welcomeMessage,
        "Greeting message after connection established"
      );

      if (sentReceipt?.topicSequenceNumber) {
        const processedSet = this.processedMessages.get(connectionTopicId);
        if (processedSet) {
          processedSet.add(sentReceipt.topicSequenceNumber.toNumber());
          logger.debug(
            `Marked own welcome message #${sentReceipt.topicSequenceNumber.toNumber()} as processed.`
          );
        }
        this.lastProcessedTimestamps.set(connectionTopicId, Date.now());
      }
      logger.info(
        `Sent welcome message to new connection topic ${connectionTopicId}`
      );
    } catch (sendError) {
      logger.error(
        `Error during connection finalization for ${connectionTopicId}:`,
        sendError
      );
    }
  }

  /**
   * Handles a standard message received on a connection topic.
   */
  private async handleMessage(
    message: HCSMessage,
    connectionTopicId: string
  ): Promise<void> {
    if (!message?.data) {
      logger.warn(
        `Received message #${message.sequence_number} on ${connectionTopicId} with undefined data. Skipping.`
      );
      return;
    }

    const connectionInfo =
      this.connectionsManager.getConnectionByTopicId(connectionTopicId);
    if (!connectionInfo || connectionInfo.status !== "established") {
      logger.error(
        `Cannot process message #${message.sequence_number} from topic ${connectionTopicId}: No active connection info found.`
      );
      return;
    }

    let messageContent: string = message.data;
    if (messageContent.startsWith("hcs://")) {
      try {
        const content = await this.client.getMessageContent(messageContent);
        messageContent =
          typeof content === "string" ? content : JSON.stringify(content);
        logger.debug(
          `Resolved HRL to content: "${messageContent.substring(0, 50)}..."`
        );
      } catch (error) {
        logger.error(
          `Failed to resolve message content for HRL ${messageContent} on topic ${connectionTopicId}:`,
          error
        );
        return;
      }
    }

    try {
      logger.info(
        `Handling standard message from topic ${connectionTopicId}: "${messageContent.substring(0, 100)}..."`
      );

      const roomId = stringToUuid(
        `${connectionTopicId}-${this.runtime.agentId}`
      );
      const userIdUUID = stringToUuid(
        `${connectionInfo.targetAccountId}-${this.runtime.agentId}`
      );
      const userName =
        connectionInfo.targetAgentName || connectionInfo.targetAccountId;
      const name =
        connectionInfo.profileInfo?.display_name ||
        connectionInfo.targetAccountId;

      await this.runtime.ensureConnection(
        userIdUUID,
        roomId,
        userName,
        name,
        "hedera"
      );

      const messageId = stringToUuid(
        `${connectionTopicId}-${message.sequence_number}-${this.runtime.agentId}`
      );
      const content: Content = {
        text: messageContent,
        source: "hedera",
        content: {
          message: message,
        },
      };
      const memory: Memory = {
        id: messageId,
        userId: userIdUUID,
        agentId: this.runtime.agentId,
        roomId,
        content,
        createdAt: message.created?.getTime() || Date.now(),
        embedding: [],
      };

      await this.runtime.messageManager.addEmbeddingToMemory(memory);
      await this.runtime.messageManager.createMemory(memory);

      const state = await this.runtime.composeState(memory, {
        hederaClient: this.client,
        hederaMessage: message,
        connectionTopicId,
        agentName: this.runtime.character?.name || "Hedera Agent",
        userName: userName,
        userId: userIdUUID,
        agentId: this.runtime.agentId,
      });

      const context = composePromptFromState({
        state,
        template: hederaMessageHandlerTemplate,
      });
      logger.debug(
        `Composed context for message #${message.sequence_number}:`,
        context.substring(0, 200) + "..."
      );

      logger.info(
        `Generating response for message #${message.sequence_number} on topic ${connectionTopicId}`
      );
      const responseContent = await this._generateResponse(context);
      console.log("responseContent", responseContent);
      logger.info(
        `Generated response content for message #${message.sequence_number}:`,
        responseContent.text?.substring(0, 100) + "..."
      );

      responseContent.inReplyTo = messageId;

      const callback = async (content: Content): Promise<Memory[]> => {
        try {
          console.log("going to send response", content);
          logger.info(
            `Sending response via callback to topic ${connectionTopicId}:`
          );
          logger.info(JSON.stringify(content));

          const responseContent: AgentResponse | undefined =
            content?.content as AgentResponse;

          let sentReceipt: TransactionReceipt | undefined;
          if (responseContent?.output && !responseContent?.transactionBytes) {
            sentReceipt = await this.client.sendMessage(
              connectionTopicId,
              `[Reply to #${message.sequence_number}] ${responseContent.output}`
            );
          }

          if (responseContent?.notes && !responseContent?.transactionBytes) {
            const formattedNotes = responseContent.notes
              .map((note) => `- ${note}`)
              .join("\n");
            const inferenceMessage =
              "I've made some inferences based on your prompt. If this isn't what you expected, please try a more refined prompt.";
            sentReceipt = await this.client.sendMessage(
              connectionTopicId,
              `[Reply to #${message.sequence_number}]\n${inferenceMessage}\n${formattedNotes}`
            );
          }

          if (responseContent?.transactionBytes) {
            const transaction = ScheduleCreateTransaction.fromBytes(
              Buffer.from(responseContent.transactionBytes || "", "base64")
            );

            let reply = `[Reply to #${message.sequence_number}]`;
            if (
              responseContent?.notes?.length &&
              responseContent?.notes?.length > 0
            ) {
              const inferenceMessage =
                "I've made some inferences based on your prompt. If this isn't what you expected, please try a more refined prompt.";
              const formattedNotes = responseContent.notes
                .map((note) => `- ${note}`)
                .join("\n");
              reply += `\n${inferenceMessage}\n${formattedNotes}`;
            }

            const schedulePayerAccountId = extractAccountId(
              message.operator_id
            );

            await this.client.sendTransaction(
              connectionTopicId,
              transaction,
              reply,
              {
                schedulePayerAccountId: schedulePayerAccountId || undefined,
              }
            );
          }

          if (!responseContent?.transactionBytes && content?.text) {
            sentReceipt = await this.client.sendMessage(
              connectionTopicId,
              `[Reply to #${message.sequence_number}]\n${content.text}`
            );
          }

          const responseMemory: Memory = {
            id: stringToUuid(
              `${connectionTopicId}-response-${Date.now()}-${this.runtime.agentId}`
            ),
            userId: this.runtime.agentId,
            agentId: this.runtime.agentId,
            content: { ...content },
            roomId,
            embedding: [],
            createdAt: Date.now(),
          };

          if (sentReceipt?.topicSequenceNumber) {
            const processedSet = this.processedMessages.get(connectionTopicId);
            if (processedSet) {
              processedSet.add(sentReceipt.topicSequenceNumber.toNumber());
              logger.debug(
                `Marked own response #${sentReceipt.topicSequenceNumber.toNumber()} as processed.`
              );
            }
            this.lastProcessedTimestamps.set(connectionTopicId, Date.now());
          }

          await this.runtime.messageManager.createMemory(responseMemory);
          return [responseMemory];
        } catch (error) {
          logger.error(
            `Error sending response callback for topic ${connectionTopicId}:`,
            error
          );
          return [];
        }
      };

      const responseMemories = await callback(responseContent);
      const updatedState = await this.runtime.updateRecentMessageState(state);

      await this.runtime.processActions(
        memory,
        responseMemories,
        updatedState,
        (response: Content) => {
          return callback({ ...response, inReplyTo: undefined });
        }
      );

      await this.runtime.evaluate(memory, updatedState, true);
    } catch (error: unknown) {
      logger.error(
        `Error processing standard message #${message.sequence_number} on topic ${connectionTopicId}:`,
        error
      );
    }
  }

  /**
   * Generates a response using the LLM runtime.
   */
  private async _generateResponse(context: string): Promise<Content> {
    try {
      logger.debug(
        "Context passed to runtime.useModel:",
        context.substring(0, 200) + "..."
      );
      const response = await this.runtime.useModel("DEFAULT" as ModelTypeName, {
        prompt: context,
      });
      logger.debug(
        "Raw response from LLM:",
        response?.substring(0, 100) + "..."
      );
      return {
        text: response || "I'm having trouble generating a response right now. Please try again later.",
        source: "hedera",
      };
    } catch (error) {
      logger.error("Error generating response:", error);
      return {
        text: "I'm having trouble generating a response right now. Please try again later.",
        source: "hedera",
      };
    }
  }

  /**
   * Sends a response message to a specific topic ID.
   */
  private async sendResponse(
    topicId: string,
    response: string,
    memo?: string
  ): Promise<TransactionReceipt> {
    try {
      logger.info(
        `Sending response to topic ${topicId}: "${response.substring(0, 100)}..."`
      );
      const actualMemo = memo || `Agent response on ${topicId}`;
      const sentMessage = await this.client.sendMessage(
        topicId,
        response,
        actualMemo
      );
      logger.success(
        `Response sent successfully to topic ${topicId}, sequence #: ${sentMessage?.topicSequenceNumber}`
      );
      return sentMessage;
    } catch (error: unknown) {
      logger.error(`Failed to send response to topic ${topicId}:`, error);
      if (
        error instanceof Error &&
        (error.message?.includes("INVALID_TOPIC_ID") ||
          error.message?.includes("TopicId Does Not Exist"))
      ) {
        logger.warn(
          `Topic ${topicId} appears invalid while sending. Cleaning up.`
        );
        this._cleanupTopicTracking(topicId);
        const conn = this.connectionsManager.getConnectionByTopicId(topicId);
        if (conn?.status !== "closed") {
          this.connectionsManager.updateOrAddConnection({
            ...conn,
            status: "closed",
            closedReason: "Topic invalid during send",
            closeMethod: "admin_key",
          });
        }
      }
      throw error;
    }
  }
}

export const OpenConvaiClientInterface = {
  start: async (runtime: IAgentRuntime) => new OpenConvaiClient(runtime),
  stop: async (_runtime: IAgentRuntime): Promise<void> => {
    logger.info(
      "OpenConvaiClientInterface stop called via runtime. Instance should handle its own stop logic."
    );
    return Promise.resolve();
  },
};
