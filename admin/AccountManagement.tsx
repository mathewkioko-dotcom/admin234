import React, { useEffect, useState } from "react";
import { Check, Search, UserRound, X } from "lucide-react";
import { supabase } from "../lib/supabase";

interface AccountRecord {
  id: string;
  username: string | null;
  full_name: string | null;
  bio: string | null;
  custom_status: string | null;
  created_at: string | null;
}

interface AccountManagementProps {
  onError: (message: string) => void;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ onError }) => {
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AccountRecord | null>(null);
  const [draft, setDraft] = useState({ full_name: "", username: "", bio: "", custom_status: "In Focus" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadAccounts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, full_name, bio, custom_status, created_at")
      .order("created_at", { ascending: false });
    if (error) onError(error.message);
    else setAccounts((data || []) as AccountRecord[]);
    setIsLoading(false);
  };

  useEffect(() => {
    void loadAccounts();
  }, []);

  const filteredAccounts = accounts.filter((account) => {
    const haystack = `${account.full_name || ""} ${account.username || ""} ${account.id}`.toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  });

  const openAccount = (account: AccountRecord) => {
    setSelected(account);
    setDraft({
      full_name: account.full_name || "",
      username: account.username || "",
      bio: account.bio || "",
      custom_status: account.custom_status || "In Focus",
    });
    setSaved(false);
  };

  const saveAccount = async () => {
    if (!selected || !draft.full_name.trim() || !draft.username.trim()) return;
    setIsSaving(true);
    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: draft.full_name.trim(),
        username: draft.username.trim(),
        bio: draft.bio.trim() || null,
        custom_status: draft.custom_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", selected.id)
      .select("id, username, full_name, bio, custom_status, created_at")
      .single();
    setIsSaving(false);
    if (error) {
      onError(error.message);
      return;
    }
    setAccounts((items) => items.map((item) => (item.id === selected.id ? (data as AccountRecord) : item)));
    setSelected(data as AccountRecord);
    setSaved(true);
  };

  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="border border-slate-800 bg-[#0d1b20]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 className="font-bold">Accounts</h2>
            <p className="mt-1 text-xs text-slate-500">View and manage registered profiles</p>
          </div>
          <label className="flex min-w-[220px] items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-400">
            <Search className="h-4 w-4" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search accounts" className="w-full bg-transparent text-slate-100 outline-none placeholder:text-slate-600" />
          </label>
        </div>
        <div className="divide-y divide-slate-800">
          {filteredAccounts.map((account) => (
            <button key={account.id} type="button" onClick={() => openAccount(account)} className={`flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-slate-800/40 ${selected?.id === account.id ? "bg-cyan-400/10" : ""}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-slate-800 text-cyan-300"><UserRound className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{account.full_name || "Unnamed user"}</span>
                <span className="block truncate text-xs text-slate-500">@{account.username || "unknown"}</span>
              </span>
              <span className="text-xs text-slate-500">{account.custom_status || "In Focus"}</span>
            </button>
          ))}
          {!isLoading && filteredAccounts.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No matching accounts.</p>}
          {isLoading && <p className="px-5 py-10 text-center text-sm text-slate-500">Loading accounts...</p>}
        </div>
      </div>

      <aside className="border border-slate-800 bg-[#0d1b20]">
        {!selected ? (
          <div className="flex min-h-[280px] items-center justify-center px-8 text-center text-sm text-slate-500">Select an account to inspect and edit it.</div>
        ) : (
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div><p className="text-xs uppercase tracking-wider text-cyan-300">Account editor</p><h3 className="mt-1 font-bold">{selected.username || "Profile"}</h3></div>
              <button type="button" onClick={() => setSelected(null)} title="Close editor" className="p-1 text-slate-500 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4 p-5">
              <p className="break-all text-[11px] text-slate-600">{selected.id}</p>
              <label className="block text-xs font-semibold text-slate-400">Full name<input value={draft.full_name} onChange={(event) => setDraft({ ...draft, full_name: event.target.value })} className="mt-1 w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /></label>
              <label className="block text-xs font-semibold text-slate-400">Username<input value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} className="mt-1 w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /></label>
              <label className="block text-xs font-semibold text-slate-400">Presence<select value={draft.custom_status} onChange={(event) => setDraft({ ...draft, custom_status: event.target.value })} className="mt-1 w-full border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"><option>In Focus</option><option>Adrift</option><option>Last Anchored</option></select></label>
              <label className="block text-xs font-semibold text-slate-400">Bio<textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} rows={4} className="mt-1 w-full resize-none border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /></label>
              <button type="button" onClick={() => void saveAccount()} disabled={isSaving || !draft.full_name.trim() || !draft.username.trim()} className="inline-flex w-full items-center justify-center gap-2 bg-cyan-400 px-4 py-2.5 text-sm font-bold text-[#081014] hover:bg-cyan-300 disabled:opacity-50">{saved ? <Check className="h-4 w-4" /> : null}{isSaving ? "Saving..." : saved ? "Saved" : "Save changes"}</button>
            </div>
          </div>
        )}
      </aside>
    </section>
  );
};
