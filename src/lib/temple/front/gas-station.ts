import {
  ContractAbstraction,
  OpKind,
  TezosToolkit,
  Wallet,
} from "@taquito/taquito";
import { hex2buf } from "@taquito/utils";

import blake from "blakejs";

import { ReadOnlySigner } from "../read-only-signer";

type ForgeTxParams = {
  to: string;
  tokenAddress: string;
  tokenId?: number;
  amount: number;
  relayerFee: number;
};

type PermitParams = {
  signature: string;
  hash: string;
  pubkey: string;
  contractAddress: string;
  callParams: any;
};

const RELAYER_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
const ESTIMATOR_ADDRESS = "tz1VSUr8wwNhLAzempoch5d6hLRiTh8Cjcjb";
const ESTIMATOR_PUBLIC_KEY =
  "edpkvGfYw3LyB1UcCahKQk4rF2tvbMUk8GFiTuMjL75uGXrpvKXhjn";

const formTransferParams = (
  from_: string,
  relayerAddress: string,
  { to: to_, tokenId, amount, relayerFee }: ForgeTxParams
) => {
  const intendedTx = { to_: to_, token_id: tokenId, amount: amount };

  const feeTx = {
    to_: relayerAddress,
    token_id: tokenId,
    amount: relayerFee,
  };

  const txList = [
    [
      {
        from_: from_,
        txs: [intendedTx, feeTx],
      },
    ],
  ];

  return txList;
};

const permitParamHash = async (
  tezos: TezosToolkit,
  contract: ContractAbstraction<Wallet>,
  entrypoint: string,
  parameters: any
): Promise<string> => {
  const raw_packed = await tezos.rpc.packData({
    data: contract.parameterSchema.Encode(entrypoint, ...parameters),
    // @ts-ignore
    type: contract.parameterSchema.root.typeWithoutAnnotations(),
  });

  return blake.blake2bHex(hex2buf(raw_packed.packed), null, 32);
};

const getUnpackedUniques = (
  contractAddress: string,
  chainId: string,
  currentPermitCount: number,
  permitHash: string
) => {
  return {
    data: {
      prim: "Pair",
      args: [
        {
          prim: "Pair",
          args: [{ string: contractAddress }, { string: chainId }],
        },
        {
          prim: "Pair",
          args: [{ int: currentPermitCount.toString() }, { bytes: permitHash }],
        },
      ],
    },
    type: {
      prim: "pair",
      args: [
        { prim: "pair", args: [{ prim: "address" }, { prim: "chain_id" }] },
        { prim: "pair", args: [{ prim: "nat" }, { prim: "bytes" }] },
      ],
    },
  };
};

const createPermitPayload = async (
  tezos: TezosToolkit,
  contractAddress: string,
  entrypoint: string,
  params: any
) => {
  const contract = await tezos.wallet.at(contractAddress);
  const storage = await contract.storage<any>();
  const signerKey = await tezos.signer.publicKey();
  const paramHash = await permitParamHash(tezos, contract, entrypoint, params);

  const chainId = await tezos.rpc.getChainId();
  const currentPermitCount = storage.permit_counter.toNumber();
  const unpacked = getUnpackedUniques(
    contractAddress,
    chainId,
    currentPermitCount,
    paramHash
  );

  const packed = await tezos.rpc.packData(unpacked);

  return [signerKey, packed.packed, paramHash];
};

const forgeTxAndParams = async (
  tezos: TezosToolkit,
  params: ForgeTxParams
): Promise<[any, Pick<PermitParams, "pubkey" | "signature" | "hash">]> => {
  const { tokenAddress } = params;

  var transferParams = formTransferParams(
    await tezos.wallet.pkh(),
    RELAYER_ADDRESS,
    params
  );

  let [pubkey, payload, hash] = await createPermitPayload(
    tezos,
    tokenAddress,
    "transfer",
    transferParams
  );
  const { sig: signature } = await tezos.signer.sign(payload);
  let permitParams = {
    pubkey,
    signature,
    hash,
  };

  return [transferParams, permitParams];
};

const estimateAsBatch = (tezos: TezosToolkit, txs: any) =>
  tezos.estimate.batch(
    txs.map((tParams: any) => ({ kind: OpKind.TRANSACTION, ...tParams }))
  );

const estimate = async (tezos: TezosToolkit, permitParams: PermitParams) => {
  const { signature, hash, pubkey, contractAddress, callParams } = permitParams;

  let estimator = new TezosToolkit(tezos.rpc);
  estimator.setSignerProvider(
    new ReadOnlySigner(ESTIMATOR_ADDRESS, ESTIMATOR_PUBLIC_KEY)
  );

  const { entrypoint, params } = callParams;

  const contract = await estimator.contract.at(contractAddress);

  let permit = contract.methods
    .permit(pubkey, signature, hash)
    .toTransferParams({});

  let feeTransfer = contract.methods[entrypoint](...params).toTransferParams(
    {}
  );

  let totalEstimate = 0;
  let estimates = await estimateAsBatch(estimator, [permit, feeTransfer]);

  for (let est of estimates) {
    totalEstimate += est.suggestedFeeMutez;
  }

  return totalEstimate;
};

export const GasStation = {
  forgeTxAndParams,
  estimate
};