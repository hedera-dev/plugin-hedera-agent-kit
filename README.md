# `@elizaos/plugin-hedera`
This plugin provides actions and utilities for interacting with Hedera blockchain.

---

Prepare Eliza according to [README](https://github.com/elizaOS/eliza/blob/main/README.md).

Add variables required for `@elizaos/plugin-hedera` :

```env
# Required: Hedera account private key (accepts ED25519 and ECDSA, both DER and HEX encoded)
HEDERA_PRIVATE_KEY= 

# Required: Hedera account ID (ex. `0.0.5393196`)
HEDERA_ACCOUNT_ID=


# Required for natural language processing: OpenAI API key
OPENAI_API_KEY=
```

**Important:** The minimum required environment variables are:
- `HEDERA_PRIVATE_KEY` - Your Hedera account private key
- `HEDERA_ACCOUNT_ID` - Your Hedera account ID
- `OPENAI_API_KEY` - Required for natural language transaction processing

Ensure the appropriate environment variables are added for the plugin. If they are correctly configured, the project will run with `@elizaos/plugin-hedera`

Run Eliza

``` bash
  elizaos dev
```

The plugin should load automatically to the `Eliza (Test Mode)` agent.

## Interaction examples
Try interacting with the agent:

```shell
Whats my HBAR balance?
```

```shell
Create fungible token Test with symbol TST, 4 decimals and 1000 initial supply. Set supply key.
```

```shell
Create topic with memo 'Example Topic'.
```

```shell
Show messages for topic 0.0.1231234.
```

As ElizaOS does not support human in the loop approach, the agent immediately executes all actions.