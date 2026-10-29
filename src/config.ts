import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

export const config = {
  botToken: requireEnv('BOT_TOKEN'),
  rpcUrl: process.env.RPC_URL ?? 'https://api.devnet.solana.com',
  network: (process.env.NETWORK ?? 'devnet') as 'devnet' | 'mainnet-beta',
  // Only needed if you switch storage back to encrypted-at-rest (see
  // src/utils/crypto.ts) — not required for the current plaintext setup.
  encryptionKey: process.env.ENCRYPTION_KEY,
  defaultSlippageBps: Number(process.env.DEFAULT_SLIPPAGE_BPS ?? 1000),
  jupiterApiBase: process.env.JUPITER_API_BASE ?? 'https://quote-api.jup.ag/v6',
} as const;

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const LAMPORTS_IN_SOL = 1_000_000_000;
