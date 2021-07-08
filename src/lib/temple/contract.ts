import {
  TezosToolkit,
  WalletContract,
  compose,
  BigMapAbstraction,
} from "@taquito/taquito";
import { tzip12 } from "@taquito/tzip12";
import { tzip16 } from "@taquito/tzip16";
import memoize from "micro-memoize";

import { michelEncoder } from "lib/temple/helpers";
import { TempleChainId } from "lib/temple/types";

export type TokenMetadata = {
  decimals: number;
  symbol: string;
  name: string;
  iconUrl: string;
};

const KNOWN_CHAIN_IDS = Object.values(TempleChainId) as string[];

export const loadContract = memoize(fetchContract, {
  isPromise: true,
  maxSize: 100,
});

export async function fetchTokenMetadata(
  tezos: TezosToolkit,
  contractAddress: string,
  tokenId?: number
): Promise<TokenMetadata> {
  const contract = await tezos.wallet.at(
    contractAddress,
    compose(tzip12, tzip16)
  );

  let tokenData: any;
  let latestErrMessage;

  /**
   * Try fetch token data with TZIP12
   */
  try {
    tokenData = await contract.tzip12().getTokenMetadata(tokenId ?? 0);
  } catch (err) {
    latestErrMessage = err.message;
  }

  /**
   * Try fetch token data with TZIP16
   * Get them from plain tzip16 structure/scheme
   */
  if (!tokenData || Object.keys(tokenData).length === 0) {
    try {
      const { metadata } = await contract.tzip16().getMetadata();
      tokenData = metadata;
    } catch (err) {
      latestErrMessage = err.message;
    }
  }

  try {
    const { tokens } = await contract.storage<any>();
    if (tokens instanceof BigMapAbstraction && tokenId !== undefined) {
      tokenData = await tokens.get(tokenId);
    }
  } catch (e) {}

  if (!tokenData) {
    throw new MetadataParseError(latestErrMessage ?? "Unknown error");
  }

  return {
    decimals: tokenData.decimals ? +tokenData.decimals : 0,
    symbol:
      tokenData.symbol ||
      (tokenData.name ? tokenData.name.substr(0, 8) : "???"),
    name: tokenData.name || tokenData.symbol || "Unknown Token",
    iconUrl:
      tokenData.thumbnailUri ??
      tokenData.logo ??
      tokenData.icon ??
      tokenData.iconUri ??
      tokenData.iconUrl ??
      "",
  };
}

export class MetadataParseError extends Error {}

export function fetchContract(
  tezos: TezosToolkit,
  address: string,
  walletAPI = true
): Promise<WalletContract> {
  return walletAPI
    ? tezos.wallet.at(address)
    : (tezos.contract.at(address) as any);
}

export async function loadContractForCallLambdaView(
  tezos: TezosToolkit,
  contractAddress: string
) {
  const chainId = await tezos.rpc.getChainId();
  if (KNOWN_CHAIN_IDS.includes(chainId)) {
    tezos = new TezosToolkit(tezos.rpc);
    tezos.setSignerProvider(lambdaSigner);
    tezos.setPackerProvider(michelEncoder);
  }

  const contract: any = await loadContract(tezos, contractAddress, false);
  return contract;
}

class LambdaViewSigner {
  async publicKeyHash() {
    return process.env.TEMPLE_WALLET_LV_ACCOUNT_PKH!;
  }

  async publicKey() {
    return process.env.TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY!;
  }

  async secretKey(): Promise<string> {
    throw new Error("Secret key cannot be exposed");
  }

  async sign(): Promise<{
    bytes: string;
    sig: string;
    prefixSig: string;
    sbytes: string;
  }> {
    throw new Error("Cannot sign");
  }
}

if (
  !process.env.TEMPLE_WALLET_LV_ACCOUNT_PKH ||
  !process.env.TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY
) {
  throw new Error(
    "Require a 'TEMPLE_WALLET_LV_ACCOUNT_PKH' and " +
      "'TEMPLE_WALLET_LV_ACCOUNT_PUBLIC_KEY' environment variable to be set"
  );
}

const lambdaSigner = new LambdaViewSigner();
