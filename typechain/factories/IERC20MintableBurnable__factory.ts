/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { Contract, Signer, utils } from "ethers";
import { Provider } from "@ethersproject/providers";
import type {
  IERC20MintableBurnable,
  IERC20MintableBurnableInterface,
} from "../IERC20MintableBurnable";

const _abi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "account",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "burnFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256",
      },
    ],
    name: "transfer",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

export class IERC20MintableBurnable__factory {
  static readonly abi = _abi;
  static createInterface(): IERC20MintableBurnableInterface {
    return new utils.Interface(_abi) as IERC20MintableBurnableInterface;
  }
  static connect(
    address: string,
    signerOrProvider: Signer | Provider
  ): IERC20MintableBurnable {
    return new Contract(
      address,
      _abi,
      signerOrProvider
    ) as IERC20MintableBurnable;
  }
}
