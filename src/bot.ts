import { Bot, session, type Context, type SessionFlavor } from 'grammy';
import { config, WSOL_MINT, LAMPORTS_IN_SOL } from './config.js';
import {
  executeSwap,
  getSolBalance,
  getTokenBalances,
  isValidPublicKey,
  type TokenBalance,
} from './services/solanaService.js';
import {
  getOrCreateUser,
  getUserKeypair,
  logTransaction,
  revealMnemonic,
  revealPrivateKey,
  updateLanguage,
  updateSlippage,
} from './services/userService.js';
import {
  backKeyboard,
  buyAmountKeyboard,
  cancelKeyboard,
  confirmRevealKeyboard,
  languageKeyboard,
  mainMenuKeyboard,
  sellPercentKeyboard,
  sellTokenListKeyboard,
  settingsKeyboard,
} from './keyboards/menus.js';
import { getLocale, locales, type LanguageCode, type Locale } from './i18n/index.js';

// ---------------------------------------------------------------------------
// Session: tracks short-lived "what is this user's next text message for"
// state — e.g. "waiting for a token mint address" or "waiting for a custom
// SOL amount". Purely in-memory, which is fine for local/testing use; swap
// the storage adapter for Redis if you run more than one process.
// ---------------------------------------------------------------------------

interface PendingBuy {
  tokenMint?: string;
  amountSol?: number;
}

interface PendingSell {
  tokenMint: string;
  tokenDecimals: number;
  tokenBalance: number;
}

interface SessionData {
  flow?: 'awaiting_buy_mint' | 'awaiting_buy_custom_amount' | 'awaiting_sell_custom_pct';
  pendingBuy?: PendingBuy;
  pendingSell?: PendingSell;
}

type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(config.botToken);

bot.use(
  session({
    initial: (): SessionData => ({}),
  })
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireTelegramId(ctx: MyContext): bigint {
  const id = ctx.from?.id;
  if (id === undefined) throw new Error('Could not determine Telegram user id.');
  return BigInt(id);
}

/** Loads (or creates) the user and returns their locale together with the row. */
async function loadUserAndLocale(ctx: MyContext, telegramId: bigint) {
  const user = await getOrCreateUser(telegramId, ctx.from?.language_code);
  const t = getLocale(user.language);
  return { user, t };
}

async function renderMainMenuText(t: Locale, publicKey: string, slippageBps: number): Promise<string> {
  let solBalance = 0;
  try {
    solBalance = await getSolBalance(publicKey);
  } catch {
    // RPC hiccup — still show the menu, just without a fresh balance.
  }

  return t.mainMenu({
    publicKey,
    balance: solBalance.toFixed(4),
    slippagePct: (slippageBps / 100).toFixed(1),
  });
}

function resetFlow(ctx: MyContext) {
  ctx.session.flow = undefined;
  ctx.session.pendingBuy = undefined;
  ctx.session.pendingSell = undefined;
}

/** editMessageText, but silently ignores Telegram's "message is not modified" error. */
async function safeEditMessageText(
  ctx: MyContext,
  text: string,
  extra: Parameters<MyContext['editMessageText']>[1]
): Promise<void> {
  await ctx.editMessageText(text, extra).catch((err) => {
    if (err instanceof Error && err.message.includes('message is not modified')) return;
    throw err;
  });
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

bot.command('start', async (ctx) => {
  const telegramId = requireTelegramId(ctx);
  resetFlow(ctx);
  const { user, t } = await loadUserAndLocale(ctx, telegramId);
  const text = await renderMainMenuText(t, user.publicKey, user.slippageBps);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) });
});

bot.command('balance', async (ctx) => {
  const telegramId = requireTelegramId(ctx);
  const { user, t } = await loadUserAndLocale(ctx, telegramId);
  const text = await renderMainMenuText(t, user.publicKey, user.slippageBps);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) });
});

bot.command('help', async (ctx) => {
  const telegramId = requireTelegramId(ctx);
  const { t } = await loadUserAndLocale(ctx, telegramId);
  await ctx.reply(t.help);
});

