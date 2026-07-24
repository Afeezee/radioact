// Very light client-side session for the prototype. Stores {name, email} in
// localStorage. This is NOT authentication — it's a UX shell so /signin,
// /signup and "signed-in" nav can exist as designed. Everything visible in the
// UI makes that clear (see /signin copy).

export interface DemoSession {
  name: string;
  email: string;
  role: "patient" | "clinician" | "admin";
  createdAt: string;
}

const KEY = "radioact-session";

export function getSession(): DemoSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoSession;
  } catch {
    return null;
  }
}

export function setSession(s: DemoSession) {
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function setSessionRole(role: DemoSession["role"]) {
  const s = getSession();
  if (!s) return;
  setSession({ ...s, role });
}

/** Type-narrowing helper for the role switcher. */
export function isDemoRole(role: string): role is DemoSession["role"] {
  return role === "patient" || role === "clinician" || role === "admin";
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
}
