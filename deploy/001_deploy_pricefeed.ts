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

const ChainLinkEthUsd = "0x81CE5a8399e49dCF8a0ce2c0A0C7015bb1F042bC"
const ChainLinkJpyUsd = "0x6C4e3804ddFE3be631b6DdF232025AC760765279"
const TellorEthJpy = "0x5b46654612f6Ff6510147b00B96FeB8E4AA93FF6"

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  await setProvider();
  const { ethers } = hre;
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;
  const signers = ethers.getSigners();
 
  const factory = await deploy('PriceFeed', {
    from: signers[0],
    args: [ChainLinkEthUsd, ChainLinkJpyUsd, TellorEthJpy],
    log: true,
    getContractFactory
  });
};
export default func;
func.tags = ['PriceFeed'];
