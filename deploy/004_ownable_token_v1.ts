import { BigNumber, Wallet, Contract } from 'ethers';
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


const codename = "OwnableToken";


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  if( !isEmbeddedMode() ) return;
  const { ethers } = hre;
  const {
    getContractFactory, Contract, BigNumber, Signer, getSigners,
  } = ethers;
  setProvider();
  const foundation = getFoundation();
  const deployer = getDeployer();
  const factoryAddr = extractEmbeddedFactoryAddress(codename);

  console.log(`${codename} is deploying with factory=${factoryAddr}...`);
  const OwnableTokenV1 = await deploy(codename, {
    from: foundation,
    args: [],
    log: true,
    getContractFactory
  });

  let _tokenTemplateKey:string|undefined;
  try {
    _tokenTemplateKey = await addTemplate(
      codename,
      factoryAddr,
      OwnableTokenV1.address
    );
  } catch (e) {
    console.trace(e.message);
  }

  try {
    await cloneTokenAndSale(factoryAddr, _tokenTemplateKey);
  } catch (e) {
    console.trace(e.message);
  } finally {
    recoverFactoryAddress("BulksaleV1");
    recoverFactoryAddress(codename);
    backToInitMode();
  }
};
export default func;
func.tags = [codename];