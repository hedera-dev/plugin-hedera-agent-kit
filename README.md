# `@elizaos/plugin-hedera`

This plugin provides actions and utilities for interacting with Hedera blockchain and the OpenConvAI (HCS-10) standard.

---

## Development

Prepare Eliza according to [README](https://github.com/elizaOS/eliza/blob/main/README.md).

Add variables required for `@elizaos/plugin-hedera` :

```env
# Required: Hedera account private key (accepts ED25519 and ECDSA, both DER and HEX encoded)
HEDERA_PRIVATE_KEY=

# Required: Hedera account ID (ex. `0.0.5393196`)
HEDERA_ACCOUNT_ID=

# Required: Hedera network (accepts 'mainnet', 'testnet' or 'previewnet')
HEDERA_NETWORK=testnet

# Optional: Agent operational mode (defaults to 'provideBytes')
# Options: 'provideBytes', 'scheduleTransaction', 'executeTransaction'
HEDERA_AGENT_MODE=provideBytes

# Required for natural language processing: OpenAI API key
OPENAI_API_KEY=

# Optional: For OpenConvAI client (defaults to HEDERA_ACCOUNT_ID if not set)
HEDERA_OPERATOR_ID=

# Note: Currently there's an inconsistency - some actions use HEDERA_NETWORK_TYPE
# This will be unified in a future update. For now, set both to the same value:
HEDERA_NETWORK_TYPE=testnet
```

**Important:** The minimum required environment variables are:

- `HEDERA_PRIVATE_KEY` - Your Hedera account private key
- `HEDERA_ACCOUNT_ID` - Your Hedera account ID
- `OPENAI_API_KEY` - Required for natural language transaction processing

Ensure the appropriate environment variables are added for the plugin. If they are correctly configured, the project will run with `@elizaos/plugin-hedera`

Run Eliza

```bash
  bun run dev
```

---

### Using the universal helper Character

The plugin includes a pre-configured character, `universalHelper.character.json`, optimized for Hedera blockchain operations. This character enhances interaction by:

- Handling repeated prompts effectively.

- Better extracting data from user prompts and matching them with proper actions.

To use the character, pass it with the `--characters` flag:

```bash
  bun run dev --characters='../characters/universalHelper.character.json'
```

---

### Testing

For testing purposes it is recommended to erase agent's memory on the app start.
This helps you achieve clean environment and erases impact of previously called actions and passed prompts which helps to test new changes during development.
To erase agent's memory and run Eliza with recommended character use following script

```bash
  rm ./agent/data/db.sqlite ; bun run dev --character ./characters/universalHelper.character.json
```

---

## Provider

Plugin implements provider creating instance of `HederaAgentKit` from
`hedera-agent-kit`. `HederaAgentKit` offers API for interacting with Hedera blockchain and supports executing of operations called from actions.

Provider contains method `get()` that is called after each input given by user. It takes care of refreshing amount of HBAR held by connected account and stored in agent's memory - state.

Connected wallet is considered to be the agent's property. Due to that fact for extracting knowledge about connected wallet's HBAR balance use the following prompt:

1. User input

```
What's yours HBAR balance?
```

2. Response from LLM based on stored context:

```
My current HBAR balance is 999.81307987 HBAR.
```

Note that there is no action required for getting agent's HBAR balance.

---

## Actions

The plugin provides a streamlined set of actions for Hedera blockchain operations and OpenConvAI interactions:

### HEDERA_CREATE_TRANSACTION

**Universal Transaction Action** - A powerful general-purpose action that processes natural language requests to create and execute any type of transaction on the Hedera network.

This action uses the `hedera-agent-kit.processMessage()` method to intelligently parse user requests and execute the appropriate Hedera operations, including:

- **HBAR Transfers** - Send HBAR between accounts with optional memos
- **HCS Topic Operations** - Create topics, submit messages, manage topic settings
- **HTS Token Operations** - Create fungible/non-fungible tokens, mint, transfer, associate/dissociate
- **Account Management** - Check balances, token holdings, pending airdrops
- **Advanced Operations** - Token airdrops, supply management, metadata updates

#### Key Features:

- **Natural Language Processing** - Simply describe what you want to do in plain English
- **Intelligent Parsing** - Automatically extracts transaction details from user requests
- **Comprehensive Coverage** - Handles all major Hedera operations through a single action
- **Error Handling** - Provides clear feedback on transaction success or failure
- **Transaction Links** - Returns hashscan.io links for easy verification

#### Example Prompts:

**HBAR Transfer:**

```
Transfer 150 hbar to Hedera account 0.0.12345 and memo it 'Payment for services'
```

**Create HCS Topic:**

```
On Hedera, create a new HCS topic with the memo 'Weekly project updates'
```

**Token Creation:**

```
Create a new Hedera fungible token named 'SuperCoin' with symbol 'SPC', initial supply of 1 million, and 2 decimal places
```

**NFT Minting:**

```
Mint 500 units of my Hedera NFT collection with token ID 0.0.78901
```

**Token Association:**

```
Associate Hedera token 0.0.98765 with my account
```

**Check Balances:**

```
Show me HBAR balance of wallet 0.0.5423981
What are my HTS token balances?
```

**Topic Messaging:**

```
Submit message 'Hello World' to topic 0.0.123456
Get messages from topic 0.0.123456 posted after yesterday
```

**Token Operations:**

```
Airdrop 100 tokens 0.0.5450181 to accounts 0.0.5450165 and 0.0.5450137
Mint 1000 additional tokens for token ID 0.0.5478757
```

The action automatically determines the transaction type based on your natural language input and executes the appropriate Hedera operation using the connected agent's credentials.

---

### HEDERA_FIND_REGISTRATIONS

**OpenConvAI Agent Discovery** - Find and discover AI agents registered in the OpenConvAI (HCS-10) registry on Hedera.

This action allows you to search for other AI agents that have registered themselves in the decentralized agent registry, enabling discovery and communication within the OpenConvAI ecosystem.

#### Example Prompts:

```
Find agent registrations on Hedera
Find agent with account ID 0.0.12345
Find all agents with TEXT_GENERATION capability
```

---

### HEDERA_RETRIEVE_PROFILE

**HCS-11 Profile Retrieval** - Retrieve standardized agent profiles using the HCS-11 profile standard.

This action fetches detailed profile information for AI agents, including their capabilities, metadata, and communication channels as defined by the HCS-11 standard.

#### Example Prompts:

```
Get the HCS-11 profile for account 0.0.12345
Retrieve your current agent profile
Show me the profile details for agent 0.0.98765
```

---

## OpenConvAI Client

The plugin includes an OpenConvAI client interface that enables participation in the HCS-10 standard for decentralized AI agent communication. This allows your agent to:

- Register in the OpenConvAI agent registry
- Discover and communicate with other agents
- Participate in the decentralized agent ecosystem
- Handle secure agent-to-agent connections

---

## Supported Operations via HEDERA_CREATE_TRANSACTION

All the following operations are now handled through natural language requests to the `HEDERA_CREATE_TRANSACTION` action:

**Account & Balance Operations:**

- Check HBAR balances for any account
- Check HTS token balances (individual or all tokens)
- View token holders and distribution
- Show pending airdrops

**Token Operations:**

- Create fungible tokens with custom parameters
- Create and mint NFTs
- Associate/dissociate tokens
- Transfer HBAR and HTS tokens
- Airdrop tokens to multiple recipients
- Claim pending airdrops
- Reject unwanted tokens
- Mint additional supply (with supply key)

**HCS Topic Operations:**

- Create new topics with optional submit keys
- Submit messages to topics
- Retrieve topic information and metadata
- Fetch messages from topics (with optional time filtering)
- Delete topics (with admin key)

**Example Natural Language Requests:**

```
"Show me HBAR balance of wallet 0.0.5423981"
"Create token GameGold with symbol GG, 2 decimals, and 750000 supply"
"Transfer 150 hbar to account 0.0.12345 with memo 'Payment for services'"
"Airdrop 100 tokens 0.0.5450181 to accounts 0.0.5450165 and 0.0.5450137"
"Create topic with memo 'Weekly updates' and set submit key"
"Get messages from topic 0.0.5473710 posted after yesterday"
```

---

## Architecture

The plugin integrates with several key components:

- **HederaProvider**: Creates and manages `HederaAgentKit` instances
- **HederaAgentKit**: Core library for Hedera blockchain operations
- **OpenConvAI Client**: Handles HCS-10 standard agent communications
- **Natural Language Processing**: Powered by ElizaOS for intelligent transaction parsing

## Dependencies

This plugin depends on the following libraries:

- `@hashgraphonline/hedera-agent-kit` - Core Hedera operations
- `@elizaos/core` - ElizaOS framework integration
- `@hashgraph/sdk` - Official Hedera SDK
- `zod` - Schema validation

## Future Enhancements

The plugin continues to evolve with planned improvements:

- Enhanced natural language understanding
- Additional Hedera service integrations
- Improved error handling and validation
- Extended OpenConvAI functionality
- Performance optimizations

## Legacy Reference

Previously, this plugin had separate actions for each operation type (HBAR_BALANCE, CREATE_TOKEN, etc.). These have been consolidated into the single `HEDERA_CREATE_TRANSACTION` action for better user experience and maintainability. All previous functionality remains available through natural language requests.

---

## Contribution

The plugin is still in development phase. It heavily depends on `hedera-agent-kit` library that is also under development.
Consider this code as an evolving implementation that continues to improve.

Areas of ongoing development:

- Enhanced natural language processing capabilities
- Additional Hedera service integrations
- Improved OpenConvAI standard support
- Extended testing coverage

## Running Tests

This project communicates with an **ElizaOS instance** via REST API on the default port **`localhost:3000`**.

- Test cases **send messages to the AI agent**, which triggers relevant actions and returns responses
- The responses are **parsed**, and important data is extracted
- Based on this extracted data, tests perform **validations** using the **Hedera Mirror Node API** as the source of truth

#### Important Information

- **Mirror Node delay:** The Hedera Mirror Node has a slight delay, so additional waiting time is required between performing an action and checking the results
- **Sequential execution only:**
  - Tests **cannot** run in parallel because requests and responses from the agent **must be processed in chronological order**
  - Concurrent testing is **disabled**, and additional timeouts are introduced before each test to improve reliability

#### Environment Setup

The `.env` file should contain the **same wallet information** as the running ElizaOS instance.  
Use the `.env.example` file as a reference.

🦁
