import { execSync } from 'child_process';

/**
 * v1.5 全初期設定実行
 * 
 * YMT関連コントラクトの初期設定を順次実行します。
 * 
 * 実行順序:
 * 1. YmtVesting.setYmtToken()
 * 2. YMT.setMinter()
 * 3. ScoreWeightController.addScore()
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⚙️  Starting v1.5 setup on ${network}...`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    { name: 'YmtVesting.setYmtToken()', path: 'scripts/setup/v1.5/setup-ymt-vesting.ts' },
    { name: 'YMT.setMinter()', path: 'scripts/setup/v1.5/setup-ymt-minter.ts' },
    { name: 'ScoreWeightController.addScore()', path: 'scripts/setup/v1.5/setup-score-weight-controller.ts' },
  ];

  let successCount = 0;
  const startTime = Date.now();

  for (const [index, script] of scripts.entries()) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`⚙️  [${index + 1}/${scripts.length}] Executing ${script.name}...`);
    console.log(`${'─'.repeat(60)}\n`);

    try {
      execSync(`npx hardhat run ${script.path} --network ${network}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed to execute ${script.name}`);
      throw error;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n🎉 v1.5 setup completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Network: ${network}`);
  console.log(`   Executed: ${successCount}/${scripts.length} setup functions`);
  console.log(`   Duration: ${duration}s`);
  console.log(`\n📝 Next steps (production only):`);
  console.log(`   1. Transfer governance: npx hardhat run scripts/governance/v1.5-transfer-governance.ts --network ${network}`);
  console.log(`   2. Accept governance: npx hardhat run scripts/governance/v1.5-accept-governance.ts --network ${network}`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  });

