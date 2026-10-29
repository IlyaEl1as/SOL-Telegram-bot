import { config } from '../config.js';

export interface QuoteResponse {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: unknown[];
  [key: string]: unknown;
}

interface GetQuoteParams {
  inputMint: string;
  outputMint: string;
  amount: number; // in the smallest unit of inputMint (lamports for SOL)
  slippageBps: number;
}

/**
 * Fetches the best swap route from Jupiter's aggregator.
 * Returns null (rather than throwing) when no route exists, e.g. for a
 * token with no liquidity or a mistyped mint address — callers should
 * treat that as "can't trade this token" rather than a hard error.
 */
export async function getQuote(params: GetQuoteParams): Promise<QuoteResponse | null> {
  const { inputMint, outputMint, amount, slippageBps } = params;

  const url = new URL(`${config.jupiterApiBase}/quote`);
  url.searchParams.set('inputMint', inputMint);
  url.searchParams.set('outputMint', outputMint);
  url.searchParams.set('amount', String(Math.floor(amount)));
  url.searchParams.set('slippageBps', String(slippageBps));

  const response = await fetchWithTimeout(url.toString(), { method: 'GET' }, 10_000);

  if (!response.ok) {
    if (response.status === 400 || response.status === 404) return null;
    throw new Error(`Jupiter quote request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as QuoteResponse;
  if (!data?.outAmount) return null;
  return data;
}

interface GetSwapTransactionParams {
  quoteResponse: QuoteResponse;
  userPublicKey: string;
}

/**
 * Asks Jupiter to build a ready-to-sign VersionedTransaction (base64) for
 * a given quote. We still sign and send it ourselves — Jupiter never sees
 * the private key.
 */
export async function getSwapTransaction(params: GetSwapTransactionParams): Promise<string> {
  const { quoteResponse, userPublicKey } = params;

  const response = await fetchWithTimeout(
    `${config.jupiterApiBase}/swap`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    },
    15_000
  );

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Jupiter swap request failed: ${response.status} ${response.statusText} ${body}`);
  }

  const data = (await response.json()) as { swapTransaction: string };
  if (!data.swapTransaction) {
    throw new Error('Jupiter did not return a swap transaction.');
  }
  return data.swapTransaction;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
