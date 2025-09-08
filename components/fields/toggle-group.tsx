"use client";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SelectFormField } from "@/lib/types";
import { useEffect } from "react";

interface ToggleGroupFieldProps {
  field: SelectFormField;
  controlProps: Omit<
    Extract<React.ComponentProps<typeof ToggleGroup>, { type: "single" }>,
    "type"
  >;
}

export const ToggleGroupField = ({
  field,
  controlProps,
}: ToggleGroupFieldProps) => {
  

  const yesOption = field.options.find(option => option.value.toLowerCase() === "yes");
  const noOption = field.options.find(option => option.value.toLowerCase() === "no");

  const isYesNo = field.options.length === 2 && yesOption && noOption;

  useEffect(() => {
    if (isYesNo) {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key.toLowerCase() === "y") {
          event.preventDefault();
          controlProps.onValueChange?.(yesOption.value);
        } else if (event.key.toLowerCase() === "n") {
          event.preventDefault();
          controlProps.onValueChange?.(noOption.value);
        }
      };

      window.addEventListener("keydown", handleKeyDown);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
      };
    }
  }, [controlProps, isYesNo, noOption?.value, yesOption?.value]);

  return (
    <ToggleGroup
      {...controlProps}
      type="single"
      size="lg"
      variant="outline"
      className="flex flex-col items-start gap-2 w-full"
    >
      {field.options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          aria-label={option.label}
          className="h-auto justify-start w-full rounded-2xl px-4 py-3 text-xl gap-4"
        >
          {isYesNo && (
            <span className="bg-secondary rounded-md text-secondary-foreground size-6 border font-bold border-border flex items-center justify-center text-base">
              {option.value.toLowerCase() === "yes" ? "Y" : "N"}
            </span>
          )}
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
};
