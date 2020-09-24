import React, { useCallback, useEffect, useMemo, useState } from "react";
import classNames from "clsx";
import BigNumber from "bignumber.js";
import formatDistanceToNow from "date-fns/formatDistanceToNow";
import {
  BcdPageableTokenTransfers,
  BcdTokenTransfer,
  getTokenTransfers,
  isBcdSupportedNetwork,
} from "lib/better-call-dev";
import {
  getOperations,
  isDelegation,
  isTransaction,
  isTzktSupportedNetwork,
  TzktOperation,
} from "lib/tzkt";
import {
  ThanosAsset,
  ThanosAssetType,
  XTZ_ASSET,
  useNetwork,
  usePendingOperations,
  useAssets,
} from "lib/thanos/front";
import InUSD from "app/templates/InUSD";
import Identicon from "app/atoms/Identicon";
import HashChip from "app/atoms/HashChip";
import Money from "app/atoms/Money";
import { ReactComponent as LayersIcon } from "app/icons/layers.svg";
import useInfiniteList from "lib/useInfiniteList";
import FormSecondaryButton from "app/atoms/FormSecondaryButton";

const PNDOP_EXPIRE_DELAY = 1000 * 60 * 60 * 24;

interface OperationPreview {
  contractAddress?: string;
  hash: string;
  newDelegate?: string;
  type: string;
  receiver: string;
  volume: number;
  sender: string;
  status: string;
  time: string;
  parameters?: string;
}

interface OperationHistoryProps {
  accountPkh: string;
}

