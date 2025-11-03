import { execSync } from 'child_process';

/**
 * v1.5 アップグレード - 全実行
 * 
 * v1.0からv1.5へのアップグレードを実行します。
 * 
 * 手順:
 * 1. 新しい実装コントラクトをデプロイ
 * 2. プロキシをアップグレード (upgradeTo)
 * 3. アップグレード後の初期設定
 * 
 * ⚠️ 注意:
 * - 本番環境ではマルチシグの承認が必要です
 * - ローカル環境でのテスト後に実行してください
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 Starting v1.5 upgrade on ${network}...`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    { 
      name: 'Deploy New Implementations', 
      path: 'scripts/upgrade/v1.5/deploy-implementations.ts',
      description: '新しい実装コントラクトをデプロイ'
    },
    { 
      name: 'Upgrade Proxies', 
      path: 'scripts/upgrade/v1.5/upgrade-proxies.ts',
      description: 'プロキシを新しい実装にアップグレード'
    },
    { 
      name: 'Post-Upgrade Setup', 
      path: 'scripts/upgrade/v1.5/post-upgrade-setup.ts',
      description: 'アップグレード後の初期設定'
    },
  ];

  let successCount = 0;
  const startTime = Date.now();

  for (const [index, script] of scripts.entries()) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`🔄 [${index + 1}/${scripts.length}] ${script.name}`);
    console.log(`   ${script.description}`);
    console.log(`${'─'.repeat(60)}\n`);

    try {
      execSync(`npx hardhat run ${script.path} --network ${network}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed: ${script.name}`);
      throw error;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n🎉 v1.5 upgrade completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Network: ${network}`);
  console.log(`   Steps completed: ${successCount}/${scripts.length}`);
  console.log(`   Duration: ${duration}s`);
  console.log(`\n📝 Upgraded contracts:`);
  console.log(`   - YamatoRepayer: V2 → V3 (upgradeTo)`);
  console.log(`   - YamatoRedeemer: V4 → V5 (upgradeTo)`);
  console.log(`   - YamatoWithdrawer: V2 → V3 (upgradeTo)`);
  console.log(`   - YamatoSweeper: V2 → V3 (upgradeTo)`);
  console.log(`   - YamatoDepositor: V2 → V3 (upgradeTo)`);
  console.log(`   - YamatoBorrower: V1 → V2 (upgradeTo)`);
  console.log(`   - CurrencyOS: V2 → V3 (upgradeTo)`);
  console.log(`   - Yamato: V3 → V4 (upgradeTo)`);
  console.log(`   - FeePool: V1 → V2 (upgradeToAndCall + initializeV2)`);
  console.log(`\n⚠️  Important:`);
  console.log(`   - Verify all contracts on Etherscan`);
  console.log(`   - Test thoroughly before production use`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Upgrade failed:', error);
    process.exit(1);
  });

