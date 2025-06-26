import { mock } from "bun:test";
import {
  type IAgentRuntime,
  type Memory,
  type State,
  type Character,
  type UUID,
  type Content,
  type Room,
  type Entity,
  ChannelType,
  ModelType,
} from "@elizaos/core";

// Mock Runtime Type
export type MockRuntime = Partial<IAgentRuntime> & {
  agentId: UUID;
  character: Character;
  getSetting: ReturnType<typeof mock>;
  useModel: ReturnType<typeof mock>;
  composeState: ReturnType<typeof mock>;
  createMemory: ReturnType<typeof mock>;
  getMemories: ReturnType<typeof mock>;
  searchMemories: ReturnType<typeof mock>;
  updateMemory: ReturnType<typeof mock>;
  getRoom: ReturnType<typeof mock>;
  getParticipantUserState: ReturnType<typeof mock>;
  setParticipantUserState: ReturnType<typeof mock>;
  emitEvent: ReturnType<typeof mock>;
  getTasks: ReturnType<typeof mock>;
  providers: any[];
  actions: any[];
  evaluators: any[];
  services: any[];
};

// Create Mock Runtime
export function createMockRuntime(
  overrides: Partial<MockRuntime> = {}
): MockRuntime {
  return {
    agentId: "test-agent-id" as UUID,
    character: {
      name: "Test Agent",
      bio: "A test agent for unit testing",
      templates: {
        messageHandlerTemplate: "Test template {{recentMessages}}",
        shouldRespondTemplate: "Should respond {{recentMessages}}",
      },
    } as Character,

    // Core methods with default implementations
    useModel: mock().mockResolvedValue("Mock response"),
    composeState: mock().mockResolvedValue({
      values: {
        agentName: "Test Agent",
        recentMessages: "Test message",
      },
      data: {
        room: {
          id: "test-room-id",
          type: ChannelType.DIRECT,
        },
      },
    }),
    createMemory: mock().mockResolvedValue({ id: "memory-id" }),
    getMemories: mock().mockResolvedValue([]),
    searchMemories: mock().mockResolvedValue([]),
    updateMemory: mock().mockResolvedValue(undefined),
    getSetting: mock().mockImplementation((key: string) => {
      const settings: Record<string, string> = {
        TEST_SETTING: "test-value",
        API_KEY: "test-api-key",
        HEDERA_ACCOUNT_ID: "0.0.12345",
        HEDERA_PRIVATE_KEY: "test-private-key",
        HEDERA_NETWORK: "testnet",
        HEDERA_NETWORK_TYPE: "testnet",
        HEDERA_AGENT_MODE: "provideBytes",
        HEDERA_INBOUND_TOPIC_ID: "0.0.11111",
        HEDERA_OUTBOUND_TOPIC_ID: "0.0.22222",
        OPENAI_API_KEY: "test-openai-key",
        // Add common settings your plugin might need
      };
      return settings[key];
    }),
    getRoom: mock().mockResolvedValue({
      id: "test-room-id",
      type: ChannelType.DIRECT,
      worldId: "test-world-id",
      serverId: "test-server-id",
      source: "test",
    }),
    getParticipantUserState: mock().mockResolvedValue("ACTIVE"),
    setParticipantUserState: mock().mockResolvedValue(undefined),
    emitEvent: mock().mockResolvedValue(undefined),
    getTasks: mock().mockResolvedValue([]),

    // Provider/action/evaluator lists
    providers: [],
    actions: [],
    evaluators: [],
    services: [],

    // Override with custom implementations
    ...overrides,
  };
}

// Create Mock Memory
export function createMockMemory(
  overrides: Partial<Memory> = {}
): Partial<Memory> {
  return {
    id: "test-message-id" as UUID,
    roomId: "test-room-id" as UUID,
    entityId: "test-entity-id" as UUID,
    agentId: "test-agent-id" as UUID,
    content: {
      text: "Test message",
      channelType: ChannelType.DIRECT,
      source: "direct",
    } as Content,
    createdAt: Date.now(),
    userId: "test-user-id" as UUID,
    ...overrides,
  };
}

// Create Mock State
export function createMockState(
  overrides: Partial<State> = {}
): Partial<State> {
  return {
    values: {
      agentName: "Test Agent",
      recentMessages: "User: Test message",
      ...overrides.values,
    },
    data: {
      room: {
        id: "test-room-id",
        type: ChannelType.DIRECT,
      },
      ...overrides.data,
    },
    ...overrides,
  };
}

// Setup Action Test Helper
export function setupActionTest(
  options: {
    runtimeOverrides?: Partial<MockRuntime>;
    messageOverrides?: Partial<Memory>;
    stateOverrides?: Partial<State>;
  } = {}
) {
  const mockRuntime = createMockRuntime(options.runtimeOverrides);
  const mockMessage = createMockMemory(options.messageOverrides);
  const mockState = createMockState(options.stateOverrides);
  const callbackFn = mock().mockResolvedValue([]);

  return {
    mockRuntime,
    mockMessage,
    mockState,
    callbackFn,
  };
}

// Mock Logger Helper
export function mockLogger() {
  // In tests, we might want to suppress logs
  // But for now, let's keep them to see what's happening
}

// Mock HederaAgentKit classes to avoid import issues in tests
export const mockHederaAgentKit = {
  HederaConversationalAgent: class MockHederaConversationalAgent {
    constructor() {}
    async initialize() {
      return Promise.resolve();
    }
  },
  ServerSigner: class MockServerSigner {
    constructor() {}
  },
  AgentOperationalMode: {
    provideBytes: "provideBytes",
    directExecution: "directExecution",
  },
  HederaNetworkType: {
    mainnet: "mainnet",
    testnet: "testnet",
    previewnet: "previewnet",
  },
};