const OperationHistory: React.FC<OperationHistoryProps> = ({ accountPkh }) => {
  const network = useNetwork();
  const { pndOps, removePndOps } = usePendingOperations();

  const bcdOperationsGetKey = useCallback(
    (index: number, previousPageData: BcdPageableTokenTransfers | null) => {
      if (!previousPageData) {
        return `bcdOperations,${network.id},${accountPkh}`;
      }

      if (previousPageData.last_id) {
        return `bcdOperations,${network.id},${accountPkh},${previousPageData.last_id}`;
      }

      return null;
    },
    [network.id, accountPkh]
  );

  const tzktOperationsGetKey = useCallback(
    (index: number, previousOperations: TzktOperation[] | null) => {
      if (!previousOperations) {
        return `tzktOperations,${network.id},${accountPkh}`;
      }

      if (previousOperations.length === 0) {
        return null;
      }

      return `tzktOperations,${network.id},${accountPkh},${
        previousOperations[previousOperations.length - 1].id
      }`;
    },
    [network.id, accountPkh]
  );

  const {
    result: bcdOperations,
    error: bcdError,
    isLoadingMore: isLoadingMoreBcdOperations,
    isReachingEnd: isReachingBcdOperationsEnd,
    loadMore: loadMoreBcdOperations,
    isRefreshing: isRefreshingBcdOperations,
    refresh: refreshBcdOperations,
  } = useInfiniteList({
    getDataLength: bcdGetDataLength,
    getKey: bcdOperationsGetKey,
    fetcher: bcdOperationsFetcher,
    transformFn: bcdOperationsTransformFn,
    itemsPerPage: 10,
  });

  const {
    result: tzktOperations,
    error: tzktError,
    isLoadingMore: isLoadingMoreTzktOperations,
    isReachingEnd: isReachingTzktOperationsEnd,
    loadMore: loadMoreTzktOperations,
    isRefreshing: isRefreshingTzktOperations,
    refresh: refreshTzktOperations,
  } = useInfiniteList({
    getDataLength: tzktGetDataLength,
    getKey: tzktOperationsGetKey,
    fetcher: tzktOperationsFetcher,
    transformFn: tzktOperationsTransformFn,
    itemsPerPage: 10,
  });

  const getOperationsError = bcdError || tzktError;
  const isLoadingMore =
    isLoadingMoreBcdOperations || isLoadingMoreTzktOperations;
  const isReachingEnd =
    isReachingBcdOperationsEnd && isReachingTzktOperationsEnd;
  const isRefreshing = isRefreshingBcdOperations || isRefreshingTzktOperations;
  const loadMore = useCallback(() => {
    if (!isReachingTzktOperationsEnd) {
      loadMoreTzktOperations();
    }
    if (!isReachingBcdOperationsEnd) {
      loadMoreBcdOperations();
    }
  }, [
    isReachingTzktOperationsEnd,
    isReachingBcdOperationsEnd,
    loadMoreBcdOperations,
    loadMoreTzktOperations,
  ]);

  const operations = useMemo<OperationPreview[]>(() => {
    return [
      ...bcdOperations.map((operation) => ({
        contractAddress: operation.contract,
        hash: operation.hash,
        type: "transaction",
        receiver: operation.to,
        sender: operation.source,
        volume: operation.amount,
        status: operation.status,
        time: operation.timestamp,
      })),
      ...tzktOperations
        .filter((operation) => {
          if (!isTransaction(operation)) {
            return true;
          }

          const parsedParams =
            operation.parameters &&
            tryParseParameters(null, operation.parameters);
          return !parsedParams || isTransferParameters(parsedParams);
        })
        .map((operation) => ({
          hash: operation.hash,
          parameters: isTransaction(operation)
            ? operation.parameters
            : undefined,
          newDelegate: isDelegation(operation)
            ? operation.newDelegate?.address
            : undefined,
          type: operation.type,
          sender: operation.sender.address,
          receiver: isTransaction(operation) ? operation.target.address : "",
          volume: isTransaction(operation) ? operation.amount : 0,
          status: operation.status,
          time: operation.timestamp || new Date().toISOString(),
        })),
    ];
  }, [bcdOperations, tzktOperations]);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshBcdOperations();
      refreshTzktOperations();
    }, 15_000);

    return () => clearInterval(interval);
  }, [refreshBcdOperations, refreshTzktOperations]);

  useEffect(() => {
    if (getOperationsError) {
      throw getOperationsError;
    }
  }, [getOperationsError]);

  const pendingOperations = useMemo<OperationPreview[]>(
    () =>
      pndOps.map((op) => ({
        ...op,
        hash: op.hash,
        type: op.kind,
        sender: accountPkh,
        receiver: op.destination ?? "",
        volume: op.amount ?? 0,
        status: "backtracked",
        time: op.addedAt,
      })),
    [pndOps, accountPkh]
  );

  const [uniqueOps, nonUniqueOps] = useMemo(() => {
    const unique: OperationPreview[] = [];
    const nonUnique: OperationPreview[] = [];

    for (const pndOp of pendingOperations) {
      const expired =
        new Date(pndOp.time).getTime() + PNDOP_EXPIRE_DELAY < Date.now();

      if (expired || operations.some((op) => opKey(op) === opKey(pndOp))) {
        nonUnique.push(pndOp);
      } else if (unique.every((u) => opKey(u) !== opKey(pndOp))) {
        unique.push(pndOp);
      }
    }

    for (const op of operations) {
      if (unique.every((u) => opKey(u) !== opKey(op))) {
        unique.push(op);
      }
    }

    return [
      unique.sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()
      ),
      nonUnique,
    ];
  }, [operations, pendingOperations]);

  useEffect(() => {
    if (nonUniqueOps.length > 0) {
      removePndOps(nonUniqueOps);
    }
  }, [removePndOps, nonUniqueOps]);

  return (
    <div
      className={classNames("mt-8", "w-full max-w-md mx-auto", "flex flex-col")}
    >
      {uniqueOps.length === 0 && (
        <div
          className={classNames(
            "mb-12",
            "flex flex-col items-center justify-center",
            "text-gray-500"
          )}
        >
          <LayersIcon className="mb-2 w-16 h-auto stroke-current" />

          <h3
            className="text-sm font-light text-center"
            style={{ maxWidth: "20rem" }}
          >
            {network.tzStats ? (
              "No operations found"
            ) : (
              <>
                Operation history is not available
                <br />
                for local sandbox
              </>
            )}
          </h3>
        </div>
      )}

      {uniqueOps.map((op) => (
        <Operation key={opKey(op)} accountPkh={accountPkh} {...op} />
      ))}

      {!getOperationsError && (
        <div className="w-full flex justify-center py-4">
          <FormSecondaryButton
            disabled={isRefreshing || isLoadingMore || isReachingEnd}
            loading={isRefreshing || isLoadingMore}
            onClick={loadMore}
          >
            {isReachingEnd ? "There are no more items" : "Load more"}
          </FormSecondaryButton>
        </div>
      )}
    </div>
  );
};

