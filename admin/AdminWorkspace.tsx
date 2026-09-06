import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Anchor,
  BarChart3,
  Bell,
  Bot,
  Check,
  CheckCircle2,
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

interface Stats {
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

const EMPTY_STATS: Stats = { users: 0, activeUsers: 0, messages: 0, posts: 0, reels: 0, subscriptions: 0, reports: 0 };

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

function HealthBadge({ label, status = "Live" }: { label: string; status?: string }) {
  const live = status === "Live" || status === "Ready" || status === "Connected";
  return <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-400"><span className={`h-1.5 w-1.5 ${live ? "bg-emerald-400" : "bg-amber-400"}`} />{label}: <span className={live ? "text-emerald-300" : "text-amber-300"}>{status}</span></span>;
}

function MetricCard({ label, value, detail, icon: Icon, tone, children }: { label: string; value: string; detail: string; icon: React.ElementType; tone: string; children?: React.ReactNode }) {
  return <section className="border border-slate-800 bg-[#0d1b20] p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{value}</p></div><span className={`flex h-9 w-9 items-center justify-center ${tone}`}><Icon className="h-5 w-5" /></span></div>{children}<p className="mt-3 text-xs text-slate-500">{detail}</p></section>;
}

function Panel({ title, description, icon: Icon, children, className = "" }: { title: string; description?: string; icon: React.ElementType; children: React.ReactNode; className?: string }) {
  return <section className={`border border-slate-800 bg-[#0d1b20] ${className}`}><div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4"><div className="flex items-center gap-3"><Icon className="h-5 w-5 text-cyan-300" /><div><h3 className="font-bold">{title}</h3>{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div></div></div>{children}</section>;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({ currentUser, onBack, onLogout }) => {
  const [page, setPage] = useState<AdminPage>("helm");
  const [stats, setStats] = useState<Stats>(EMPTY_STATS);
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
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
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

  const renderHelm = () => <div className="space-y-6">
    <div className="grid gap-4 xl:grid-cols-3">
      <MetricCard label="Crew counter" value={isLoading ? "--" : stats.activeUsers.toLocaleString()} detail="Active sessions across the fleet" icon={Users} tone="bg-emerald-400/10 text-emerald-300"><div className="mt-5 flex h-9 items-end gap-1">{[35, 55, 42, 78, 66, 92, 74, 88, 100, 82, 96, 90].map((height, index) => <span key={index} className="flex-1 bg-emerald-400/70" style={{ height: `${height}%` }} />)}</div></MetricCard>
      <MetricCard label="Waveform bandwidth" value="--" detail="WebRTC signaling feed not connected" icon={Activity} tone="bg-amber-400/10 text-amber-300"><div className="mt-5 flex h-9 items-center gap-1">{[30, 48, 25, 66, 40, 78, 36, 55, 28, 62, 44, 70].map((height, index) => <span key={index} className="flex-1 bg-amber-400/50" style={{ height: `${height}%` }} />)}</div></MetricCard>
      <MetricCard label="Hymli engine load" value="Ready" detail="Gemini and Ollama controls in Engine Room" icon={Bot} tone="bg-cyan-400/10 text-cyan-300"><div className="mt-5 flex items-center gap-3"><div className="h-10 w-10 rounded-full border-4 border-cyan-400/30 border-t-cyan-300" /><span className="text-xs text-slate-400">SDK telemetry migration pending</span></div></MetricCard>
    </div>
    <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
      <Panel title="Fleet pulse" description="Live application totals from Supabase" icon={BarChart3}><div className="grid grid-cols-3 gap-px bg-slate-800"><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Messages</p><p className="mt-2 text-2xl font-bold">{stats.messages.toLocaleString()}</p></div><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Posts</p><p className="mt-2 text-2xl font-bold">{stats.posts.toLocaleString()}</p></div><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Reels</p><p className="mt-2 text-2xl font-bold">{stats.reels.toLocaleString()}</p></div></div></Panel>
      <Panel title="System integrity" description="Dependency heartbeat" icon={Zap}><div className="space-y-4 p-5"><HealthBadge label="Supabase" /><HealthBadge label="Gemini SDK" status={import.meta.env.VITE_GEMINI_API_KEY ? "Ready" : "Missing key"} /><HealthBadge label="Paystack API" status="Pending webhook" /><HealthBadge label="WebRTC" status="Pending feed" /></div></Panel>
    </div>
    <Panel title="Crew ledger preview" description="Open the Crew Ledger for full profile controls" icon={Users}><div className="grid gap-px bg-slate-800 sm:grid-cols-3"><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Registered accounts</p><p className="mt-2 text-xl font-bold">{stats.users.toLocaleString()}</p></div><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Active subscriptions</p><p className="mt-2 text-xl font-bold">{stats.subscriptions.toLocaleString()}</p></div><button type="button" onClick={() => setPage("crew")} className="flex items-center justify-between bg-[#0d1b20] p-5 text-left text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10">Manage accounts <span>Open ledger</span></button></div></Panel>
  </div>;

  const renderQuarterdeck = () => <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
    <Panel title="Unified stream manager" description="Dense content ledger for feed operations" icon={Newspaper}><div className="border-b border-slate-800 px-5 py-3"><label className="flex items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-400"><Search className="h-4 w-4" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Filter creator or content" className="w-full bg-transparent outline-none placeholder:text-slate-600" /></label></div><div className="max-h-[560px] overflow-auto"><table className="w-full min-w-[580px] text-left text-xs"><thead className="sticky top-0 border-b border-slate-800 bg-[#0d1b20] text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Creator</th><th className="px-5 py-3">Content</th><th className="px-5 py-3">Signals</th><th className="px-5 py-3">Created</th></tr></thead><tbody className="divide-y divide-slate-800">{filteredPosts.map((post) => <tr key={post.id} className="hover:bg-slate-800/30"><td className="px-5 py-4 font-semibold">@{post.profiles?.username || "unknown"}</td><td className="max-w-[250px] truncate px-5 py-4 text-slate-300">{post.content || "Media post"}</td><td className="px-5 py-4 text-amber-300">{post.likes_count || 0} likes</td><td className="px-5 py-4 text-slate-500">{formatDate(post.created_at)}</td></tr>)}</tbody></table>{!filteredPosts.length && <p className="px-5 py-10 text-center text-sm text-slate-500">No feed posts found.</p>}</div></Panel>
    <div className="space-y-6"><Panel title="Signal filter" description="Reported content and flagged chats" icon={AlertTriangle}><div className="p-5"><div className="border border-amber-400/20 bg-amber-400/5 p-4"><p className="text-2xl font-bold text-amber-200">{stats.reports}</p><p className="mt-1 text-xs text-slate-400">Open message reports</p></div><div className="mt-4 grid gap-2"><button type="button" onClick={() => setError("Dismiss actions require the admin_reports migration.")} className="border border-slate-700 px-3 py-2 text-left text-xs text-slate-300 hover:border-cyan-400">Dismiss queue flags</button><button type="button" onClick={() => setError("Scuttle actions require an audited moderation Edge Function.")} className="border border-amber-400/30 px-3 py-2 text-left text-xs text-amber-200 hover:bg-amber-400/10">Scuttle reported content</button><button type="button" onClick={() => setError("Brig actions require the account restriction migration.")} className="border border-rose-400/30 px-3 py-2 text-left text-xs text-rose-200 hover:bg-rose-400/10">Brig communication pathway</button></div></div></Panel><Panel title="System broadcaster" description="Send an announcement into every user's activity feed" icon={Bell}><div className="p-5"><textarea value={announcement} onChange={(event) => setAnnouncement(event.target.value)} rows={4} placeholder="Write a fleet-wide announcement..." className="w-full resize-none border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400" /><div className="mt-3 flex gap-2"><select value={announcementTarget} onChange={(event) => setAnnouncementTarget(event.target.value)} className="min-w-0 flex-1 border border-slate-700 bg-slate-900 px-2 py-2 text-xs text-white outline-none"><option>All Enlisted</option><option>Free Tier Only</option><option>Premium Tier Only</option></select><button type="button" onClick={() => void sendAnnouncement()} className="bg-cyan-400 px-3 py-2 text-xs font-bold text-[#081014]">{announcementSent ? "Delivered" : "Broadcast"}</button></div></div></Panel></div>
  </div>;

  const renderCargo = () => <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-3"><MetricCard label="Active plans" value={stats.subscriptions.toLocaleString()} detail="Subscriptions with active status" icon={CircleDollarSign} tone="bg-emerald-400/10 text-emerald-300" /><MetricCard label="Processed value" value={`$${subscriptions.reduce((sum, item) => sum + (item.amount_paid || 0), 0).toLocaleString()}`} detail="Recent subscription records" icon={WalletCards} tone="bg-amber-400/10 text-amber-300" /><MetricCard label="Paystack" value="Ready" detail="Webhook audit feed pending" icon={CheckCircle2} tone="bg-cyan-400/10 text-cyan-300" /></div><Panel title="Plugin cargo manifest" description="Global availability and tier gating" icon={WalletCards}><div className="grid gap-px bg-slate-800 sm:grid-cols-2">{PLUGINS.map((plugin) => <div key={plugin.id} className="bg-[#0d1b20] p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{plugin.name}</p><p className="mt-1 text-xs text-slate-500">{plugin.detail}</p></div><span className={pluginState[plugin.id].enabled ? "text-emerald-300" : "text-rose-300"}>{pluginState[plugin.id].enabled ? "ONLINE" : "OFFLINE"}</span></div><div className="mt-6 flex items-center justify-between gap-3"><button type="button" onClick={() => setPluginState((state) => ({ ...state, [plugin.id]: { ...state[plugin.id], enabled: !state[plugin.id].enabled } }))} className={`relative h-6 w-11 ${pluginState[plugin.id].enabled ? "bg-emerald-400" : "bg-slate-700"}`} title="Toggle plugin availability"><span className={`absolute top-1 h-4 w-4 bg-white transition-transform ${pluginState[plugin.id].enabled ? "translate-x-6" : "translate-x-1"}`} /></button><div className="flex border border-slate-700 text-[10px]"><button type="button" onClick={() => setPluginState((state) => ({ ...state, [plugin.id]: { ...state[plugin.id], tier: "Free" } }))} className={`px-2 py-1 ${pluginState[plugin.id].tier === "Free" ? "bg-cyan-400 text-[#081014]" : "text-slate-400"}`}>Free</button><button type="button" onClick={() => setPluginState((state) => ({ ...state, [plugin.id]: { ...state[plugin.id], tier: "Premium" } }))} className={`px-2 py-1 ${pluginState[plugin.id].tier === "Premium" ? "bg-cyan-400 text-[#081014]" : "text-slate-400"}`}>Premium</button></div></div></div>)}</div><p className="border-t border-slate-800 px-5 py-3 text-xs text-amber-300">Plugin persistence requires an admin settings table or Edge Function.</p></Panel><Panel title="Transaction audits" description="Latest subscription records" icon={FileText}><div className="divide-y divide-slate-800 px-5">{subscriptions.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"><span className="text-slate-400">{item.user_id?.slice(0, 12) || "Unknown user"}</span><span>{item.tier || "free"}</span><span className="text-emerald-300">{item.status || "unknown"}</span><span className="text-slate-500">${item.amount_paid || 0}</span></div>)}{!subscriptions.length && <p className="py-6 text-sm text-slate-500">No subscription records found.</p>}</div></Panel></div>;

  const renderEngine = () => <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><MetricCard label="Gemini engine" value={import.meta.env.VITE_GEMINI_API_KEY ? "Online" : "Unconfigured"} detail="Google GenAI client status" icon={Bot} tone="bg-cyan-400/10 text-cyan-300" /><MetricCard label="Ollama node" value="Local" detail="Expected endpoint: localhost:11434" icon={Activity} tone="bg-emerald-400/10 text-emerald-300" /></div><div className="grid gap-6 lg:grid-cols-2"><Panel title="AI SDK model swapper" description="Map the active assistant model" icon={Settings2}><div className="p-5"><select defaultValue={import.meta.env.VITE_GEMINI_MODEL || "gemini-2.5-flash"} className="w-full border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white outline-none"><option>gemini-2.5-flash</option><option>gemini-2.5-pro</option><option>llama-3.1-8b</option><option>ollama-local</option></select><p className="mt-3 text-xs text-amber-300">Production switching requires an admin settings table or Edge Function.</p></div></Panel><Panel title="Supabase connection anchor" description="Infrastructure diagnostics" icon={Database}><div className="space-y-4 p-5 text-sm"><div className="flex justify-between"><span className="text-slate-400">Project endpoint</span><span className="text-emerald-300">Connected</span></div><div className="flex justify-between"><span className="text-slate-400">Push queue</span><span className="text-amber-300">Telemetry pending</span></div><div className="flex justify-between"><span className="text-slate-400">AI usage logs</span><span className="text-amber-300">Migration pending</span></div></div></Panel></div><section className="border border-rose-400/30 bg-rose-400/5 p-5"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-rose-300">Emergency control</p><h3 className="mt-2 font-bold">Deploy Global Maintenance Mode Anchor</h3><p className="mt-1 text-xs text-slate-400">Locks application-wide writes after explicit confirmation.</p></div><button type="button" onClick={() => setMaintenanceOpen(true)} className="border border-rose-400/50 px-4 py-2 text-xs font-bold text-rose-200 hover:bg-rose-400/10">{maintenanceMode ? "Maintenance armed" : "Open override"}</button></div></section></div>;

  const renderSecurity = () => <div className="space-y-6"><Panel title="Administrative access" description="Current clearance and session posture" icon={ShieldCheck}><div className="grid gap-px bg-slate-800 sm:grid-cols-2"><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Signed-in administrator</p><p className="mt-2 break-all text-sm font-semibold">{currentUser.email || currentUser.username}</p></div><div className="bg-[#0d1b20] p-5"><p className="text-xs text-slate-500">Clearance layer</p><p className="mt-2 text-sm font-semibold text-emerald-300">Captain / Admin</p></div></div></Panel><Panel title="Security controls" description="MFA and session controls" icon={Shield}><div className="space-y-4 p-5"><label className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 text-sm"><span><span className="block font-semibold">Require MFA for administrators</span><span className="mt-1 block text-xs text-slate-500">Enforce an authenticator before admin entry</span></span><input type="checkbox" className="h-4 w-4 accent-cyan-400" /></label><label className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 text-sm"><span><span className="block font-semibold">Session audit trail</span><span className="mt-1 block text-xs text-slate-500">Record browser, region, and access events</span></span><input type="checkbox" defaultChecked className="h-4 w-4 accent-cyan-400" /></label><button type="button" onClick={onLogout} className="border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-300">Sign out current session</button></div></Panel></div>;

  const activeNav = NAV_ITEMS.find((item) => item.id === page);

  return <main className={isDark ? "h-screen overflow-hidden bg-[#081014] text-slate-100" : "h-screen overflow-hidden bg-slate-100 text-slate-900"}>
    <header className="h-16 border-b border-slate-800 bg-[#0b171c]/95 px-5 backdrop-blur"><div className="flex h-full items-center justify-between gap-4"><div className="flex items-center gap-3"><button type="button" onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 text-slate-400 lg:hidden"><Menu className="h-5 w-5" /></button><div className="flex h-9 w-9 items-center justify-center bg-cyan-400 text-[#081014]"><Anchor className="h-5 w-5" /></div><div><p className="text-[9px] font-bold uppercase tracking-[0.26em] text-cyan-300">The Top Deck</p><h1 className="text-sm font-bold">Captain's console</h1></div></div><label className="hidden max-w-xl flex-1 items-center gap-2 border border-slate-700 px-3 py-2 text-xs text-slate-400 md:flex"><Search className="h-4 w-4" /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search crew, logs, or transactions..." className="w-full bg-transparent outline-none placeholder:text-slate-600" /></label><div className="hidden items-center gap-4 xl:flex"><HealthBadge label="Supabase" /><HealthBadge label="Gemini SDK" status={import.meta.env.VITE_GEMINI_API_KEY ? "Ready" : "Missing"} /><HealthBadge label="Paystack" status="Pending" /></div><div className="flex items-center gap-1"><button type="button" onClick={() => setIsDark(!isDark)} title="Toggle theme" className="p-2 text-slate-400">{isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button type="button" onClick={() => void loadOperations()} title="Refresh data" className="p-2 text-slate-400"><RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} /></button><div className="hidden items-center gap-2 border-l border-slate-700 pl-3 sm:flex"><div className="flex h-7 w-7 items-center justify-center bg-cyan-400 text-xs font-bold text-[#081014]">{(currentUser.full_name || currentUser.username || "A").slice(0, 1).toUpperCase()}</div><span className="text-[10px] font-semibold text-slate-400">Captain / Admin</span></div><button type="button" onClick={onBack} className="hidden border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 sm:block">App</button><button type="button" onClick={onLogout} title="Sign out" className="p-2 text-slate-400 hover:text-rose-300"><LogOut className="h-4 w-4" /></button></div></div></header>
    <div className="flex h-[calc(100vh-4rem)]"><aside className={`${sidebarOpen ? "block" : "hidden"} fixed inset-y-16 left-0 z-20 w-72 border-r border-slate-800 bg-[#0a192f] p-4 lg:static lg:block lg:w-64 lg:shrink-0`}><div className="mb-7 px-3"><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">The Rigging</p><p className="mt-2 text-xs leading-5 text-slate-400">A command deck for the whole fleet.</p></div><nav className="space-y-1">{NAV_ITEMS.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" onClick={() => { setPage(item.id); setSidebarOpen(false); }} className={`flex w-full items-center gap-3 px-3 py-3 text-left ${page === item.id ? "bg-cyan-400 text-[#081014]" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="h-4 w-4 shrink-0" /><span><span className="block text-sm font-semibold">{item.label}</span><span className={`block text-[10px] ${page === item.id ? "text-[#081014]/70" : "text-slate-600"}`}>{item.caption}</span></span></button>; })}</nav><div className="mt-10 border-t border-white/10 pt-5"><div className="flex items-center gap-2 px-3 text-xs text-emerald-300"><span className="h-2 w-2 bg-emerald-400" /> All systems nominal</div></div></aside><section className="min-w-0 flex-1 overflow-y-auto px-5 py-7 lg:px-8"><div className="mx-auto max-w-[1400px]"><div className="mb-7"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{activeNav?.caption}</p><h2 className="mt-2 text-2xl font-bold tracking-tight">{activeNav?.label}</h2><p className="mt-2 text-sm text-slate-500">Signed in as {currentUser.email || currentUser.username}</p></div>{error && <div className="mb-6 flex items-center justify-between gap-3 border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-200"><span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" />{error}</span><button type="button" onClick={() => setError(null)}><X className="h-4 w-4" /></button></div>}{page === "helm" && renderHelm()}{page === "crew" && <AccountManagement onError={setError} />}{page === "quarterdeck" && renderQuarterdeck()}{page === "cargo" && renderCargo()}{page === "engine" && renderEngine()}{page === "security" && renderSecurity()}</div></section></div>
    {maintenanceOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-5"><div className="w-full max-w-md border border-rose-400/40 bg-[#0d1b20] p-6 shadow-2xl"><div className="flex items-center gap-3 text-rose-200"><AlertTriangle className="h-6 w-6" /><h3 className="font-bold">Confirm maintenance mode</h3></div><p className="mt-4 text-sm leading-6 text-slate-400">This control will eventually lock application-wide writes. Confirm only after the maintenance Edge Function is deployed.</p><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setMaintenanceOpen(false)} className="border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300">Cancel</button><button type="button" onClick={() => { setMaintenanceMode(true); setMaintenanceOpen(false); }} className="bg-rose-400 px-4 py-2 text-xs font-bold text-[#081014]">Arm control</button></div></div></div>}
  </main>;
};
