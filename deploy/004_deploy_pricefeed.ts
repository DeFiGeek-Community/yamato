import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { readFileSync } from 'fs';
import { deploy, getFoundation, setProvider, getDeploymentAddressPath, getDeploymentAddressPathWithTag } from '@src/deployUtil';
import { genABI } from '@src/genABI';
import { Contract } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const ChainLinkEthUsd = readFileSync(getDeploymentAddressPathWithTag('ChainLinkMock', 'EthUsd')).toString()
  const ChainLinkJpyUsd = readFileSync(getDeploymentAddressPathWithTag('ChainLinkMock', 'JpyUsd')).toString()
  const TellorEthJpy = readFileSync(getDeploymentAddressPath('TellorCallerMock')).toString()

  const chainlinkEthUsd = new Contract(
    ChainLinkEthUsd,
    genABI("ChainLinkMock"),
    p
  );
  const chainlinkJpyUsd = new Contract(
    ChainLinkJpyUsd,
    genABI("ChainLinkMock"),
    p
  );

  await (await chainlinkEthUsd.connect(getFoundation()).simulatePriceMove({gasLimit: 200000})).wait()
  await (await chainlinkJpyUsd.connect(getFoundation()).simulatePriceMove({gasLimit: 200000})).wait()
  await (await chainlinkEthUsd.connect(getFoundation()).simulatePriceMove({gasLimit: 200000})).wait()
  await (await chainlinkJpyUsd.connect(getFoundation()).simulatePriceMove({gasLimit: 200000})).wait()

  await deploy('PriceFeed', {
    args: [ChainLinkEthUsd, ChainLinkJpyUsd, TellorEthJpy],
    getContractFactory,
    deployments,
  }).catch((e) => console.trace(e.message));
};
export default func;
func.tags = ["PriceFeed"];
