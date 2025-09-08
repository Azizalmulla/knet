"use server";

import { EnvCheckResult } from "@joycostudio/v0-setup";
import { createClient } from "./supabase/server";
import {
  SupabaseFormSession,
  SessionData,
  FormData as TFormData,
  SupabaseFormSubmission,
} from "./types";
import {
  getSessionExpiryDate,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromServerCookies,
} from "./utils";
import { cookies } from "next/headers";
import { STEPS, getStepSchema } from "./constants";
import { ZodError } from "zod";

function generateSessionId(): string {
  return crypto.randomUUID();
}

export const createSession = async (): Promise<{
  session: SupabaseFormSession;
  sessionId: string;
}> => {
  const sessionId = generateSessionId();
  const cookieStore = await cookies();

  setSessionCookie(cookieStore, sessionId);

  const supabase = await createClient();

  const sessionData: Omit<SupabaseFormSession, "created_at" | "updated_at"> = {
    id: sessionId,
    form_data: {},
    current_step: -1,
    expires_at: getSessionExpiryDate(),
  };

  const { data, error } = await supabase
    .from("form_sessions")
    .insert(sessionData)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create session: ${error.message}`);
  }

  return { session: data, sessionId };
};

export const saveFormProgress = async (
  sessionId: string,
  formData: TFormData,
  currentStep: number
): Promise<{ success: boolean; errors?: Record<string, string> }> => {
  // Only validate if there's actual form data to validate
  const hasFormData = Object.keys(formData).length > 0;
  
  if (hasFormData && currentStep >= 0 && currentStep < STEPS.length) {
    try {
      const stepSchema = getStepSchema(STEPS[currentStep]);
      
      // Extract only the fields for the current step for validation
      const currentStepFields = STEPS[currentStep].fields.map(field => field.label);
      const stepFormData = Object.fromEntries(
        Object.entries(formData).filter(([key]) => currentStepFields.includes(key))
      );
      
      // Only validate if there are relevant fields for this step
      if (Object.keys(stepFormData).length > 0) {
        stepSchema.parse(stepFormData);
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach((issue) => {
          if (issue.path.length > 0) {
            errors[issue.path[0] as string] = issue.message;
          }
        });
        return { success: false, errors };
      }
      return { success: false, errors: { "root": "Something went wrong" } };
    }
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("form_sessions")
    .update({
      form_data: formData,
      current_step: currentStep,
    })
    .eq("id", sessionId);

  if (error) {
    throw new Error(`Failed to save form progress: ${error.message}`);
  }

  return { success: true };
};

export const restoreSession = async (
  sessionId: string
): Promise<SessionData | null> => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("form_sessions")
    .select("*")
    .eq("id", sessionId)
    .gt("expires_at", new Date().toISOString()) // Only get non-expired sessions
    .single();

  if (error || !data) {
    return null;
  }

  return {
    sessionId: data.id,
    formData: data.form_data,
    currentStep: data.current_step,
  };
};

export const restoreSessionFromServer =
  async (): Promise<SessionData | null> => {
    const cookieStore = await cookies();
    const sessionId = getSessionFromServerCookies(cookieStore);

    if (!sessionId) {
      return null;
    }

    return await restoreSession(sessionId);
  };

export const submitForm = async (): Promise<SupabaseFormSubmission> => {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const sessionId = getSessionFromServerCookies(cookieStore);

  if (!sessionId) {
    throw new Error("No active session found");
  }

  const sessionData = await restoreSession(sessionId);
  if (!sessionData) {
    throw new Error("Session not found or expired");
  }

  const submissionData: Omit<
    SupabaseFormSubmission,
    "id" | "created_at" | "updated_at"
  > = {
    session_id: sessionId,
    first_name: (sessionData.formData["First name"] as string) || null,
    last_name: (sessionData.formData["Last name"] as string) || null,
    email: (sessionData.formData["Email"] as string) || null,
    form_data: sessionData.formData,
  };

  const { data: submittedData, error: submissionError } = await supabase
    .from("form_submissions")
    .insert(submissionData)
    .select()
    .single<SupabaseFormSubmission>();

  if (submissionError) {
    throw new Error(`Failed to submit form: ${submissionError.message}`);
  }

  await supabase.from("form_sessions").delete().eq("id", sessionId);

  return submittedData;
};

export const getSubmissionBySession = async (sessionId: string) => {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("form_submissions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    firstName: data.first_name,
    lastName: data.last_name,
    email: data.email,
    formData: data.form_data,
    createdAt: data.created_at,
  };
};

export const clearSession = async (): Promise<void> => {
  const cookieStore = await cookies();
  const sessionId = getSessionFromServerCookies(cookieStore);

  if (sessionId) {
    const supabase = await createClient();
    try {
      await supabase.from("form_sessions").delete().eq("id", sessionId);
    } catch (error) {
      console.error("Failed to clear session from database:", error);
    }
  }

  clearSessionCookie(cookieStore);
};

const checkSchema = async () => {
  try {
    const supabase = await createClient();
    const { error: sessionError } = await supabase
      .from("form_sessions")
      .select("*")
      .limit(1);
    const { error: submissionError } = await supabase
      .from("form_submissions")
      .select("*")
      .limit(1);
  
    if (sessionError || submissionError) {
      return false;
    }
  
    return true;
  } catch {
    return false
  }
};

export const checkEnvs = async () => {
  if (process.env.NODE_ENV === "production") {
    return {
      envs: [],
      allValid: true,
    };
  }

  const requiredEnvs: (Omit<EnvCheckResult, "isValid"> & {
    check: () => Promise<boolean>;
  })[] = [
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      label: "NEXT_PUBLIC_SUPABASE_URL",
      check: async () => Boolean(process.env["NEXT_PUBLIC_SUPABASE_URL"]),
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      label: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      check: async () => Boolean(process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
    },
    {
      name: "Run this script in your database",
      label: "DATABASE SCHEMA",
      check: checkSchema,
      script: {
        language: "sql",
        content: `
          CREATE TABLE IF NOT EXISTS form_sessions (
            id TEXT PRIMARY KEY,
            form_data JSONB NOT NULL DEFAULT '{}',
            current_step INTEGER NOT NULL DEFAULT -1,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at TIMESTAMPTZ NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_form_sessions_id ON form_sessions(id);

          CREATE TABLE IF NOT EXISTS form_submissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id TEXT NOT NULL,
            first_name TEXT,
            last_name TEXT,
            email TEXT,
            form_data JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS idx_form_submissions_session_id ON form_submissions(session_id);
          CREATE INDEX IF NOT EXISTS idx_form_submissions_email ON form_submissions(email);
          
          -- Enable RLS
          ALTER TABLE form_sessions ENABLE ROW LEVEL SECURITY;
          ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
          
          -- RLS Policies
          CREATE POLICY "Allow anonymous session creation" ON form_sessions FOR INSERT WITH CHECK (true);
          CREATE POLICY "Allow session read with valid id" ON form_sessions FOR SELECT USING (id = current_setting('request.headers')::json->>'x-session-id');
          CREATE POLICY "Allow session update with valid id" ON form_sessions FOR UPDATE USING (id = current_setting('request.headers')::json->>'x-session-id') WITH CHECK (id = current_setting('request.headers')::json->>'x-session-id');
          CREATE POLICY "Allow session delete with valid id" ON form_sessions FOR DELETE USING (id = current_setting('request.headers')::json->>'x-session-id');
          CREATE POLICY "Allow submission creation with valid session" ON form_submissions FOR INSERT WITH CHECK (session_id = current_setting('request.headers')::json->>'x-session-id');
          CREATE POLICY "Allow submission access with valid session" ON form_submissions FOR SELECT USING (session_id = current_setting('request.headers')::json->>'x-session-id');
        `,
      },
    },
  ];

  const envs: EnvCheckResult[] = await Promise.all(
    requiredEnvs.map(async (env) => ({
      name: env.name,
      label: env.label,
      script: env.script,
      isValid: await env.check(),
    }))
  );

  const allValid = envs.every((env) => env.isValid);

  return {
    envs,
    allValid,
  };
};
