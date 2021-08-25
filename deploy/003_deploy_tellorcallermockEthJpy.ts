
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
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;

  let signer = getDeployer();

  let _nonce;
  
  _nonce = await signer.getTransactionCount("pending");
  console.log(`_nonce: ${_nonce}`);
  const tellor = await deploy('TellorCallerMock', {
    args: [],
    getContractFactory,
    nonce: _nonce + 3
  }).catch(console.trace)

};
export default func;
func.tags = ['TellorCallerMock'];
