import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { deploy, setProvider, getDeploymentAddressPath } from '@src/deployUtil';
import { readFileSync } from 'fs';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const p = await setProvider();
  const { ethers, deployments } = hre;
  const { getContractFactory } = ethers;

  const _yamatoAddr = readFileSync(getDeploymentAddressPath('Yamato')).toString()
  const PledgeLib = readFileSync(getDeploymentAddressPath('PledgeLib')).toString()


  await deploy('PriorityRegistry', {
    args: [_yamatoAddr],
    getContractFactory,
    deployments,
    linkings: {PledgeLib}
  }).catch(e=> console.trace(e.message) )

};
export default func;
func.tags = ['PriorityRegistry'];
