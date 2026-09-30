import type { ReactNode, Ref } from "react"
import { NumericFormat } from "react-number-format"
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

type DecimalInputProps = {
  id?: string
  value: string
  /** Emits the plain decimal string ("1284.5"), never a float. */
  onChange: (value: string) => void
  onBlur?: () => void
  name?: string
  ref?: Ref<HTMLInputElement>
  decimals: number
  prefix?: ReactNode
  suffix?: ReactNode
  /** Extra trailing content inside the box, e.g. a "Use max" button. */
  trailing?: ReactNode
  placeholder?: string
  className?: string
  "aria-invalid"?: boolean
  "aria-describedby"?: string
  readOnly?: boolean
}

/**
 * Numeric input with Indian grouping (1,23,456.789) that keeps its value as a string.
 * type="text" + inputMode="decimal": no scroll-wheel changes and a numeric phone keyboard.
 */
export function DecimalInput({
  value,
  onChange,
  decimals,
  prefix,
  suffix,
  trailing,
  className,
  ref,
  ...rest
}: DecimalInputProps) {
  return (
    <InputGroup className={cn("h-11 md:h-9", className)}>
      {prefix ? (
        <InputGroupAddon>
          <InputGroupText>{prefix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
      <NumericFormat
        {...rest}
        getInputRef={ref}
        customInput={InputGroupInput}
        value={value}
        // Only the user's typing counts as a change. NumericFormat also reports changes to the
        // `value` prop (a form reset, an auto-filled maximum), which would mark the field as edited
        // and re-validate it.
        onValueChange={(values, info) => {
          if (info.source === "event") onChange(values.value)
        }}
        valueIsNumericString
        thousandSeparator=","
        thousandsGroupStyle="lakh"
        decimalScale={decimals}
        allowNegative={false}
        allowLeadingZeros={false}
        inputMode="decimal"
        autoComplete="off"
        className="text-right text-base tabular-nums md:text-sm"
      />
      {suffix || trailing ? (
        <InputGroupAddon align="inline-end">
          {suffix ? <InputGroupText>{suffix}</InputGroupText> : null}
          {trailing}
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  )
}

/** Tons with 3 decimals and a "t" unit. */
export function TonsInput(props: Omit<DecimalInputProps, "decimals" | "suffix">) {
  return <DecimalInput {...props} decimals={3} suffix="t" />
}

/** Rupees per ton with 2 decimals: "₹ [38,500.00] /t". */
export function RateInput(props: Omit<DecimalInputProps, "decimals" | "prefix" | "suffix">) {
  return <DecimalInput {...props} decimals={2} prefix="₹" suffix="/t" />
}
