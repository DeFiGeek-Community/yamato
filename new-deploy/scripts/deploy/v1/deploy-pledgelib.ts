import hre from 'hardhat';
import { deployLibrary } from '../../core/contract-deployer-hh';
import type { NetworkName } from '../../core/address-manager';

async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  // PledgeLibをライブラリとしてデプロイ
  const pledgeLibAddress = await deployLibrary({
    name: 'PledgeLib',
    contractName: 'contracts/Dependencies/PledgeLib.sol:PledgeLib',
  });

  console.log(`\n✅ PledgeLib deployed at: ${pledgeLibAddress}`);
  console.log(`\n📝 This library will be linked to:
   - YamatoBorrower
   - YamatoRepayer
   - YamatoWithdrawer
   - YamatoRedeemer
   - YamatoSweeper
   - YamatoDepositor
   - Pool
   - PriorityRegistry\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });

