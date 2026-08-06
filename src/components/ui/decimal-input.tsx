"use client";

import type * as React from "react";
import { Input } from "@/components/ui/input";

interface DecimalInputProps
  extends Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> {
  value: number;
  onChange: (value: number) => void;
}

function digitsFromValue(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value * 100).toString();
}

function DecimalInput({ value, onChange, ...props }: DecimalInputProps) {
  const digits = digitsFromValue(value);
  const display = (Number(digits) / 100).toFixed(2);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const nextDigits = e.target.value.replace(/\D/g, "") || "0";
    onChange(Number(nextDigits) / 100);
  }

  return (
    <Input type="text" inputMode="decimal" value={display} onChange={handleChange} {...props} />
  );
}

export { DecimalInput };