bot.command('language', async (ctx) => {
  const telegramId = requireTelegramId(ctx);
  const { t } = await loadUserAndLocale(ctx, telegramId);
  await ctx.reply(t.language.prompt, { reply_markup: languageKeyboard() });
});

// ---------------------------------------------------------------------------
// Callback query router
// ---------------------------------------------------------------------------

bot.on('callback_query:data', async (ctx) => {
  const telegramId = requireTelegramId(ctx);
  const data = ctx.callbackQuery.data;

  try {
    const { user, t } = await loadUserAndLocale(ctx, telegramId);

    if (data === 'noop') {
      await ctx.answerCallbackQuery();
      return;
    }

    if (data === 'action:refresh' || data === 'action:balance') {
      const text = await renderMainMenuText(t, user.publicKey, user.slippageBps);
      await safeEditMessageText(ctx, text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data === 'action:back') {
      resetFlow(ctx);
      const text = await renderMainMenuText(t, user.publicKey, user.slippageBps);
      await safeEditMessageText(ctx, text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data === 'action:buy_start') {
      resetFlow(ctx);
      ctx.session.flow = 'awaiting_buy_mint';
      await ctx.editMessageText(t.buy.askMint, { parse_mode: 'HTML', reply_markup: cancelKeyboard(t) });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith('buy_amount:')) {
      await handleBuyAmount(ctx, telegramId, t, data.split(':')[1]!);
      return;
    }

    if (data === 'action:sell_start') {
      await handleSellStart(ctx, t, user.publicKey);
      return;
    }

    if (data.startsWith('sell_token:')) {
      await handleSellTokenChosen(ctx, t, user.publicKey, data.split(':')[1]!);
      return;
    }

    if (data.startsWith('sell_pct:')) {
      await handleSellPercent(ctx, telegramId, t, Number(data.split(':')[1]));
      return;
    }

    if (data === 'action:reveal_confirm') {
      await ctx.editMessageText(t.reveal.warning, { parse_mode: 'HTML', reply_markup: confirmRevealKeyboard(t) });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data === 'action:reveal_confirmed') {
      const [secretKey, mnemonic] = await Promise.all([
        revealPrivateKey(telegramId),
        revealMnemonic(telegramId),
      ]);
      await ctx.answerCallbackQuery();
      const warning = await ctx.reply(
        `${t.reveal.message({ privateKey: secretKey, mnemonic })}\n\n${t.reveal.deleteNotice}`,
        { parse_mode: 'HTML' }
      );
      // Best-effort auto-delete after 60s so it doesn't sit in chat history.
      setTimeout(() => {
        ctx.api.deleteMessage(warning.chat.id, warning.message_id).catch(() => undefined);
      }, 60_000);
      return;
    }

    if (data === 'action:settings') {
      await ctx.editMessageText(t.settings.title, {
        parse_mode: 'HTML',
        reply_markup: settingsKeyboard(t, user.slippageBps),
      });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith('slippage:')) {
      const bps = Number(data.split(':')[1]);
      const updated = await updateSlippage(telegramId, bps);
      await ctx.editMessageText(t.settings.title, {
        parse_mode: 'HTML',
        reply_markup: settingsKeyboard(t, updated.slippageBps),
      });
      await ctx.answerCallbackQuery({ text: t.settings.slippageSet((bps / 100).toFixed(1)) });
      return;
    }

    if (data === 'action:language') {
      await ctx.editMessageText(t.language.prompt, { reply_markup: languageKeyboard() });
      await ctx.answerCallbackQuery();
      return;
    }

    if (data.startsWith('language:')) {
      const code = data.split(':')[1] as LanguageCode;
      if (!(code in locales)) {
        await ctx.answerCallbackQuery();
        return;
      }
      const updated = await updateLanguage(telegramId, code);
      const newLocale = getLocale(updated.language);
      const text = await renderMainMenuText(newLocale, updated.publicKey, updated.slippageBps);
      await safeEditMessageText(ctx, text, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(newLocale) });
      await ctx.answerCallbackQuery({ text: newLocale.language.setTo(newLocale.name) });
      return;
    }

    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error('callback_query error:', err);
    const t = getLocale(undefined); // best-effort fallback if we failed before loading the user's locale
    await ctx.answerCallbackQuery({ text: t.genericError, show_alert: true }).catch(() => undefined);
  }
});

// ---------------------------------------------------------------------------
// Buy flow
// ---------------------------------------------------------------------------

async function handleBuyAmount(ctx: MyContext, telegramId: bigint, t: Locale, amountToken: string): Promise<void> {
  if (!ctx.session.pendingBuy?.tokenMint) {
    await ctx.answerCallbackQuery({ text: t.buy.mintFirst, show_alert: true });
    return;
  }

  if (amountToken === 'custom') {
    ctx.session.flow = 'awaiting_buy_custom_amount';
    await ctx.editMessageText(t.buy.askCustomAmount, { reply_markup: cancelKeyboard(t) });
    await ctx.answerCallbackQuery();
    return;
  }

  const amountSol = Number(amountToken);
  await ctx.answerCallbackQuery();
  await executeBuy(ctx, telegramId, t, ctx.session.pendingBuy.tokenMint, amountSol);
}

async function executeBuy(
  ctx: MyContext,
  telegramId: bigint,
  t: Locale,
  tokenMint: string,
  amountSol: number
): Promise<void> {
  if (!Number.isFinite(amountSol) || amountSol <= 0) {
    await ctx.reply(t.buy.invalidAmount, { reply_markup: backKeyboard(t) });
    return;
  }

  const statusMsg = await ctx.reply(t.buy.submitting);
  try {
    const user = await getOrCreateUser(telegramId);
    const keypair = await getUserKeypair(telegramId);
    const amountLamports = Math.floor(amountSol * LAMPORTS_IN_SOL);

    const result = await executeSwap({
      userKeypair: keypair,
      inputMint: WSOL_MINT,
      outputMint: tokenMint,
      amountRaw: amountLamports,
      slippageBps: user.slippageBps,
    });

    await logTransaction({
      userId: user.id,
      signature: result.signature,
      side: 'buy',
      inputMint: WSOL_MINT,
      outputMint: tokenMint,
      inAmount: result.inAmount,
      outAmount: result.outAmount,
      status: 'confirmed',
    });

    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      t.buy.success({
        amountSol: String(amountSol),
        tokenMint,
        priceImpact: result.priceImpactPct,
        signature: result.signature,
      }),
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) }
    );
  } catch (err) {
    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      t.buy.failed(escapeHtml(errorMessage(err))),
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) }
    );
  } finally {
    resetFlow(ctx);
  }
}

