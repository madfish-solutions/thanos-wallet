import * as React from "react";
import classNames from "clsx";
import { useForm } from "react-hook-form";
import { T, t } from "lib/ui/i18n";
import { useThanosClient, useAccount } from "lib/thanos/front";
import AccountBanner from "app/templates/AccountBanner";
import FormField from "app/atoms/FormField";
import FormSubmitButton from "app/atoms/FormSubmitButton";
import Alert from "app/atoms/Alert";

const SUBMIT_ERROR_TYPE = "submit-error";

type FormData = {
  password: string;
};

type RevealSecretProps = {
  reveal: "private-key" | "seed-phrase";
};

const RevealSecret: React.FC<RevealSecretProps> = ({ reveal }) => {
  const {
    revealPrivateKey,
    revealMnemonic,
    setSeedRevealed,
  } = useThanosClient();
  const account = useAccount();

  const {
    register,
    handleSubmit,
    errors,
    setError,
    clearError,
    formState,
  } = useForm<FormData>();
  const submitting = formState.isSubmitting;

  const [secret, setSecret] = React.useState<string | null>(null);

  const secretFieldRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (account.publicKeyHash) {
      return () => setSecret(null);
    }
    return;
  }, [account.publicKeyHash, setSecret]);

  React.useEffect(() => {
    if (secret) {
      secretFieldRef.current?.focus();
      secretFieldRef.current?.select();
    }
  }, [secret]);

  React.useEffect(() => {
    if (secret) {
      const t = setTimeout(() => {
        setSecret(null);
      }, 10 * 60_000);

      return () => {
        clearTimeout(t);
      };
    }
    return;
  }, [secret, setSecret]);

  const formRef = React.useRef<HTMLFormElement>(null);

  const focusPasswordField = React.useCallback(() => {
    formRef.current
      ?.querySelector<HTMLInputElement>("input[name='password']")
      ?.focus();
  }, []);

  React.useLayoutEffect(() => {
    focusPasswordField();
  }, [focusPasswordField]);

  const onSubmit = React.useCallback(
    async ({ password }) => {
      if (submitting) return;

      clearError("password");
      try {
        let scrt: string;

        switch (reveal) {
          case "private-key":
            scrt = await revealPrivateKey(account.publicKeyHash, password);
            break;

          case "seed-phrase":
            scrt = await revealMnemonic(password);
            setSeedRevealed(true);
            break;
        }

        setSecret(scrt);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error(err);
        }

        // Human delay.
        await new Promise((res) => setTimeout(res, 300));
        setError("password", SUBMIT_ERROR_TYPE, err.message);
        focusPasswordField();
      }
    },
    [
      reveal,
      submitting,
      clearError,
      setError,
      revealPrivateKey,
      revealMnemonic,
      account.publicKeyHash,
      setSeedRevealed,
      setSecret,
      focusPasswordField,
    ]
  );

  const texts = React.useMemo(() => {
    switch (reveal) {
      case "private-key":
        return {
          name: t("privateKey"),
          accountBanner: (
            <AccountBanner
              account={account}
              labelDescription={t(
                "ifYouWantToRevealPrivateKeyFromOtherAccount"
              )}
              className="mb-6"
            />
          ),
          derivationPathBanner: null,
          attention: (
            <T
              name="doNotSharePrivateKey"
              substitutions={[
                <T name="doNotShareEmphasized" key="doNotShare">
                  {(message) => (
                    <span className="font-semibold">{message}</span>
                  )}
                </T>,
              ]}
            >
              {(message) => <>{message}</>}
            </T>
          ),
          fieldDesc: (
            <T name="privateKeyFieldDescription">
              {(message) => <>{message}</>}
            </T>
          ),
        };

      case "seed-phrase":
        return {
          name: t("seedPhrase"),
          accountBanner: null,
          derivationPathBanner: (
            <div className={classNames("mb-6", "flex flex-col")}>
              <h2
                className={classNames("mb-4", "leading-tight", "flex flex-col")}
              >
                <T name="derivationPath">
                  {(message) => (
                    <span className="text-base font-semibold text-gray-700">
                      {message}
                    </span>
                  )}
                </T>

                <T name="pathForHDAccounts">
                  {(message) => (
                    <span
                      className={classNames(
                        "mt-1",
                        "text-xs font-light text-gray-600"
                      )}
                      style={{ maxWidth: "90%" }}
                    >
                      {message}
                    </span>
                  )}
                </T>
              </h2>

              <div
                className={classNames(
                  "w-full",
                  "border rounded-md",
                  "p-2",
                  "flex items-center"
                )}
              >
                <T name="derivationPathExample">
                  {(message) => (
                    <span className="text-sm font-medium text-gray-800">
                      {message}
                    </span>
                  )}
                </T>
              </div>
            </div>
          ),
          attention: (
            <T
              name="doNotSharePhrase"
              substitutions={[
                <T key="doNotShare" name="doNotShareEmphasized">
                  {(message) => (
                    <span className="font-semibold">{message}</span>
                  )}
                </T>,
              ]}
            >
              {(message) => <>{message}</>}
            </T>
          ),
          fieldDesc: (
            <>
              <T name="youWillNeedThisSeedPhrase">
                {(message) => <>{message}</>}
              </T>{" "}
              <T name="keepSeedPhraseSecret">{(message) => <>{message}</>}</T>
            </>
          ),
        };
    }
  }, [reveal, account]);

  return (
    <div className="w-full max-w-sm p-2 mx-auto">
      {texts.accountBanner}

      {texts.derivationPathBanner}

      {secret ? (
        <>
          <FormField
            ref={secretFieldRef}
            secret
            textarea
            rows={4}
            readOnly
            label={texts.name}
            labelDescription={texts.fieldDesc}
            id="reveal-secret-secret"
            spellCheck={false}
            containerClassName="mb-4"
            className="resize-none notranslate"
            value={secret}
          />

          <Alert
            title={t("attentionExclamation")}
            description={<p>{texts.attention}</p>}
            className="my-4"
          />
        </>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit(onSubmit)}>
          <FormField
            ref={register({ required: "Required" })}
            label={t("password")}
            labelDescription={t(
              "revealSecretPasswordInputDescription",
              texts.name
            )}
            id="reveal-secret-password"
            type="password"
            name="password"
            placeholder="********"
            errorCaption={errors.password?.message}
            containerClassName="mb-4"
          />

          <T name="reveal">
            {(message) => (
              <FormSubmitButton loading={submitting}>
                {message}
              </FormSubmitButton>
            )}
          </T>
        </form>
      )}
    </div>
  );
};

export default RevealSecret;
