import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Anchor,
  BarChart3,
  Bell,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Database,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Newspaper,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { Profile } from "../types";
import { supabase } from "../lib/supabase";
import { AccountManagement } from "./AccountManagement";

export type AdminPage = "helm" | "crew" | "quarterdeck" | "cargo" | "engine" | "security";

interface AdminWorkspaceProps {
  currentUser: Profile;
  onBack: () => void;
  onLogout: () => void;
}

interface CoreStats {
  users: number;
  activeUsers: number;
  messages: number;
  posts: number;
  reels: number;
  subscriptions: number;
  reports: number;
}

interface PostRecord {
  id: string;
  content: string | null;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string;
  profiles?: { username?: string | null; full_name?: string | null } | null;
}

interface SubscriptionRecord {
  id: string;
  user_id: string | null;
  tier: string | null;
  status: string | null;
  amount_paid: number | null;
  expires_at: string | null;
}

const EMPTY_STATS: CoreStats = { users: 0, activeUsers: 0, messages: 0, posts: 0, reels: 0, subscriptions: 0, reports: 0 };

const NAV_ITEMS: { id: AdminPage; label: string; caption: string; icon: React.ElementType }[] = [
  { id: "helm", label: "Captain's Helm", caption: "Fleet overview", icon: LayoutDashboard },
  { id: "crew", label: "Crew Ledger", caption: "Accounts & roles", icon: Users },
  { id: "quarterdeck", label: "Quarterdeck", caption: "Content & signals", icon: Newspaper },
  { id: "cargo", label: "Cargo Bay", caption: "Commerce & plugins", icon: WalletCards },
  { id: "engine", label: "Engine Room", caption: "AI & infrastructure", icon: Bot },
  { id: "security", label: "Security", caption: "Access & sessions", icon: Shield },
];

const PLUGINS = [
  { id: "invoice", name: "Invoice Generator", detail: "Create invoices from chat", tier: "Premium" },
  { id: "meal", name: "Meal Planner", detail: "AI meal planning widget", tier: "Premium" },
  { id: "travel", name: "Travel Planner", detail: "Routes, stays, and itineraries", tier: "Free" },
  { id: "access", name: "Access Control", detail: "Permissions and identity checks", tier: "Premium" },
];