// ---------------------------------------------------------------------------
// Sell flow
// ---------------------------------------------------------------------------

async function handleSellStart(ctx: MyContext, t: Locale, publicKey: string): Promise<void> {
  resetFlow(ctx);

  let balances: TokenBalance[] = [];
  try {
    balances = await getTokenBalances(publicKey);
  } catch (err) {
    await ctx.editMessageText(t.sell.fetchFailed(escapeHtml(errorMessage(err))), {
      parse_mode: 'HTML',
      reply_markup: backKeyboard(t),
    });
    await ctx.answerCallbackQuery();
    return;
  }

  if (balances.length === 0) {
    await ctx.editMessageText(t.sell.noBalances, { reply_markup: backKeyboard(t) });
    await ctx.answerCallbackQuery();
    return;
  }

  await ctx.editMessageText(t.sell.chooseToken, { reply_markup: sellTokenListKeyboard(t, balances) });
  await ctx.answerCallbackQuery();
}

async function handleSellTokenChosen(ctx: MyContext, t: Locale, publicKey: string, mint: string): Promise<void> {
  const balances = await getTokenBalances(publicKey);
  const token = balances.find((b) => b.mint === mint);

  if (!token) {
    await ctx.answerCallbackQuery({ text: t.sell.balanceNotFound, show_alert: true });
    return;
  }

  ctx.session.pendingSell = { tokenMint: mint, tokenDecimals: token.decimals, tokenBalance: token.amount };

  await ctx.editMessageText(t.sell.tokenInfo({ tokenMint: mint, balance: String(token.amount) }), {
    parse_mode: 'HTML',
    reply_markup: sellPercentKeyboard(t),
  });
  await ctx.answerCallbackQuery();
}

