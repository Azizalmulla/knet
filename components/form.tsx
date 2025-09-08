"use client";

import { AnimatePresence, motion, Variants } from "motion/react";
import { useForm as useFormStateContext } from "@/components/form-context";
import { useForm, FormProvider, ControllerRenderProps } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TextInputField } from "@/components/fields/text-input";
import { TextareaField } from "@/components/fields/textarea";
import { RatingField } from "@/components/fields/rating";
import {
  FormControl,
  FormField,
  FormMessage,
  FormItem,
  FormLabel,
  FormDescription,
} from "@/components/ui/form";
import { ToggleGroupField } from "@/components/fields/toggle-group";
import { FormField as TFormField, FormStep as TFormStep } from "@/lib/types";
import { getStepSchema } from "@/lib/constants";
import { useCallback, useEffect, useMemo } from "react";
import { useIsV0 } from "@/lib/context"
import { cn } from "@/lib/utils";

const TRANSITION_DURATION = 0.3;

type FormStepProps = {
  step: TFormStep;
  onSubmit: () => void;
};

type FieldRendererProps = {
  field: TFormField;
  formField: ControllerRenderProps<Record<string, unknown>, string>;
} & {
  [key: string]: unknown;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const FieldRenderer = ({ field, children, formField, ...rest }: FieldRendererProps) => {
  if (field.type === "text") {
    return (
      <TextInputField
        key={field.label}
        field={field}
        controlProps={{
          ...formField,
          ...rest,
          value: String(formField.value),
          autoComplete: field.autoComplete,
        }}
      />
    );
  }
  if (field.type === "textarea") {
    return (
      <TextareaField
        key={field.label}
        field={field}
        controlProps={{
          ...formField,
          ...rest,
          value: String(formField.value),
        }}
        {...rest}
      />
    );
  }
  if (field.type === "rating") {
    return (
      <RatingField
        key={field.label}
        field={field}
        controlProps={{
          ...formField,
          ...rest,
          value: String(formField.value),
          onValueChange: (value) => formField.onChange(value),
        }}
      />
    );
  }
  if (field.type === "select") {
    return (
      <ToggleGroupField
        key={field.label}
        field={field}
        controlProps={{
          ...formField,
          ...rest,
          value: String(formField.value),
          onValueChange: (value) => formField.onChange(value),
        }}
      />
    );
  }

  return null;
};

const FormStep = ({ step, onSubmit }: FormStepProps) => {
  const {
    prevStep,
    isFirstStep,
    formData,
    updateField,
    isLastStep,
    isLoading,
    globalError,
    currentStep,
  } = useFormStateContext();

  useEffect(() => {
    const field = document.querySelector<HTMLInputElement>(
      `[data-step-idx='${currentStep}'] [data-field-idx='0']`
    );

    if (!field) return;

    setTimeout(() => {
      field?.focus();
    }, TRANSITION_DURATION * 1000);
  }, [currentStep]);

  const form = useForm({
    resolver: zodResolver(getStepSchema(step)),
    defaultValues: step.fields.reduce((acc, field) => {
      const v = formData[field.label];
      acc[field.label] = v ? String(v) : "";
      return acc;
    }, {} as Record<string, unknown>),
  });

  const handleSubmit = useMemo(() => {
    return form.handleSubmit((data: Record<string, unknown>) => {
      Object.entries(data).forEach(([key, value]) => {
        updateField(key, value as string);
      });
      onSubmit();
    });
  }, [form, updateField, onSubmit]);

  const handleFormKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <>
      <CardHeader>
        <CardTitle className="text-2xl font-medium">{step.title}</CardTitle>
        {step.description && (
          <CardDescription className="text-sm text-muted-foreground">
            {step.description}
          </CardDescription>
        )}
        {globalError && (
          <div className="text-red-600 text-sm mt-2">{globalError}</div>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <FormProvider {...form}>
          <form
            onSubmit={handleSubmit}
            onKeyDown={handleFormKeyDown}
            className="flex flex-col justify-between space-y-6 flex-1"
          >
            <div className="space-y-4">
              {step.fields.map((fieldData, idx) => (
                <FormField
                  key={fieldData.label}
                  control={form.control}
                  name={fieldData.label}
                  render={({ field: formField }) => (
                    <FormItem>
                      {!fieldData.hiddenLabel && (
                        <FormLabel className="text-xl">
                          {fieldData.label}
                        </FormLabel>
                      )}
                      <FormControl>
                        <FieldRenderer
                          data-field-idx={idx}
                          field={fieldData}
                          formField={formField}
                        />
                      </FormControl>
                      {fieldData.description && (
                        <FormDescription>
                          {fieldData.description}
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <div className="flex justify-between pt-4">
              <Button
                size="xl"
                type="submit"
                disabled={isLoading}
                className="order-2"
              >
                {isLoading ? "Submitting..." : isLastStep ? "Submit" : "Next"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="xl"
                onClick={prevStep}
                disabled={isFirstStep || isLoading}
                className="order-1"
              >
                Previous
              </Button>
            </div>
          </form>
        </FormProvider>
      </CardContent>
    </>
  );
};

const formStepVariants: Variants = {
  hidden: ({ direction }: { direction: number }) => {
    return {
      opacity: 0,
      x: direction >= 0 ? 100 : -100,
    };
  },
  visible: {
    opacity: 1,
    x: 0,
  },
  exit: ({ direction }: { direction: number }) => {
    return {
      opacity: 0,
      x: direction < 0 ? 100 : -100,
    };
  },
};

export const Form = ({ className }: { className?: string }) => {
  const {
    currentStep,
    steps,
    nextStep,
    isLastStep,
    submitFormData,
    direction,
  } = useFormStateContext();
  const isV0 = useIsV0();

  const currentStepData = steps[currentStep];

  const handleSubmit = useCallback(async () => {
    if (isLastStep) {
      try {
        await submitFormData();
      } catch {
        /* noop */
      }
    } else {
      nextStep();
    }
  }, [isLastStep, submitFormData, nextStep]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <AnimatePresence custom={{ direction }} mode={isV0 ? "wait" : "popLayout"}>
        <motion.div
          className="flex flex-col gap-6 flex-1"
          variants={formStepVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          custom={{
            direction,
          }}
          transition={{
            duration: TRANSITION_DURATION,
            ease: "backOut",
          }}
          data-step-idx={currentStep}
          key={`step-${currentStep}`}
        >
          <FormStep step={currentStepData} onSubmit={handleSubmit} />
        </motion.div>
      </AnimatePresence>
    </Card>
  );
};
