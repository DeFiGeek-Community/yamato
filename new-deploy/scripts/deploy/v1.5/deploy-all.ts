import { execSync } from 'child_process';

/**
 * v1.5 全コントラクトデプロイ
 * 
 * YMT関連コントラクトを順次デプロイします。
 * 
 * デプロイ順序:
 * 1. YmtVesting
 * 2. YMT
 * 3. veYMT
 * 4. ScoreWeightController
 * 5. YmtMinter
 * 6. ScoreRegistry
 */
async function main() {
  const network = process.env.HARDHAT_NETWORK || 'localhost';
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 Starting v1.5 deployment on ${network}...`);
  console.log(`${'='.repeat(60)}\n`);

  const scripts = [
    { name: 'YmtVesting', path: 'scripts/deploy/v1.5/deploy-ymt-vesting.ts' },
    { name: 'YMT', path: 'scripts/deploy/v1.5/deploy-ymt.ts' },
    { name: 'veYMT', path: 'scripts/deploy/v1.5/deploy-veymt.ts' },
    { name: 'ScoreWeightController', path: 'scripts/deploy/v1.5/deploy-score-weight-controller.ts' },
    { name: 'YmtMinter', path: 'scripts/deploy/v1.5/deploy-ymt-minter.ts' },
    { name: 'ScoreRegistry', path: 'scripts/deploy/v1.5/deploy-score-registry.ts' },
  ];

  let successCount = 0;
  const startTime = Date.now();

  for (const [index, script] of scripts.entries()) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📦 [${index + 1}/${scripts.length}] Deploying ${script.name}...`);
    console.log(`${'─'.repeat(60)}\n`);

    try {
      execSync(`npx hardhat run ${script.path} --network ${network}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      successCount++;
    } catch (error) {
      console.error(`\n❌ Failed to deploy ${script.name}`);
      throw error;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`\n🎉 v1.5 deployment completed!`);
  console.log(`\n📊 Summary:`);
  console.log(`   Network: ${network}`);
  console.log(`   Deployed: ${successCount}/${scripts.length} contracts`);
  console.log(`   Duration: ${duration}s`);
  console.log(`\n📝 Next steps:`);
  console.log(`   1. Run setup: npx hardhat run scripts/setup/v1.5/setup-all.ts --network ${network}`);
  console.log(`   2. Transfer governance (production only)`);
  console.log(`\n${'='.repeat(60)}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });

