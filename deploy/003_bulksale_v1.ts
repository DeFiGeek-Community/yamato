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
import { addTemplate } from '@src/addTemplate';
import {
    getSaleTemplateKey,
    setSaleTemplateKey,
    cloneTokenAndSale,
} from '@src/cloneTester';


const codename = "BulksaleV1";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if( !isEmbeddedMode() ) return;
  const { ethers } = hre;
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;
  setProvider();
   const foundation = getFoundation();
  const deployer = getDeployer();

  console.log(`${codename} is deploying with factory=${extractEmbeddedFactoryAddress(codename)}...`);
  const BulksaleV1 = await deploy(codename, {
    from: foundation,
    args: [],
    log: true,
    getContractFactory
  });

  try {
    const saleTemplateKey = await addTemplate(
      codename,
      extractEmbeddedFactoryAddress(codename),
      BulksaleV1.address
    );
    setSaleTemplateKey(saleTemplateKey);
  } catch (e) {
    console.trace(e.message);
    recoverFactoryAddress(codename);
    recoverFactoryAddress("OwnableToken");
    backToInitMode();
  }

};
export default func;
func.tags = [codename];