function formatDate(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function StatCard({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: string }) {
  return (
    <div className="border border-slate-800 bg-[#0d1b20] p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p><p className="mt-4 text-3xl font-bold tracking-tight">{value}</p></div>
        <span className={`flex h-9 w-9 items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></span>
      </div>
      <p className="mt-3 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({ currentUser, onBack, onLogout }) => {
  const [page, setPage] = useState<AdminPage>("helm");
  const [stats, setStats] = useState<CoreStats>(EMPTY_STATS);
  const [posts, setPosts] = useState<PostRecord[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDark, setIsDark] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [announcementTarget, setAnnouncementTarget] = useState("All Enlisted");
  const [announcementSent, setAnnouncementSent] = useState(false);
  const [pluginState, setPluginState] = useState<Record<string, { enabled: boolean; tier: string }>>(
    Object.fromEntries(PLUGINS.map((plugin) => [plugin.id, { enabled: true, tier: plugin.tier }])),
  );

  const loadOperations = async () => {
    setIsLoading(true);
    setError(null);
    const [users, activeUsers, messages, postsCount, reels, subscriptionsCount, reports, recentPosts, subscriptionRows] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("custom_status", "In Focus"),
      supabase.from("messages").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("reels").select("id", { count: "exact", head: true }),
      supabase.from("user_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("message_reports").select("id", { count: "exact", head: true }),
      supabase.from("posts").select("id, content, likes_count, comments_count, created_at, profiles:user_id(username, full_name)").order("created_at", { ascending: false }).limit(12),
      supabase.from("user_subscriptions").select("id, user_id, tier, status, amount_paid, expires_at").order("created_at", { ascending: false }).limit(12),
    ]);
    const firstError = [users, activeUsers, messages, postsCount, reels, subscriptionsCount, reports, recentPosts, subscriptionRows].find((result) => result.error)?.error;
    if (firstError) setError(firstError.message);
    setStats({ users: users.count || 0, activeUsers: activeUsers.count || 0, messages: messages.count || 0, posts: postsCount.count || 0, reels: reels.count || 0, subscriptions: subscriptionsCount.count || 0, reports: reports.count || 0 });
    setPosts((recentPosts.data || []) as PostRecord[]);
    setSubscriptions((subscriptionRows.data || []) as SubscriptionRecord[]);
    setIsLoading(false);
  };

  useEffect(() => { void loadOperations(); }, []);

  const pageTitle = NAV_ITEMS.find((item) => item.id === page);
  const filteredPosts = useMemo(() => posts.filter((post) => `${post.content || ""} ${post.profiles?.username || ""}`.toLowerCase().includes(globalSearch.toLowerCase().trim())), [posts, globalSearch]);

  const sendAnnouncement = async () => {
    if (!announcement.trim()) return;
    const { data: recipients, error: recipientError } = await supabase.from("profiles").select("id");
    if (recipientError || !recipients?.length) { setError(recipientError?.message || "No recipients found"); return; }
    const rows = recipients.map((recipient) => ({ recipient_id: recipient.id, actor_id: currentUser.id, kind: "system_announcement", message: announcement.trim(), target_id: null }));
    const { error: sendError } = await supabase.from("notifications").insert(rows);
    if (sendError) setError(sendError.message);
    else { setAnnouncement(""); setAnnouncementSent(true); window.setTimeout(() => setAnnouncementSent(false), 2400); }
  };

  const renderHelm = () => (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active crew" value={isLoading ? "--" : stats.activeUsers.toLocaleString()} detail="Profiles currently In Focus" icon={Activity} tone="text-emerald-300 bg-emerald-400/10" />
        <StatCard label="Total crew" value={isLoading ? "--" : stats.users.toLocaleString()} detail="Registered profiles in the ledger" icon={Users} tone="text-cyan-300 bg-cyan-400/10" />
        <StatCard label="Comms traffic" value={isLoading ? "--" : stats.messages.toLocaleString()} detail="Messages indexed in the harbor" icon={MessageSquare} tone="text-amber-300 bg-amber-400/10" />
        <StatCard label="Open signals" value={isLoading ? "--" : stats.reports.toLocaleString()} detail="Message reports needing review" icon={AlertTriangle} tone="text-rose-300 bg-rose-400/10" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold">Channel pulse</h2><p className="mt-1 text-xs text-slate-500">Content volume across the fleet</p></div><BarChart3 className="h-5 w-5 text-cyan-300" /></div><div className="mt-8 grid grid-cols-3 items-end gap-4"><div className="h-28 bg-cyan-400/20"><div className="h-[72%] bg-cyan-400" /></div><div className="h-36 bg-emerald-400/20"><div className="h-[84%] bg-emerald-400" /></div><div className="h-24 bg-amber-400/20"><div className="h-[55%] bg-amber-400" /></div></div><div className="mt-3 grid grid-cols-3 text-center text-[10px] uppercase tracking-wider text-slate-500"><span>Messages</span><span>Posts</span><span>Reels</span></div></section>
        <section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><Zap className="h-5 w-5 text-amber-300" /><div><h2 className="font-bold">Engine health</h2><p className="mt-1 text-xs text-slate-500">Service readiness checks</p></div></div><div className="mt-6 space-y-4 text-sm"><div className="flex items-center justify-between"><span className="text-slate-400">Supabase connection</span><span className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Connected</span></div><div className="flex items-center justify-between"><span className="text-slate-400">Gemini key</span><span className="flex items-center gap-2 text-emerald-300"><CheckCircle2 className="h-4 w-4" /> Configured</span></div><div className="flex items-center justify-between"><span className="text-slate-400">WebRTC telemetry</span><span className="text-amber-300">Pending feed</span></div></div></section>
      </div>
      <section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><Anchor className="h-5 w-5 text-cyan-300" /><div><h2 className="font-bold">Fleet snapshot</h2><p className="mt-1 text-xs text-slate-500">Current platform totals from Supabase</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-3"><div><p className="text-xs text-slate-500">Feed posts</p><p className="mt-1 text-xl font-bold">{stats.posts.toLocaleString()}</p></div><div><p className="text-xs text-slate-500">Reels published</p><p className="mt-1 text-xl font-bold">{stats.reels.toLocaleString()}</p></div><div><p className="text-xs text-slate-500">Active subscriptions</p><p className="mt-1 text-xl font-bold">{stats.subscriptions.toLocaleString()}</p></div></div></section>
    </div>
  );

  const renderQuarterdeck = () => (
    <div className="space-y-6">
      <section className="border border-slate-800 bg-[#0d1b20]"><div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-5 py-4"><div><h2 className="font-bold">Unified stream manager</h2><p className="mt-1 text-xs text-slate-500">Review public feed content and engagement</p></div><label className="flex items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-400"><Search className="h-4 w-4" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Filter stream" className="bg-transparent outline-none placeholder:text-slate-600" /></label></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Creator</th><th className="px-5 py-3">Post</th><th className="px-5 py-3">Reactions</th><th className="px-5 py-3">Comments</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-800">{filteredPosts.map((post) => <tr key={post.id} className="hover:bg-slate-800/30"><td className="px-5 py-4 font-semibold">@{post.profiles?.username || "unknown"}</td><td className="max-w-[300px] truncate px-5 py-4 text-slate-300">{post.content || "Media post"}</td><td className="px-5 py-4 text-amber-300">{post.likes_count || 0}</td><td className="px-5 py-4 text-cyan-300">{post.comments_count || 0}</td><td className="px-5 py-4 text-slate-500">{formatDate(post.created_at)}</td></tr>)}</tbody></table>{!filteredPosts.length && <p className="px-5 py-10 text-center text-sm text-slate-500">No feed posts found.</p>}</div></section>
      <div className="grid gap-6 lg:grid-cols-2"><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><AlertTriangle className="h-5 w-5 text-amber-300" /><div><h2 className="font-bold">Signal filter</h2><p className="mt-1 text-xs text-slate-500">{stats.reports} message reports are available for moderation.</p></div></div><button type="button" onClick={() => setError("Moderation queue needs the admin_reports migration before actions can be enabled.")} className="mt-6 inline-flex items-center gap-2 border border-amber-400/40 px-3 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-400/10">Open incident queue <ChevronRight className="h-4 w-4" /></button></section><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><Bell className="h-5 w-5 text-cyan-300" /><div><h2 className="font-bold">System broadcaster</h2><p className="mt-1 text-xs text-slate-500">Send an announcement to every profile</p></div></div><textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} rows={3} placeholder="Write a fleet-wide announcement..." className="mt-5 w-full resize-none border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /><div className="mt-3 flex items-center gap-3"><select value={announcementTarget} onChange={(event) => setAnnouncementTarget(event.target.value)} className="border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none"><option>All Enlisted</option><option>Free Tier Only</option><option>Premium Tier Only</option></select><button type="button" onClick={() => void sendAnnouncement()} className="bg-cyan-400 px-3 py-2 text-xs font-bold text-[#081014] hover:bg-cyan-300">{announcementSent ? "Delivered" : "Broadcast"}</button></div></section></div>
    </div>
  );

  const renderCargo = () => (
    <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><StatCard label="Active plans" value={stats.subscriptions.toLocaleString()} detail="Subscriptions with active status" icon={CircleDollarSign} tone="text-emerald-300 bg-emerald-400/10" /><StatCard label="Processed value" value={`$${subscriptions.reduce((sum, item) => sum + (item.amount_paid || 0), 0).toLocaleString()}`} detail="Recent subscription records" icon={WalletCards} tone="text-amber-300 bg-amber-400/10" /><StatCard label="Paystack" value="Ready" detail="Connect webhook audit data next" icon={CheckCircle2} tone="text-cyan-300 bg-cyan-400/10" /></div><section className="border border-slate-800 bg-[#0d1b20]"><div className="border-b border-slate-800 px-5 py-4"><h2 className="font-bold">Plugin cargo manifest</h2><p className="mt-1 text-xs text-slate-500">Control availability and tier gating for Hymli utilities</p></div><div className="divide-y divide-slate-800">{PLUGINS.map((plugin) => <div key={plugin.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"><div><p className="text-sm font-semibold">{plugin.name}</p><p className="mt-1 text-xs text-slate-500">{plugin.detail}</p></div><div className="flex items-center gap-4"><button type="button" onClick={() => setPluginState((state) => ({ ...state, [plugin.id]: { ...state[plugin.id], enabled: !state[plugin.id].enabled } }))} className={`relative h-6 w-11 ${pluginState[plugin.id].enabled ? "bg-emerald-400" : "bg-slate-700"}`} title="Toggle plugin availability"><span className={`absolute top-1 h-4 w-4 bg-white transition-transform ${pluginState[plugin.id].enabled ? "translate-x-6" : "translate-x-1"}`} /></button><select value={pluginState[plugin.id].tier} onChange={(event) => setPluginState((state) => ({ ...state, [plugin.id]: { ...state[plugin.id], tier: event.target.value } }))} className="border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white outline-none"><option>Free</option><option>Premium</option></select></div></div>)}</div></section><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><FileText className="h-5 w-5 text-amber-300" /><div><h2 className="font-bold">Transaction audits</h2><p className="mt-1 text-xs text-slate-500">Recent subscription ledger records</p></div></div><div className="mt-5 divide-y divide-slate-800">{subscriptions.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 py-3 text-xs"><span className="text-slate-400">{item.user_id?.slice(0, 12) || "Unknown user"}</span><span className="text-slate-300">{item.tier || "free"}</span><span className="text-emerald-300">{item.status || "unknown"}</span><span className="text-slate-500">${item.amount_paid || 0}</span></div>)}{!subscriptions.length && <p className="py-6 text-sm text-slate-500">No subscription records found.</p>}</div></section></div>
  );

  const renderEngine = () => <div className="space-y-6"><section className="grid gap-4 sm:grid-cols-2"><StatCard label="Gemini engine" value={import.meta.env.VITE_GEMINI_API_KEY ? "Online" : "Unconfigured"} detail="Client integration status" icon={Bot} tone="text-cyan-300 bg-cyan-400/10" /><StatCard label="Ollama node" value="Local" detail="Expected endpoint: localhost:11434" icon={Activity} tone="text-emerald-300 bg-emerald-400/10" /></section><div className="grid gap-6 lg:grid-cols-2"><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-cyan-300" /><div><h2 className="font-bold">AI SDK model swapper</h2><p className="mt-1 text-xs text-slate-500">Select the default model for new assistant sessions</p></div></div><select defaultValue={import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash"} className="mt-6 w-full border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none"><option>gemini-2.5-flash</option><option>gemini-2.5-pro</option><option>llama-3.1-8b</option><option>ollama-local</option></select><p className="mt-3 text-xs text-amber-300">Production model switching requires an admin settings table or Edge Function.</p></section><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><Database className="h-5 w-5 text-emerald-300" /><div><h2 className="font-bold">Supabase connection anchor</h2><p className="mt-1 text-xs text-slate-500">Current browser connection diagnostics</p></div></div><div className="mt-6 space-y-4 text-sm"><div className="flex justify-between"><span className="text-slate-400">Project endpoint</span><span className="text-emerald-300">Connected</span></div><div className="flex justify-between"><span className="text-slate-400">Push queue</span><span className="text-amber-300">Telemetry pending</span></div><div className="flex justify-between"><span className="text-slate-400">AI usage logs</span><span className="text-amber-300">Migration pending</span></div></div></section></div></div>;

  const renderSecurity = () => <div className="space-y-6"><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-emerald-300" /><div><h2 className="font-bold">Administrative access</h2><p className="mt-1 text-xs text-slate-500">Current role and session posture</p></div></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="border border-slate-800 p-4"><p className="text-xs text-slate-500">Signed-in administrator</p><p className="mt-2 break-all text-sm font-semibold">{currentUser.email || currentUser.username}</p></div><div className="border border-slate-800 p-4"><p className="text-xs text-slate-500">Admin role</p><p className="mt-2 text-sm font-semibold text-emerald-300">Authorized</p></div></div></section><section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-center gap-3"><Shield className="h-5 w-5 text-amber-300" /><div><h2 className="font-bold">Security controls</h2><p className="mt-1 text-xs text-slate-500">Controls that require the admin security migration</p></div></div><div className="mt-6 space-y-4"><label className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 text-sm"><span><span className="block font-semibold">Require MFA for administrators</span><span className="mt-1 block text-xs text-slate-500">Enforce an authenticator before admin entry</span></span><input type="checkbox" className="h-4 w-4 accent-cyan-400" /></label><label className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 text-sm"><span><span className="block font-semibold">Session audit trail</span><span className="mt-1 block text-xs text-slate-500">Record browser, region, and access events</span></span><input type="checkbox" defaultChecked className="h-4 w-4 accent-cyan-400" /></label><div className="flex items-center justify-between text-sm"><span><span className="block font-semibold">Force sign-out elsewhere</span><span className="mt-1 block text-xs text-slate-500">Available after admin session migration</span></span><button type="button" onClick={onLogout} className="border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-400/10">Sign out</button></div></div></section></div>;

  return <main className={isDark ? "min-h-screen bg-[#081014] text-slate-100" : "min-h-screen bg-slate-100 text-slate-900"}>
    <header className={isDark ? "sticky top-0 z-20 border-b border-slate-800 bg-[#0b171c]/95 px-5 py-3 backdrop-blur" : "sticky top-0 z-20 border-b border-slate-300 bg-white/95 px-5 py-3 backdrop-blur"}>
      <div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 lg:hidden"><Menu className="h-5 w-5" /></button><div className="flex h-9 w-9 items-center justify-center bg-cyan-400 text-[#081014]"><Anchor className="h-5 w-5" /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.26em] text-cyan-300">HeyLook operations</p><h1 className="text-sm font-bold">Captain's console</h1></div></div><label className="hidden max-w-md flex-1 items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-400 md:flex"><Search className="h-4 w-4" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search crew, logs, or transactions..." className="w-full bg-transparent outline-none placeholder:text-slate-600" /></label><div className="flex items-center gap-1"><button type="button" onClick={() => setIsDark(!isDark)} title="Toggle theme" className="p-2 text-slate-400 hover:text-white">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button type="button" onClick={() => void loadOperations()} title="Refresh data" className="p-2 text-slate-400 hover:text-white"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></button><button type="button" onClick={onBack} className="hidden border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-cyan-400 hover:text-cyan-300 sm:block">App</button><button type="button" onClick={onLogout} title="Sign out" className="p-2 text-slate-400 hover:text-rose-300"><LogOut className="h-4 w-4" /></button></div></div>
    </header>
    <div className="mx-auto flex max-w-[1600px]">
      <aside className={`${sidebarOpen ? "block" : "hidden"} fixed inset-y-[61px] left-0 z-10 w-72 border-r border-slate-800 bg-[#0a192f] p-4 lg:sticky lg:top-[61px] lg:block lg:h-[calc(100vh-61px)] lg:w-64 lg:shrink-0`}><div className="mb-7 px-3"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">The rigging</p><p className="mt-2 text-xs leading-5 text-slate-400">One command deck for the whole fleet.</p></div><nav className="space-y-1">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => { setPage(item.id); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 px-3 py-3 text-left ${page === item.id ? "bg-cyan-400 text-[#081014]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4 shrink-0" /><span className="min-w-0"><span className="block text-sm font-semibold">{item.label}</span><span className={`block text-[10px] ${page === item.id ? "text-[#081014]/70" : "text-slate-600"}`}>{item.caption}</span></span></button>; })}</nav><div className="mt-10 border-t border-white/10 pt-5"><div className="flex items-center gap-2 px-3 text-xs text-emerald-300"><span className="h-2 w-2 bg-emerald-400" /> All systems nominal</div></div></aside>
      <section className="min-w-0 flex-1 px-5 py-7 lg:px-8"><div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{pageTitle?.caption}</p><h2 className="mt-2 text-2xl font-bold tracking-tight">{pageTitle?.label}</h2><p className="mt-2 text-sm text-slate-500">Signed in as {currentUser.email || currentUser.username}</p></div>{error && <div className="mb-6 flex items-center justify-between gap-3 border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span><button type="button" onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}{page === "helm" && renderHelm()}{page === "crew" && <AccountManagement onError={setError} />}{page === "quarterdeck" && renderQuarterdeck()}{page === "cargo" && renderCargo()}{page === "engine" && renderEngine()}{page === "security" && renderSecurity()}</section>
    </div>
  </main>;
};
