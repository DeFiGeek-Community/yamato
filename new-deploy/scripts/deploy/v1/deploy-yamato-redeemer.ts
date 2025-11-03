import hre from 'hardhat';
import type { Address } from 'viem';
import { deployUUPS } from '../../core/uups-deployer';
import { loadAddress, loadProxyAddress, type NetworkName } from '../../core/address-manager';
import { V1_CONTRACTS, requiresPledgeLib, CONTRACT_NAMES } from '../../core/contract-definitions';

/**
 * YamatoRedeemer デプロイ
 * 
 * CJPYを償還（ETHと交換）するアクションコントラクトです。
 * PledgeLibをリンクします。
 */
async function main() {
  const network = hre.network.name as NetworkName;
  console.log(`\n🌐 Network: ${network}\n`);

  console.log('📖 Loading dependencies...');
  const yamatoAddr = loadProxyAddress(network, CONTRACT_NAMES.Yamato);
  const pledgeLibAddr = loadAddress(network, V1_CONTRACTS.PledgeLib);
  console.log(`   Yamato: ${yamatoAddr}`);
  console.log(`   PledgeLib: ${pledgeLibAddr}`);
  console.log('✅ Dependencies loaded\n');

  const needsLibrary = requiresPledgeLib(V1_CONTRACTS.YamatoRedeemer, 'v1');

  const result = await deployUUPS({
    name: CONTRACT_NAMES.YamatoRedeemer,
    contractName: V1_CONTRACTS.YamatoRedeemer,
    initFunction: 'initialize',
    initArgs: [yamatoAddr],
    libraries: needsLibrary ? {
      'contracts/Dependencies/PledgeLib.sol:PledgeLib': pledgeLibAddr as `0x${string}`,
    } : undefined,
  });

  console.log(`\n✅ YamatoRedeemer deployed!`);
  console.log(`   Implementation: ${result.implAddress}`);
  console.log(`   Proxy: ${result.proxyAddress}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
