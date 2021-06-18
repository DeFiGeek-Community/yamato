/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Signer, utils, Contract, ContractFactory, Overrides } from "ethers";
import { Provider, TransactionRequest } from "@ethersproject/providers";
import type { PriceFeed, PriceFeedInterface } from "../PriceFeed";

const _abi = [
  {
    inputs: [],
    name: "fetchPrice",
    outputs: [
      {
        internalType: "uint256",
        name: "jpyPerETH",
        type: "uint256",
      },
    ],
    stateMutability: "pure",
    type: "function",
  },
];

const _bytecode =
  "0x608060405234801561001057600080fd5b5060b78061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060285760003560e01c80630fdb11cf14602d575b600080fd5b60336047565b604051603e9190605e565b60405180910390f35b6000612b67905090565b6058816077565b82525050565b6000602082019050607160008301846051565b92915050565b600081905091905056fea2646970667358221220e2042e13b59044fefea0fa06472f0515e5098f204adfaae1cacf9c0e44e8c0bb64736f6c63430008030033";

export class PriceFeed__factory extends ContractFactory {
  constructor(signer?: Signer) {
    super(_abi, _bytecode, signer);
  }

  deploy(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<PriceFeed> {
    return super.deploy(overrides || {}) as Promise<PriceFeed>;
  }
  getDeployTransaction(
    overrides?: Overrides & { from?: string | Promise<string> }
  ): TransactionRequest {
    return super.getDeployTransaction(overrides || {});
  }
  attach(address: string): PriceFeed {
    return super.attach(address) as PriceFeed;
  }
  connect(signer: Signer): PriceFeed__factory {
    return super.connect(signer) as PriceFeed__factory;
  }
  static readonly bytecode = _bytecode;
  static readonly abi = _abi;
  static createInterface(): PriceFeedInterface {
    return new utils.Interface(_abi) as PriceFeedInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): PriceFeed {
    return new Contract(address, _abi, signerOrProvider) as PriceFeed;
  }
}
