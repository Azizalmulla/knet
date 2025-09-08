import { z } from "zod";

type BaseFormField = {
  label: string;
  hiddenLabel?: boolean;
  required?: boolean;
  schema?: z.ZodType;
  description?: string;
}

export type TextFormField = BaseFormField & {
  type: "text";
  placeholder?: string;
  autoComplete?: HTMLInputElement["autocomplete"];
}

export type TextareaFormField = BaseFormField & {
  type: "textarea";
  placeholder?: string;
}

export type RatingFormField = BaseFormField & {
  type: "rating";
  range: [number, number];
  rangeLabel: [string, string];
}

export type SelectFormField = BaseFormField & {
  type: "select";
  options: {
    label: string;
    value: string;
  }[];
}

export type FormField = TextFormField | TextareaFormField | RatingFormField | SelectFormField;

export type FormData = Record<string, string | number | null>;

export type FormStep = {
  title: string;
  description?: string;
  fields: FormField[];
}

// Session-related types
export type SupabaseFormSession = {
  id: string;
  form_data: FormData;
  current_step: number;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export type SupabaseFormSubmission = {
  id: string;
  session_id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  form_data: FormData;
  created_at: string;
  updated_at: string;
}

// Session management types
export type SessionData = {
  sessionId: string;
  formData: Record<string, string | number>;
  currentStep: number;
}

export type SessionAction = 
  | { type: "CREATE_SESSION"; sessionId: string }
  | { type: "RESTORE_SESSION"; sessionData: SessionData }
  | { type: "CLEAR_SESSION" }
