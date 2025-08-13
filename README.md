# `@elizaos/plugin-hedera`

This plugin provides actions and utilities for interacting with the Hedera blockchain.

## Prerequisites

Before getting started, you'll need to install the ElizaOS CLI:

```bash
# Install the ElizaOS CLI globally
bun install -g @elizaos/cli

# Verify installation
elizaos --version

# Get help with available commands
elizaos --help
```

## Getting Started

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/hedera-dev/eliza-plugin-hedera.git

# Navigate to the project directory
cd eliza-plugin-hedera
```

### 2. Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env

# Open the .env file in your favorite editor
# Fill in the required variables:
#   - HEDERA_PRIVATE_KEY
#   - HEDERA_ACCOUNT_ID
#   - OPENAI_API_KEY (or another model provider key)
```

### 3. Install Dependencies

```bash
# Install project dependencies
npm install
```

### 4. Run ElizaOS

```bash
# Start the ElizaOS development environment
elizaos dev
```

The plugin should load automatically to the `Eliza (Test Mode)` agent.

## Available Actions

The Hedera Agent Kit provides a set of tools, bundled into plugins, to interact with the Hedera network. This ElizaOS plugin is built on top of the [`hedera-agent-kit`](https://github.com/hedera-dev/hedera-agent-kit) SDK and offers the following functionalities:

### Core Account Plugin
Tools for Hedera Account Service operations:
- **Transfer HBAR**: Send HBAR cryptocurrency between accounts on the Hedera network

### Core Consensus Plugin
Tools for Hedera Consensus Service (HCS) operations:
- **Create a Topic**: Establish a new topic for messaging and consensus
- **Submit a Message to a Topic**: Post messages to an existing Hedera Consensus Service topic

### Core HTS Plugin
Tools for Hedera Token Service operations:
- **Create a Fungible Token**: Deploy new fungible tokens with customizable properties
- **Create a Non-Fungible Token**: Deploy new NFT collections with customizable properties
- **Airdrop Fungible Tokens**: Distribute fungible tokens to multiple accounts in a single operation

### Core Queries Plugin
Tools for querying Hedera network data:
- **Get Account Query**: Retrieve detailed information about a Hedera account
- **Get HBAR Balance Query**: Check the HBAR balance of an account
- **Get Account Token Balances Query**: View all token balances for a specific account
- **Get Topic Messages Query**: Retrieve messages from a specific consensus topic

**Important:** The minimum required environment variables are:
- `HEDERA_PRIVATE_KEY` - Your Hedera account private key (accepts ED25519 and ECDSA, both DER and HEX encoded)
- `HEDERA_ACCOUNT_ID` - Your Hedera account ID (ex. `0.0.5393196`)
- `OPENAI_API_KEY` - Required for natural language transaction processing

## Interaction Examples

Try interacting with the agent with natural language commands. Below are examples for each plugin functionality:

### Account Operations
```shell
# Check your HBAR balance
Whats my HBAR balance?

# Transfer HBAR to another account
Transfer 5 HBAR to account 0.0.123456
```

### Token Operations
```shell
# Create a fungible token
Create fungible token Test with symbol TST, 4 decimals and 1000 initial supply. Set supply key.

# Create an NFT
Create NFT collection called "Digital Art" with symbol DART

# Airdrop tokens
Airdrop 10 tokens of 0.0.7654321 to accounts 0.0.111111 and 0.0.222222
```

### Consensus Service Operations
```shell
# Create a topic
Create topic with memo 'Example Topic'.

# Submit a message to a topic
Submit message "Hello Hedera world!" to topic 0.0.1231234

# Read topic messages
Show messages for topic 0.0.1231234.
```

### Query Operations
```shell
# Get account details
Show details for account 0.0.123456

# Check token balances
What tokens do I own?
```

As ElizaOS does not support human in the loop approach, the agent immediately executes all actions.

## How This Project Was Created

This project was created using the `elizaos create` command from the ElizaOS CLI tool. The CLI provides a streamlined way to set up new ElizaOS plugin projects with the necessary scaffolding and configuration.