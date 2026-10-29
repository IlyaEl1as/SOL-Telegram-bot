import type { Locale } from './types.js';

export const en: Locale = {
  code: 'en',
  name: 'English',
  flag: '🇬🇧',

  mainMenu: ({ publicKey, balance, slippagePct }) =>
    `<b>Solana Trading Bot</b>\n\n` +
    `Wallet: <code>${publicKey}</code>\n` +
    `Balance: <b>${balance} SOL</b>\n` +
    `Slippage: ${slippagePct}%`,

  buttons: {
    balance: '💰 Balance',
    revealKey: '🔑 Reveal Key',
    buy: '🟢 Buy',
    sell: '🔴 Sell',
    settings: '⚙️ Settings',
    refresh: '🔄 Refresh',
    back: '⬅️ Back',
    cancel: '✖️ Cancel',
    customAmount: '✏️ Custom Amount',
    language: '🌐 Language',
  },

  help:
    'Commands:\n' +
    '/start — open the main menu, creates your wallet if needed\n' +
    '/balance — show SOL + token balances\n' +
    '/language — change bot language\n' +
    '/help — this message',

  buy: {
    askMint: 'Send the <b>token mint address</b> (contract address) you want to buy.',
    invalidMint: 'That does not look like a valid Solana mint address. Try again.',
    askAmount: (tokenMint) => `Token: <code>${tokenMint}</code>\n\nHow much SOL do you want to spend?`,
    askCustomAmount: 'Enter the amount of SOL to spend (e.g. 0.25):',
    invalidAmount: 'Please enter a valid positive number, e.g. 0.25',
    submitting: '⏳ Fetching route and submitting swap...',
    success: ({ amountSol, tokenMint, priceImpact, signature }) =>
      `✅ <b>Buy successful</b>\n` +
      `Spent: ${amountSol} SOL\n` +
      `Token: <code>${tokenMint}</code>\n` +
      `Price impact: ${priceImpact}%\n` +
      `Tx: <a href="https://solscan.io/tx/${signature}">${signature.slice(0, 8)}...</a>`,
    failed: (reason) => `❌ <b>Buy failed</b>\n${reason}`,
    mintFirst: 'Send a token mint address first.',
  },

  sell: {
    noBalances: 'You have no token balances to sell.',
    fetchFailed: (reason) => `❌ Could not fetch token balances: ${reason}`,
    chooseToken: 'Select a token to sell:',
    tokenInfo: ({ tokenMint, balance }) =>
      `Token: <code>${tokenMint}</code>\nBalance: ${balance}\n\nHow much do you want to sell?`,
    balanceNotFound: 'Balance not found — it may have changed.',
    sessionExpired: 'Session expired, start over.',
    nothingToSell: 'Nothing to sell.',
    submitting: '⏳ Fetching route and submitting swap...',
    success: ({ solReceived, tokenMint, priceImpact, signature }) =>
      `✅ <b>Sell successful</b>\n` +
      `Received: ${solReceived} SOL\n` +
      `Token: <code>${tokenMint}</code>\n` +
      `Price impact: ${priceImpact}%\n` +
      `Tx: <a href="https://solscan.io/tx/${signature}">${signature.slice(0, 8)}...</a>`,
    failed: (reason) => `❌ <b>Sell failed</b>\n${reason}`,
  },

  reveal: {
    warning:
      '⚠️ <b>Never share your private key or seed phrase with anyone.</b>\n' +
      'This will show both your raw private key and your 12-word seed phrase. ' +
      'Anyone with either one has full control of your wallet. Are you sure?',
    confirmButton: '⚠️ Yes, show my private key',
    cancelButton: 'Cancel',
    message: ({ privateKey, mnemonic }) =>
      `🔑 <b>Private key</b> (base58):\n<code>${privateKey}</code>\n\n` +
      `🌱 <b>Seed phrase</b> (12 words — import this into Phantom/Solflare):\n<code>${mnemonic}</code>`,
    deleteNotice: '⚠️ Delete this message after copying. Anyone with either of these has full control of your wallet.',
  },

  settings: {
    title: '⚙️ <b>Settings</b>',
    slippageLabel: (pct) => `Slippage: ${pct}%`,
    slippageSet: (pct) => `Slippage set to ${pct}%`,
  },

  language: {
    prompt: '🌐 Choose your language:',
    setTo: (name) => `Language set to ${name}`,
  },

  genericError: 'Something went wrong. Please try again.',
};
