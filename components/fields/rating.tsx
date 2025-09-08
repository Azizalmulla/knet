"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { RatingFormField } from "@/lib/types";
import { useEffect } from "react";

interface RatingFieldProps {
  field: RatingFormField;
  controlProps: Omit<Extract<React.ComponentProps<typeof ToggleGroup>, { type: "single" }>, "type">;
}

export const RatingField = ({ field, controlProps }: RatingFieldProps) => {
  const range = Array.from({ length: field.range[1] - field.range[0] + 1 }, (_, i) => field.range[0] + i);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key >= '0' && event.key <= '9') {
        const pressedNumber = parseInt(event.key);
        
        if (pressedNumber >= field.range[0] && pressedNumber <= field.range[1]) {
          controlProps.onValueChange?.(pressedNumber.toString());
          event.preventDefault();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [field, controlProps]);

  return (
    <div className="space-y-2">
      <ToggleGroup {...controlProps} type="single" variant="outline" className="flex w-full" size="lg">
        {range.map((value) => (
          <ToggleGroupItem key={value} value={value.toString()} className="!text-xl">
            {value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex justify-between text-sm text-gray-500">
        <span>{field.rangeLabel[0]}</span>
        <span>{field.rangeLabel[1]}</span>
      </div>
    </div>
  )
};
