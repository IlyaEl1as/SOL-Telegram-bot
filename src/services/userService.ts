import { PrismaClient, type User } from '@prisma/client';
import { Keypair } from '@solana/web3.js';
import { config } from '../config.js';
import { generateWallet, keypairFromSecretBase58 } from './solanaService.js';
import { DEFAULT_LANGUAGE, detectLanguage, type LanguageCode } from '../i18n/index.js';

export const prisma = new PrismaClient();

export async function getOrCreateUser(
  telegramId: bigint,
  telegramLanguageCode?: string
): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;

  const wallet = generateWallet();

  return prisma.user.create({
    data: {
      telegramId,
      publicKey: wallet.publicKey,
      privateKey: wallet.secretKeyBase58,
      mnemonic: wallet.mnemonic,
      slippageBps: config.defaultSlippageBps,
      language: telegramLanguageCode ? detectLanguage(telegramLanguageCode) : DEFAULT_LANGUAGE,
    },
  });
}

export async function updateLanguage(telegramId: bigint, language: LanguageCode): Promise<User> {
  return prisma.user.update({ where: { telegramId }, data: { language } });
}

export async function getUser(telegramId: bigint): Promise<User | null> {
  return prisma.user.findUnique({ where: { telegramId } });
}

export async function getUserKeypair(telegramId: bigint): Promise<Keypair> {
  const user = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  return keypairFromSecretBase58(user.privateKey);
}

export async function revealPrivateKey(telegramId: bigint): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  return user.privateKey;
}

export async function revealMnemonic(telegramId: bigint): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { telegramId } });
  return user.mnemonic;
}

export async function updateSlippage(telegramId: bigint, slippageBps: number): Promise<User> {
  return prisma.user.update({ where: { telegramId }, data: { slippageBps } });
}

export async function logTransaction(params: {
  userId: number;
  signature: string;
  side: 'buy' | 'sell';
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  status: 'confirmed' | 'failed';
}): Promise<void> {
  await prisma.transaction.create({ data: params });
}
