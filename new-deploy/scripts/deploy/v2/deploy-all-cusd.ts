import { execSync } from 'child_process';

/**
 * CUSD 完全デプロイ
 * 
 * CUSDに必要な全てのコントラクトをデプロイします。
 * 
 * デプロイ順序:
 * 1. CUSD トークン
 * 2. PriceFeedSingle (USD用)
 * 3. CurrencyOS (CUSD)
 * 4. Yamato (CUSD)
 * 5. Actions (CUSD)
 * 6. Pool (CUSD)
 * 7. PriorityRegistry (CUSD)
 * 8. ScoreRegistry (CUSD)
 * 
 * ⚠️ 注意:
 * - 事前にv1.5までのデプロイが完了している必要があります
 * - YmtOSは別途デプロイしてください
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 CUSD Full Deployment`);
  console.log(`🌐 Network: ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    'scripts/deploy/v2/deploy-cusd.ts',
    'scripts/deploy/v2/deploy-pricefeed-single.ts',
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
      
      execSync(`CURRENCY=CUSD npx hardhat run ${scripts[i]} --network ${network}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
    } catch (error) {
      console.error(`\n❌ Failed at step ${i + 1}: ${scripts[i]}`);
      throw error;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ CUSD deployment completed successfully!`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Deployment failed:', error);
    process.exit(1);
  });

