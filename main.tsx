import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Anchor, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";
import { AdminPortal } from "./admin";
import { Profile } from "./types";
import { supabase } from "./lib/supabase";
import "./index.css";

function profileFromUser(user: { id: string; email?: string; user_metadata?: Record<string, string>; app_metadata?: Record<string, unknown> }): Profile {
  const username = user.user_metadata?.username || user.email?.split("@")[0] || "admin";
  return {
    id: user.id,
    username,
    full_name: user.user_metadata?.full_name || username,
    avatar_url: user.user_metadata?.avatar_url || "",
    email: user.email,
    app_metadata: { role: typeof user.app_metadata?.role === "string" ? user.app_metadata.role : undefined },
  };
}

function LoginScreen({ onLogin, error }: { onLogin: (email: string, password: string) => Promise<void>; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    await onLogin(email, password);
    setIsSubmitting(false);
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#081014] px-5 text-slate-100"><div className="w-full max-w-md border border-slate-800 bg-[#0d1b20] p-8 shadow-2xl"><div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center bg-cyan-400 text-[#081014]"><Anchor className="h-6 w-6" /></div><div><p className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan-300">HeyLook operations</p><h1 className="mt-1 text-xl font-bold">Captain's console</h1></div></div><div className="mt-8 flex items-center gap-2 border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-200"><ShieldCheck className="h-4 w-4" /> Authorized administrators only</div><form onSubmit={submit} className="mt-7 space-y-4"><label className="block text-xs font-semibold text-slate-400">Admin email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400" /></label><label className="block text-xs font-semibold text-slate-400">Password<input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none focus:border-cyan-400" /></label>{error && <p className="border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs text-rose-200">{error}</p>}<button type="submit" disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 bg-cyan-400 px-4 py-3 text-sm font-bold text-[#081014] hover:bg-cyan-300 disabled:opacity-50">{isSubmitting ? "Authenticating..." : "Enter admin console"}<ArrowRight className="h-4 w-4" /></button></form><p className="mt-6 flex items-center gap-2 text-[11px] text-slate-600"><LockKeyhole className="h-3 w-3" /> Access is enforced by Supabase Auth and admin allowlisting.</p></div></main>;
}

function AdminApp() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setCurrentUser(profileFromUser(data.session.user));
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ? profileFromUser(session.user) : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setAuthError(error.message);
    else if (data.user) setCurrentUser(profileFromUser(data.user));
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  if (!currentUser) return <LoginScreen onLogin={login} error={authError} />;
  return <AdminPortal currentUser={currentUser} onBack={() => undefined} onLogout={logout} />;
}

createRoot(document.getElementById("root")!).render(<React.StrictMode><AdminApp /></React.StrictMode>);
