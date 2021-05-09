import { TezosToolkit, WalletContract } from "@taquito/taquito";
import BigNumber from "bignumber.js";
import { browser } from "webextension-polyfill-ts";

import assert, { AssertionError } from "lib/assert";
import { getMessage } from "lib/i18n";
import {
  loadContract,
  loadContractForCallLambdaView,
} from "lib/temple/contract";
import { mutezToTz } from "lib/temple/helpers";
import { TempleAsset, TempleToken, TempleAssetType } from "lib/temple/types";
export const TEZ_ASSET: TempleAsset = {
  type: TempleAssetType.TEZ,
  name: "Tezos",
  symbol: "tez",
  decimals: 6,
  fungible: true,
  status: "displayed",
};

export const DELPHINET_TOKENS: TempleToken[] = [
  {
    type: TempleAssetType.FA1_2,
    address: "KT1RXpLtz22YgX24QQhxKVyKvtKZFaAVtTB9",
    name: "Kolibri",
    symbol: "kUSD",
    decimals: 18,
    fungible: true,
    iconUrl: "https://kolibri-data.s3.amazonaws.com/logo.png",
    status: "displayed",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1TDHL9ipKL8WW3TMPvutbLh9uZBdY9BU59",
    name: "Wrapped Tezos",
    symbol: "wXTZ",
    decimals: 6,
    fungible: true,
    iconUrl: browser.runtime.getURL("misc/token-logos/wxtz.png"),
    status: "displayed",
  },
  {
    type: TempleAssetType.FA2,
    address: "KT1WnjpKriR4yweiFdkTiMofoV9hvz7vMSXJ",
    id: 0,
    name: "Stably USD",
    symbol: "USDS",
    decimals: 6,
    fungible: true,
    iconUrl: browser.runtime.getURL("misc/token-logos/usds.svg"),
    status: "displayed",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT19UypipJWENBavh34Wn7tc67bL1HucZh9W",
    name: "Staker Governance Token",
    symbol: "STKR",
    decimals: 18,
    fungible: true,
    iconUrl: "https://github.com/StakerDAO/resources/raw/main/stkr.png",
    status: "displayed",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1N3KopJkpzBfRPFVzqaAwyPEyuVmhpePmt",
    name: "Blend",
    symbol: "BLND",
    decimals: 18,
    fungible: true,
    iconUrl: "https://github.com/StakerDAO/resources/raw/main/blend.png",
    status: "displayed",
  },
];

export const MAINNET_TOKENS: TempleToken[] = [
  {
    type: TempleAssetType.TzBTC,
    address: "KT1PWx2mnDueood7fEmfbBDKx1D9BAnnXitn",
    name: "Tezos BTC",
    symbol: "tzBTC",
    decimals: 8,
    fungible: true,
    iconUrl:
      "https://tzbtc.io/wp-content/uploads/2020/03/tzbtc_logo_single.svg",
    status: "displayed",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1K9gCRgaLRFKTErYt1wVxA3Frb9FjasjTV",
    name: "Kolibri",
    symbol: "kUSD",
    decimals: 18,
    fungible: true,
    iconUrl: "https://kolibri-data.s3.amazonaws.com/logo.png",
    status: "displayed",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1AxaBxkFLCUi3f8rdDAAxBKHfzY8LfKDRA",
    name: "Quipuswap Liquidating kUSD",
    symbol: "QLkUSD",
    decimals: 36,
    fungible: true,
    iconUrl: "https://kolibri-data.s3.amazonaws.com/logo.png",
    status: "displayed",
  },  
  {
    type: TempleAssetType.FA1_2,
    address: "KT1VYsVfmobT7rsMVivvZ4J8i3bPiqz12NaH",
    name: "Wrapped Tezos",
    symbol: "wXTZ",
    decimals: 6,
    fungible: true,
    iconUrl: browser.runtime.getURL("misc/token-logos/wxtz.png"),
    status: "displayed",
  },
  {
    type: TempleAssetType.FA2,
    address: "KT1REEb5VxWRjcHm5GzDMwErMmNFftsE5Gpf",
    id: 0,
    name: "Stably USD",
    symbol: "USDS",
    decimals: 6,
    fungible: true,
    iconUrl: browser.runtime.getURL("misc/token-logos/usds.svg"),
    status: "displayed",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT19at7rQUvyjxnZ2fBv7D9zc8rkyG7gAoU8",
    name: "ETH Tez",
    symbol: "ETHtz",
    decimals: 18,
    fungible: true,
    iconUrl: browser.runtime.getURL("misc/token-logos/ethtz.png"),
    status: "hidden",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1LN4LPSqTMS7Sd2CJw4bbDGRkMv2t68Fy9",
    name: "USD Tez",
    symbol: "USDtz",
    decimals: 6,
    fungible: true,
    iconUrl: "https://usdtz.com/lightlogo10USDtz.png",
    status: "hidden",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1AEfeckNbdEYwaMKkytBwPJPycz7jdSGea",
    name: "Staker Governance Token",
    symbol: "STKR",
    decimals: 18,
    fungible: true,
    iconUrl: "https://github.com/StakerDAO/resources/raw/main/stkr.png",
    status: "hidden",
  },
  {
    type: TempleAssetType.FA1_2,
    address: "KT1MEouXPpCx9eFJYnxfAWpFA7NxhW3rDgUN",
    name: "Blend",
    symbol: "BLND",
    decimals: 18,
    fungible: true,
    iconUrl: "https://github.com/StakerDAO/resources/raw/main/blend.png",
    status: "hidden",
  },
];

function signatureAssertionFactory(name: string, args: string[]) {
  return (contract: WalletContract) => {
    const signatures = contract.parameterSchema.ExtractSignatures();
    const receivedSignature = signatures.find(
      (signature) => signature[0] === name
    );
    assert(receivedSignature);
    const receivedArgs = receivedSignature.slice(1);
    assert(receivedArgs.length === args.length);
    receivedArgs.forEach((receivedArg, index) =>
      assert(receivedArg === args[index])
    );
  };
}

function viewSuccessAssertionFactory(name: string, args: any[]) {
  return async (contract: WalletContract, tezos: TezosToolkit) => {
    assert(contract.views[name]);
    await contract.views[name](...args).read((tezos as any).lambdaContract);
  };
}

const STUB_TEZOS_ADDRESS = "tz1TTXUmQaxe1dTLPtyD4WMQP6aKYK9C8fKw";
const FA12_METHODS_ASSERTIONS = [
  {
    name: "transfer",
    assertion: signatureAssertionFactory("transfer", [
      "address",
      "address",
      "nat",
    ]),
  },
  {
    name: "approve",
    assertion: signatureAssertionFactory("approve", ["address", "nat"]),
  },
  {
    name: "getAllowance",
    assertion: viewSuccessAssertionFactory("getAllowance", [
      STUB_TEZOS_ADDRESS,
      STUB_TEZOS_ADDRESS,
    ]),
  },
  {
    name: "getBalance",
    assertion: viewSuccessAssertionFactory("getBalance", [STUB_TEZOS_ADDRESS]),
  },
  {
    name: "getTotalSupply",
    assertion: viewSuccessAssertionFactory("getTotalSupply", ["unit"]),
  },
];

const FA2_METHODS_ASSERTIONS = [
  {
    name: "update_operators",
    assertion: signatureAssertionFactory("update_operators", ["list"]),
  },
  {
    name: "transfer",
    assertion: signatureAssertionFactory("transfer", ["list"]),
  },
  {
    name: "balance_of",
    assertion: (
      contract: WalletContract,
      tezos: TezosToolkit,
      tokenId: number
    ) =>
      viewSuccessAssertionFactory("balance_of", [
        [{ owner: STUB_TEZOS_ADDRESS, token_id: String(tokenId) }],
      ])(contract, tezos),
  },
];

export async function assertTokenType(
  tokenType: TempleAssetType.FA1_2,
  contract: WalletContract,
  tezos: TezosToolkit
): Promise<void>;
export async function assertTokenType(
  tokenType: TempleAssetType.FA2,
  contract: WalletContract,
  tezos: TezosToolkit,
  tokenId: number
): Promise<void>;
export async function assertTokenType(
  tokenType: TempleAssetType.FA1_2 | TempleAssetType.FA2,
  contract: WalletContract,
  tezos: TezosToolkit,
  tokenId?: number
) {
  const isFA12Token = tokenType === TempleAssetType.FA1_2;
  const assertions = isFA12Token
    ? FA12_METHODS_ASSERTIONS
    : FA2_METHODS_ASSERTIONS;
  await Promise.all(
    assertions.map(async ({ name, assertion }) => {
      if (typeof contract.methods[name] !== "function") {
        throw new NotMatchingStandardError(
          getMessage("someMethodNotDefinedInContract", name)
        );
      }
      try {
        await assertion(contract, tezos, tokenId!);
      } catch (e) {
        if (e instanceof AssertionError) {
          throw new NotMatchingStandardError(
            getMessage("someMethodSignatureDoesNotMatchStandard", name)
          );
        } else if (e.value?.string === "FA2_TOKEN_UNDEFINED") {
          throw new UndefinedTokenError(
            getMessage("incorrectTokenIdErrorMessage")
          );
        } else {
          if (process.env.NODE_ENV === "development") {
            console.error(e);
          }
          throw new Error(
            getMessage("unknownErrorCheckingSomeEntrypoint", name)
          );
        }
      }
    })
  );
}

export async function fetchBalance(
  tezos: TezosToolkit,
  asset: TempleAsset,
  accountPkh: string
) {
  let nat: BigNumber | undefined;

  switch (asset.type) {
    case TempleAssetType.TEZ:
      const amount = await tezos.tz.getBalance(accountPkh);
      return mutezToTz(amount);

    case TempleAssetType.Staker:
    case TempleAssetType.TzBTC:
    case TempleAssetType.FA1_2:
      const contract = await loadContractForCallLambdaView(
        tezos,
        asset.address
      );

      try {
        nat = await contract.views
          .getBalance(accountPkh)
          .read((tezos as any).lambdaContract);
      } catch {}

      if (!nat || nat.isNaN()) {
        nat = new BigNumber(0);
      }

      return nat.div(10 ** asset.decimals);

    case TempleAssetType.FA2:
      const fa2Contract = await loadContractForCallLambdaView(
        tezos,
        asset.address
      );

      try {
        const response = await fa2Contract.views
          .balance_of([{ owner: accountPkh, token_id: asset.id }])
          .read((tezos as any).lambdaContract);
        nat = response[0].balance;
      } catch {}

      if (!nat || nat.isNaN()) {
        nat = new BigNumber(0);
      }

      return nat.div(10 ** asset.decimals);

    default:
      throw new Error("Not Supported");
  }
}

export async function toTransferParams(
  tezos: TezosToolkit,
  asset: TempleAsset,
  fromPkh: string,
  toPkh: string,
  amount: BigNumber.Value
) {
  switch (asset.type) {
    case TempleAssetType.TEZ:
      return {
        to: toPkh,
        amount: amount as any,
      };

    case TempleAssetType.Staker:
    case TempleAssetType.TzBTC:
    case TempleAssetType.FA1_2:
    case TempleAssetType.FA2:
      const contact = await loadContract(tezos, asset.address);
      const pennyAmount = new BigNumber(amount)
        .times(10 ** asset.decimals)
        .toFixed();
      const methodArgs =
        asset.type === TempleAssetType.FA2
          ? [
              [
                {
                  from_: fromPkh,
                  txs: [
                    { to_: toPkh, token_id: asset.id, amount: pennyAmount },
                  ],
                },
              ],
            ]
          : [fromPkh, toPkh, pennyAmount];
      return contact.methods.transfer(...methodArgs).toTransferParams();

    default:
      throw new Error("Not Supported");
  }
}

export function tryParseParameters(asset: TempleAsset, parameters: any) {
  switch (asset.type) {
    case TempleAssetType.Staker:
    case TempleAssetType.TzBTC:
    case TempleAssetType.FA1_2:
      try {
        const [{ args }, { int }] = parameters.value.args;
        const sender: string = args[0].string;
        const receiver: string = args[1].string;
        const volume = new BigNumber(int).div(10 ** asset.decimals).toNumber();
        return {
          sender,
          receiver,
          volume,
        };
      } catch (_err) {
        return null;
      }

    default:
      return null;
  }
}

export function mergeAssets<T extends TempleAsset>(base: T[], ...rest: T[][]) {
  const uniques = new Set<string>();
  return base.concat(...rest).filter((a) => {
    const key = getAssetKey(a);
    if (uniques.has(key)) return false;
    uniques.add(key);
    return true;
  });
}

export function omitAssets<T extends TempleAsset>(base: T[], toRemove: T[]) {
  const toRemoveSet = new Set(toRemove.map(getAssetKey));
  return base.filter((a) => !toRemoveSet.has(getAssetKey(a)));
}

export function assetsAreSame(aAsset: TempleAsset, bAsset: TempleAsset) {
  return getAssetKey(aAsset) === getAssetKey(bAsset);
}

export function getAssetKey(asset: TempleAsset) {
  switch (asset.type) {
    case TempleAssetType.TEZ:
      return "tez";

    case TempleAssetType.FA2:
      return `${asset.address}_${asset.id}`;

    default:
      return `${asset.address}_0`;
  }
}

export function toPenny(asset: TempleAsset) {
  return new BigNumber(1).div(10 ** asset.decimals);
}

export class NotMatchingStandardError extends Error {}
export class UndefinedTokenError extends Error {}
