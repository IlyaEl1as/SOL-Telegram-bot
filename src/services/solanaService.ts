import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import { config } from '../config.js';
import { getQuote, getSwapTransaction } from './jupiterService.js';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

// Standard Solana derivation path used by Phantom/Solflare/most wallets,
// so a mnemonic generated here can be imported into those apps too.
const SOLANA_DERIVATION_PATH = "m/44'/501'/0'/0'";

const connection = new Connection(config.rpcUrl, 'confirmed');

export function getConnection(): Connection {
  return connection;
}

export interface GeneratedWallet {
  keypair: Keypair;
  publicKey: string;
  secretKeyBase58: string;
  mnemonic: string;
}

/**
 * Generates a BIP39 mnemonic (12 words) and derives the Solana keypair from
 * it via the standard m/44'/501'/0'/0' path. This is the same scheme
 * Phantom/Solflare use, so the resulting phrase can be imported there.
 *
 * We still store/use the raw secretKeyBase58 for signing (that's what
 * Keypair.fromSecretKey expects), but we now also keep the mnemonic around
 * so it can be shown/exported to the user.
 */
export function generateWallet(): GeneratedWallet {
  const mnemonic = bip39.generateMnemonic(128); // 128 bits of entropy -> 12 words
  const keypair = keypairFromMnemonic(mnemonic);
  return {
    keypair,
    publicKey: keypair.publicKey.toBase58(),
    secretKeyBase58: bs58.encode(keypair.secretKey),
    mnemonic,
  };
}

export function keypairFromMnemonic(mnemonic: string): Keypair {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error('Invalid mnemonic phrase.');
  }
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const { key } = derivePath(SOLANA_DERIVATION_PATH, seed.toString('hex'));
  return Keypair.fromSeed(key);
}

export function keypairFromSecretBase58(secretBase58: string): Keypair {
  return Keypair.fromSecretKey(bs58.decode(secretBase58));
}

export async function getSolBalance(publicKey: string): Promise<number> {
  const lamports = await connection.getBalance(new PublicKey(publicKey), 'confirmed');
  return lamports / LAMPORTS_PER_SOL;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  rawAmount: string;
}

export async function getTokenBalances(publicKey: string): Promise<TokenBalance[]> {
  const owner = new PublicKey(publicKey);
  const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  return accounts.value
    .map((acc) => {
      const info = acc.account.data.parsed.info;
      const tokenAmount = info.tokenAmount as {
        uiAmount: number | null;
        decimals: number;
        amount: string;
      };
      return {
        mint: info.mint as string,
        amount: tokenAmount.uiAmount ?? 0,
        decimals: tokenAmount.decimals,
        rawAmount: tokenAmount.amount,
      };
    })
    .filter((t) => t.amount > 0);
}

export interface SwapParams {
  userKeypair: Keypair;
  inputMint: string;
  outputMint: string;
  /** Amount in the input token's smallest unit (lamports for SOL). */
  amountRaw: number;
  slippageBps: number;
}

export interface SwapResult {
  signature: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
}

/**
 * Fetches a route, builds the swap transaction, signs it locally with the
 * user's keypair, and submits + confirms it. Throws on any failure with a
 * message suitable for showing directly to the Telegram user.
 */
export async function executeSwap(params: SwapParams): Promise<SwapResult> {
  const { userKeypair, inputMint, outputMint, amountRaw, slippageBps } = params;

  if (amountRaw <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  const quote = await getQuote({
    inputMint,
    outputMint,
    amount: amountRaw,
    slippageBps,
  });

  if (!quote) {
    throw new Error('No swap route found. The token may have no liquidity, or the mint address is invalid.');
  }

  const swapTxBase64 = await getSwapTransaction({
    quoteResponse: quote,
    userPublicKey: userKeypair.publicKey.toBase58(),
  });

  const transaction = VersionedTransaction.deserialize(Buffer.from(swapTxBase64, 'base64'));
  transaction.sign([userKeypair]);

  let signature: string;
  try {
    signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
  } catch (err) {
    throw new Error(`Failed to broadcast transaction: ${errorMessage(err)}`);
  }

  try {
    const latestBlockhash = await connection.getLatestBlockhash('confirmed');
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation.value.err) {
      throw new Error(`Transaction landed but failed on-chain: ${JSON.stringify(confirmation.value.err)}`);
    }
  } catch (err) {
    // The tx may still confirm later even if the confirmation RPC call
    // itself timed out — surface the signature so the user can check.
    throw new Error(
      `Could not confirm transaction in time. Check status manually: https://solscan.io/tx/${signature} (${errorMessage(err)})`
    );
  }

  return {
    signature,
    inAmount: quote.inAmount,
    outAmount: quote.outAmount,
    priceImpactPct: quote.priceImpactPct,
  };
}

export function isValidPublicKey(value: string): boolean {
  try {
    // eslint-disable-next-line no-new
    new PublicKey(value);
    return true;
  } catch {
    return false;
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
