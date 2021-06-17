/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  ethers,
  EventFilter,
  Signer,
  BigNumber,
  BigNumberish,
  PopulatedTransaction,
  BaseContract,
  ContractTransaction,
  Overrides,
  CallOverrides,
} from "ethers";
import { BytesLike } from "@ethersproject/bytes";
import { Listener, Provider } from "@ethersproject/providers";
import { FunctionFragment, EventFragment, Result } from "@ethersproject/abi";
import { TypedEventFilter, TypedEvent, TypedListener } from "./commons";

interface PoolInterface extends ethers.utils.Interface {
  functions: {
    "accumulateDividendReserve(uint256)": FunctionFragment;
    "debtCancelReserve()": FunctionFragment;
    "depositDebtCancelReserve(uint256)": FunctionFragment;
    "depositRedemptionReserve(uint256)": FunctionFragment;
    "dividendReserve()": FunctionFragment;
    "lockETH(uint256)": FunctionFragment;
    "lockedCollateral()": FunctionFragment;
    "redemptionReserve()": FunctionFragment;
    "sendETH(address,uint256)": FunctionFragment;
    "useDebtCancelReserve(uint256)": FunctionFragment;
    "useRedemptionReserve(uint256)": FunctionFragment;
    "withdrawDividendReserve(uint256)": FunctionFragment;
  };

  encodeFunctionData(
    functionFragment: "accumulateDividendReserve",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "debtCancelReserve",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "depositDebtCancelReserve",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "depositRedemptionReserve",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "dividendReserve",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "lockETH",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "lockedCollateral",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "redemptionReserve",
    values?: undefined
  ): string;
  encodeFunctionData(
    functionFragment: "sendETH",
    values: [string, BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "useDebtCancelReserve",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "useRedemptionReserve",
    values: [BigNumberish]
  ): string;
  encodeFunctionData(
    functionFragment: "withdrawDividendReserve",
    values: [BigNumberish]
  ): string;

  decodeFunctionResult(
    functionFragment: "accumulateDividendReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "debtCancelReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "depositDebtCancelReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "depositRedemptionReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "dividendReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "lockETH", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "lockedCollateral",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "redemptionReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(functionFragment: "sendETH", data: BytesLike): Result;
  decodeFunctionResult(
    functionFragment: "useDebtCancelReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "useRedemptionReserve",
    data: BytesLike
  ): Result;
  decodeFunctionResult(
    functionFragment: "withdrawDividendReserve",
    data: BytesLike
  ): Result;

  events: {
    "Received(address,uint256)": EventFragment;
  };

  getEvent(nameOrSignatureOrTopic: "Received"): EventFragment;
}

export class Pool extends BaseContract {
  connect(signerOrProvider: Signer | Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;

  listeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter?: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): Array<TypedListener<EventArgsArray, EventArgsObject>>;
  off<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  on<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  once<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeListener<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>,
    listener: TypedListener<EventArgsArray, EventArgsObject>
  ): this;
  removeAllListeners<EventArgsArray extends Array<any>, EventArgsObject>(
    eventFilter: TypedEventFilter<EventArgsArray, EventArgsObject>
  ): this;

  listeners(eventName?: string): Array<Listener>;
  off(eventName: string, listener: Listener): this;
  on(eventName: string, listener: Listener): this;
  once(eventName: string, listener: Listener): this;
  removeListener(eventName: string, listener: Listener): this;
  removeAllListeners(eventName?: string): this;

  queryFilter<EventArgsArray extends Array<any>, EventArgsObject>(
    event: TypedEventFilter<EventArgsArray, EventArgsObject>,
    fromBlockOrBlockhash?: string | number | undefined,
    toBlock?: string | number | undefined
  ): Promise<Array<TypedEvent<EventArgsArray & EventArgsObject>>>;

  interface: PoolInterface;

  functions: {
    accumulateDividendReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    debtCancelReserve(overrides?: CallOverrides): Promise<[BigNumber]>;

    depositDebtCancelReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    depositRedemptionReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    dividendReserve(overrides?: CallOverrides): Promise<[BigNumber]>;

    lockETH(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    lockedCollateral(overrides?: CallOverrides): Promise<[BigNumber]>;

    redemptionReserve(overrides?: CallOverrides): Promise<[BigNumber]>;

    sendETH(
      recipient: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    useDebtCancelReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    useRedemptionReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;

    withdrawDividendReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<ContractTransaction>;
  };

  accumulateDividendReserve(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  debtCancelReserve(overrides?: CallOverrides): Promise<BigNumber>;

  depositDebtCancelReserve(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  depositRedemptionReserve(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  dividendReserve(overrides?: CallOverrides): Promise<BigNumber>;

  lockETH(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  lockedCollateral(overrides?: CallOverrides): Promise<BigNumber>;

  redemptionReserve(overrides?: CallOverrides): Promise<BigNumber>;

  sendETH(
    recipient: string,
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  useDebtCancelReserve(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  useRedemptionReserve(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  withdrawDividendReserve(
    amount: BigNumberish,
    overrides?: Overrides & { from?: string | Promise<string> }
  ): Promise<ContractTransaction>;

  callStatic: {
    accumulateDividendReserve(
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    debtCancelReserve(overrides?: CallOverrides): Promise<BigNumber>;

    depositDebtCancelReserve(
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    depositRedemptionReserve(
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    dividendReserve(overrides?: CallOverrides): Promise<BigNumber>;

    lockETH(amount: BigNumberish, overrides?: CallOverrides): Promise<void>;

    lockedCollateral(overrides?: CallOverrides): Promise<BigNumber>;

    redemptionReserve(overrides?: CallOverrides): Promise<BigNumber>;

    sendETH(
      recipient: string,
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    useDebtCancelReserve(
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    useRedemptionReserve(
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;

    withdrawDividendReserve(
      amount: BigNumberish,
      overrides?: CallOverrides
    ): Promise<void>;
  };

  filters: {
    Received(
      undefined?: null,
      undefined?: null
    ): TypedEventFilter<[string, BigNumber], { arg0: string; arg1: BigNumber }>;
  };

  estimateGas: {
    accumulateDividendReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    debtCancelReserve(overrides?: CallOverrides): Promise<BigNumber>;

    depositDebtCancelReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    depositRedemptionReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    dividendReserve(overrides?: CallOverrides): Promise<BigNumber>;

    lockETH(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    lockedCollateral(overrides?: CallOverrides): Promise<BigNumber>;

    redemptionReserve(overrides?: CallOverrides): Promise<BigNumber>;

    sendETH(
      recipient: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    useDebtCancelReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    useRedemptionReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;

    withdrawDividendReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<BigNumber>;
  };

  populateTransaction: {
    accumulateDividendReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    debtCancelReserve(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    depositDebtCancelReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    depositRedemptionReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    dividendReserve(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    lockETH(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    lockedCollateral(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    redemptionReserve(overrides?: CallOverrides): Promise<PopulatedTransaction>;

    sendETH(
      recipient: string,
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    useDebtCancelReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    useRedemptionReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;

    withdrawDividendReserve(
      amount: BigNumberish,
      overrides?: Overrides & { from?: string | Promise<string> }
    ): Promise<PopulatedTransaction>;
  };
}
