"use client"

import { Input } from "@/components/ui/input";
import { TextFormField } from "@/lib/types";

interface TextInputFieldProps {
  field: TextFormField;
  controlProps: React.ComponentProps<typeof Input>;
}

export const TextInputField = ({ field, controlProps }: TextInputFieldProps) => {

  const autocapitalize = field.label.toLowerCase().includes("email") ? "off" : "on";

  return (
    <Input
      type="text"
      placeholder={field.placeholder}
      autoCapitalize={autocapitalize}
      {...controlProps}
    />
  );
};
