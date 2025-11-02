#!/usr/bin/env node
/**
 * Yamato v1.0 完全デプロイスクリプト
 * 
 * 実行順序:
 * 1. PriceFeed
 * 2. CJPY
 * 3. FeePool
 * 4. CurrencyOS
 * 5. Yamato
 * 6. YamatoActions (Depositor, Borrower, Repayer, Withdrawer, Redeemer, Sweeper)
 * 7. Pool
 * 8. PriorityRegistry
 */

import { execSync } from 'child_process';

const network = process.argv.find((arg) => arg.startsWith('--network='))?.split('=')[1] || 'localhost';

console.log(`\n🚀 Starting Yamato v1.0 deployment on ${network}...\n`);
console.log(`${'='.repeat(60)}\n`);

const scripts = [
  { name: 'Mock Oracles', path: './scripts/deploy/v1/deploy-mocks.ts' },
  { name: 'PriceFeed', path: './scripts/deploy/v1/deploy-pricefeed.ts' },
  { name: 'CJPY', path: './scripts/deploy/v1/deploy-cjpy.ts' },
  { name: 'FeePool', path: './scripts/deploy/v1/deploy-feepool.ts' },
  { name: 'CurrencyOS', path: './scripts/deploy/v1/deploy-currencyos.ts' },
  { name: 'Yamato', path: './scripts/deploy/v1/deploy-yamato.ts' },
  { name: 'YamatoDepositor', path: './scripts/deploy/v1/deploy-yamato-depositor.ts' },
  { name: 'YamatoBorrower', path: './scripts/deploy/v1/deploy-yamato-borrower.ts' },
  { name: 'YamatoRepayer', path: './scripts/deploy/v1/deploy-yamato-repayer.ts' },
  { name: 'YamatoWithdrawer', path: './scripts/deploy/v1/deploy-yamato-withdrawer.ts' },
  { name: 'YamatoRedeemer', path: './scripts/deploy/v1/deploy-yamato-redeemer.ts' },
  { name: 'YamatoSweeper', path: './scripts/deploy/v1/deploy-yamato-sweeper.ts' },
  { name: 'Pool', path: './scripts/deploy/v1/deploy-pool.ts' },
  { name: 'PriorityRegistry', path: './scripts/deploy/v1/deploy-priority-registry.ts' },
];

let deployedCount = 0;
const startTime = Date.now();

for (const script of scripts) {
  console.log(`\n📦 [${deployedCount + 1}/${scripts.length}] Deploying ${script.name}...`);
  console.log(`${'─'.repeat(60)}`);
  
  try {
    execSync(`npx tsx ${script.path} --network=${network}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    deployedCount++;
    console.log(`✅ ${script.name} deployed successfully!`);
  } catch (error) {
    console.error(`\n❌ Failed to deploy ${script.name}`);
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

const endTime = Date.now();
const duration = ((endTime - startTime) / 1000).toFixed(2);

console.log(`\n${'='.repeat(60)}`);
console.log(`\n🎉 Yamato v1.0 deployment completed!`);
console.log(`\n📊 Summary:`);
console.log(`   Total contracts deployed: ${deployedCount}/${scripts.length}`);
console.log(`   Network: ${network}`);
console.log(`   Duration: ${duration}s`);
console.log(`\n📝 Next steps:`);
console.log(`   1. Run setup script: npx tsx scripts/setup/v1/setup-all.ts --network=${network}`);
console.log(`   2. Verify deployments in: deployments/${network}/`);
console.log(`\n${'='.repeat(60)}\n`);

