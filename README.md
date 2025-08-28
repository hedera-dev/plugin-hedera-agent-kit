# Hedera + ElizaOS: Hedera Agent Kit Plugin

A high‑level integration that lets AI agents built with ElizaOS understand, reason about, and execute on‑chain actions on the Hedera network using natural language.

- What is ElizaOS? An open‑source agent runtime for building autonomous, tool‑using AI agents that can plan and take actions.
- Why use it with Hedera? To give agents fast, low‑cost blockchain execution.
- What value does this plugin add? It connects ElizaOS directly to Hedera via the Hedera Agent Kit, exposing safe, typed tools for transfers, tokens, and queries—so you can build real, useful, on‑chain agents quickly.

Repository scope: This package wraps Hedera Agent Kit tools as an ElizaOS plugin and wires them into the ElizaOS runtime.

## Overview

ElizaOS provides the runtime for AI agents (planning, memory, tools, messaging). The Hedera Agent Kit provides strongly‑typed, batteries‑included functions for common Hedera actions (HBAR transfers, HTS token ops, HCS messages, queries). This plugin bridges the two, so an Eliza agent can call Hedera actions safely via tools.

Who is this for?
- Builders that are experimenting with autonomous agents that take on‑chain actions
- Teams adding blockchain capabilities to assistants, copilots, and workflows
- Educators and docs writers who want a concise, high‑level integration example for Hedera

## Why ElizaOS for agents

- Tool‑native architecture: ElizaOS encourages explicit tools and plans, which maps well to deterministic blockchain actions.
- Flexible model providers: Works with OpenAI, Ollama, and others via plugins.
- Production‑ready runtime: Background services, providers, evaluators, and a clean plugin lifecycle.

## Why pair it with Hedera

- Fast finality and low, predictable fees—ideal for iterative agent behavior
- Native tokenization (HTS) with rich controls and compliance features
- Ordered, verifiable messaging via Hedera Consensus Service (HCS)
- Carbon‑negative network with high throughput and stable costs

## What you can do with Hedera Agent Kit + ElizaOS

Using natural language, agents can:

- Accounts and HBAR
  - Transfer HBAR between accounts
  - Check HBAR and token balances
  - Fetch account details
- Hedera Token Service (HTS)
  - Create fungible tokens
  - Create non‑fungible token (NFT) collections
  - Airdrop fungible tokens to multiple recipients
- Hedera Consensus Service (HCS)
  - Create topics
  - Submit messages to topics
  - Read topic messages
- Queries
  - Retrieve topic messages, account balances, and token balances

These capabilities come from Hedera Agent Kit (HAK) and are surfaced as ElizaOS tools that an agent can call as part of its plan.

## Architecture at a glance

- At startup the plugin registers the Hedera Agent Kit toolkit with ElizaOS.
- It validates your Hedera credentials, creates a Hedera client (testnet by default), and registers a set of blockchain tools (actions) with the agent runtime.
- Agent prompts/plans then invoke these tools to perform on‑chain operations and return results back into the conversation.

## Common use cases

- Autonomous token treasuries and spend controls on testnet
- NFT minting assistants for creators
- Support bots that fetch balances and account details
- Workflow agents that post auditable messages to HCS topics
- Classroom demos showcasing agent‑to‑chain interactions

## Quick start

### Prerequisites
- Node.js 20+ and Bun (for ElizaOS CLI)
- Hedera Testnet account and private key
- A model provider key (e.g., OpenAI) or use Ollama locally

Install the ElizaOS CLI:

```bash
bun install -g @elizaos/cli
elizaos --version
```

### Clone and set up

```bash
git clone https://github.com/hedera-dev/eliza-plugin-hedera.git
cd eliza-plugin-hedera

# Configure environment
cp .env.example .env
# Fill the variables in .env:
#   HEDERA_PRIVATE_KEY=...
#   HEDERA_ACCOUNT_ID=...
#   OPENAI_API_KEY=...        # or configure Ollama/OpenAI per your model choice

npm install
```

### Run the agent

```bash
elizaos dev
```

The plugin loads into the Eliza agent. You can now use natural language to perform Hedera actions.

### Required environment variables
- HEDERA_PRIVATE_KEY — Your Hedera account private key (DER/HEX; ED25519 or ECDSA)
- HEDERA_ACCOUNT_ID — Your Hedera account ID (e.g., 0.0.5393196)
- OPENAI_API_KEY — If using OpenAI; otherwise configure your chosen model provider (e.g., Ollama) via its plugin

## Example prompts

- Account operations
  - "What’s my HBAR balance?"
  - "Transfer 5 HBAR to account 0.0.123456"
- Token operations
  - "Create fungible token Test with symbol TST, 4 decimals, and 1000 initial supply. Set supply key."
  - "Create an NFT collection called Digital Art with symbol DART"
  - "Airdrop 10 tokens of 0.0.7654321 to accounts 0.0.111111 and 0.0.222222"
- Consensus operations
  - "Create a topic with memo ‘Example Topic’"
  - "Submit message ‘Hello Hedera world!’ to topic 0.0.1231234"
  - "Show messages for topic 0.0.1231234"
- Query operations
  - "Show details for account 0.0.123456"
  - "What tokens do I own?"

Note: ElizaOS agents typically execute tools immediately (no human‑in‑the‑loop). Use small amounts on testnet and review prompts for safety.

## Security and best practices

- Use Hedera Testnet for experimentation; limit value at risk.
- Scope tool permissions and validate inputs in prompts where possible.
- Store secrets in environment variables; never commit keys.
- Consider human‑in‑the‑loop review for high‑risk actions in production.

## Developer notes

- Built on [`hedera-agent-kit`](https://github.com/hedera-dev/hedera-agent-kit)
- Registers core plugins: Accounts, HTS, HCS (Consensus), and Queries
- Defaults to Hedera Testnet

## Where to go next

- Hedera Agent Kit (SDK, docs, examples): https://github.com/hedera-dev/hedera-agent-kit
- Hedera Docs (HTS, HCS, SDKs): https://docs.hedera.com/
- ElizaOS (runtime and docs): https://elizaos.ai

## Contributing

Issues and PRs are welcome. For significant changes, please open an issue first to discuss what you’d like to change.
