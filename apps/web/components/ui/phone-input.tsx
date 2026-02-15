"use client"

import * as React from "react"
import { useMaskInput } from "use-mask-input"
import { Input } from "./input"

/**
 * PhoneInput component with (###) ###-#### masking
 * Uses use-mask-input for automatic formatting
 */
export const PhoneInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<typeof Input>
>((props, externalRef) => {
  const maskRef = useMaskInput({
    mask: "(999) 999-9999",
  })

  // Merge refs: apply mask ref and forward external ref
  const mergedRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      maskRef(node)

      if (typeof externalRef === "function") {
        externalRef(node)
      } else if (externalRef) {
        externalRef.current = node
      }
    },
    [maskRef, externalRef]
  )

  return (
    <Input
      ref={mergedRef}
      type="tel"
      inputMode="numeric"
      {...props}
    />
  )
})

PhoneInput.displayName = "PhoneInput"
