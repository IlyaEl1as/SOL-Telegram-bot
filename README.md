# Solana Trading Bot (Telegram)

An educational, BonkBot/Trojan-style Telegram trading bot for Solana, built with
TypeScript, grammY, and the Jupiter v6 swap API.

> ⚠️ **Educational / testing project.** Private keys and seed phrases are stored
> in **plaintext** in a local SQLite database. Do not use it with real funds or
> deploy it for other people without reading the [Security notes](#security-notes).

## Features

- **Per-user wallets** – a BIP39 wallet (12-word seed phrase, standard Solana
  derivation path) is generated on `/start`; private key and seed phrase can be
  revealed behind a confirmation prompt and are auto-deleted after 60 seconds
- **Multi-wallet** – create or import extra wallets and switch the active one
- **Buy / Sell** – swap SOL ⇄ any SPL token through Jupiter v6 with configurable
  slippage (5 / 10 / 15%, default 10%)
- **Limit orders** – buy or sell when a token's price crosses a target
- **Sniper** – arm a token mint and buy automatically once a swap route appears
- **Copy trading** – mirror simple SOL ⇄ token swaps from a watched wallet,
  with a per-trade SOL cap
- **Transfer SOL** – send SOL to any address
- **Profile** – wallet count and trade history stats
- **Multi-language UI** – English and Russian; language is auto-detected from
  Telegram and switchable via `/language`. Adding a language means adding one file
- **Inline-keyboard UX** – menus edit the existing message instead of flooding the chat

## Tech stack

| Layer | Tools |
|---|---|
| Language | TypeScript, Node.js ≥ 18.17 |
| Telegram | [grammY](https://grammy.dev) |
| Blockchain | `@solana/web3.js`, `bip39`, `ed25519-hd-key` |
| Swaps | Jupiter v6 Quote & Swap API |
| Database | Prisma + SQLite |

## Getting started

```bash
git clone <your-repo-url>
cd solana-trading-bot
npm install
cp .env.example .env        # then fill in BOT_TOKEN
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Get a bot token from [@BotFather](https://t.me/BotFather), then message your
bot with `/start`.

### Configuration (`.env`)

| Variable | Description |
|---|---|
| `BOT_TOKEN` | Telegram bot token from @BotFather (required) |
| `RPC_URL` | Solana RPC endpoint (devnet by default; use a paid RPC such as Helius/QuickNode for mainnet) |
| `NETWORK` | `devnet` or `mainnet-beta` (label only) |
| `DEFAULT_SLIPPAGE_BPS` | Default slippage in basis points (`1000` = 10%) |
| `JUPITER_API_BASE` | Jupiter API base URL (default: v6) |
| `DATABASE_URL` | SQLite path (default: `file:./dev.db`) |

## Project structure

```
prisma/schema.prisma           Users, wallets, orders, watches, trade log
src/bot.ts                     Commands, callbacks, conversation flows
src/worker.ts                  Background polling: limit orders, sniper, copy trading
src/services/                  solana, jupiter, wallet, user, order, sniper, copy-trade
src/keyboards/menus.ts         Inline keyboards
src/i18n/                      Translations (en, ru)
src/utils/crypto.ts            AES-256-GCM helpers (available, currently unused)
```

## How it works

- **Swaps:** quote via Jupiter → build the transaction → sign locally with the
  user's keypair → send → confirm. Jupiter never sees the private key.
- **Background worker:** limit orders, sniper, and copy trading run on a single
  polling loop (every ~8 s) in the bot process. This is simple and fine for a few
  users, but executions can lag a price move by up to one interval.
- **Copy trading limits:** only direct SOL ⇄ token swaps are detected;
  token-to-token swaps are ignored.

## Security notes

This is a **custodial** design: the server holds keys that can move user funds.

- Private keys and seed phrases are stored **unencrypted** for local debugging.
  Never commit `.env` or `prisma/dev.db`.
- For anything beyond testing: encrypt keys at rest (AES-256-GCM helpers are in
  `src/utils/crypto.ts`) and preferably move to a KMS/HSM or MPC signer.
- Missing for production: rate limiting and spend caps, RPC redundancy, honeypot /
  rug-pull screening, MEV protection (e.g. Jito), and event-driven (websocket)
  monitoring instead of polling.
- Meme-coin trading is high risk. Start on devnet or with tiny amounts.

## Disclaimer

Provided for educational purposes only, without warranty. Not financial advice.
You are responsible for any funds you use with it.

## License

MIT