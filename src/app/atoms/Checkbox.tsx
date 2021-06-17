import React, {
  forwardRef,
  InputHTMLAttributes,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import classNames from "clsx";

import { ReactComponent as OkIcon } from "app/icons/ok.svg";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  containerClassName?: string;
  errored?: boolean;
};

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      containerClassName,
      errored = false,
      className,
      checked,
      onChange,
      onFocus,
      onBlur,
      ...rest
    },
    ref
  ) => {
    const prevChecked = useRef(checked || false);
    const [localChecked, setLocalChecked] = useState(() => checked || false);
    const handleChange = useCallback(
      (evt) => {
        if (onChange) {
          onChange(evt);
          if (evt.defaultPrevented) {
            return;
          }
        }

        setLocalChecked(evt.target.checked);
      },
      [onChange, setLocalChecked]
    );

    useEffect(() => {
      if (prevChecked.current !== checked) {
        setLocalChecked(checked || false);
      }
      prevChecked.current = checked || false;
    }, [checked]);

    /**
     * Focus handling
     */
    const [localFocused, setLocalFocused] = useState(false);

    const handleFocus = useCallback(
      (evt) => {
        if (onFocus) {
          onFocus(evt);
          if (evt.defaultPrevented) {
            return;
          }
        }

        setLocalFocused(true);
      },
      [onFocus, setLocalFocused]
    );

    const handleBlur = useCallback(
      (evt) => {
        if (onBlur) {
          onBlur(evt);
          if (evt.defaultPrevented) {
            return;
          }
        }

        setLocalFocused(false);
      },
      [onBlur, setLocalFocused]
    );

    return (
      <div
        className={classNames(
          "h-6 w-6 flex-shrink-0",
          localChecked ? "bg-primary-orange" : "bg-black-40",
          "border",
          (() => {
            switch (true) {
              case localChecked:
                return "border-primary-orange-dark";

              case localFocused:
                return "border-primary-orange";

              case Boolean(errored):
                return "border-red-400";

              default:
                return "border-gray-400";
            }
          })(),
          "rounded-md overflow-hidden",
          "disable-outline-for-click",
          localFocused && "shadow-outline",
          "transition ease-in-out duration-200",
          "text-white",
          "flex justify-center items-center",
          containerClassName
        )}
      >
        <input
          ref={ref}
          type="checkbox"
          className={classNames("sr-only", className)}
          checked={localChecked}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        <OkIcon
          className={classNames(
            localChecked ? "block" : "hidden",
            "h-4 w-4",
            "pointer-events-none",
            "stroke-current"
          )}
          style={{ strokeWidth: 2 }}
        />
      </div>
    );
  }
);

export default Checkbox;
