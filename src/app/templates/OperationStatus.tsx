import React, { FC, ReactNode, useEffect, useMemo } from "react";

import classNames from "clsx";

import Alert from "app/atoms/Alert";
import OpenInExplorerChip from "app/atoms/OpenInExplorerChip";
import HashChip from "app/templates/HashChip";
import { T, t } from "lib/i18n/react";
import {
  useTezos,
  useBlockTriggers,
  useExplorerBaseUrls,
  FailedOpError,
} from "lib/temple/front";
import useSafeState from "lib/ui/useSafeState";

type OperationStatusProps = {
  className?: string;
  closable?: boolean;
  onClose?: () => void;
  typeTitle: string;
  operation: any;
  operationMayBeInvisible?: boolean;
};

const OperationStatus: FC<OperationStatusProps> = ({
  typeTitle,
  operation,
  operationMayBeInvisible,
  className,
  closable,
  onClose,
}) => {
  const tezos = useTezos();
  const { confirmOperationAndTriggerNewBlock } = useBlockTriggers();

  const hash = useMemo(() => operation.hash || operation.opHash, [operation]);

  const { transaction: transactionBaseUrl } = useExplorerBaseUrls();

  const descFooter = useMemo(
    () => (
      <div className="mt-2 text-xs flex items-center">
        <div className="whitespace-no-wrap">
          <T id="operationHash" />:{" "}
        </div>
        <HashChip
          hash={hash}
          firstCharsCount={10}
          lastCharsCount={7}
          small
          key="hash"
          className="ml-2 mr-2"
        />
        {transactionBaseUrl && (
          <OpenInExplorerChip baseUrl={transactionBaseUrl} hash={hash} />
        )}
      </div>
    ),
    [hash, transactionBaseUrl]
  );

  const [alert, setAlert] = useSafeState<{
    type: "success" | "error";
    title: string;
    description: ReactNode;
  }>(() => ({
    type: "success",
    title: `${t("success")} 🛫`,
    description: (
      <>
        <T id="requestSent" substitutions={typeTitle} />
        {operationMayBeInvisible && (
          <p>
            <T id="operationMayBeNotVisibleWarning" />
          </p>
        )}
        {descFooter}
        <div className="flex-1" />
      </>
    ),
  }));

  useEffect(() => {
    const abortCtrl = new AbortController();

    confirmOperationAndTriggerNewBlock(tezos, hash, {
      signal: abortCtrl.signal,
    })
      .then(() => {
        setAlert((a) => ({
          ...a,
          title: `${t("success")} ✅`,
          description: (
            <>
              <T
                id="operationSuccessfullyProcessed"
                substitutions={typeTitle}
              />
              {operationMayBeInvisible && (
                <p>
                  <T id="operationMayBeNotVisibleWarning" />
                </p>
              )}
              {descFooter}
            </>
          ),
        }));
      })
      .catch((err) => {
        setAlert({
          type: "error",
          title: t("error"),
          description:
            err instanceof FailedOpError
              ? err.message
              : t("timedOutOperationConfirmation"),
        });
      });

    return () => abortCtrl.abort();
  }, [
    confirmOperationAndTriggerNewBlock,
    tezos,
    hash,
    setAlert,
    descFooter,
    operationMayBeInvisible,
    typeTitle,
  ]);

  return (
    <Alert
      type={alert.type}
      title={alert.title}
      description={alert.description}
      autoFocus
      className={classNames("mb-8", className)}
      closable={closable}
      onClose={onClose}
    />
  );
};

export default OperationStatus;