async function handleSellPercent(ctx: MyContext, telegramId: bigint, t: Locale, percent: number): Promise<void> {
  const pending = ctx.session.pendingSell;
  if (!pending) {
    await ctx.answerCallbackQuery({ text: t.sell.sessionExpired, show_alert: true });
    return;
  }

  await ctx.answerCallbackQuery();
  const rawAmount = Math.floor(
    pending.tokenBalance * (percent / 100) * 10 ** pending.tokenDecimals
  );

  await executeSell(ctx, telegramId, t, pending.tokenMint, rawAmount);
}

async function executeSell(
  ctx: MyContext,
  telegramId: bigint,
  t: Locale,
  tokenMint: string,
  amountRaw: number
): Promise<void> {
  if (amountRaw <= 0) {
    await ctx.reply(t.sell.nothingToSell, { reply_markup: backKeyboard(t) });
    resetFlow(ctx);
    return;
  }

  const statusMsg = await ctx.reply(t.sell.submitting);
  try {
    const user = await getOrCreateUser(telegramId);
    const keypair = await getUserKeypair(telegramId);

    const result = await executeSwap({
      userKeypair: keypair,
      inputMint: tokenMint,
      outputMint: WSOL_MINT,
      amountRaw,
      slippageBps: user.slippageBps,
    });

    await logTransaction({
      userId: user.id,
      signature: result.signature,
      side: 'sell',
      inputMint: tokenMint,
      outputMint: WSOL_MINT,
      inAmount: result.inAmount,
      outAmount: result.outAmount,
      status: 'confirmed',
    });

    const solReceived = Number(result.outAmount) / LAMPORTS_IN_SOL;

    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      t.sell.success({
        solReceived: solReceived.toFixed(4),
        tokenMint,
        priceImpact: result.priceImpactPct,
        signature: result.signature,
      }),
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) }
    );
  } catch (err) {
    await ctx.api.editMessageText(
      statusMsg.chat.id,
      statusMsg.message_id,
      t.sell.failed(escapeHtml(errorMessage(err))),
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) }
    );
  } finally {
    resetFlow(ctx);
  }
}

// ---------------------------------------------------------------------------
// Free-text handler — used to collect mint addresses / custom amounts
// requested by the flows above.
// ---------------------------------------------------------------------------

bot.on('message:text', async (ctx) => {
  const telegramId = requireTelegramId(ctx);
  const text = ctx.message.text.trim();
  const flow = ctx.session.flow;
  const { user, t } = await loadUserAndLocale(ctx, telegramId);

  if (flow === 'awaiting_buy_mint') {
    if (!isValidPublicKey(text)) {
      await ctx.reply(t.buy.invalidMint, { reply_markup: cancelKeyboard(t) });
      return;
    }
    ctx.session.pendingBuy = { tokenMint: text };
    ctx.session.flow = undefined;
    await ctx.reply(t.buy.askAmount(text), { parse_mode: 'HTML', reply_markup: buyAmountKeyboard(t) });
    return;
  }

  if (flow === 'awaiting_buy_custom_amount') {
    const amount = Number(text.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.reply(t.buy.invalidAmount, { reply_markup: cancelKeyboard(t) });
      return;
    }
    const tokenMint = ctx.session.pendingBuy?.tokenMint;
    ctx.session.flow = undefined;
    if (!tokenMint) {
      await ctx.reply(t.sell.sessionExpired, { reply_markup: mainMenuKeyboard(t) });
      return;
    }
    await executeBuy(ctx, telegramId, t, tokenMint, amount);
    return;
  }

  // No active flow — treat any message as "open the menu".
  const menuText = await renderMainMenuText(t, user.publicKey, user.slippageBps);
  await ctx.reply(menuText, { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(t) });
});

// ---------------------------------------------------------------------------
// Global error handling
// ---------------------------------------------------------------------------

bot.catch((err) => {
  console.error('Unhandled bot error:', err.error);
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

bot
  .start({
    onStart: (info) => {
      console.log(`Bot started as @${info.username} (network: ${config.network})`);
    },
  })
  .catch((err) => {
    console.error('Failed to start bot:', err);
    process.exit(1);
  });
