import React, {
  FC,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { WalletContract } from "@taquito/taquito";
import classNames from "clsx";
import { Controller, useForm } from "react-hook-form";

import Alert from "app/atoms/Alert";
import AssetField from "app/atoms/AssetField";
import FormField from "app/atoms/FormField";
import FormSubmitButton from "app/atoms/FormSubmitButton";
import NoSpaceField from "app/atoms/NoSpaceField";
import Spinner from "app/atoms/Spinner";
import { ReactComponent as AddIcon } from "app/icons/add.svg";
import PageLayout from "app/layouts/PageLayout";
import { useFormAnalytics } from "lib/analytics";
import { T, t } from "lib/i18n/react";
import { sanitizeImgUri } from "lib/image-uri";
import {
  TempleToken,
  TempleAssetType,
  useTokens,
  useTezos,
  validateContractAddress,
  useNetwork,
  assertTokenType,
  NotMatchingStandardError,
  loadContractForCallLambdaView,
  getAssetKey,
  fetchTokenMetadata,
  MetadataParseError,
  TokenMetadata,
  UndefinedTokenError,
} from "lib/temple/front";
import { withErrorHumanDelay } from "lib/ui/humanDelay";
import { navigate } from "lib/woozie";

const AddToken: FC = () => (
  <PageLayout
    pageTitle={
      <>
        <AddIcon className="w-auto h-4 mr-1 stroke-current" />
        <T id="addToken" />
      </>
    }
  >
    <Form />
  </PageLayout>
);

export default AddToken;

type TempleCustomTokenType = TempleAssetType.FA1_2 | TempleAssetType.FA2;
type TopFormData = {
  address: string;
  id?: number;
};

const Form: FC = () => {
  const tezos = useTezos();
  const { id: networkId } = useNetwork();

  const {
    control,
    register,
    errors,
    watch,
    setValue,
    triggerValidation,
  } = useForm<TopFormData>({
    defaultValues: { id: 0 },
    reValidateMode: "onBlur",
  });
  const contractAddress = watch("address");
  const previousAddressRef = useRef<string>();
  const previousNetworkIdRef = useRef(networkId);
  const tokenId = watch("id");
  const previousTokenIdRef = useRef<number | undefined>(0);

  const [tokenDataError, setTokenDataError] = useState<ReactNode>(null);
  const [tokenType, setTokenType] = useState<TempleCustomTokenType>();
  const tokenTypeRef = useRef<TempleCustomTokenType>();
  const [tokenValidationError, setTokenValidationError] = useState<ReactNode>(
    null
  );
  const [loadingToken, setLoadingToken] = useState(false);
  const [bottomFormInitialData, setBottomFormInitialData] = useState<
    Partial<TokenMetadata>
  >();

  useEffect(() => {
    setTokenValidationError(null);
    setBottomFormInitialData(undefined);
    if (validateContractAddress(contractAddress) !== true) {
      setTokenType(undefined);
      tokenTypeRef.current = undefined;
      previousAddressRef.current = undefined;
      previousTokenIdRef.current = 0;
      setBottomFormInitialData(undefined);
      previousNetworkIdRef.current = networkId;
      return;
    }
    triggerValidation("address");
    (async () => {
      try {
        setTokenDataError(null);
        setLoadingToken(true);

        let contract: WalletContract;
        try {
          contract = await loadContractForCallLambdaView(
            tezos,
            contractAddress
          );
        } catch (_err) {
          throw new TokenValidationError(t("contractNotAvailable"));
        }

        let tokenData;

        if (
          previousAddressRef.current !== contractAddress ||
          previousNetworkIdRef.current !== networkId
        ) {
          try {
            await assertTokenType(TempleAssetType.FA1_2, contract, tezos);
            tokenTypeRef.current = TempleAssetType.FA1_2;
            setTokenType(TempleAssetType.FA1_2);
          } catch (fa12Error) {
            try {
              await assertTokenType(TempleAssetType.FA2, contract, tezos, 0);
              tokenTypeRef.current = TempleAssetType.FA2;
              setTokenType(TempleAssetType.FA2);
              setValue("id", 0);
            } catch (fa2Error) {
              if (fa2Error instanceof UndefinedTokenError) {
                tokenTypeRef.current = TempleAssetType.FA2;
                setTokenType(TempleAssetType.FA2);
                setValue("id", undefined);
              } else {
                setTokenType(undefined);
                setValue("id", 0);
                setBottomFormInitialData(undefined);
                if (fa2Error instanceof NotMatchingStandardError) {
                  throw new TokenValidationError(
                    t("tokenDoesNotMatchAnyStandard", [
                      fa12Error.message as string,
                      fa2Error.message,
                    ])
                  );
                } else {
                  throw new TokenValidationError(fa2Error.message);
                }
              }
            }
          }
        } else if (
          previousTokenIdRef.current !== tokenId &&
          tokenTypeRef.current === TempleAssetType.FA2
        ) {
          if (tokenId === undefined) {
            setBottomFormInitialData(undefined);
            setLoadingToken(false);
            previousAddressRef.current = contractAddress;
            previousTokenIdRef.current = tokenId;
            return;
          } else {
            try {
              await assertTokenType(
                TempleAssetType.FA2,
                contract,
                tezos,
                tokenId!
              );
            } catch (e) {
              throw new TokenValidationError(e.message);
            }
          }
        } else {
          previousAddressRef.current = contractAddress;
          previousTokenIdRef.current = tokenId;
          return;
        }

        const newTokenType = tokenTypeRef.current;

        if (!newTokenType) {
          return;
        }

        try {
          if (newTokenType === TempleAssetType.FA1_2) {
            await assertTokenType(newTokenType, contract, tezos);
            tokenData = await fetchTokenMetadata(tezos, contractAddress);
          } else {
            await assertTokenType(newTokenType, contract, tezos, tokenId!);
            tokenData = await fetchTokenMetadata(
              tezos,
              contractAddress,
              tokenId!
            );
          }
        } catch (err) {
          if (err instanceof MetadataParseError) {
            throw err;
          } else if (err instanceof NotMatchingStandardError) {
            throw new TokenValidationError(
              `${t(
                "tokenDoesNotMatchStandard",
                newTokenType === TempleAssetType.FA1_2 ? "FA1.2" : "FA2"
              )}: ${err.message}`
            );
          } else {
            throw new TokenValidationError(err.message);
          }
        }

        setBottomFormInitialData({
          symbol: tokenData.symbol.substr(0, 5),
          name: tokenData.name.substr(0, 50),
          decimals: tokenData.decimals,
          iconUrl: tokenData.iconUrl,
        });
      } catch (e) {
        withErrorHumanDelay(e, () => {
          if (e instanceof TokenValidationError) {
            setTokenValidationError(e.message);
            return;
          }
          let errorMessage =
            e instanceof MetadataParseError ? (
              e.message
            ) : (
              <T id="unknownParseErrorOccurred" />
            );
          setBottomFormInitialData({
            symbol: "",
            name: "",
            decimals: 0,
          });
          setTokenDataError(errorMessage);
        });
      } finally {
        setLoadingToken(false);
        previousAddressRef.current = contractAddress;
        previousTokenIdRef.current = tokenId;
        previousNetworkIdRef.current = networkId;
      }
    })();
  }, [contractAddress, tezos, setValue, networkId, triggerValidation, tokenId]);

  const cleanContractAddress = useCallback(() => {
    setValue("address", "");
    triggerValidation("address");
  }, [setValue, triggerValidation]);

  const isFA2Token = tokenType === TempleAssetType.FA2;

  return (
    <div className="w-full max-w-sm mx-auto my-8">
      <form>
        <NoSpaceField
          ref={register({
            required: t("required"),
            validate: validateContractAddress,
          })}
          name="address"
          id="addtoken-address"
          textarea
          rows={2}
          cleanable={Boolean(contractAddress)}
          onClean={cleanContractAddress}
          label={t("address")}
          labelDescription={t("addressOfDeployedTokenContract")}
          placeholder={t("tokenContractPlaceholder")}
          errorCaption={errors.address?.message}
          containerClassName={isFA2Token ? "mb-4" : "mb-6"}
        />

        <div
          className={classNames(
            "mb-6",
            "flex flex-col",
            !isFA2Token && "hidden"
          )}
        >
          <Controller
            as={AssetField}
            control={control}
            rules={{
              min: { value: 0, message: t("nonNegativeIntMessage") },
              required: isFA2Token ? t("required") : undefined,
            }}
            name="id"
            id="token-id"
            label={t("tokenId")}
            labelDescription={t("tokenIdInputDescription")}
            placeholder="0"
            errorCaption={errors.id?.message}
          />
        </div>
      </form>

      {tokenValidationError && (
        <Alert
          type="error"
          title={t("error")}
          autoFocus
          description={tokenValidationError}
          className="mb-8"
        />
      )}

      {tokenDataError && (
        <Alert
          type="warn"
          title={t("failedToParseMetadata")}
          autoFocus
          description={tokenDataError}
          className="mb-8"
        />
      )}

      <BottomSection
        hidden={!bottomFormInitialData}
        address={contractAddress}
        initialData={bottomFormInitialData}
        tokenType={tokenType}
        id={tokenId}
      />

      {loadingToken && (
        <div className="my-8 w-full flex items-center justify-center pb-4">
          <div>
            <Spinner theme="gray" className="w-20" />
          </div>
        </div>
      )}
    </div>
  );
};

type BottomSectionProps = {
  address: string;
  hidden?: boolean;
  initialData?: Partial<TokenMetadata>;
  tokenType?: TempleCustomTokenType;
  id?: number;
};

const urlValidationRules = {
  validate: (val: string) => {
    if (!val) return true;
    if (
      val.match(/(https:\/\/.*\.(?:png|jpg|jpeg|gif|webp))/i) ||
      val.match(/(ipfs:\/\/.*)/i)
    ) {
      return true;
    }

    return (
      <ul className="list-disc list-inside">
        <T id="validImageURL">{(message) => <li>{message}</li>}</T>
        <T id="onlyHTTPS">{(message) => <li>{message}</li>}</T>
        <T id="formatsAllowed">{(message) => <li>{message}</li>}</T>
        <T id="orIPFSImageURL">{(message) => <li>{message}</li>}</T>
      </ul>
    );
  },
};

const BottomSection: FC<BottomSectionProps> = (props) => {
  const { address, hidden, initialData, tokenType, id } = props;
  const {
    handleSubmit,
    register,
    errors,
    formState,
    reset,
  } = useForm<TokenMetadata>({
    defaultValues: initialData,
  });
  const prevInitialDataRef = useRef(initialData);
  const formAnalytics = useFormAnalytics("AddToken");

  const { addToken } = useTokens();
  const [submitError, setSubmitError] = useState<React.ReactNode>(null);

  useEffect(() => {
    if (prevInitialDataRef.current !== initialData) {
      reset(initialData);
      setSubmitError(null);
    }
    prevInitialDataRef.current = initialData;
  }, [initialData, reset]);

  const onSubmit = useCallback(
    async ({ symbol, name, decimals, iconUrl }: TokenMetadata) => {
      if (formState.isSubmitting) {
        return;
      }

      setSubmitError(null);

      formAnalytics.trackSubmit();
      try {
        const tokenCommonProps = {
          address,
          symbol,
          name,
          decimals: decimals ? +decimals : 0,
          iconUrl: iconUrl ? sanitizeImgUri(iconUrl) : undefined,
          fungible: true,
          status: "displayed" as const,
        };

        const newToken: TempleToken =
          tokenType === TempleAssetType.FA1_2
            ? {
                type: TempleAssetType.FA1_2,
                ...tokenCommonProps,
              }
            : {
                type: TempleAssetType.FA2,
                id: Number(id!),
                ...tokenCommonProps,
              };

        await addToken(newToken);
        const assetKey = getAssetKey(newToken);

        // Wait a little bit while the tokens updated
        await new Promise((r) => setTimeout(r, 300));

        formAnalytics.trackSubmitSuccess();

        navigate({
          pathname: `/explore/${assetKey}`,
          search: "after_token_added=true",
        });
      } catch (err) {
        formAnalytics.trackSubmitFail();

        if (process.env.NODE_ENV === "development") {
          console.error(err);
        }

        // Human delay
        await new Promise((r) => setTimeout(r, 300));
        setSubmitError(err.message);
      }
    },
    [addToken, address, formState.isSubmitting, id, tokenType, formAnalytics]
  );

  return (
    <form
      className={classNames("w-full", { hidden })}
      onSubmit={handleSubmit(onSubmit)}
    >
      <FormField
        ref={register({
          required: t("required"),
          validate: (val: string) => {
            if (!val || val.length < 2 || val.length > 5) {
              return t("tokenSymbolPatternDescription");
            }
            return true;
          },
        })}
        name="symbol"
        id="addtoken-symbol"
        label={t("symbol")}
        labelDescription={t("tokenSymbolInputDescription")}
        placeholder={t("tokenSymbolInputPlaceholder")}
        errorCaption={errors.symbol?.message}
        containerClassName="mb-4"
      />

      <FormField
        ref={register({
          required: t("required"),
          pattern: {
            value: /^[a-zA-Z0-9 _-]{3,50}$/,
            message: t("tokenNamePatternDescription"),
          },
        })}
        name="name"
        id="addtoken-name"
        label={t("name")}
        labelDescription={t("tokenNameInputDescription")}
        placeholder={t("tokenNameInputPlaceholder")}
        errorCaption={errors.name?.message}
        containerClassName="mb-4"
      />

      <FormField
        ref={register({
          min: { value: 0, message: t("nonNegativeIntMessage") },
        })}
        type="number"
        name="decimals"
        id="addtoken-decimals"
        label={t("decimals")}
        labelDescription={t("decimalsInputDescription")}
        placeholder="0"
        errorCaption={errors.decimals?.message}
        containerClassName="mb-4"
      />

      <FormField
        ref={register(urlValidationRules)}
        name="iconUrl"
        id="addtoken-iconUrl"
        label={
          <>
            <T id="iconURL" />{" "}
            <T id="optionalComment">
              {(message) => (
                <span className="text-sm font-light text-gray-600">
                  {message}
                </span>
              )}
            </T>
          </>
        }
        labelDescription={t("iconURLInputDescription")}
        placeholder="e.g. https://cdn.com/mytoken.png"
        errorCaption={errors.iconUrl?.message}
        containerClassName="mb-6"
      />

      {submitError && (
        <Alert
          type="error"
          title={t("error")}
          autoFocus
          description={submitError}
          className="mb-6"
        />
      )}

      <T id="addToken">
        {(message) => (
          <FormSubmitButton loading={formState.isSubmitting}>
            {message}
          </FormSubmitButton>
        )}
      </T>
    </form>
  );
};

class TokenValidationError extends Error {}
