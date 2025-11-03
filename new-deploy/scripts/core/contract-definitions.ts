/**
 * Yamato コントラクト定義
 * 
 * 各バージョンで使用するコントラクト名を一元管理します。
 * これにより、コントラクト名の変更や追加が容易になり、
 * 型安全性も確保されます。
 */

// ============================================================================
// v1.0 コントラクト定義
// ============================================================================

export const V1_CONTRACTS = {
  // 非UUPSコントラクト
  CJPY: 'CJPY',
  
  // UUPSコントラクト（実装バージョン）
  PriceFeed: 'PriceFeedV3',
  FeePool: 'FeePool',
  CurrencyOS: 'CurrencyOSV2',
  Yamato: 'YamatoV3',
  YamatoDepositor: 'YamatoDepositorV2',
  YamatoBorrower: 'YamatoBorrower',
  YamatoRepayer: 'YamatoRepayerV2',
  YamatoWithdrawer: 'YamatoWithdrawerV2',
  YamatoRedeemer: 'YamatoRedeemerV4',
  YamatoSweeper: 'YamatoSweeperV2',
  Pool: 'PoolV2',
  PriorityRegistry: 'PriorityRegistryV6',
  
  // ライブラリ
  PledgeLib: 'PledgeLib',
  
  // モック（テスト用）
  ChainLinkMock: 'ChainLinkMock',
} as const;

// v1.0でライブラリリンクが必要なコントラクト
export const V1_CONTRACTS_WITH_PLEDGELIB = [
  'YamatoBorrower',
  'YamatoWithdrawerV2',
  'YamatoRedeemerV4',
  'YamatoSweeperV2',
  'PriorityRegistryV6',
] as const;

// ============================================================================
// v1.5 コントラクト定義
// ============================================================================

export const V1_5_CONTRACTS = {
  // 新規追加（非UUPS）
  YMT: 'YMT',
  veYMT: 'veYMT',
  YmtVesting: 'YmtVesting',
  
  // 新規追加（UUPS）
  YmtMinter: 'YmtMinter',
  ScoreWeightController: 'ScoreWeightController',
  ScoreRegistry: 'ScoreRegistry',
} as const;

// v1.5でアップグレードされるコントラクト（新実装バージョン）
export const V1_5_UPGRADE_IMPLEMENTATIONS = {
  YamatoRepayer: 'YamatoRepayerV3',
  YamatoRedeemer: 'YamatoRedeemerV5',
  YamatoWithdrawer: 'YamatoWithdrawerV3',
  YamatoSweeper: 'YamatoSweeperV3',
  YamatoDepositor: 'YamatoDepositorV3',
  YamatoBorrower: 'YamatoBorrowerV2',
  CurrencyOS: 'CurrencyOSV3',
  Yamato: 'YamatoV4',
  FeePool: 'FeePoolV2',
} as const;

// v1.5アップグレード後のプロキシコントラクト名（現在のバージョン）
export const V1_5_UPGRADE_PROXIES = {
  YamatoRepayer: 'YamatoRepayerV2',
  YamatoRedeemer: 'YamatoRedeemerV4',
  YamatoWithdrawer: 'YamatoWithdrawerV2',
  YamatoSweeper: 'YamatoSweeperV2',
  YamatoDepositor: 'YamatoDepositorV2',
  YamatoBorrower: 'YamatoBorrower',
  CurrencyOS: 'CurrencyOSV2',
  Yamato: 'YamatoV3',
  FeePool: 'FeePool',
} as const;

// v1.5でライブラリリンクが必要なコントラクト
export const V1_5_UPGRADE_CONTRACTS_WITH_PLEDGELIB = [
  'YamatoRepayerV3',
  'YamatoRedeemerV5',
  'YamatoWithdrawerV3',
  'YamatoSweeperV3',
  'YamatoDepositorV3',
  'YamatoBorrowerV2',
] as const;

export const V1_5_NEW_CONTRACTS_WITH_PLEDGELIB = [
  'ScoreRegistry',
] as const;

// ============================================================================
// v2.0 コントラクト定義
// ============================================================================

export const V2_CONTRACTS = {
  // 新規追加（非UUPS）
  CUSD: 'CUSD',
  CEUR: 'CEUR',
  
  // 新規追加（UUPS）
  YmtOS: 'YmtOS',
  PriceFeedSingle: 'PriceFeedSingle',
} as const;

// v2.0でアップグレードされるコントラクト（新実装バージョン）
export const V2_UPGRADE_IMPLEMENTATIONS = {
  CurrencyOS: 'CurrencyOSV4', // CJPYのCurrencyOSのみ
  ScoreWeightController: 'ScoreWeightControllerV2',
} as const;

// v2.0アップグレード前のプロキシコントラクト名
export const V2_UPGRADE_PROXIES = {
  CurrencyOS: 'CurrencyOSV3',
  ScoreWeightController: 'ScoreWeightController',
} as const;

