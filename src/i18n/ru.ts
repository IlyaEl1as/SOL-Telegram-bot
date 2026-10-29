import type { Locale } from './types.js';

export const ru: Locale = {
  code: 'ru',
  name: 'Русский',
  flag: '🇷🇺',

  mainMenu: ({ publicKey, balance, slippagePct }) =>
    `<b>Solana Trading Bot</b>\n\n` +
    `Кошелёк: <code>${publicKey}</code>\n` +
    `Баланс: <b>${balance} SOL</b>\n` +
    `Слиппедж: ${slippagePct}%`,

  buttons: {
    balance: '💰 Баланс',
    revealKey: '🔑 Показать ключ',
    buy: '🟢 Купить',
    sell: '🔴 Продать',
    settings: '⚙️ Настройки',
    refresh: '🔄 Обновить',
    back: '⬅️ Назад',
    cancel: '✖️ Отмена',
    customAmount: '✏️ Своя сумма',
    language: '🌐 Язык',
  },

  help:
    'Команды:\n' +
    '/start — открыть главное меню, создаёт кошелёк, если его ещё нет\n' +
    '/balance — показать баланс SOL и токенов\n' +
    '/language — сменить язык бота\n' +
    '/help — это сообщение',

  buy: {
    askMint: 'Отправь <b>адрес контракта токена</b> (mint address), который хочешь купить.',
    invalidMint: 'Это не похоже на валидный Solana mint-адрес. Попробуй ещё раз.',
    askAmount: (tokenMint) => `Токен: <code>${tokenMint}</code>\n\nСколько SOL потратить?`,
    askCustomAmount: 'Введи сумму SOL для покупки (например, 0.25):',
    invalidAmount: 'Введи корректное положительное число, например 0.25',
    submitting: '⏳ Ищу маршрут и отправляю своп...',
    success: ({ amountSol, tokenMint, priceImpact, signature }) =>
      `✅ <b>Покупка успешна</b>\n` +
      `Потрачено: ${amountSol} SOL\n` +
      `Токен: <code>${tokenMint}</code>\n` +
      `Влияние на цену: ${priceImpact}%\n` +
      `Tx: <a href="https://solscan.io/tx/${signature}">${signature.slice(0, 8)}...</a>`,
    failed: (reason) => `❌ <b>Покупка не удалась</b>\n${reason}`,
    mintFirst: 'Сначала отправь адрес токена.',
  },

  sell: {
    noBalances: 'У тебя нет токенов для продажи.',
    fetchFailed: (reason) => `❌ Не удалось получить балансы токенов: ${reason}`,
    chooseToken: 'Выбери токен для продажи:',
    tokenInfo: ({ tokenMint, balance }) =>
      `Токен: <code>${tokenMint}</code>\nБаланс: ${balance}\n\nСколько продать?`,
    balanceNotFound: 'Баланс не найден — возможно, он изменился.',
    sessionExpired: 'Сессия истекла, начни заново.',
    nothingToSell: 'Нечего продавать.',
    submitting: '⏳ Ищу маршрут и отправляю своп...',
    success: ({ solReceived, tokenMint, priceImpact, signature }) =>
      `✅ <b>Продажа успешна</b>\n` +
      `Получено: ${solReceived} SOL\n` +
      `Токен: <code>${tokenMint}</code>\n` +
      `Влияние на цену: ${priceImpact}%\n` +
      `Tx: <a href="https://solscan.io/tx/${signature}">${signature.slice(0, 8)}...</a>`,
    failed: (reason) => `❌ <b>Продажа не удалась</b>\n${reason}`,
  },

  reveal: {
    warning:
      '⚠️ <b>Никогда никому не показывай приватный ключ или seed-фразу.</b>\n' +
      'Сейчас будут показаны и приватный ключ, и seed-фраза из 12 слов. ' +
      'Любой, у кого есть хоть одно из этого, получает полный контроль над кошельком. Уверен?',
    confirmButton: '⚠️ Да, показать мой приватный ключ',
    cancelButton: 'Отмена',
    message: ({ privateKey, mnemonic }) =>
      `🔑 <b>Приватный ключ</b> (base58):\n<code>${privateKey}</code>\n\n` +
      `🌱 <b>Seed-фраза</b> (12 слов — можно импортировать в Phantom/Solflare):\n<code>${mnemonic}</code>`,
    deleteNotice: '⚠️ Удали это сообщение после копирования. Любой, у кого есть эти данные, получает полный контроль над кошельком.',
  },

  settings: {
    title: '⚙️ <b>Настройки</b>',
    slippageLabel: (pct) => `Слиппедж: ${pct}%`,
    slippageSet: (pct) => `Слиппедж установлен на ${pct}%`,
  },

  language: {
    prompt: '🌐 Выбери язык:',
    setTo: (name) => `Язык изменён на ${name}`,
  },

  genericError: 'Что-то пошло не так. Попробуй ещё раз.',
};
