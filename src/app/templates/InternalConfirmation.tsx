import React, { FC, useCallback, useEffect, useMemo } from "react";

import { localForger } from "@taquito/local-forging";
import classNames from "clsx";

import Alert from "app/atoms/Alert";
import ConfirmLedgerOverlay from "app/atoms/ConfirmLedgerOverlay";
import FormSecondaryButton from "app/atoms/FormSecondaryButton";
import FormSubmitButton from "app/atoms/FormSubmitButton";
import Logo from "app/atoms/Logo";
import SubTitle from "app/atoms/SubTitle";
import { useAppEnv } from "app/env";
import { ReactComponent as CodeAltIcon } from "app/icons/code-alt.svg";
import { ReactComponent as EyeIcon } from "app/icons/eye.svg";
import { ReactComponent as HashIcon } from "app/icons/hash.svg";
import AccountBanner from "app/templates/AccountBanner";
import ExpensesView, { ModifyFeeAndLimit } from "app/templates/ExpensesView";
import NetworkBanner from "app/templates/NetworkBanner";
import OperationsBanner from "app/templates/OperationsBanner";
import RawPayloadView from "app/templates/RawPayloadView";
import ViewsSwitcher, {
  ViewsSwitcherItemProps,
} from "app/templates/ViewsSwitcher";
import { T, t } from "lib/i18n/react";
import { useRetryableSWR } from "lib/swr";
import {
  TempleAccountType,
  TempleAssetType,
  TempleConfirmationPayload,
  tryParseExpenses,
  useAssets,
  useNetwork,
  useRelevantAccounts,
  TEZ_ASSET,
  useCustomChainId,
  TempleChainId,
} from "lib/temple/front";
import useSafeState from "lib/ui/useSafeState";

import { InternalConfirmationSelectors } from "./InternalConfirmation.selectors";

type InternalConfiramtionProps = {
  payload: TempleConfirmationPayload;
  onConfirm: (
    confirmed: boolean,
    modifiedTotalFee?: number,
    modifiedStorageLimit?: number
  ) => Promise<void>;
};

