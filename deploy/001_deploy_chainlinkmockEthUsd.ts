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
import { Wallet } from 'ethers';


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await setProvider();
  const { ethers, deployments } = hre;
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;

  let signer = getDeployer();

  let _nonce;
  
  _nonce = await signer.getTransactionCount();
  let _nonceP = await signer.getTransactionCount("pending");
  console.log(`_nonce: ${_nonce} _nonceP:${_nonceP}`);
  
  for(var i = 84; i <= _nonceP+1; i++){
    await deploy('ChainLinkMock', { args: ["ETH/USD"], getContractFactory, nonce: i }).catch(e=> console.trace(e.message.substr(0,300)) )
  }

  
  process.exit();


  const chainlinkEthUsd = await deploy('ChainLinkMock', {
    args: ["ETH/USD"],
    getContractFactory,
    nonce: _nonce + 1
  }).catch(console.trace)



};
export default func;
func.tags = ['ChainLinkMockEthUsd'];
