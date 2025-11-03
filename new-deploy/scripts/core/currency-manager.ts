/**
 * 通貨管理ユーティリティ
 * 
 * v2.0のマルチカレンシー対応で、CURRENCY環境変数を使用して
 * 通貨別のアドレスを管理します。
 */

export type Currency = 'CJPY' | 'CUSD' | 'CEUR';

/**
 * 環境変数からCURRENCYを取得
 * 設定されていない場合はエラー
 */
export function getCurrency(): Currency {
  const currency = process.env.CURRENCY;
  
  if (!currency) {
    throw new Error('CURRENCY environment variable is not set. Please set CURRENCY=CJPY, CUSD, or CEUR');
  }
  
  if (currency !== 'CJPY' && currency !== 'CUSD' && currency !== 'CEUR') {
    throw new Error(`Invalid CURRENCY: ${currency}. Must be CJPY, CUSD, or CEUR`);
  }
  
  return currency as Currency;
}

/**
 * 通貨別のコントラクト名にサフィックスを追加
 * 例: Yamato + CUSD → Yamato_CUSD
 */
export function getCurrencyContractName(baseName: string, currency: Currency): string {
  return `${baseName}_${currency}`;
}

/**
 * 通貨情報を取得
 */
export function getCurrencyInfo(currency: Currency): {
  name: string;
  symbol: string;
  contractName: string;
} {
  switch (currency) {
    case 'CJPY':
      return {
        name: 'Convertible JPY Token',
        symbol: 'CJPY',
        contractName: 'CJPY',
      };
    case 'CUSD':
      return {
        name: 'Convertible USD Token',
        symbol: 'CUSD',
        contractName: 'CUSD',
      };
    case 'CEUR':
      return {
        name: 'Convertible EUR Token',
        symbol: 'CEUR',
        contractName: 'CEUR',
      };
  }
}

/**
 * 通貨別のPriceFeedコントラクト名（CONTRACT_NAMESの値）を取得
 * 
 * アドレス管理でのコントラクト名を返します。
 * - CUSD: 'PriceFeedSingle'
 * - CJPY/CEUR: 'PriceFeed'
 */
export function getPriceFeedContractName(currency: Currency): string {
  // CUSDはPriceFeedSingleを使用、CJPY/CEURはPriceFeedを使用
  return currency === 'CUSD' ? 'PriceFeedSingle' : 'PriceFeed';
}

