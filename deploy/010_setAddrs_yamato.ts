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

  const _yamatoAddr = readFileSync(getDeploymentAddressPath('Yamato')).toString()
  const Yamato = new Contract(_yamatoAddr, genABI("Yamato"), p);


  const _poolAddr = readFileSync(getDeploymentAddressPath('Pool')).toString()
  const _priorityRegistryAddr = readFileSync(getDeploymentAddressPath('PriorityRegistry')).toString()
  await (await Yamato.setPool(_poolAddr)).wait()
  await (await Yamato.setPriorityRegistry(_priorityRegistryAddr)).wait()

};
export default func;
func.tags = [''];
