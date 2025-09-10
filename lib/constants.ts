import { z } from "zod"
import type { FormStep } from "./types"

export const FORM_TITLE = "Feedback Form"
export const COMPANY_NAME = "Net"
export const FORM_DESCRIPTION = "Net's company feedback form"

export const FORM_FIELD_COMPLETION_TIME_SECONDS = 20

export const STEPS: FormStep[] = [
  {
    title: "First off, what’s your name?",
    description: "Tell us a bit about yourself.",
    fields: [
      {
        type: "text",
        label: "First name",
        placeholder: "John",
        autoComplete: "given-name",
        required: true,
      },
      {
        type: "text",
        autoComplete: "family-name",
        label: "Last name",
        placeholder: "Doe",
        required: true,
      },
    ],
  },
  {
    title: "What’s your email?",
    description: "We’ll use this to follow up if needed.",
    fields: [
      {
        type: "text",
        label: "Email",
        autoComplete: "email",
        placeholder: "Enter your email",
        schema: z.string().email("Please enter a valid email"),
        description: "We won't share your email with anyone else.",
        required: true,
      },
    ],
  },
  {
    title: "Thanks, what was your overall impression?",
    description: "Please select an option.",
    fields: [
      {
        type: "rating",
        label: "Rating",
        range: [1, 5],
        rangeLabel: ["Bad 👎", "Excellent 👍"],
        required: true,
      },
    ],
  },
  {
    title: "Awesome! What blew you away the most?",
    fields: [
      {
        type: "textarea",
        label: "Message",
        placeholder: "Type your answer here...",
        description: "Tell us what you liked the most about our service.",
        required: true,
      },
    ],
  },
  {
    title: "Did things turn out the way you thought?",
    description: "Just be open and sincere!",
    fields: [
      {
        type: "select",
        label: "Did things turn out the way you thought?",
        hiddenLabel: true,
        required: true,
        options: [
          { label: "Yes, everything was great!", value: "Yes" },
          { label: "No, I had some issues.", value: "No" },
        ],
      },
    ],
  },
]

export const getStepSchema = (step: FormStep) => {
  const schemaShape: Record<string, z.ZodType> = {}

  for (const field of step.fields) {
    // Create schema based on field type if not explicitly provided
    let fieldSchema: z.ZodType

    if (field.schema) {
      fieldSchema = field.schema
    } else {
      switch (field.type) {
        case "text":
        case "textarea":
          fieldSchema = z.string().min(1, "This field is required")
          break
        case "rating":
          const rangeErrorMessage = `Must be between ${field.range[0]} and ${field.range[1]}`
          fieldSchema = z
            .string()
            .transform((val) => Number(val))
            .pipe(z.number().min(field.range[0], rangeErrorMessage).max(field.range[1], rangeErrorMessage))
          break
        case "select":
          const validValues = field.options.map((opt) => opt.value)
          fieldSchema = z.enum(validValues as [string, ...string[]])
          break
        default:
          fieldSchema = z.string()
      }
    }

    // Make optional if not required
    if (!field.required) {
      fieldSchema = fieldSchema.optional()
    }

    schemaShape[field.label] = fieldSchema
  }

  return z.object(schemaShape)
}

export const getFormSchema = (steps: FormStep[]) => {
  const schemaShape: Record<string, z.ZodType> = {}

  for (const step of steps) {
    const stepSchema = getStepSchema(step)
    Object.assign(schemaShape, stepSchema.shape)
  }

  return z.object(schemaShape)
}
