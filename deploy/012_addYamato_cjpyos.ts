import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { setProvider, getDeploymentAddressPath } from '@src/deployUtil';
import { readFileSync } from 'fs';
import { genABI } from '@src/genABI';
import { Contract } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _cjpyosAddr = readFileSync(getDeploymentAddressPath('CjpyOS')).toString()
  const CjpyOS = new Contract(_cjpyosAddr, genABI("CjpyOS"), p);

  const _yamatoAddr = readFileSync(getDeploymentAddressPath('Yamato')).toString()
  await (await CjpyOS.addYamato(_yamatoAddr)).wait()
};
export default func;
func.tags = [''];
