import { execSync } from 'child_process';

/**
 * CEUR 完全デプロイ
 * 
 * CEURに必要な全てのコントラクトをデプロイします。
 * 
 * デプロイ順序:
 * 1. ChainLinkMock (EUR/USD) - localhost環境のみ
 * 2. CEUR トークン
 * 3. PriceFeed (EUR用 - PriceFeedV3)
 * 4. CurrencyOS (CEUR)
 * 5. Yamato (CEUR)
 * 6. Actions (CEUR)
 * 7. Pool (CEUR)
 * 8. PriorityRegistry (CEUR)
 * 9. ScoreRegistry (CEUR)
 * 
 * ⚠️ 注意:
 * - 事前にv1.5までのデプロイが完了している必要があります
 * - YmtOSは別途デプロイしてください
 * - CEURはPriceFeedV3を使用します（Chainlink EUR/USD Oracle）
 * - localhost環境では、ChainLinkMock (EUR/USD) を事前にデプロイします
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 CEUR Full Deployment`);
  console.log(`🌐 Network: ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    'scripts/deploy/v1/deploy-mocks.ts', // ChainLinkMock (EUR/USD) をデプロイ
    'scripts/deploy/v2/deploy-ceur.ts',
    'scripts/deploy/v2/deploy-pricefeed-eur.ts', // PriceFeedV3 (CEUR用)
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
      
      // deploy-mocks.tsは通貨パラメータ不要、その他はCURRENCY=CEURを指定
      const envVars = scripts[i].includes('deploy-mocks.ts') 
        ? '' 
        : 'CURRENCY=CEUR ';
      
      execSync(`${envVars}npx hardhat run ${scripts[i]} --network ${network}`, {
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

