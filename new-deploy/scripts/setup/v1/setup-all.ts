#!/usr/bin/env node
/**
 * Yamato v1.0 完全初期設定スクリプト
 * 
 * 実行順序:
 * 1. Yamato.setDeps()
 * 2. CurrencyOS.addYamato()
 * 3. CJPY.setCurrencyOS() + CJPY.revokeGovernance()
 */

import { execSync } from 'child_process';

const network = process.argv.find((arg) => arg.startsWith('--network='))?.split('=')[1] || 'localhost';

console.log(`\n🔧 Starting Yamato v1.0 setup on ${network}...\n`);
console.log(`${'='.repeat(60)}\n`);

const scripts = [
  { name: 'Yamato.setDeps()', path: './scripts/setup/v1/setup-yamato-deps.ts' },
  { name: 'CurrencyOS.addYamato()', path: './scripts/setup/v1/setup-currencyos-add-yamato.ts' },
  { name: 'CJPY Setup', path: './scripts/setup/v1/setup-cjpy.ts' },
];

let completedCount = 0;
const startTime = Date.now();

for (const script of scripts) {
  console.log(`\n🔧 [${completedCount + 1}/${scripts.length}] Running ${script.name}...`);
  console.log(`${'─'.repeat(60)}`);
  
  try {
    execSync(`npx hardhat run ${script.path} --network ${network}`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    completedCount++;
    console.log(`✅ ${script.name} completed successfully!`);
  } catch (error) {
    console.error(`\n❌ Failed to execute ${script.name}`);
    console.error(`Error: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

const endTime = Date.now();
const duration = ((endTime - startTime) / 1000).toFixed(2);

console.log(`\n${'='.repeat(60)}`);
console.log(`\n🎉 Yamato v1.0 setup completed!`);
console.log(`\n📊 Summary:`);
console.log(`   Total steps completed: ${completedCount}/${scripts.length}`);
console.log(`   Network: ${network}`);
console.log(`   Duration: ${duration}s`);
console.log(`\n✅ Yamato v1.0 is now ready for use!`);
console.log(`\n${'='.repeat(60)}\n`);

