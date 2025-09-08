import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type CookieStore = {
  get: (name: string) => { value: string } | undefined;
  set: (name: string, value: string, options?: {
    expires?: Date;
    path?: string;
    sameSite?: "strict" | "lax" | "none";
    secure?: boolean;
    httpOnly?: boolean;
  }) => void;
  delete: (name: string) => void;
}

export function getSessionFromServerCookies(cookieStore: CookieStore): string | null {
  try {
    const sessionCookie = cookieStore.get("form_session_id");
    return sessionCookie?.value || null;
  } catch {
    return null;
  }
}

export function setSessionCookie(
  cookieStore: CookieStore,
  sessionId: string
): void {
  try {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);

    cookieStore.set("form_session_id", sessionId, {
      expires: expiryDate,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false, // Allow client-side access for form context
    });
  } catch (error) {
    console.error("Failed to set session cookie:", error);
  }
}

export function clearSessionCookie(cookieStore: CookieStore): void {
  try {
    cookieStore.delete("form_session_id");
  } catch (error) {
    console.error("Failed to clear session cookie:", error);
  }
}

export function getSessionExpiryDate(): string {
  // Sessions expire after 24 hours
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate.toISOString();
}
