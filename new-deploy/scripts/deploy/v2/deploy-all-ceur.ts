import { execSync } from 'child_process';

/**
 * CEUR 完全デプロイ
 * 
 * CEURに必要な全てのコントラクトをデプロイします。
 * 
 * デプロイ順序:
 * 1. CEUR トークン
 * 2. PriceFeed (EUR用 - PriceFeedV3)
 * 3. CurrencyOS (CEUR)
 * 4. Yamato (CEUR)
 * 5. Actions (CEUR)
 * 6. Pool (CEUR)
 * 7. PriorityRegistry (CEUR)
 * 8. ScoreRegistry (CEUR)
 * 
 * ⚠️ 注意:
 * - 事前にv1.5までのデプロイが完了している必要があります
 * - YmtOSは別途デプロイしてください
 * - CEURはPriceFeedV3を使用します（Chainlink EUR/USD Oracle）
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 CEUR Full Deployment`);
  console.log(`🌐 Network: ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    'scripts/deploy/v2/deploy-ceur.ts',
    'scripts/deploy/v1/deploy-pricefeed.ts', // PriceFeedV3を使用
    'scripts/deploy/v2/deploy-currency-currencyos.ts',
    'scripts/deploy/v2/deploy-currency-yamato.ts',
    'scripts/deploy/v2/deploy-currency-actions.ts',
    'scripts/deploy/v2/deploy-currency-pool.ts',
    'scripts/deploy/v2/deploy-currency-priority-registry.ts',
    'scripts/deploy/v2/deploy-currency-score-registry.ts',
  ];

  for (let i = 0; i < scripts.length; i++) {
    try {
      console.log(`\n📍 Step ${i + 1}/${scripts.length}: ${scripts[i]}`);
      console.log(`${'─'.repeat(60)}\n`);
      
      execSync(`CURRENCY=CEUR npx hardhat run ${scripts[i]} --network ${network}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (error) {
      console.error(`\n❌ Failed at step ${i + 1}: ${scripts[i]}`);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ CEUR deployment completed successfully!`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

