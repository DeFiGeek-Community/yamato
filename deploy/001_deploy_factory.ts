import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import {parseEther} from 'ethers/lib/utils';
import {
  deploy,
  goToEmbededMode,
  hardcodeFactoryAddress,
  singletonProvider,
  getFoundation,
  getDeployer,
  extractEmbeddedFactoryAddress,
  recoverFactoryAddress,
  setProvider,
  isInitMode,
  isEmbeddedMode,
  backToInitMode,
} from '@src/deployUtil';
import {Wallet} from 'ethers';


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if( !isInitMode() ) return;
  const { ethers } = hre;
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;
  setProvider();
  const foundation = getFoundation();
  const deployer = getDeployer();

  const factory = await deploy('Factory', {
    from: foundation,
    args: [(<Wallet>foundation).address],
    log: true,
    getContractFactory
  });

  goToEmbededMode();
  hardcodeFactoryAddress("BulksaleV1", factory.address);
  hardcodeFactoryAddress("OwnableToken", factory.address);

  console.log("\nPlanned checkpoint. You can continue by running the same command again.\n");
  process.exit(0);
};
export default func;
func.tags = ['Factory'];
