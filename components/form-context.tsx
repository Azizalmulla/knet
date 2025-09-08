"use client"

import { createContext, useContext, useReducer, ReactNode, useMemo, useEffect, useCallback } from "react";
import { STEPS } from "@/lib/constants";
import { FormStep, FormData as TFormData, SessionData, SupabaseFormSubmission } from "@/lib/types";
import { createSession, saveFormProgress, submitForm, getSubmissionBySession, clearSession } from "@/lib/actions";

interface FormState {
  currentStep: number;
  formData: TFormData;
  submissionData: SupabaseFormSubmission | null;
  steps: FormStep[];
  sessionId: string | null;
  isLoading: boolean;
  globalError: string | null;
  direction: number;
}

interface FormContextValue extends FormState {
  nextStep: () => void;
  prevStep: () => void;
  updateField: (fieldName: string, value: string | number) => void;
  goToStep: (stepIndex: number) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitted: boolean;
  submitFormData: () => Promise<void>;
  createSessionAndStart: () => Promise<void>;
  resetSessionAndState: () => Promise<void>;
  verifySubmissionAccess: () => Promise<boolean>;
}

type FormAction =
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "GO_TO_STEP"; payload: number }
  | { type: "UPDATE_FIELD"; payload: { fieldName: string; value: string | number } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "RESTORE_SESSION"; payload: SessionData }
  | { type: "CREATE_SESSION"; payload: string }
  | { type: "SET_SUBMITTED"; payload: boolean }
  | { type: "SET_GLOBAL_ERROR"; payload: string | null }
  | { type: "SET_SUBMISSION_DATA"; payload: SupabaseFormSubmission }
  | { type: "RESET_AND_START_NEW" };

const initialState: FormState = {
  currentStep: -1,
  formData: {},
  submissionData: null,
  steps: STEPS,
  sessionId: null,
  isLoading: false,
  globalError: null,
  direction: 0,
};

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "NEXT_STEP":
      return {
        ...state,
        currentStep: Math.min(state.currentStep + 1, state.steps.length - 1),
        direction: 1,
      };
    case "PREV_STEP":
      return {
        ...state,
        currentStep: Math.max(-1, state.currentStep - 1),
        direction: -1,
      };
    case "GO_TO_STEP":
      return {
        ...state,
        currentStep: Math.max(-1, Math.min(action.payload, state.steps.length - 1)),
      };
    case "UPDATE_FIELD":
      return {
        ...state,
        formData: {
          ...state.formData,
          [action.payload.fieldName]: action.payload.value,
        },
      };
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };
    case "RESTORE_SESSION":
      return {
        ...state,
        sessionId: action.payload.sessionId,
        formData: action.payload.formData,
        currentStep: action.payload.currentStep,
      };
    case "CREATE_SESSION":
      return {
        ...state,
        sessionId: action.payload,
      };
    case "SET_SUBMISSION_DATA":
      return {
        ...state,
        submissionData: action.payload,
      };
    case "RESET_AND_START_NEW":
      return {
        ...initialState,
        currentStep: -1,
      };
    default:
      return state;
  }
}

const FormContext = createContext<FormContextValue | undefined>(undefined);

interface FormProviderProps {
  children: ReactNode;
  initialSessionData?: SessionData | null;
}

export function FormProvider({ children, initialSessionData }: FormProviderProps) {
  // Initialize state with preloaded session data if available
  const [state, dispatch] = useReducer(formReducer, {
    ...initialState,
    ...(initialSessionData && {
      sessionId: initialSessionData.sessionId,
      formData: initialSessionData.formData,
      currentStep: initialSessionData.currentStep,
    }),
  });

  // Note: Session restoration is now handled server-side only
  // If initialSessionData is provided, it means the server already restored the session

  // Create session and start the survey
  const createSessionAndStart = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });
    
    try {
      // Create a new session (session ID is generated server-side for security)
      const { sessionId } = await createSession();
      dispatch({ type: "CREATE_SESSION", payload: sessionId });
      
      // Move to the first step
      dispatch({ type: "NEXT_STEP" });
      
    } catch (error) {
      console.error('Failed to create session:', error);
      dispatch({ type: "SET_GLOBAL_ERROR", payload: error instanceof Error ? error.message : "Failed to create session" });
    }
    
    dispatch({ type: "SET_LOADING", payload: false });
  }, []);

  // Auto-save form progress when data changes
  const saveProgress = useCallback(async (formData: TFormData, currentStep: number) => {
    if (!state.sessionId) return;
    
    try {
      const result = await saveFormProgress(state.sessionId, formData, currentStep);
      if (!result.success) {
        console.log('Form validation errors during auto-save:', result.errors);
        // Don't show validation errors during auto-save - they'll be shown when user tries to proceed
      }
    } catch (error) {
      console.error('Failed to save form progress:', error);
      // Continue without saving - don't break the user experience
    }
  }, [state.sessionId]);

  // Save progress when form data or step changes (only if session exists)
  useEffect(() => {
    if (state.sessionId && state.currentStep >= 0) {
      // Debounce the save operation
      const timeoutId = setTimeout(() => {
        saveProgress(state.formData, state.currentStep);
      }, 500); // Save 500ms after last change

      return () => clearTimeout(timeoutId);
    }
  }, [state.formData, state.currentStep, state.sessionId, saveProgress]);

  const submitFormData = useCallback(async () => {
    try {
      if (!state.sessionId) {
        throw new Error('No active session');
      }
      
      dispatch({ type: "SET_LOADING", payload: true });

      const submissionData = await submitForm();

      dispatch({ type: "SET_SUBMISSION_DATA", payload: submissionData });
    } catch (error) {
      console.error('Failed to submit form:', error);
      dispatch({ type: "SET_GLOBAL_ERROR", payload: error instanceof Error ? error.message : "Failed to submit form" });
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [state.sessionId]);

  const resetSessionAndState = useCallback(async () => {
    try {
      // Clear session from database and cookies (server-side)
      await clearSession();
    } catch (error) {
      console.error('Failed to clear session:', error);
    }
    dispatch({ type: "RESET_AND_START_NEW" });
  }, []);

  const verifySubmissionAccess = useCallback(async (): Promise<boolean> => {
    if (!state.sessionId) {
      return false;
    }

    try {
      const submission = await getSubmissionBySession(state.sessionId);
      return submission !== null;
    } catch (error) {
      console.error('Failed to verify submission access:', error);
      return false;
    }
  }, [state.sessionId]);

  const value: FormContextValue = useMemo(() => ({
    ...state,
    nextStep: () => dispatch({ type: "NEXT_STEP" }),
    prevStep: () => dispatch({ type: "PREV_STEP" }),
    updateField: (fieldName: string, value: string | number) =>
      dispatch({ type: "UPDATE_FIELD", payload: { fieldName, value } }),
    goToStep: (stepIndex: number) => dispatch({ type: "GO_TO_STEP", payload: stepIndex }),
    isFirstStep: state.currentStep === 0,
    isLastStep: state.currentStep === state.steps.length - 1,
    isSubmitted: state.submissionData !== null,
    submitFormData,
    createSessionAndStart,
    resetSessionAndState,
    verifySubmissionAccess,
  }), [state, submitFormData, createSessionAndStart, resetSessionAndState, verifySubmissionAccess]);

  return <FormContext.Provider value={value}>{children}</FormContext.Provider>;
}

export function useForm() {
  const context = useContext(FormContext);
  if (context === undefined) {
    throw new Error("useForm must be used within a FormProvider");
  }
  return context;
}

export { FormContext };