// v2.0通貨別デプロイで使用するコントラクト（最新バージョン）
export const V2_CURRENCY_CONTRACTS = {
  // 通貨トークン（動的に決定）
  Currency: 'CurrencyV2', // CUSD/CEURの基底クラス
  
  // PriceFeed（通貨によって異なる）
  PriceFeedV3: 'PriceFeedV3', // CJPY/CEUR用
  PriceFeedSingle: 'PriceFeedSingle', // CUSD用
  
  // 通貨別UUPSコントラクト（v1.5アップグレード後の最新バージョン）
  CurrencyOS: 'CurrencyOSV4',
  Yamato: 'YamatoV4',
  YamatoDepositor: 'YamatoDepositorV3',
  YamatoBorrower: 'YamatoBorrowerV2',
  YamatoRepayer: 'YamatoRepayerV3',
  YamatoWithdrawer: 'YamatoWithdrawerV3',
  YamatoRedeemer: 'YamatoRedeemerV5',
  YamatoSweeper: 'YamatoSweeperV3',
  Pool: 'PoolV2',
  PriorityRegistry: 'PriorityRegistryV6',
  ScoreRegistry: 'ScoreRegistry',
} as const;

// v2.0通貨別デプロイでライブラリリンクが必要なコントラクト
export const V2_CURRENCY_CONTRACTS_WITH_PLEDGELIB = [
  'YamatoDepositorV3',
  'YamatoBorrowerV2',
  'YamatoRepayerV3',
  'YamatoWithdrawerV3',
  'YamatoRedeemerV5',
  'YamatoSweeperV3',
  'PriorityRegistryV6',
  'ScoreRegistry',
] as const;

// ============================================================================
// ヘルパー関数
// ============================================================================

/**
 * コントラクトがPledgeLibリンクを必要とするかチェック
 */
export function requiresPledgeLib(contractName: string, version: 'v1' | 'v1.5' | 'v2'): boolean {
  switch (version) {
    case 'v1':
      return V1_CONTRACTS_WITH_PLEDGELIB.includes(contractName as any);
    case 'v1.5':
      return V1_5_UPGRADE_CONTRACTS_WITH_PLEDGELIB.includes(contractName as any) ||
             V1_5_NEW_CONTRACTS_WITH_PLEDGELIB.includes(contractName as any);
    case 'v2':
      return V2_CURRENCY_CONTRACTS_WITH_PLEDGELIB.includes(contractName as any);
    default:
      return false;
  }
}

/**
 * v1.5アップグレード対象コントラクトの情報を取得
 */
export function getV1_5UpgradeInfo(contractName: keyof typeof V1_5_UPGRADE_IMPLEMENTATIONS) {
  return {
    newImplementation: V1_5_UPGRADE_IMPLEMENTATIONS[contractName],
    currentProxy: V1_5_UPGRADE_PROXIES[contractName],
    requiresPledgeLib: requiresPledgeLib(V1_5_UPGRADE_IMPLEMENTATIONS[contractName], 'v1.5'),
  };
}

/**
 * v2.0アップグレード対象コントラクトの情報を取得
 */
export function getV2UpgradeInfo(contractName: keyof typeof V2_UPGRADE_IMPLEMENTATIONS) {
  return {
    newImplementation: V2_UPGRADE_IMPLEMENTATIONS[contractName],
    currentProxy: V2_UPGRADE_PROXIES[contractName],
  };
}

/**
 * 全バージョンのコントラクト定義をエクスポート
 */
export const CONTRACT_DEFINITIONS = {
  v1: V1_CONTRACTS,
  v1_5: {
    new: V1_5_CONTRACTS,
    upgrades: V1_5_UPGRADE_IMPLEMENTATIONS,
  },
  v2: {
    new: V2_CONTRACTS,
    upgrades: V2_UPGRADE_IMPLEMENTATIONS,
    currency: V2_CURRENCY_CONTRACTS,
  },
} as const;

// ============================================================================
// 型定義
// ============================================================================

export type V1ContractName = typeof V1_CONTRACTS[keyof typeof V1_CONTRACTS];
export type V1_5ContractName = typeof V1_5_CONTRACTS[keyof typeof V1_5_CONTRACTS];
export type V1_5UpgradeContractName = typeof V1_5_UPGRADE_IMPLEMENTATIONS[keyof typeof V1_5_UPGRADE_IMPLEMENTATIONS];
export type V2ContractName = typeof V2_CONTRACTS[keyof typeof V2_CONTRACTS];
export type V2UpgradeContractName = typeof V2_UPGRADE_IMPLEMENTATIONS[keyof typeof V2_UPGRADE_IMPLEMENTATIONS];
export type V2CurrencyContractName = typeof V2_CURRENCY_CONTRACTS[keyof typeof V2_CURRENCY_CONTRACTS];

export type ContractName = 
  | V1ContractName 
  | V1_5ContractName 
  | V1_5UpgradeContractName 
  | V2ContractName 
  | V2UpgradeContractName 
  | V2CurrencyContractName;

