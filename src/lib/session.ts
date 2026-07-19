import { supabase } from "@/integrations/supabase/client";

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

/** Start an anonymous account only when an RLS-protected operation needs one. */
export async function startAnonymousSession() {
  const { data: signed, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!signed.session) throw new Error("Supabase did not return a session.");
  return signed.session;
}

/** Existing callers use this immediately before protected reads and writes. */
export async function ensureSession() {
  return (await getCurrentSession()) ?? startAnonymousSession();
}

export async function currentUserId(): Promise<string | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user?.id ?? null;
}

function clearAppBrowserState() {
  if (typeof window === "undefined") return;

  for (const storage of [window.localStorage, window.sessionStorage]) {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key),
    );
    for (const key of keys) {
      if (key.startsWith("realdoor") || (key.startsWith("sb-") && key.includes("auth-token"))) {
        storage.removeItem(key);
      }
    }
  }
}

/** End the local session. This does not delete the Supabase Auth user record. */
export async function endSession() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } finally {
    clearAppBrowserState();
  }
}

export const signOut = endSession;
