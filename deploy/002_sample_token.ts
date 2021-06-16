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

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if( !isEmbeddedMode() ) return;
  const { ethers } = hre;
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;
  setProvider();
  const foundation = getFoundation();
  const deployer = getDeployer();

  await deploy('SampleToken', {
    from: deployer,
    args: [parseEther('115792089237316195423570985008687907853269984665640564039457')],
    log: true,
    getContractFactory
  });
};
export default func;
func.tags = ['SampleToken'];