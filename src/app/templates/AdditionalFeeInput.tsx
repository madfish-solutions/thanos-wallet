import React, {
  ComponentType,
  FC,
  ForwardRefExoticComponent,
  Fragment,
  FunctionComponent,
  MutableRefObject,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import BigNumber from "bignumber.js";
import classNames from "clsx";
import {
  Controller,
  ControllerProps,
  EventFunction,
  FieldError,
} from "react-hook-form";

import AssetField from "app/atoms/AssetField";
import FormCheckbox from "app/atoms/FormCheckbox";
import Money from "app/atoms/Money";
import Name from "app/atoms/Name";
import { ReactComponent as CoffeeIcon } from "app/icons/coffee.svg";
import { ReactComponent as CupIcon } from "app/icons/cup.svg";
import { ReactComponent as RocketIcon } from "app/icons/rocket.svg";
import { ReactComponent as SettingsIcon } from "app/icons/settings.svg";
import CustomSelect, { OptionRenderProps } from "app/templates/CustomSelect";
import { AnalyticsEventCategory, useAnalytics } from "lib/analytics";
import { toLocalFixed } from "lib/i18n/numbers";
import { T, t } from "lib/i18n/react";
import { mutezToTz, TempleToken, TEZ_ASSET, tzToMutez } from "lib/temple/front";

import { AdditionalFeeInputSelectors } from "./AdditionalFeeInput.selectors";

type AssetFieldProps = typeof AssetField extends ForwardRefExoticComponent<
  infer T
>
  ? T
  : never;

export type AdditionalFeeInputProps = Pick<
  ControllerProps<ComponentType>,
  "name" | "control" | "onChange"
> & {
  assetSymbol?: string;
  baseFee?: BigNumber | Error;
  token?: TempleToken;
  tokenPrice?: number;
  error?: FieldError;
  id: string;
};

type FeeOption = {
  Icon?: FunctionComponent<SVGProps<SVGSVGElement>>;
  descriptionI18nKey: string;
  type: "minimal" | "fast" | "rocket" | "custom";
  amount?: BigNumber;
};

const xtzFeeOptions: FeeOption[] = [
  {
    Icon: CoffeeIcon,
    descriptionI18nKey: "minimalFeeDescription",
    type: "minimal",
    amount: new BigNumber(1e-4),
  },
  {
    Icon: ({ className, ...rest }) => (
      <CupIcon
        className={classNames("transform scale-95", className)}
        {...rest}
      />
    ),
    descriptionI18nKey: "fastFeeDescription",
    type: "fast",
    amount: new BigNumber(1.5e-4),
  },
  {
    Icon: RocketIcon,
    descriptionI18nKey: "rocketFeeDescription",
    type: "rocket",
    amount: new BigNumber(2e-4),
  },
  {
    Icon: ({ className, ...rest }) => (
      <SettingsIcon
        className={classNames("transform scale-95", className)}
        {...rest}
      />
    ),
    descriptionI18nKey: "customFeeDescription",
    type: "custom",
  },
];

const getFeeOptionId = (option: FeeOption) => option.type;

const AdditionalFeeInput: FC<AdditionalFeeInputProps> = (props) => {
  const {
    assetSymbol,
    baseFee,
    control,
    error,
    id,
    name,
    onChange,
    token,
    tokenPrice,
  } = props;
  const { trackEvent } = useAnalytics();

  const validateAdditionalFee = useCallback((v?: AdditionalFeeValue) => {
    if (v?.amount === undefined) {
      return t("required");
    }
    const bn = new BigNumber(v.amount);
    if (bn.lte(0)) {
      return t("amountMustBePositive");
    }
    return true;
  }, []);

  const customFeeInputRef = useRef<HTMLInputElement>(null);
  const focusCustomFeeInput = useCallback(() => {
    customFeeInputRef.current?.focus();
  }, []);

  const handleChange: EventFunction = (event) => {
    trackEvent(
      AdditionalFeeInputSelectors.FeeButton,
      AnalyticsEventCategory.ButtonPress
    );
    return onChange !== undefined && onChange(event);
  };

  return (
    <Controller
      name={name}
      as={AdditionalFeeInputContent}
      control={control}
      customFeeInputRef={customFeeInputRef}
      onChange={handleChange}
      id={id}
      assetSymbol={assetSymbol}
      onFocus={focusCustomFeeInput}
      label={t("additionalFee")}
      baseFee={baseFee}
      placeholder="0"
      errorCaption={error?.message}
      rules={{
        validate: validateAdditionalFee,
      }}
      token={token}
      tokenPrice={tokenPrice}
    />
  );
};

export default AdditionalFeeInput;

export type AdditionalFeeValue = {
  inToken: boolean;
  amount?: string;
};

type AdditionalFeeInputContentProps = Omit<
  AssetFieldProps,
  "onChange" | "value" | "labelDescription"
> &
  Pick<AdditionalFeeInputProps, "token" | "tokenPrice" | "baseFee"> & {
    customFeeInputRef: MutableRefObject<HTMLInputElement | null>;
    onChange?: (newValue: AdditionalFeeValue) => void;
    value?: AdditionalFeeValue;
  };

const defaultAdditionalFeeValue: AdditionalFeeValue = { inToken: false };

const AdditionalFeeInputContent: FC<AdditionalFeeInputContentProps> = (
  props
) => {
  const {
    baseFee,
    className,
    containerClassName,
    customFeeInputRef,
    onChange,
    assetSymbol,
    id,
    label,
    token,
    tokenPrice,
    value = defaultAdditionalFeeValue,
    ...restProps
  } = props;
  const { inToken, amount: amountFromValue } = value;

  const actualInToken = token ? inToken : false;
  useEffect(() => {
    if (actualInToken !== inToken) {
      onChange?.({ amount: amountFromValue, inToken: actualInToken });
    }
  }, [amountFromValue, inToken, actualInToken, onChange]);

  const tokenFeeOptions = useMemo(() => {
    if (!token) {
      return [];
    }
    return xtzFeeOptions.map((option) => ({
      ...option,
      amount:
        option.amount &&
        tzToMutez(option.amount)
          .multipliedBy(tokenPrice ?? 1)
          .decimalPlaces(token.decimals),
    }));
  }, [token, tokenPrice]);

  const feeOptions = token && inToken ? tokenFeeOptions : xtzFeeOptions;

  const [selectedPreset, setSelectedPreset] = useState<FeeOption["type"]>(
    feeOptions.find(
      ({ amount }) =>
        amountFromValue !== undefined && amount?.eq(amountFromValue)
    )?.type || "custom"
  );
  const handlePresetSelected = useCallback(
    (newType: FeeOption["type"]) => {
      setSelectedPreset(newType);
      const option = feeOptions.find(({ type }) => type === newType)!;
      if (option.amount) {
        onChange?.({ inToken, amount: `${option.amount}` });
      }
    },
    [onChange, feeOptions, inToken]
  );
  const handleAmountChange = useCallback(
    (newAmount?: string) => {
      onChange?.({ inToken, amount: newAmount });
    },
    [onChange, inToken]
  );
  const handleInTokenChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newInToken = e.target.checked;
      let newAmount = amountFromValue;
      if (newAmount && selectedPreset === "custom") {
        newAmount = newInToken
          ? tzToMutez(newAmount)
              .multipliedBy(tokenPrice ?? 1)
              .decimalPlaces(token!.decimals)
              .toString()
          : mutezToTz(
              new BigNumber(newAmount).dividedBy(tokenPrice ?? 1)
            ).toString();
      } else {
        const newOptions = newInToken ? tokenFeeOptions : xtzFeeOptions;
        newAmount = newOptions
          .find(({ type }) => type === selectedPreset)!
          .amount?.toString();
      }
      onChange?.({ inToken: e.target.checked, amount: newAmount });
    },
    [
      onChange,
      amountFromValue,
      selectedPreset,
      token,
      tokenFeeOptions,
      tokenPrice,
    ]
  );

  const defaultAssetSymbol = token && inToken ? token.symbol : TEZ_ASSET.symbol;

  const FeeOptionContent = useCallback(
    (props: OptionRenderProps<FeeOption>) => (
      <GenericFeeOptionContent
        {...props}
        assetSymbol={defaultAssetSymbol}
        cryptoDecimals={
          token?.decimals === undefined ? undefined : token.decimals - 1
        }
      />
    ),
    [token, defaultAssetSymbol]
  );

  const labelDescription = useMemo(
    () =>
      baseFee instanceof BigNumber && (
        <T
          id="feeInputDescription"
          substitutions={[
            <Fragment key={0}>
              <span className="font-normal">
                {toLocalFixed(baseFee)}
                {defaultAssetSymbol === TEZ_ASSET.symbol
                  ? ""
                  : ` ${defaultAssetSymbol}`}
              </span>
            </Fragment>,
          ]}
        />
      ),
    [baseFee, defaultAssetSymbol]
  );

  return (
    <div className="flex flex-col w-full mb-2">
      {label ? (
        <label
          className="flex flex-col mb-4 leading-tight"
          htmlFor={`${id}-select`}
        >
          <span className="text-base font-semibold text-gray-700">{label}</span>

          {labelDescription && (
            <span
              className={classNames("mt-1", "text-xs font-light text-gray-600")}
              style={{ maxWidth: "90%" }}
            >
              {labelDescription}
            </span>
          )}
        </label>
      ) : null}

      <FormCheckbox
        checked={inToken}
        onChange={handleInTokenChange}
        name="inToken"
        label={"Pay fee in token"}
        containerClassName={classNames("mb-4", !token && "hidden")}
      />

      <div className="relative flex flex-col items-stretch">
        <CustomSelect
          activeItemId={selectedPreset}
          className="mb-4"
          getItemId={getFeeOptionId}
          id={`${id}-select`}
          items={feeOptions}
          onSelect={handlePresetSelected}
          padding="0.2rem 0.375rem 0.2rem 0.375rem"
          OptionIcon={FeeOptionIcon}
          OptionContent={FeeOptionContent}
        />

        <AssetField
          assetDecimals={token?.decimals}
          containerClassName={classNames(
            selectedPreset !== "custom" && "hidden",
            "mb-2"
          )}
          id={id}
          onChange={handleAmountChange}
          ref={customFeeInputRef}
          assetSymbol={assetSymbol ?? defaultAssetSymbol}
          value={amountFromValue}
          {...restProps}
        />
      </div>
    </div>
  );
};

const FeeOptionIcon: FC<OptionRenderProps<FeeOption>> = ({
  item: { Icon },
}) => {
  if (Icon) {
    return (
      <Icon
        className="flex-none inline-block stroke-current opacity-90"
        style={{ width: 24, height: 24 }}
      />
    );
  }

  return <div style={{ width: 24, height: 24 }} />;
};

const GenericFeeOptionContent: FC<
  OptionRenderProps<FeeOption> & {
    assetSymbol: string;
    cryptoDecimals?: number;
  }
> = ({
  item: { descriptionI18nKey, amount },
  assetSymbol,
  cryptoDecimals = 5,
}) => {
  return (
    <>
      <div className="flex flex-wrap items-center">
        <T id={descriptionI18nKey}>
          {(message) => (
            <Name className="w-16 text-sm font-medium leading-tight text-left">
              {message}
            </Name>
          )}
        </T>

        {amount && (
          <div className="ml-2 leading-none text-gray-600">
            <Money cryptoDecimals={cryptoDecimals}>{amount}</Money>{" "}
            <span style={{ fontSize: "0.75em" }}>{assetSymbol}</span>
          </div>
        )}
      </div>
    </>
  );
};