export default OperationHistory;

function bcdGetDataLength(pageData: BcdPageableTokenTransfers) {
  return pageData.transfers.length;
}

async function bcdOperationsFetcher(queryKey: string) {
  const { networkId, accountPkh, lastId } = parseOperationsFetcherQueryKey(
    queryKey
  );
  if (!isBcdSupportedNetwork(networkId)) {
    return { transfers: [] };
  }

  return getTokenTransfers({
    address: accountPkh,
    network: networkId,
    last_id: lastId,
  });
}

function bcdOperationsTransformFn(pagesData: BcdPageableTokenTransfers[]) {
  return pagesData.reduce(
    (operations, { transfers }) => [...operations, ...transfers],
    [] as BcdTokenTransfer[]
  );
}

function tzktGetDataLength(pageData: TzktOperation[]) {
  return pageData.length;
}

async function tzktOperationsFetcher(queryKey: string) {
  const { networkId, accountPkh, lastId } = parseOperationsFetcherQueryKey(
    queryKey
  );
  if (!isTzktSupportedNetwork(networkId)) {
    return [];
  }

  return getOperations(networkId, {
    address: accountPkh,
    lastId: lastId !== undefined ? Number(lastId) : undefined,
    limit: 10,
  });
}

function tzktOperationsTransformFn(pagesData: TzktOperation[][]) {
  return pagesData.reduce(
    (resultPart, pageData) => [...resultPart, ...pageData],
    [] as TzktOperation[]
  );
}

function parseOperationsFetcherQueryKey(queryKey: string) {
  const [queryName, networkId, accountPkh, lastId] = queryKey.split(",");

  return {
    queryName,
    networkId,
    accountPkh,
    lastId,
  };
}

type OperationProps = OperationPreview & {
  accountPkh: string;
};

