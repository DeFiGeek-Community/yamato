import { execSync } from 'child_process';

/**
 * CUSD 完全セットアップ
 * 
 * CUSDデプロイ後の初期設定を実行します。
 * 
 * セットアップ順序:
 * 1. Yamato.setDeps()
 * 2. CurrencyOS.addYamato()
 * 3. CurrencyOS.setYmtOS()
 * 4. CUSD.setCurrencyOS() + CUSD.revokeGovernance()
 * 5. YmtOS.addCurrencyOS()
 * 6. Yamato.setScoreRegistry()
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⚙️  CUSD Setup`);
  console.log(`🌐 Network: ${network}`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    'scripts/setup/v2/setup-currency-yamato-deps.ts',
    'scripts/setup/v2/setup-currency-currencyos-add-yamato.ts',
    'scripts/setup/v2/setup-currency-currencyos-set-ymtos.ts',
    'scripts/setup/v2/setup-currency-token.ts',
    'scripts/setup/v2/setup-ymtos-add-currencyos.ts',
    'scripts/setup/v2/setup-currency-yamato-score-registry.ts',
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
  console.log(`✅ CUSD setup completed successfully!`);
  console.log(`${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });

