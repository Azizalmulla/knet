"use client"

import { Textarea } from "@/components/ui/textarea";
import { TextareaFormField } from "@/lib/types";

interface TextareaFieldProps {
  field: TextareaFormField;
  controlProps: React.ComponentProps<typeof Textarea>;
}

export const TextareaField = ({ field, controlProps }: TextareaFieldProps) => {
  return <Textarea
    placeholder={field.placeholder}
    {...controlProps}
  />;
};