const Operation = React.memo<OperationProps>(
  ({
    accountPkh,
    contractAddress,
    hash,
    type,
    receiver,
    volume,
    status,
    time,
    parameters,
  }) => {
    const { allAssets } = useAssets();

    const token = useMemo(
      () =>
        (parameters &&
          allAssets.find(
            (a) =>
              a.type !== ThanosAssetType.XTZ && a.address === contractAddress
          )) ||
        null,
      [allAssets, parameters, contractAddress]
    );

    const tokenParsed = useMemo(
      () =>
        (parameters &&
          (tryParseParameters(
            token,
            parameters
          ) as ParsedTransferParameters)) ||
        null,
      [token, parameters]
    );

    const finalReceiver =
      contractAddress && tokenParsed ? tokenParsed.receiver : receiver;
    const finalVolume = tokenParsed
      ? tokenParsed.volume
      : contractAddress
      ? volume
      : new BigNumber(volume).div(1e6).toNumber();

    const volumeExists = finalVolume !== 0;
    const typeTx = type === "transaction";
    const imReceiver = finalReceiver === accountPkh;
    const pending = status === "backtracked";

    return useMemo(
      () => (
        <div className={classNames("my-3", "flex items-stretch")}>
          <div className="mr-2">
            <Identicon hash={hash} size={50} className="shadow-xs" />
          </div>

          <div className="flex-1">
            <div className="flex items-center">
              <HashChip
                hash={hash}
                firstCharsCount={10}
                lastCharsCount={7}
                small
                className="mr-2"
              />

              <div className={classNames("flex-1", "h-px", "bg-gray-200")} />
            </div>

            <div className="flex items-stretch">
              <div className="flex flex-col">
                <span className="mt-1 text-xs text-blue-600 opacity-75">
                  {formatOperationType(type, imReceiver)}
                </span>

                {pending ? (
                  <span className="text-xs text-yellow-600 font-light">
                    pending...
                  </span>
                ) : (
                  <Time
                    children={() => (
                      <span className="text-xs text-gray-500 font-light">
                        {formatDistanceToNow(new Date(time), {
                          includeSeconds: true,
                          addSuffix: true,
                        })}
                      </span>
                    )}
                  />
                )}
              </div>

              <div className="flex-1" />

              {volumeExists && (
                <div className="flex-shrink-0 flex flex-col items-end">
                  <div
                    className={classNames(
                      "text-sm",
                      (() => {
                        switch (true) {
                          case pending:
                            return "text-yellow-600";

                          case typeTx:
                            return imReceiver
                              ? "text-green-500"
                              : "text-red-700";

                          default:
                            return "text-gray-800";
                        }
                      })()
                    )}
                  >
                    {typeTx && (imReceiver ? "+" : "-")}
                    <Money>{finalVolume}</Money>{" "}
                    {contractAddress
                      ? token?.symbol || contractAddress.substr(2, 3)
                      : "ꜩ"}
                  </div>

                  <InUSD volume={finalVolume} asset={token || XTZ_ASSET}>
                    {(usdVolume) => (
                      <div className="text-xs text-gray-500">
                        <span className="mr-px">$</span>
                        {usdVolume}
                      </div>
                    )}
                  </InUSD>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
      [
        contractAddress,
        hash,
        finalVolume,
        imReceiver,
        pending,
        time,
        token,
        type,
        typeTx,
        volumeExists,
      ]
    );
  }
);

type TimeProps = {
  children: () => React.ReactElement;
};

const Time: React.FC<TimeProps> = ({ children }) => {
  const [value, setValue] = useState(children);

  useEffect(() => {
    const interval = setInterval(() => {
      setValue(children());
    }, 5_000);

    return () => {
      clearInterval(interval);
    };
  }, [setValue, children]);

  return value;
};

function formatOperationType(type: string, imReciever: boolean) {
  if (type === "transaction") {
    type = `${imReciever ? "↓" : "↑"}_${type}`;
  }

  return type
    .split("_")
    .map((w) => `${w.charAt(0).toUpperCase()}${w.substring(1)}`)
    .join(" ");
}

function opKey(op: OperationPreview) {
  return `${op.hash}_${op.type}`;
}

type ParsedTransferParameters = {
  sender: string;
  receiver: string;
  volume: number;
  entrypoint: "transfer";
};
type ParsedNonTransferParameters = { entrypoint: string; [key: string]: any };
type ParsedParameters = ParsedTransferParameters | ParsedNonTransferParameters;

function isTransferParameters(
  parameters: ParsedParameters
): parameters is ParsedTransferParameters {
  return parameters.entrypoint === "transfer";
}

function tryParseParameters(
  asset: ThanosAsset | null,
  parameters: string
): ParsedParameters | null {
  try {
    const parsedParameters = JSON.parse(parameters);
    if (
      typeof parsedParameters !== "object" ||
      parsedParameters instanceof Array
    ) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "cannot process parameters ",
          parsedParameters,
          " for now"
        );
      }

      return null;
    }

    if (parsedParameters.entrypoint !== "transfer") {
      return parsedParameters;
    }

    const { args } = parsedParameters.value;
    const firstArgIsSender = !!args[0].string;
    const volumeArg = firstArgIsSender ? args[1].args[1] : args[1];
    const senderArg = firstArgIsSender ? args[0] : args[0].args[0];
    const receiverArg = firstArgIsSender ? args[1].args[0] : args[0].args[1];
    const receiver: string = receiverArg.string;
    const sender: string = senderArg.string;
    const volume = new BigNumber(volumeArg.int)
      .div(10 ** (asset?.decimals || 0))
      .toNumber();
    return { sender, receiver, volume, entrypoint: "transfer" };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("Error while parsing parameters ", parameters);
      console.error(e);
    }

    return null;
  }
}
