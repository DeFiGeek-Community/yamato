
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
  sleep
} from '@src/deployUtil';
import { Wallet } from 'ethers';


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory, Contract, BigNumber, Signer, getSigners } = ethers;

  const chainlinkJpyUsd = await deploy('ChainLinkMock', {
    args: ["JPY/USD"],
    getContractFactory
  }).catch(e=> console.trace(e.message) )

};
export default func;
func.tags = ['ChainLinkMockJpyUsd'];