const InternalConfirmation: FC<InternalConfiramtionProps> = ({
  payload,
  onConfirm,
}) => {
  const { rpcBaseURL: currentNetworkRpc } = useNetwork();
  const { popup } = useAppEnv();

  const getContentToParse = useCallback(async () => {
    switch (payload.type) {
      case "operations":
        return payload.opParams || [];
      case "sign":
        const unsignedBytes = payload.bytes.substr(
          0,
          payload.bytes.length - 128
        );
        try {
          return (await localForger.parse(unsignedBytes)) || [];
        } catch (err) {
          if (process.env.NODE_ENV === "development") {
            console.error(err);
          }
          return [];
        }
      default:
        return [];
    }
  }, [payload]);
  const { data: contentToParse } = useRetryableSWR(
    ["content-to-parse"],
    getContentToParse,
    { suspense: true }
  );
  const forceHidePreview =
    !(contentToParse instanceof Array) &&
    contentToParse &&
    contentToParse.contents.length === 0;

  const networkRpc =
    payload.type === "operations" ? payload.networkRpc : currentNetworkRpc;

  const chainId = useCustomChainId(networkRpc, true)!;
  const mainnet = chainId === TempleChainId.Mainnet;

  const allAccounts = useRelevantAccounts();
  const { allAssetsWithHidden } = useAssets();
  const account = useMemo(
    () => allAccounts.find((a) => a.publicKeyHash === payload.sourcePkh)!,
    [allAccounts, payload.sourcePkh]
  );
  const rawExpensesData = useMemo(
    () => tryParseExpenses(contentToParse!, account.publicKeyHash),
    [contentToParse, account.publicKeyHash]
  );
  const expensesData = useMemo(() => {
    return rawExpensesData.map(({ expenses, ...restProps }) => ({
      expenses: expenses.map(({ tokenAddress, tokenId, ...restProps }) => ({
        asset: tokenAddress
          ? allAssetsWithHidden.find((asset) => {
              switch (asset.type) {
                case TempleAssetType.TEZ:
                  return false;
                case TempleAssetType.FA2:
                  return asset.address === tokenAddress && asset.id === tokenId;
                default:
                  return asset.address === tokenAddress;
              }
            }) || tokenAddress
          : TEZ_ASSET,
        ...restProps,
      })),
      ...restProps,
    }));
  }, [allAssetsWithHidden, rawExpensesData]);

  const signPayloadFormats: ViewsSwitcherItemProps[] = useMemo(() => {
    if (payload.type === "operations") {
      return [
        {
          key: "preview",
          name: t("preview"),
          Icon: EyeIcon,
          testID: InternalConfirmationSelectors.PreviewTab,
        },
        {
          key: "raw",
          name: t("raw"),
          Icon: CodeAltIcon,
          testID: InternalConfirmationSelectors.RawTab,
        },
        ...(payload.bytesToSign
          ? [
              {
                key: "bytes",
                name: t("bytes"),
                Icon: HashIcon,
                testID: InternalConfirmationSelectors.BytesTab,
              },
            ]
          : []),
      ];
    }

    if (forceHidePreview) {
      return [
        {
          key: "bytes",
          name: t("bytes"),
          Icon: HashIcon,
        },
      ];
    }

    return [
      {
        key: "preview",
        name: t("preview"),
        Icon: EyeIcon,
        testID: InternalConfirmationSelectors.PreviewTab,
      },
      {
        key: "bytes",
        name: t("bytes"),
        Icon: HashIcon,
        testID: InternalConfirmationSelectors.BytesTab,
      },
    ];
  }, [payload, forceHidePreview]);

  const [spFormat, setSpFormat] = useSafeState(signPayloadFormats[0]);
  const [error, setError] = useSafeState<any>(null);
  const [confirming, setConfirming] = useSafeState(false);
  const [declining, setDeclining] = useSafeState(false);

  const [modifiedTotalFeeValue, setModifiedTotalFeeValue] = useSafeState(
    (payload.type === "operations" &&
      payload.estimates?.reduce((sum, e) => sum + e.suggestedFeeMutez, 0)) ||
      0
  );
  const [modifiedStorageLimitValue, setModifiedStorageLimitValue] =
    useSafeState(
      (payload.type === "operations" && payload.estimates?.[0].storageLimit) ||
        0
    );

  useEffect(() => {
    if (!signPayloadFormats.some(({ key }) => key === spFormat.key)) {
      setSpFormat(signPayloadFormats[0]);
    }
  }, [spFormat, signPayloadFormats, setSpFormat]);

  const confirm = useCallback(
    async (confirmed: boolean) => {
      setError(null);
      try {
        await onConfirm(
          confirmed,
          modifiedTotalFeeValue,
          modifiedStorageLimitValue
        );
      } catch (err) {
        // Human delay.
        await new Promise((res) => setTimeout(res, 300));
        setError(err);
      }
    },
    [onConfirm, setError, modifiedTotalFeeValue, modifiedStorageLimitValue]
  );

  const handleConfirmClick = useCallback(async () => {
    if (confirming || declining) return;

    setConfirming(true);
    await confirm(true);
    setConfirming(false);
  }, [confirming, declining, setConfirming, confirm]);

  const handleDeclineClick = useCallback(async () => {
    if (confirming || declining) return;

    setDeclining(true);
    await confirm(false);
    setDeclining(false);
  }, [confirming, declining, setDeclining, confirm]);

  const handleErrorAlertClose = useCallback(() => setError(null), [setError]);

  const modifiedStorageLimitDisplayed = useMemo(
    () =>
      payload.type === "operations" &&
      payload.estimates &&
      payload.estimates.length < 2,
    [payload]
  );

  const modifyFeeAndLimit = useMemo<ModifyFeeAndLimit>(
    () => ({
      totalFee: modifiedTotalFeeValue,
      onTotalFeeChange: (v) => setModifiedTotalFeeValue(v),
      storageLimit: modifiedStorageLimitDisplayed
        ? modifiedStorageLimitValue
        : null,
      onStorageLimitChange: (v) => setModifiedStorageLimitValue(v),
    }),
    [
      modifiedTotalFeeValue,
      setModifiedTotalFeeValue,
      modifiedStorageLimitValue,
      setModifiedStorageLimitValue,
      modifiedStorageLimitDisplayed,
    ]
  );

  return (
    <div
      className={classNames(
        "h-full w-full",
        "max-w-sm mx-auto",
        "flex flex-col",
        !popup && "justify-center px-2"
      )}
    >
      <div
        className={classNames(
          "flex flex-col items-center justify-center",
          popup && "flex-1"
        )}
      >
        <div className="flex items-center my-4">
          <Logo hasTitle />
        </div>
      </div>

      <div
        className={classNames(
          "relative bg-white shadow-md",
          popup ? "border-t border-gray-200" : "rounded-md",
          "overflow-y-auto",
          "flex flex-col"
        )}
        style={{ height: "34rem" }}
      >
        <div className="px-4 pt-3">
          <SubTitle small className="mb-4">
            <T
              id="confirmAction"
              substitutions={t(
                payload.type === "sign" ? "signAction" : "operations"
              )}
            />
          </SubTitle>

          {error ? (
            <Alert
              closable
              onClose={handleErrorAlertClose}
              type="error"
              title={t("error")}
              description={error?.message ?? t("smthWentWrong")}
              className="my-4"
              autoFocus
            />
          ) : (
            <>
              <AccountBanner
                account={account}
                labelIndent="sm"
                className="w-full mb-4"
              />

              <NetworkBanner
                rpc={
                  payload.type === "operations"
                    ? payload.networkRpc
                    : currentNetworkRpc
                }
              />

              {signPayloadFormats.length > 1 && (
                <div className="w-full flex justify-end mb-3 items-center">
                  <span
                    className={classNames(
                      "mr-2",
                      "text-base font-semibold text-gray-700"
                    )}
                  >
                    <T id="operations" />
                  </span>

                  <div className="flex-1" />

                  <ViewsSwitcher
                    activeItem={spFormat}
                    items={signPayloadFormats}
                    onChange={setSpFormat}
                  />
                </div>
              )}

              {payload.type === "operations" && spFormat.key === "raw" && (
                <OperationsBanner
                  opParams={payload.rawToSign ?? payload.opParams}
                  jsonViewStyle={
                    signPayloadFormats.length > 1
                      ? { height: "11rem" }
                      : undefined
                  }
                />
              )}

              {payload.type === "sign" && spFormat.key === "bytes" && (
                <>
                  <RawPayloadView
                    label={t("payloadToSign")}
                    payload={payload.bytes}
                    className="mb-4"
                    style={{ height: "11rem" }}
                  />
                </>
              )}

              {payload.type === "operations" &&
                payload.bytesToSign &&
                spFormat.key === "bytes" && (
                  <>
                    <RawPayloadView
                      payload={payload.bytesToSign}
                      className="mb-4"
                      style={{ height: "11rem" }}
                    />
                  </>
                )}

              {spFormat.key === "preview" && (
                <ExpensesView
                  expenses={expensesData}
                  estimates={
                    payload.type === "operations"
                      ? payload.estimates
                      : undefined
                  }
                  modifyFeeAndLimit={modifyFeeAndLimit}
                  mainnet={mainnet}
                />
              )}
            </>
          )}
        </div>

        <div className="flex-1" />

        <div
          className={classNames(
            "sticky bottom-0 w-full",
            "bg-white shadow-md",
            "flex items-stretch",
            "px-4 pt-2 pb-4"
          )}
        >
          <div className="w-1/2 pr-2">
            <T id="decline">
              {(message) => (
                <FormSecondaryButton
                  type="button"
                  className="justify-center w-full"
                  loading={declining}
                  disabled={declining}
                  onClick={handleDeclineClick}
                  testID={InternalConfirmationSelectors.DeclineButton}
                >
                  {message}
                </FormSecondaryButton>
              )}
            </T>
          </div>

          <div className="w-1/2 pl-2">
            <T id={error ? "retry" : "confirm"}>
              {(message) => (
                <FormSubmitButton
                  type="button"
                  className="justify-center w-full"
                  loading={confirming}
                  onClick={handleConfirmClick}
                  testID={
                    error
                      ? InternalConfirmationSelectors.RetryButton
                      : InternalConfirmationSelectors.ConfirmButton
                  }
                >
                  {message}
                </FormSubmitButton>
              )}
            </T>
          </div>
        </div>

        <ConfirmLedgerOverlay
          displayed={confirming && account.type === TempleAccountType.Ledger}
        />
      </div>
    </div>
  );
};

export default InternalConfirmation;
