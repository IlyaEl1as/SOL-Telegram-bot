export type LanguageCode = 'en' | 'ru';

export interface Locale {
  code: LanguageCode;
  name: string; // shown in the language picker, e.g. "English"
  flag: string;

  mainMenu(params: { publicKey: string; balance: string; slippagePct: string }): string;

  buttons: {
    balance: string;
    revealKey: string;
    buy: string;
    sell: string;
    settings: string;
    refresh: string;
    back: string;
    cancel: string;
    customAmount: string;
    language: string;
  };

  help: string;

  buy: {
    askMint: string;
    invalidMint: string;
    askAmount(tokenMint: string): string;
    askCustomAmount: string;
    invalidAmount: string;
    submitting: string;
    success(params: { amountSol: string; tokenMint: string; priceImpact: string; signature: string }): string;
    failed(reason: string): string;
    mintFirst: string;
  };

  sell: {
    noBalances: string;
    fetchFailed(reason: string): string;
    chooseToken: string;
    tokenInfo(params: { tokenMint: string; balance: string }): string;
    balanceNotFound: string;
    sessionExpired: string;
    nothingToSell: string;
    submitting: string;
    success(params: { solReceived: string; tokenMint: string; priceImpact: string; signature: string }): string;
    failed(reason: string): string;
  };

  reveal: {
    warning: string;
    confirmButton: string;
    cancelButton: string;
    message(params: { privateKey: string; mnemonic: string }): string;
    deleteNotice: string;
  };

  settings: {
    title: string;
    slippageLabel(pct: string): string;
    slippageSet(pct: string): string;
  };

  language: {
    prompt: string;
    setTo(name: string): string;
  };

  genericError: string;
}
