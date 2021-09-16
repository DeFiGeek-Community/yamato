import { waffleJest } from "@ethereum-waffle/jest";
import {BigNumber, Wallet, Contract} from 'ethers';

jest.setTimeout(90000);

expect.extend(waffleJest);

// workaround: https://github.com/EthWorks/Waffle/issues/538
// Copied from `node_modules/@ethereum-waffle/jest/src/types.d.ts`
export type Numberish = number | string | BigNumber;
declare global {
  namespace jest {
    interface Matchers<R> {
      // misc matchers
      toBeProperAddress(): R;
      toBeProperPrivateKey(): R;
      toBeProperHex(length: number): R;

      // BigNumber matchers
      toEqBN(value: Numberish): R;
      toBeGtBN(value: Numberish): R;
      toBeLtBN(value: Numberish): R;
      toBeGteBN(value: Numberish): R;
      toBeLteBN(value: Numberish): R;

      // balance matchers
      toChangeBalance(wallet: Wallet, balanceChange: Numberish): Promise<R>;
      toChangeBalances(wallets: Wallet[], balanceChanges: Numberish[]): Promise<R>;

      // revert matchers
      toBeReverted(): Promise<R>;
      toBeRevertedWith(revertReason: string): Promise<R>;

      // emit matcher
      toHaveEmitted(contract: Contract, eventName: string): Promise<R>;
      toHaveEmittedWith(
        contract: Contract,
        eventName: string,
        expectedArgs: any[]
      ): Promise<R>;

      // calledOnContract matchers
      toBeCalledOnContract(contract: Contract): R;
      toBeCalledOnContractWith(contract: Contract, parameters: any[]): R;
    }
  }
}