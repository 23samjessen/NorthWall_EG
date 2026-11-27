"use client";
import { useCallback, useEffect, useRef, useState, cloneElement, isValidElement, type ReactElement, type FormEvent, type ReactNode } from "react";
import { Activity, Archive, ArrowDown, ArrowUp, Bell, BookOpen, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, ClipboardList, Clock3, Columns3, Download, ExternalLink, FileText, Filter, Flag, FolderOpen, Hash, LayoutDashboard, List, Loader2, LockKeyhole, LogOut, Menu, MessageCircle, MoreHorizontal, Pencil, Pin, Plus, Reply, Search, Send, Settings2, Share2, Shield, SlidersHorizontal, Smile, Sparkles, StickyNote, Trash2, UserPlus, Users, X } from "lucide-react";
import { NWMark } from "@/components/brand";
import EmployeeProfile, { EmployeePortrait } from "@/components/employee-profile";
import NewsExplorer from "@/components/news-explorer";
import type { AuditEntry, CalendarEvent, Comment, Member, Message, Note, OnboardingResponse, Ticket, WorkspaceAction, WorkspaceResponse } from "@/lib/workspace-types";
type NewsItem = {
    id: string;
    title: string;
    url: string;
    source: string;
    category: string;
    publishedAt: string | null;
    topics?: string[];
};
type NewsData = {
    items: NewsItem[];
    status: "live" | "partial" | "cached" | "unavailable";
    fetchedAt: string | null;
    checkedAt?: string;
    errors?: {
        source: string;
        message: string;
    }[];
};
type View = "overview" | "tickets" | "calendar" | "notes" | "chat" | "library" | "profile" | "admin" | "audit";
type ModalState = {
    type: string;
    data?: any;
} | null;
type OnboardingState = OnboardingResponse;
type MemberAccess = OnboardingState["status"] | "owner" | "sample";
type Resource = {
    id: string;
    title: string;
    category: string;
    publisher: string;
    description: string;
    url: string;
    access?: string;
    tags?: string[];
};
type Runbook = {
    id: string;
    title: string;
    product: string;
    summary: string;
    estimatedMinutes: number;
    steps: (string | {
        title?: string;
        text?: string;
        description?: string;
    })[];
    evidence: string[];
    escalateWhen: string | string[];
    sourceUrls: string[];
};
type Knowledge = {
    resources?: Resource[];
    runbooks?: Runbook[];
    verifiedOn?: string;
    notes?: string[];
};
const NAV: {
    id: View;
    label: string;
    icon: typeof LayoutDashboard;
}[] = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "tickets", label: "Work board", icon: Columns3 },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "notes", label: "Notes", icon: StickyNote },
    { id: "chat", label: "Team chat", icon: MessageCircle },
    { id: "library", label: "Knowledge library", icon: BookOpen },
    { id: "profile", label: "My profile", icon: Users },
];
const COLORS = ["#ba7c5a", "#66877b", "#8298b1", "#b8a46d", "#b995ac", "#7097a2"];
const EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "✅", "🙏", "🚀"];
const PRIORITIES = ["low", "medium", "high", "critical"];
function initials(name?: string) { return (name || "NW").split(/\s+/).map(x => x[0]).slice(0, 2).join("").toUpperCase(); }
function shortDate(value?: string | null) { if (!value)
    return "No due date"; const d = new Date(value); return isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }); }
function fullDate(value: string) { const d = new Date(value); return isNaN(d.getTime()) ? value : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function dateInput(value?: string | null) { if (!value)
    return ""; return value.slice(0, 10); }
function localDateTime(value?: string) { const d = value ? new Date(value) : new Date(); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function readable(name: string) { return name.charAt(0).toUpperCase() + name.slice(1); }
function accessForMember(user: Member, time = Date.now()): MemberAccess {
    if (user.id === "owner") return "owner";
    if (user.sample) return "sample";
    // The server derives active access and omits other members' invitation
    // metadata from non-owner directories. Legacy unapproved rows are inactive.
    if (!user.onboarding) return user.active ? "approved" : "not_invited";
    if (user.onboarding.status === "revoked") return "revoked";
    if (user.onboarding.status === "approved") return user.active ? "approved" : "revoked";
    const deadline = new Date(user.onboarding.expiresAt).getTime();
    if (!Number.isFinite(deadline) || deadline <= time) return "expired";
    return user.onboarding.status;
}
function invitationTime(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Time unavailable" : `${date.toLocaleString("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} UTC`;
}
function Avatar({ user, small = false }: {
    user?: Member;
    small?: boolean;
}) { return <span className={`nw-avatar${small ? " small" : ""}`} title={user ? `${user.name}${user.jobTitle ? ` · ${user.jobTitle}` : ""}` : "Unassigned"}>{user ? <EmployeePortrait user={user}/> : "–"}</span>; }
function Empty({ title, children, icon: Icon = FolderOpen }: {
    title: string;
    children?: ReactNode;
    icon?: typeof FolderOpen;
}) { return <div className="nw-empty"><Icon size={29}/><h3>{title}</h3>{children}</div>; }
function Field({ label, children, full = false }: {
    label: string;
    children: ReactNode;
    full?: boolean;
}) { const content = isValidElement(children) ? cloneElement(children as ReactElement<any>, { "aria-label": label }) : children; return <div className={`nw-field${full ? " full" : ""}`}><label>{label}</label>{content}</div>; }
function FormText({ name, value, required = false, placeholder, type = "text", ...rest }: {
    name: string;
    value?: string | number;
    required?: boolean;
    placeholder?: string;
    type?: string;
    "aria-label"?: string;
}) { return <input {...rest} className="nw-input" name={name} defaultValue={value ?? ""} type={type} required={required} placeholder={placeholder} maxLength={type === "text" ? 200 : undefined}/>; }
function PersonSelect({ users, name = "assigneeId", selected, allowNone = true, ...rest }: {
    users: Member[];
    name?: string;
    selected?: string | null;
    allowNone?: boolean;
    "aria-label"?: string;
}) { return <select {...rest} className="nw-select" name={name} defaultValue={selected || ""}>{allowNone && <option value="">Unassigned</option>}{users.filter(u => u.active).map(u => <option key={u.id} value={u.id}>{u.name}{u.sample ? " · sample" : ""}</option>)}</select>; }
// Keep every available publisher visible in the compact news strip.
function tickerHeadlines(items: NewsItem[]) {
    const sources = new Set<string>();
    const selected = items.filter(item => {
        if (sources.has(item.source)) return false;
        sources.add(item.source); return true;
    }).slice(0, 12);
    const urls = new Set(selected.map(item => item.url));
    return [...selected, ...items.filter(item => !urls.has(item.url))].slice(0, 12);
}
function WorkspaceAccessGate({ status, onboarding, error, busy, onAccept, onRefresh }: {
    status: string;
    onboarding: OnboardingState | null;
    error: string;
    busy: boolean;
    onAccept: () => void;
    onRefresh: () => void;
}) {
    const denied = status === "denied";
    const invitation = onboarding?.status;
    const titles: Record<OnboardingState["status"], string> = {
        invited: "Your invitation is ready",
        pending_approval: "Waiting for owner approval",
        approved: "Your access is approved",
        revoked: "Your access has been revoked",
        expired: "Your invitation has expired",
        not_invited: "An owner invitation is required",
    };
    const descriptions: Record<OnboardingState["status"], string> = {
        invited: "Accept the invitation for your sign-in email. The owner must then approve your access before you can enter the employee workspace.",
        pending_approval: "You have accepted your invitation. The workspace owner must review and approve it before any employee tools or records become available.",
        approved: "The owner has approved your employee access. Refresh to open your workspace.",
        revoked: "The owner has withdrawn this invitation or workspace access. Contact the owner if you need a new invitation.",
        expired: "The acceptance and approval window has ended. Ask the owner to create a new invitation, then accept it again.",
        not_invited: "This sign-in email does not have a current owner invitation. Contact the workspace owner; accounts cannot register themselves here.",
    };
    const accepted = !!onboarding?.acceptedAt || invitation === "pending_approval" || invitation === "approved";
    const stage = invitation === "approved" ? 3 : accepted ? 2 : invitation === "invited" ? 1 : 0;
    return <div className="nw-workspace"><div className="nw-signin">
        <section className="nw-signin-art">
            <a className="nw-brand" href="/"><span className="nw-mark"><NWMark /></span>NorthWallEg</a>
            <div><span className="nw-eyebrow">The team, connected</span><h1>Good work starts<br />with clarity.</h1><p>One place for your projects, conversations and the knowledge that keeps your clients moving.</p></div>
            <footer>Work board · Team chat · Knowledge · Evidence</footer>
        </section>
        <section className="nw-signin-form"><div className="nw-signin-box nw-access-box">
            <span className="nw-access-symbol">{invitation === "pending_approval" ? <Clock3 size={27}/> : invitation === "approved" ? <CheckCircle2 size={27}/> : <LockKeyhole size={27}/>}</span>
            <span className="nw-access-eyebrow">Invitation-only employee access</span>
            <h2 aria-live="polite">{denied ? invitation ? titles[invitation] : error ? "Invitation status unavailable" : "Checking your invitation" : status === "error" ? "Let’s reconnect" : "Welcome to the workspace"}</h2>
            <p>{denied ? invitation ? descriptions[invitation] : "Your account cannot open the workspace yet. Refresh to check its invitation status." : status === "error" ? "The workspace could not be reached. Please try again." : "Sign in with the email address the owner invited. Signing in alone does not create membership or approve access."}</p>
            {denied && onboarding?.email && <div className="nw-access-email"><span>Signed in as</span><strong>{onboarding.email}</strong></div>}
            {denied && onboarding && <ol className="nw-access-steps" aria-label="Employee access steps">{["Owner invitation", "Your acceptance", "Owner approval"].map((label, index) => <li key={label} className={stage > index ? "complete" : stage === index && (invitation === "invited" || invitation === "pending_approval") ? "current" : ""}><span>{stage > index ? <Check size={13}/> : index + 1}</span>{label}</li>)}</ol>}
            {denied && onboarding?.acceptedAt && <p className="nw-access-time">Accepted <time dateTime={onboarding.acceptedAt}>{invitationTime(onboarding.acceptedAt)}</time></p>}
            {denied && onboarding?.expiresAt && (invitation === "invited" || invitation === "pending_approval" || invitation === "expired") && <p className="nw-access-time">Acceptance and approval deadline <time dateTime={onboarding.expiresAt}>{invitationTime(onboarding.expiresAt)}</time></p>}
            {error && <div className="nw-alert error" role="alert">{error}</div>}
            <div className="nw-access-actions">
                {denied ? <>
                    {invitation === "invited" && <button className="nw-button" disabled={busy || !onboarding?.invitationId} onClick={onAccept}>{busy ? <Loader2 size={16} className="nw-spinner"/> : <CheckCircle2 size={16}/>}Accept invitation</button>}
                    <button className={`nw-button${invitation === "invited" ? " secondary" : ""}`} disabled={busy} onClick={onRefresh}>{busy ? <Loader2 size={16} className="nw-spinner"/> : <Activity size={16}/>} {invitation === "approved" ? "Open workspace" : invitation === "pending_approval" ? "Check approval status" : "Refresh access status"}</button>
                    <a className="nw-text-link" href="/sign-in?mode=logout&return_to=%2Fworkspace" target="_top">Use another sign-in account</a>
                </> : status === "error" ? <button className="nw-button" disabled={busy} onClick={onRefresh}>Try again</button> : <a className="nw-button" href="/sign-in?return_to=%2Fworkspace" target="_top"><LockKeyhole size={16}/>Sign in to workspace</a>}
                <a href="/" className="nw-button ghost">Back to NorthWallEg</a>
            </div>
            {denied && <div className="nw-access-note">The owner creates invitations and approves employee access. Sign-in verification and owner approval are both required.</div>}
            <span className="nw-demo-label">Private review demo</span>
        </div></section>
    </div></div>;
}
export default function Workspace() {
    const [data, setData] = useState<WorkspaceResponse | null>(null);
    const dataRef = useRef<WorkspaceResponse | null>(null);
    const [status, setStatus] = useState<"loading" | "ready" | "signin" | "denied" | "error">("loading");
    const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
    const [error, setError] = useState("");
    const [view, setView] = useState<View>("overview");
    const [profileMemberId, setProfileMemberId] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [query, setQuery] = useState("");
    const [ticketView, setTicketView] = useState<"board" | "list">("board");
    const [assigneeFilter, setAssigneeFilter] = useState("");
    const [priorityFilter, setPriorityFilter] = useState("");
    const [showArchived, setShowArchived] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
    const [modal, setModal] = useState<ModalState>(null);
    const [busy, setBusy] = useState(false);
    const modalRevision = useRef<number | null>(null);
    useEffect(() => { modalRevision.current = modal ? dataRef.current?.revision ?? null : null; }, [modal]);
    const [toast, setToast] = useState("");
    const [showNotifications, setShowNotifications] = useState(false);
    const [now, setNow] = useState(new Date());
    const [calendarMonth, setCalendarMonth] = useState(new Date());
    const [calendarView, setCalendarView] = useState<"month" | "list">("month");
    const [chatChannel, setChatChannel] = useState("");
    const [directUser, setDirectUser] = useState<string | null>(null);
    const [libraryTab, setLibraryTab] = useState("All resources");
    const [audit, setAudit] = useState<any>(null);
    const [auditQuery, setAuditQuery] = useState("");
    const [auditLoading, setAuditLoading] = useState(false);
    const [news, setNews] = useState<NewsData | null>(null);
    const [newsPaused, setNewsPaused] = useState(false);
    const [adminTab, setAdminTab] = useState("Team");
    const searchRef = useRef<HTMLInputElement>(null);
    const accept = useCallback((next: WorkspaceResponse) => { dataRef.current = next; setData(next); setOnboarding(null); setStatus("ready"); }, []);
    const clearWorkspace = useCallback(() => { dataRef.current = null; setData(null); setModal(null); setSelectedTicket(null); setShowNotifications(false); }, []);
    const load = useCallback(async (quiet = false) => {
        try {
            const r = await fetch("/api/workspace", { cache: "no-store" });
            const next = await r.json() as WorkspaceResponse & {
                error?: string;
            };
            if (!r.ok) {
                if (r.status === 401) {
                    clearWorkspace();
                    setOnboarding(null);
                    setError("");
                    setStatus("signin");
                    return;
                }
                if (r.status === 403) {
                    clearWorkspace();
                    setStatus("denied");
                    try {
                        const invitationResponse = await fetch("/api/workspace?view=onboarding", { cache: "no-store" });
                        const invitation = await invitationResponse.json() as OnboardingState & { error?: string };
                        if (invitationResponse.status === 401) { setOnboarding(null); setError(""); setStatus("signin"); return; }
                        if (!invitationResponse.ok || !["invited", "pending_approval", "approved", "revoked", "expired", "not_invited"].includes(invitation.status)) throw new Error(invitation.error || "Your invitation status could not be checked. Please refresh.");
                        setOnboarding(invitation);
                        setError("");
                    }
                    catch (e) { setOnboarding(null); setError(e instanceof Error ? e.message : "Your invitation status could not be checked."); }
                    return;
                }
                throw new Error(next.error || "The workspace could not be loaded.");
            }
            accept(next);
            if (!quiet)
                setError("");
        }
        catch (e) {
            if (!quiet) {
                setError(e instanceof Error ? e.message : "Connection failed.");
                setStatus("error");
            }
        }
    }, [accept, clearWorkspace]);
    const acceptInvitation = async () => {
        if (busy || onboarding?.status !== "invited" || !onboarding.invitationId) return;
        setBusy(true);
        setError("");
        try {
            const response = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invitation.accept", payload: { invitationId: onboarding.invitationId } }) });
            const result = await response.json() as OnboardingState & { error?: string };
            if (!response.ok) { await load(true); throw new Error(result.error || "The invitation could not be accepted. Refresh its status and try again."); }
            setOnboarding(result);
            setStatus("denied");
            if (result.status === "approved") await load();
        }
        catch (e) { setError(e instanceof Error ? e.message : "The invitation could not be accepted."); }
        finally { setBusy(false); }
    };
    const refreshAccess = async () => { if (busy) return; setBusy(true); await load(); setBusy(false); };
    useEffect(() => { void load(); const timer = setInterval(() => void load(true), 15000); const clock = setInterval(() => setNow(new Date()), 30000); return () => { clearInterval(timer); clearInterval(clock); }; }, [load]);
    useEffect(() => { if (!toast)
        return; const t = setTimeout(() => setToast(""), 4000); return () => clearTimeout(t); }, [toast]);
    useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
    } if (e.key === "Escape") {
        setModal(null);
        setSelectedTicket(null);
        setShowNotifications(false);
    } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, []);
    useEffect(() => { if (data && !chatChannel && data.state.channels.length)
        setChatChannel(data.state.channels[0].id); }, [data, chatChannel]);
    useEffect(() => {
        if (status !== "ready")
            return;
        let active = true;
        const update = async () => {
            const attemptAt = new Date().toISOString();
            try {
                const r = await fetch("/api/news");
                if (!r.ok)
                    throw new Error("News unavailable");
                const result = await r.json() as NewsData;
                if (active)
                    setNews(previous => result.status === "unavailable" && previous?.items.length
                        ? { ...result, items: previous.items, status: "cached", fetchedAt: previous.fetchedAt }
                        : result);
            }
            catch {
                if (active)
                    setNews(previous => ({
                        items: previous?.items || [],
                        status: previous?.items.length ? "cached" : "unavailable",
                        fetchedAt: previous?.fetchedAt ?? null,
                        checkedAt: attemptAt,
                        errors: [{ source: "News service", message: "The latest refresh could not be completed." }],
                    }));
            }
        };
        void update();
        const interval = setInterval(() => void update(), 120000);
        return () => { active = false; clearInterval(interval); };
    }, [status]);
    useEffect(() => { const id = new URLSearchParams(window.location.search).get("ticket"); if (id) {
        setSelectedTicket(id);
        setView("tickets");
    } }, []);
    useEffect(() => {
        if (!modal && !selectedTicket)
            return;
        const previous = document.activeElement as HTMLElement | null;
        const oldOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        const timer = setTimeout(() => { const dialog = document.querySelector(".nw-modal") || document.querySelector(".nw-drawer"); (dialog?.querySelector("input:not([type=checkbox]), textarea, select, button") as HTMLElement | null)?.focus(); }, 0);
        const trap = (e: KeyboardEvent) => { if (e.key !== "Tab")
            return; const dialog = document.querySelector(".nw-modal") || document.querySelector(".nw-drawer"); const nodes = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []).filter(n => n.offsetParent !== null); if (!nodes.length)
            return; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        }
        else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        } };
        document.addEventListener("keydown", trap);
        return () => { clearTimeout(timer); document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", trap); previous?.focus(); };
    }, [modal, selectedTicket]);
    const mutate = async (action: WorkspaceAction, payload: Record<string, any>, message = "Saved") => {
        if (!dataRef.current || busy)
            return false;
        setBusy(true);
        setError("");
        try {
            const r = await fetch("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, payload, revision: modalRevision.current ?? dataRef.current.revision }) });
            const result = await r.json() as WorkspaceResponse & {
                error?: string;
                code?: string;
            };
            if (r.status === 401 || r.status === 403) await load(true);
            if (r.status === 409 && result.code === "revision_conflict") {
                await load(true);
                setModal(null);
                throw new Error("The workspace changed while you were editing. Your change was not saved. Reopen the item to review its current details before editing again.");
            }
            if (!r.ok)
                throw new Error(result.error || "The change could not be saved.");
            accept(result);
            if (message)
                setToast(message);
            return true;
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "The change could not be saved.");
            return false;
        }
        finally {
            setBusy(false);
        }
    };
    const loadAudit = useCallback(async () => { setAuditLoading(true); try {
        const r = await fetch("/api/workspace?view=audit", { cache: "no-store" });
        const result = await r.json() as WorkspaceResponse & {
            error?: string;
        };
        if (!r.ok)
            throw new Error(result.error || "Unable to read the audit log.");
        setAudit(result);
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "Audit unavailable.");
    }
    finally {
        setAuditLoading(false);
    } }, []);
    useEffect(() => { if (view === "audit")
        void loadAudit(); }, [view, loadAudit]);
    const state = data?.state;
    const me = data?.user;
    const isAdmin = me?.role === "admin";
    const isOwner = me?.id === "owner";
    const users = state?.users || [];
    const profileUsers = users.filter(u => !u.sample && ["owner", "approved"].includes(accessForMember(u, now.getTime())));
    const profileTarget = isAdmin && profileMemberId ? profileUsers.find(u => u.id === profileMemberId) || me : me;
    const member = (id: string | null | undefined) => users.find(u => u.id === id);
    const activeTickets = state?.tickets.filter(t => !t.archived) || [];
    const doneIds = new Set(state?.columns.filter(c => c.isDone).map(c => c.id));
    const closed = activeTickets.filter(t => doneIds.has(t.status));
    const open = activeTickets.filter(t => !doneIds.has(t.status));
    const overdue = open.filter(t => t.dueDate && new Date(t.dueDate).getTime() < new Date(new Date().toDateString()).getTime());
    const dueSoon = open.filter(t => t.dueDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate))).slice(0, 5);
    const myTickets = open.filter(t => t.assigneeId === me?.id);
    const filteredTickets = (state?.tickets || []).filter(t => t.archived === showArchived && (!query || `${t.title} ${t.key} ${t.customer} ${t.description} ${t.tags.join(" ")}`.toLowerCase().includes(query.toLowerCase())) && (!assigneeFilter || t.assigneeId === assigneeFilter || (assigneeFilter === "unassigned" && !t.assigneeId)) && (!priorityFilter || t.priority === priorityFilter));
    const ticket = state?.tickets.find(t => t.id === selectedTicket);
    const notifications = state?.notifications.filter(n => n.userId === me?.id) || [];
    const unread = notifications.filter(n => !n.read).length;
    const knowledge = (data?.resources || {}) as Knowledge;
    const resources = knowledge.resources || [];
    const runbooks = knowledge.runbooks || [];
    const go = (next: View) => { setView(next); setQuery(""); setShowNotifications(false); if (next === "profile") setProfileMemberId(null); if (window.innerWidth < 760)
        setCollapsed(false); };
    const showTicket = (id: string) => { setSelectedTicket(id); };
    const copy = async (text: string, label = "Copied") => { try {
        await navigator.clipboard.writeText(text);
        setToast(label);
    }
    catch {
        setModal({ type: "copy", data: { text } });
    } };
    const confirm = (title: string, description: string, action: WorkspaceAction, payload: any) => setModal({ type: "confirm", data: { title, description, action, payload } });
    const exportEvent = (event: CalendarEvent) => {
        const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
        const stamp = (value: string) => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
        const text = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//NorthWallEg//Workspace//EN", "BEGIN:VEVENT", `UID:${event.id}@northwalleg`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(event.start)}`, `DTEND:${stamp(event.end)}`, `SUMMARY:${escape(event.title)}`, `DESCRIPTION:${escape(event.description)}`, `LOCATION:${escape(event.location)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
        const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `${event.id}.ics`;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setToast("Calendar file downloaded");
    };
    if (status === "loading")
        return <div className="nw-workspace"><div className="nw-loading"><span className="nw-mark"><NWMark /></span><span className="nw-spinner"/><span>Opening your workspace</span></div></div>;
    if (!data || status === "signin" || status === "denied")
        return <WorkspaceAccessGate status={status} onboarding={onboarding} error={error} busy={busy} onAccept={() => void acceptInvitation()} onRefresh={() => void refreshAccess()}/>;
    function PriorityBadge({ priority }: {
        priority: string;
    }) { return <span className={`nw-pill ${readable(priority)}`}><Flag size={10}/>{readable(priority)}</span>; }
    function StatusBadge({ id }: {
        id: string;
    }) { const col = state!.columns.find(c => c.id === id); return <span className="nw-pill" style={col ? { background: `${col.color}17`, color: col.color } : {}}>{col?.name || id}</span>; }
    function TicketCard({ item }: {
        item: Ticket;
    }) { return <article className="nw-ticket-card" onClick={() => showTicket(item.id)} onKeyDown={e => { if (e.key === "Enter")
        showTicket(item.id); }} tabIndex={0} role="button" draggable onDragStart={e => e.dataTransfer.setData("text/plain", item.id)}><div className="nw-flex-between"><span className="nw-ticket-id">{item.key}</span><PriorityBadge priority={item.priority}/></div><h3>{item.title}</h3><div className="nw-ticket-tags">{item.tags.slice(0, 2).map(t => <span key={t}>{t}</span>)}</div><div className="nw-ticket-meta"><Clock3 size={11}/><span className={item.dueDate && overdue.some(t => t.id === item.id) ? "nw-overdue" : ""}>{shortDate(item.dueDate)}</span>{state!.comments.filter(c => c.ticketId === item.id && !c.deleted).length > 0 && <><MessageCircle size={11}/>{state!.comments.filter(c => c.ticketId === item.id && !c.deleted).length}</>}<Avatar user={member(item.assigneeId)} small/></div></article>; }
    function TicketRows({ items }: {
        items: Ticket[];
    }) { return <>{items.length ? items.map(t => <div className="nw-task-row" key={t.id} onClick={() => showTicket(t.id)} role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter")
        showTicket(t.id); }}><span className={`nw-task-check${doneIds.has(t.status) ? " done" : ""}`}>{doneIds.has(t.status) && <Check size={12}/>}</span><div className="nw-task-row-main"><h3>{t.title}</h3><p><span>{t.key}</span><span>·</span><span>{t.customer || "Internal"}</span><span>·</span><span>{shortDate(t.dueDate)}</span></p></div><PriorityBadge priority={t.priority}/><Avatar user={member(t.assigneeId)} small/></div>) : <Empty title="You’re all caught up"><p>No matching work at the moment.</p></Empty>}</>; }
    const renderOverview = () => {
        const counts = state!.columns.map((c, i) => ({ ...c, count: activeTickets.filter(t => t.status === c.id).length, chartColor: c.color || COLORS[i % COLORS.length] }));
        let progress = 0;
        const gradient = counts.map(c => { const start = progress; progress += activeTickets.length ? c.count / activeTickets.length * 100 : 0; return `${c.chartColor} ${start}% ${progress}%`; }).join(",");
        const upcoming = state!.events.filter(e => new Date(e.end).getTime() >= now.getTime()).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
        return <><div className="nw-stats">{[{ label: "Total tickets", value: activeTickets.length, icon: ClipboardList, caption: `Across ${state!.columns.length} workflow stages`, color: "" }, { label: "Open work", value: open.length, icon: Clock3, caption: `${myTickets.length} assigned to you`, color: "" }, { label: "Completed", value: closed.length, icon: CheckCircle2, caption: `${activeTickets.length ? Math.round(closed.length / activeTickets.length * 100) : 0}% of active tickets`, color: "green" }, { label: "Overdue", value: overdue.length, icon: Flag, caption: overdue.length ? "Ready for your attention" : "Everything is on schedule", color: overdue.length ? "orange" : "green" }].map(s => <div className="nw-stat" key={s.label}><div className="nw-stat-top"><span>{s.label}</span><span className="nw-stat-icon"><s.icon size={16}/></span></div><span className="nw-stat-number">{s.value.toString().padStart(2, "0")}</span><div className={`nw-stat-caption ${s.color}`}>{s.caption}</div></div>)}</div><div className="nw-dashboard-grid"><div><section className="nw-panel"><div className="nw-panel-head"><div><h2>Next up for the team</h2><p>Upcoming work, ordered by due date</p></div><button className="nw-text-link" onClick={() => go("tickets")}>View board</button></div><TicketRows items={dueSoon}/></section><section className="nw-panel"><div className="nw-panel-head"><div><h2>Team workload</h2><p>Open tickets by assigned team member</p></div><Users size={17} color="#9aaa9e"/></div><div className="nw-panel-body">{users.filter(u => u.active).map((u, i) => { const n = open.filter(t => t.assigneeId === u.id).length; return <div className="nw-progress-row" key={u.id}><div className="nw-progress-label"><span className="nw-person"><Avatar user={u} small/>{u.name}{u.sample && <span className="nw-small">sample</span>}</span><span>{n} ticket{n !== 1 ? "s" : ""}</span></div><div className="nw-progress-track"><span style={{ width: `${Math.max(0, n / Math.max(open.length, 1) * 100)}%`, background: COLORS[i % COLORS.length] }}/></div></div>; })}</div></section><section className="nw-panel"><div className="nw-panel-head"><h2>Useful places</h2></div><div className="nw-panel-body nw-quick-links"><button onClick={() => { go("library"); setLibraryTab("M365 runbooks"); }}><BookOpen size={18}/>Microsoft 365 handbook</button><button onClick={() => { go("library"); setLibraryTab("ISO standards"); }}><Shield size={18}/>Standards & guidance</button><button onClick={() => setModal({ type: "note" })}><StickyNote size={18}/>Write a team note</button><button onClick={() => go("chat")}><MessageCircle size={18}/>Start a conversation</button></div></section></div><div><section className="nw-panel"><div className="nw-panel-head"><div><h2>Work at a glance</h2><p>A live view of your workspace</p></div><MoreHorizontal size={18} color="#9aaa9e"/></div><div className="nw-panel-body"><div className="nw-donut-wrap"><div className="nw-donut" style={{ background: activeTickets.length ? `conic-gradient(${gradient})` : "#e4ebe5" }}><div className="nw-donut-center">{activeTickets.length}<small>Total tickets</small></div></div><div className="nw-legend">{counts.map(c => <div className="nw-legend-row" key={c.id}><i style={{ background: c.chartColor }}/><span>{c.name}</span><b>{c.count}</b></div>)}</div></div><div className="nw-small" style={{ borderTop: "1px solid #edf1ee", paddingTop: 15, display: "flex", gap: 7, alignItems: "center" }}><Activity size={13}/>Counts reflect saved workspace records</div></div></section><section className="nw-panel"><div className="nw-panel-head"><h2>On the calendar</h2><button className="nw-text-link" onClick={() => go("calendar")}>View all</button></div>{upcoming.length ? upcoming.map(e => <div className="nw-event-row" key={e.id} onClick={() => setModal({ type: (e.ownerId === me!.id || isAdmin) ? "event" : "readEvent", data: e })} role="button" tabIndex={0} onKeyDown={ev => { if (ev.key === "Enter")
            setModal({ type: (e.ownerId === me!.id || isAdmin) ? "event" : "readEvent", data: e }); }}><div className="nw-date-tile">{new Date(e.start).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}<b>{new Date(e.start).getDate()}</b></div><div><h3>{e.title}</h3><p>{new Date(e.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {e.location || "Online"}</p></div></div>) : <Empty title="Your calendar is clear" icon={CalendarDays}><button className="nw-button secondary small" onClick={() => setModal({ type: "event" })}>Add an event</button></Empty>}</section><section className="nw-panel"><div className="nw-panel-head"><h2>Recent updates</h2><Bell size={16} color="#9aaa9e"/></div>{notifications.slice(0, 3).map(n => <button className={`nw-notification${!n.read ? " unread" : ""}`} key={n.id} onClick={() => { void mutate("notification.read", { id: n.id }, ""); if (n.objectId && state!.tickets.some(t => t.id === n.objectId))
            showTicket(n.objectId); }}><span className="nw-avatar small warm"><Bell size={12}/></span><div><strong>{n.title}</strong><small>{fullDate(n.createdAt)}</small></div></button>)}{!notifications.length && <Empty title="No updates yet" icon={Bell}><p>Assignments, mentions and team alerts will appear here.</p></Empty>}</section></div></div></>;
    };
    const renderTickets = () => <><div className="nw-toolbar"><div className="nw-tabs"><button className={ticketView === "board" ? "active" : ""} onClick={() => setTicketView("board")}><Columns3 size={14}/>Board</button><button className={ticketView === "list" ? "active" : ""} onClick={() => setTicketView("list")}><List size={14}/>List</button></div><div className="nw-search-input"><Search size={15}/><input className="nw-input" aria-label="Search tickets" placeholder="Search tickets…" value={query} onChange={e => setQuery(e.target.value)}/></div><select className="nw-select" aria-label="Filter assignee" value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}><option value="">All assignees</option><option value="unassigned">Unassigned</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select className="nw-select" aria-label="Filter priority" value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}><option value="">All priorities</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select><button className={`nw-button ${showArchived ? "" : "secondary"} small`} onClick={() => setShowArchived(!showArchived)}><Archive size={13}/>{showArchived ? "Show active" : "Show archive"}</button>{isAdmin && <button className="nw-button secondary small nw-spacer" onClick={() => setModal({ type: "column" })}><Plus size={13}/>Column</button>}</div>{ticketView === "board" ? <div className="nw-board">{state!.columns.map(c => <section className="nw-column" key={c.id} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain"); if (state!.tickets.some(t => t.id === id))
        void mutate("ticket.update", { id, status: c.id }, `Moved to ${c.name}`); }}><div className="nw-column-head"><i style={{ background: c.color }}/>{c.name}<span>{filteredTickets.filter(t => t.status === c.id).length}</span><button className="nw-icon-button" title={`Add to ${c.name}`} onClick={() => setModal({ type: "ticket", data: { status: c.id } })}><Plus size={15}/></button></div>{filteredTickets.filter(t => t.status === c.id).map(t => <TicketCard item={t} key={t.id}/>)}<button className="nw-add-card" onClick={() => setModal({ type: "ticket", data: { status: c.id } })}><Plus size={13}/>Add ticket</button></section>)}</div> : <section className="nw-panel"><div className="nw-table-wrap"><table><thead><tr><th>Ticket</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due date</th><th>Location</th></tr></thead><tbody>{filteredTickets.map(t => <tr className="clickable" key={t.id} onClick={() => showTicket(t.id)}><td className="nw-ticket-cell"><strong>{t.title}</strong><small>{t.key} · {t.customer || "Internal"}</small></td><td><StatusBadge id={t.status}/></td><td><PriorityBadge priority={t.priority}/></td><td><span className="nw-person"><Avatar user={member(t.assigneeId)} small/>{member(t.assigneeId)?.name || "Unassigned"}</span></td><td>{shortDate(t.dueDate)}</td><td>{t.location || "—"}</td></tr>)}</tbody></table></div>{!filteredTickets.length && <Empty title="No matching tickets"><p>Try a different search or create a new ticket.</p></Empty>}</section>}<p className="nw-small">Drag cards between columns, or open a ticket to update its status. All changes are saved and recorded.</p></>;
    const renderCalendar = () => {
        const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
        const start = new Date(first);
        start.setDate(1 - ((first.getDay() + 6) % 7));
        const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
        const items = state!.events.filter(e => !query || `${e.title} ${e.description} ${e.location}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.start.localeCompare(b.start));
        return <><div className="nw-toolbar"><div className="nw-tabs"><button className={calendarView === "month" ? "active" : ""} onClick={() => setCalendarView("month")}>Month</button><button className={calendarView === "list" ? "active" : ""} onClick={() => setCalendarView("list")}>Agenda</button></div><button className="nw-icon-button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><ChevronLeft size={18}/></button><strong style={{ fontSize: 16, fontWeight: 500 }}>{calendarMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</strong><button className="nw-icon-button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><ChevronRight size={18}/></button><button className="nw-button secondary small" onClick={() => setCalendarMonth(new Date())}>Today</button><button className="nw-button nw-spacer" onClick={() => setModal({ type: "event" })}><Plus size={15}/>Add event</button></div>{calendarView === "month" ? <div className="nw-calendar">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => <div className="nw-calendar-weekday" key={d}>{d}</div>)}{days.map(d => <div key={dayKey(d)} className={`nw-calendar-day${d.getMonth() !== calendarMonth.getMonth() ? " other" : ""}${dayKey(d) === dayKey(new Date()) ? " today" : ""}`}><button aria-label={`Add event on ${dayKey(d)}`} onClick={() => setModal({ type: "event", data: { start: `${dayKey(d)}T09:00:00`, end: `${dayKey(d)}T10:00:00` } })}>{d.getDate()}</button>{items.filter(e => dayKey(new Date(e.start)) === dayKey(d)).map(e => <button className="nw-calendar-event" key={e.id} title={e.title} onClick={() => setModal({ type: (e.ownerId === me!.id || isAdmin) ? "event" : "readEvent", data: e })}>{new Date(e.start).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} {e.title}</button>)}{activeTickets.filter(t => dateInput(t.dueDate) === dayKey(d)).map(t => <button className="nw-calendar-event ticket" key={t.id} title={t.title} onClick={() => showTicket(t.id)}>{t.key} · {t.title}</button>)}</div>)}</div> : <section className="nw-panel">{items.map(e => <div className="nw-event-row" key={e.id}><div className="nw-date-tile">{new Date(e.start).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}<b>{new Date(e.start).getDate()}</b></div><div style={{ flex: 1 }}><h3>{e.title}</h3><p>{fullDate(e.start)} – {new Date(e.end).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · {e.location || "Online"}</p><p>{e.description}</p></div><button className="nw-icon-button" aria-label="Edit event" onClick={() => setModal({ type: (e.ownerId === me!.id || isAdmin) ? "event" : "readEvent", data: e })}><Pencil size={14}/></button></div>)}{!items.length && <Empty title="No events planned" icon={CalendarDays}><p>Add a maintenance window, meeting or delivery milestone.</p></Empty>}</section>}<p className="nw-small" style={{ marginTop: 15 }}>Events use your browser’s local time. Terracotta entries are ticket due dates.</p></>;
    };
    const renderNotes = () => { const notes = state!.notes.filter(n => !query || `${n.title} ${n.body}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt)); return <><div className="nw-toolbar"><div className="nw-search-input"><Search size={15}/><input className="nw-input" placeholder="Search notes…" aria-label="Search notes" value={query} onChange={e => setQuery(e.target.value)}/></div><span className="nw-small">{notes.length} notes · Private notes are visible only to their author</span><button className="nw-button nw-spacer" onClick={() => setModal({ type: "note" })}><Plus size={15}/>New note</button></div><div className="nw-notes-grid">{notes.map(n => <article className={`nw-note-card${n.pinned ? " pinned" : ""}`} key={n.id}><div className="nw-flex-between"><span className="nw-pill gray">{n.visibility === "private" ? <LockKeyhole size={10}/> : <Users size={10}/>} {readable(n.visibility)}</span><button className="nw-icon-button" title={n.pinned ? "Unpin note" : "Pin note"} disabled={n.ownerId !== me!.id || busy} onClick={() => void mutate("note.save", { ...n, pinned: !n.pinned }, n.pinned ? "Note unpinned" : "Note pinned")}><Pin size={14} fill={n.pinned ? "#c6956c" : "none"}/></button></div><h3>{n.title}</h3><p>{n.body}</p><div className="nw-note-footer"><span>{member(n.ownerId)?.name || "Team"} · {shortDate(n.updatedAt)}</span><button className="nw-text-link" onClick={() => setModal({ type: n.ownerId === me!.id ? "note" : "readNote", data: n })}>Open note</button></div></article>)}</div>{!notes.length && <section className="nw-panel"><Empty title="Room for your next idea" icon={StickyNote}><p>Write handover notes, project decisions and reminders for yourself or the team.</p></Empty></section>}</>; };
    const messageBody = (text: string) => { const parts = text.split(/(@[\w.-]+(?: [\w.-]+)?)/g); return parts.map((p, i) => p.startsWith("@") ? <span className="nw-mention" key={i}>{p}</span> : p); };
    const ReactionButtons = ({ item, kind }: {
        item: Comment | Message;
        kind: "comment" | "message";
    }) => <>{item.reactions.map(r => <button className="nw-reaction" key={r.emoji} title={r.userIds.map(id => member(id)?.name || "Team member").join(", ")} onClick={() => void mutate(`${kind}.react` as WorkspaceAction, { id: item.id, emoji: r.emoji }, "")}>{r.emoji} {r.userIds.length}</button>)}</>;
    const renderChat = () => {
        const messages = state!.messages.filter(m => !m.deleted && (directUser ? ((m.authorId === me!.id && m.recipientId === directUser) || (m.authorId === directUser && m.recipientId === me!.id)) : (m.channelId === chatChannel && !m.recipientId))).filter(m => !query || m.body.toLowerCase().includes(query.toLowerCase()));
        const channel = state!.channels.find(c => c.id === chatChannel);
        return <div className="nw-chat-layout"><aside className="nw-chat-sidebar"><div className="nw-flex-between"><h3>Channels</h3>{isAdmin && <button className="nw-icon-button" aria-label="Add channel" style={{ width: 22 }} onClick={() => setModal({ type: "channel" })}><Plus size={13}/></button>}</div>{state!.channels.map(c => <button key={c.id} className={!directUser && c.id === chatChannel ? "active" : ""} title={c.name} onClick={() => { setChatChannel(c.id); setDirectUser(null); setQuery(""); }}><Hash size={16}/><span className="nw-chat-name">{c.name}</span></button>)}<h3 style={{ marginTop: 26 }}>Direct messages</h3>{users.filter(u => u.id !== me!.id && u.active).map(u => <button key={u.id} className={directUser === u.id ? "active" : ""} title={u.name} onClick={() => { setDirectUser(u.id); setQuery(""); }}><Avatar user={u} small/><span className="nw-chat-name">{u.name}</span></button>)}</aside><div className="nw-chat-main"><div className="nw-chat-head"><div><h2>{directUser ? member(directUser)?.name : `# ${channel?.name || "Team chat"}`}</h2><span className="nw-small">{directUser ? "Private conversation" : channel?.description}</span></div><span className="nw-small">Refreshes every 15 seconds</span></div><div className="nw-chat-messages">{messages.map(m => { const original = state!.messages.find(x => x.id === m.replyToId); return <article className={`nw-chat-message${m.authorId === me!.id ? " own" : ""}`} key={m.id}><Avatar user={member(m.authorId)} small/><div className="nw-chat-bubble"><div className="nw-comment-header"><b>{member(m.authorId)?.name || "Team member"}</b><time>{fullDate(m.createdAt)}</time>{m.pinned && <Pin size={10}/>}</div>{m.forwardedFromId && <span className="nw-message-edited">Forwarded</span>}{original && <div className="nw-quote"><strong>{member(original.authorId)?.name}</strong>{original.body.slice(0, 130)}</div>}<div className="nw-comment-text">{messageBody(m.body)}</div>{m.updatedAt !== m.createdAt && <span className="nw-message-edited">Edited</span>}<div className="nw-comment-actions"><ReactionButtons item={m} kind="message"/><button title="Reply to this person" onClick={() => setModal({ type: "messageReply", data: m })}>Reply</button><button onClick={() => setModal({ type: "reaction", data: { item: m, kind: "message" } })}>React</button><button onClick={() => setModal({ type: "forward", data: { item: m, kind: "message" } })}>Forward</button><button onClick={() => void copy(m.body, "Message copied")}>Copy</button>{m.authorId === me!.id && <button onClick={() => setModal({ type: "editText", data: { item: m, kind: "message" } })}>Edit</button>}<button onClick={() => void mutate("message.pin", { id: m.id, pinned: !m.pinned }, m.pinned ? "Message unpinned" : "Message pinned")}>{m.pinned ? "Unpin" : "Pin"}</button>{(m.authorId === me!.id || isAdmin) && <button onClick={() => confirm("Delete message?", "The message will be removed from the conversation. The action remains in the audit trail.", "message.delete", { id: m.id })}>Delete</button>}</div></div></article>; })}{!messages.length && <Empty title={directUser ? "Start a conversation" : "A little quiet here"} icon={MessageCircle}><p>{member(directUser)?.sample ? "This is a sample teammate. Messages are saved, but sample users do not receive them." : "Share an update, ask a question or mention a teammate."}</p></Empty>}</div><div className="nw-chat-compose"><Composer users={users} busy={busy} placeholder={directUser ? `Message ${member(directUser)?.name}…` : `Message #${channel?.name || "team"}…`} onSend={async (body, mentions) => mutate("message.send", { channelId: chatChannel || state!.channels[0]?.id, recipientId: directUser, body, mentions }, "Message sent")}/></div></div></div>;
    };
    const renderLibrary = () => {
        const categories = Array.from(new Set(resources.map(r => r.category)));
        const tabs = ["All resources", "M365 runbooks", ...categories];
        const list = resources.filter(r => (libraryTab === "All resources" || r.category === libraryTab) && (!query || `${r.title} ${r.description} ${r.tags?.join(" ")}`.toLowerCase().includes(query.toLowerCase())));
        const guides = runbooks.filter(r => !query || `${r.title} ${r.product} ${r.summary}`.toLowerCase().includes(query.toLowerCase()));
        return <><section className="nw-library-hero"><div><span className="nw-eyebrow">Knowledge that moves work forward</span><h2>Your team’s practical reference desk.</h2><p>Official guidance, original troubleshooting checklists, and the admin links you reach for every day.</p></div><BookOpen strokeWidth={1}/></section><div className="nw-toolbar"><div className="nw-search-input"><Search size={15}/><input className="nw-input" placeholder="Find a guide, standard or tool…" aria-label="Search library" value={query} onChange={e => setQuery(e.target.value)}/></div><select className="nw-select" aria-label="Resource category" value={libraryTab} onChange={e => setLibraryTab(e.target.value)}>{tabs.map(t => <option key={t}>{t}</option>)}</select><span className="nw-small nw-spacer">{resources.length} resources · {runbooks.length} runbooks</span></div><div className="nw-resource-grid">{libraryTab === "M365 runbooks" ? guides.map(r => <article className="nw-resource-card" key={r.id}><div className="nw-flex-between"><span className="nw-pill blue">{r.product}</span><FileText size={17} color="#879987"/></div><h3>{r.title}</h3><p>{r.summary}</p><footer><span>{r.estimatedMinutes} min · {r.steps.length} steps</span><button className="nw-text-link" onClick={() => setModal({ type: "runbook", data: r })}>Open runbook</button></footer></article>) : list.map(r => <article className="nw-resource-card" key={r.id}><div className="nw-flex-between"><span className="nw-pill gray">{r.category}</span>{r.category.toLowerCase().includes("iso") ? <Shield size={17} color="#879987"/> : <BookOpen size={17} color="#879987"/>}</div><h3>{r.title}</h3><p>{r.description}</p><div className="nw-tag-list">{r.tags?.slice(0, 3).map(t => <span key={t}>{t}</span>)}</div><footer><span>{r.publisher}</span><a className="nw-text-link" href={r.url} target="_blank" rel="noreferrer">Official source <ExternalLink size={11}/></a></footer></article>)}</div>{(libraryTab === "M365 runbooks" ? !guides.length : !list.length) && <Empty title="No resources match this search" icon={BookOpen}><p>Try a different term or category.</p></Empty>}<div className="nw-info-box"><Shield size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }}/>ISO entries link to official descriptions and licensed publications. The library’s checklists are original practical summaries; full paid standards are not reproduced. Resource links reviewed {knowledge.verifiedOn || "for this demo"}.</div></>;
    };
    const revokeMember = (user: Member) => setModal({ type: "confirm", data: {
        title: `Revoke access for ${user.name}?`,
        description: "This withdraws the invitation or approved access. The person will need a new invitation, acceptance and owner approval to return. Existing work and audit evidence are retained.",
        action: "member.revoke", payload: { id: user.id }, label: "Revoke access", success: "Invitation and workspace access revoked",
    } });
    const reinviteMember = (user: Member) => setModal({ type: "confirm", data: {
        title: `Create a new invitation for ${user.name}?`,
        description: "The previous invitation will be replaced. This person must accept the new invitation and receive your approval within seven days. The invitation starts with the employee role and does not send an email.",
        action: "member.reinvite", payload: { id: user.id }, label: "Create new invitation", success: "New invitation created. Copy its message to share it.",
    } });
    const memberTimestamps = (user: Member) => user.onboarding && <dl className="nw-invitation-dates">
        <div><dt>Invited</dt><dd><time dateTime={user.onboarding.invitedAt}>{invitationTime(user.onboarding.invitedAt)}</time></dd></div>
        {user.onboarding.acceptedAt && <div><dt>Accepted</dt><dd><time dateTime={user.onboarding.acceptedAt}>{invitationTime(user.onboarding.acceptedAt)}</time></dd></div>}
        {user.onboarding.approvedAt ? <div><dt>Approved</dt><dd><time dateTime={user.onboarding.approvedAt}>{invitationTime(user.onboarding.approvedAt)}</time></dd></div> : <div><dt>Deadline</dt><dd><time dateTime={user.onboarding.expiresAt}>{invitationTime(user.onboarding.expiresAt)}</time></dd></div>}
        {user.onboarding.revokedAt && <div><dt>Revoked</dt><dd><time dateTime={user.onboarding.revokedAt}>{invitationTime(user.onboarding.revokedAt)}</time></dd></div>}
    </dl>;
    const renderTeam = () => {
        const pending = users.filter(u => accessForMember(u, now.getTime()) === "pending_approval");
        const accessLabels: Record<MemberAccess, string> = {
            owner: "Owner access", sample: "Sample · no sign-in", invited: "Awaiting acceptance", pending_approval: "Awaiting owner approval",
            approved: "Approved", revoked: "Revoked", expired: "Invitation expired", not_invited: "Invitation required",
        };
        return <div className="nw-team-access">
            <section className="nw-access-policy">
                <div className="nw-access-policy-heading"><Shield size={21}/><div><h2>{isOwner ? "You control who joins the team" : "Employee access is controlled by the owner"}</h2><p>{isOwner ? "Invite a person, wait for their acceptance, then approve their employee access." : "Your administrator role manages workspace features and evidence. Only the owner can invite people, approve or revoke access, and change roles."}</p></div></div>
                <ol className="nw-owner-access-flow"><li><span>1</span><div><strong>Owner invites</strong><small>Employee access stays off</small></div></li><li><span>2</span><div><strong>Person accepts</strong><small>Identity matches the invited email</small></div></li><li><span>3</span><div><strong>Owner approves</strong><small>Employee workspace opens</small></div></li></ol>
            </section>
            {isOwner && pending.length > 0 && <section className="nw-panel nw-approval-panel">
                <div className="nw-panel-head"><div><h2>Ready for your approval <span className="nw-pill">{pending.length}</span></h2><p>These people accepted their invitations. They still cannot open the workspace.</p></div><Clock3 size={21}/></div>
                <div className="nw-approval-list">{pending.map(user => <article className="nw-approval-card" key={user.id}>
                    <div className="nw-person"><Avatar user={user}/><div><h3>{user.name}</h3><p>{user.email}</p></div></div>
                    {memberTimestamps(user)}
                    <div className="nw-approval-actions"><button className="nw-button small" disabled={busy} onClick={() => setModal({ type: "approveMember", data: { id: user.id } })}><CheckCircle2 size={15}/>Review & approve</button><button className="nw-text-link nw-access-revoke" disabled={busy} onClick={() => revokeMember(user)}>Revoke invitation</button></div>
                </article>)}</div>
            </section>}
            <section className="nw-panel">
                <div className="nw-panel-head"><div><h2>People & permissions</h2><p>{isOwner ? "Invitations, accepted accounts and employee access" : "Team access and profile directory"}</p></div>{isOwner && <button className="nw-button" disabled={busy} onClick={() => setModal({ type: "member" })}><UserPlus size={15}/>Create invitation</button>}</div>
                <div className="nw-table-wrap"><table className="nw-members-table"><thead><tr><th>Team member</th><th>Role</th><th>Access</th><th>Account</th><th>Profile</th><th><span className="nw-sr-only">Owner actions</span></th></tr></thead><tbody>{users.map(user => {
                    const access = accessForMember(user, now.getTime());
                    const approved = access === "approved" || access === "owner";
                    return <tr key={user.id}>
                        <td><div className="nw-person"><Avatar user={user}/><div><b>{user.name}{user.sample && <span className="nw-pill gray">Sample</span>}</b><div className="nw-small">{user.jobTitle || "Job title to be added"}</div><div className="nw-small nw-member-email">{user.email}</div></div></div></td>
                        <td>{access === "owner" ? <span className="nw-owner-label"><Shield size={13}/>Owner · admin</span> : user.sample ? "Assignment only" : approved ? readable(user.role) : "Employee on approval"}</td>
                        <td><span className={`nw-pill nw-access-badge ${approved ? "approved" : access === "pending_approval" ? "pending" : "gray"}`}>{accessLabels[access]}</span>{user.onboarding && <div className="nw-member-lifecycle">{memberTimestamps(user)}</div>}</td>
                        <td className="nw-small">{user.sample ? "No login account" : user.userId ? "Account linked" : user.onboarding ? "Not accepted yet" : access === "owner" ? "Owner identity" : "Invitation needed"}</td>
                        <td className="nw-small">{user.sample ? "Sample record" : <>{user.photoUrl && user.jobTitle ? "Complete" : !user.photoUrl && !user.jobTitle ? "Photo + title needed" : !user.photoUrl ? "Photo needed" : "Title needed"}{approved && <button className="nw-text-link" onClick={() => { go("profile"); setProfileMemberId(user.id); }}>Manage profile</button>}</>}</td>
                        <td><div className="nw-member-actions">{isOwner && !user.sample && user.id !== "owner" && <>
                            {access === "pending_approval" && <button className="nw-button secondary small" disabled={busy} onClick={() => setModal({ type: "approveMember", data: { id: user.id } })}>Review approval</button>}
                            {access === "invited" && <button className="nw-button secondary small" disabled={busy} onClick={() => setModal({ type: "invitationShare", data: { id: user.id } })}><Share2 size={13}/>Copy invitation</button>}
                            {access === "approved" && <button className="nw-button secondary small" disabled={busy} onClick={() => setModal({ type: "member", data: { id: user.id } })}><Shield size={13}/>Change role</button>}
                            {["expired", "revoked", "not_invited"].includes(access) && <button className="nw-button secondary small" disabled={busy} onClick={() => reinviteMember(user)}><UserPlus size={13}/>Create new invitation</button>}
                            {["invited", "pending_approval", "approved"].includes(access) && <button className="nw-text-link nw-access-revoke" disabled={busy} onClick={() => revokeMember(user)}>Revoke access</button>}
                        </>}{access === "owner" && <span className="nw-small">Owner role protected</span>}{user.sample && <span className="nw-small">No account controls</span>}</div></td>
                    </tr>;
                })}</tbody></table></div>
                <div className="nw-invitation-delivery"><Send size={17}/><div><strong>Email delivery is not configured</strong><p>Create an invitation, then copy and share its message yourself. The link contains no sign-in secret and only the invited email can accept. Private Site access must be shared separately by the Site owner.</p></div></div>
            </section>
        </div>;
    };
    const renderAdmin = () => <><div className="nw-toolbar"><div className="nw-tabs">{["Team", "Workflow", "Automations", "Settings"].map(t => <button className={adminTab === t ? "active" : ""} key={t} onClick={() => setAdminTab(t)}>{t}</button>)}</div><span className="nw-small nw-spacer">Admin access · Changes are recorded</span></div>{adminTab === "Team" ? renderTeam() : adminTab === "Workflow" ? <div className="nw-admin-grid"><section className="nw-panel"><div className="nw-panel-head"><div><h2>Board columns</h2><p>Design the stages that match how you work</p></div><button className="nw-button secondary small" onClick={() => setModal({ type: "column" })}><Plus size={13}/>Add</button></div>{state!.columns.map((c, i) => <div className="nw-settings-row" key={c.id}><span className="nw-column-color" style={{ background: c.color }}/><div>{c.name}<small>{c.isDone ? "Counts as completed" : "Counts as open"} · {activeTickets.filter(t => t.status === c.id).length} tickets</small></div><button className="nw-icon-button" style={{ marginLeft: 0, width: 25 }} disabled={i === 0 || busy} title="Move column earlier" onClick={() => { const ids = state!.columns.map(x => x.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; void mutate("column.reorder", { ids }, "Column order saved"); }}><ChevronUp size={12}/></button><button className="nw-icon-button" style={{ marginLeft: 0, width: 25 }} disabled={i === state!.columns.length - 1 || busy} title="Move column later" onClick={() => { const ids = state!.columns.map(x => x.id); [ids[i], ids[i + 1]] = [ids[i + 1], ids[i]]; void mutate("column.reorder", { ids }, "Column order saved"); }}><ChevronDown size={12}/></button><button className="nw-icon-button" style={{ marginLeft: 0 }} title="Edit column" onClick={() => setModal({ type: "column", data: c })}><Pencil size={13}/></button></div>)}</section><section className="nw-panel"><div className="nw-panel-head"><div><h2>Custom ticket fields</h2><p>Add the details your team needs to capture</p></div><button className="nw-button secondary small" onClick={() => setModal({ type: "field" })}><Plus size={13}/>Add</button></div>{state!.customFields.map(f => <div className="nw-settings-row" key={f.id}><SlidersHorizontal size={15} color="#869582"/><div>{f.name}<small>{readable(f.type)} · {f.required ? "Required" : "Optional"}{f.options.length ? ` · ${f.options.join(", ")}` : ""}</small></div><button className="nw-icon-button" title="Edit custom field" onClick={() => setModal({ type: "field", data: f })}><Pencil size={13}/></button></div>)}{!state!.customFields.length && <Empty title="Make it your own" icon={SlidersHorizontal}><p>Add an asset ID, site, service tier or approval field.</p></Empty>}</section></div> : adminTab === "Automations" ? <section className="nw-panel"><div className="nw-panel-head"><div><h2>Workflow automations</h2><p>Match ticket creation or updates, then assign, move or alert</p></div><button className="nw-button" onClick={() => setModal({ type: "rule" })}><Plus size={15}/>New rule</button></div>{state!.rules.map(r => <div className="nw-settings-row" key={r.id}><Sparkles size={17} color="#ad8a59"/><div>{r.name}<small>When {r.trigger.replace(".", " is ")} · {r.priority === "any" ? "any priority" : `${r.priority} priority`}{r.assignToId ? ` · assign ${member(r.assignToId)?.name}` : ""}{r.moveToId ? ` · move to ${state!.columns.find(c => c.id === r.moveToId)?.name}` : ""}</small></div><span className={`nw-pill${r.enabled ? "" : " gray"}`}>{r.enabled ? "Enabled" : "Paused"}</span><button className="nw-icon-button" title="Edit rule" onClick={() => setModal({ type: "rule", data: r })}><Pencil size={13}/></button></div>)}{!state!.rules.length && <Empty title="Let routine work take care of itself" icon={Sparkles}><p>For example: assign critical tickets to the service lead and notify the response team.</p></Empty>}<div className="nw-panel-body nw-small">Rules run on saved ticket changes. They do not send external email, SMS or push notifications; alerts appear inside the workspace.</div></section> : <section className="nw-panel"><div className="nw-panel-head"><h2>Workspace settings</h2></div><form className="nw-panel-body" onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await mutate("settings.update", { name: String(f.get("name")), timeZone: String(f.get("timeZone")) }, "Workspace settings saved"); }}><div className="nw-form-grid"><Field label="Workspace name"><FormText name="name" value={state!.settings.name} required/></Field><Field label="Workspace time zone"><select className="nw-select" name="timeZone" defaultValue={state!.settings.timeZone}><option value="Africa/Cairo">Cairo</option><option value="Europe/Copenhagen">Copenhagen</option><option value="Europe/Stockholm">Stockholm</option><option value="UTC">UTC</option></select></Field></div><button className="nw-button" disabled={busy}>Save settings</button><div className="nw-info-box">Employee access uses individual sign-in accounts. There is no shared administrator password in the website code. Only the workspace owner can invite people, approve employee access and change roles in the Team tab.</div></form></section>}</>;
    const renderAudit = () => { const rows: AuditEntry[] = (audit?.audit || []).filter((r: AuditEntry) => `${r.actorName} ${r.action} ${r.objectId} ${r.timestamp}`.toLowerCase().includes(auditQuery.toLowerCase())); return <><div className="nw-audit-summary"><Shield size={20}/><div><b>{audit?.chainValid ? "Audit chain verified" : auditLoading ? "Verifying the audit chain…" : "Audit verification status"}</b><div>{audit ? `${audit.total ?? audit.audit?.length ?? 0} recorded events · ${audit.chainScope || "Current exported scope"}` : "Administrator-only evidence log"}. UTC timestamps, actor identity and before/after changes are recorded on the server.</div></div></div><div className="nw-toolbar"><div className="nw-search-input"><Search size={15}/><input className="nw-input" placeholder="Filter actor, action or ticket…" value={auditQuery} onChange={e => setAuditQuery(e.target.value)} aria-label="Filter audit log"/></div><button className="nw-button secondary" onClick={() => void loadAudit()} disabled={auditLoading}><Activity size={14}/>Refresh</button><a className="nw-button secondary nw-spacer" href="/api/workspace?view=audit&format=json" target="_blank" rel="noreferrer"><Download size={14}/>Export evidence</a></div><section className="nw-panel"><div className="nw-table-wrap"><table><thead><tr><th>UTC time</th><th>Actor</th><th>Action</th><th>Object</th><th>Evidence</th><th /></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td style={{ whiteSpace: "nowrap", fontSize: 11 }}>{r.timestamp.replace("T", " ").replace("Z", " UTC")}</td><td>{r.actorName}</td><td><span className="nw-pill gray">{r.action}</span></td><td className="nw-audit-detail">{r.objectId}</td><td className="nw-audit-detail" title={r.hash}>{r.hash?.slice(0, 20)}…</td><td><button className="nw-text-link" onClick={() => setModal({ type: "auditEntry", data: r })}>Inspect</button></td></tr>)}</tbody></table></div>{!rows.length && <Empty title={auditLoading ? "Reading events…" : "No matching events"} icon={Shield}><p>Saved changes and administrative actions will appear here.</p></Empty>}</section><div className="nw-info-box">This is a tamper-evident application audit trail. It is not an independent immutable evidence vault or a claim of forensic certification. Export and retain records under your organisation’s evidence procedures.</div></>; };
    const titles: Record<View, {
        title: string;
        description: string;
    }> = { overview: { title: `Good ${now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening"}, ${me!.name.split(" ")[0]}.`, description: "A clear view of the work that matters today." }, tickets: { title: "Your work, in motion.", description: "Plan, assign and move work forward together." }, calendar: { title: "Make time for good work.", description: "Meetings, maintenance windows and delivery dates in one place." }, notes: { title: "Keep the useful details.", description: "Ideas, handovers and decisions — ready when you need them." }, chat: { title: "Stay in the conversation.", description: "Team channels and direct messages, connected to your work." }, library: { title: "Knowledge library", description: "Trusted resources for a confident team." }, profile: { title: "People behind the work.", description: "Your photograph, professional title and team contact details." }, admin: { title: "Shape your workspace.", description: "People, permissions and workflows, managed in one place." }, audit: { title: "A clear record of every change.", description: "Administrator evidence log with server timestamps and actor attribution." } };
    const renderModal = () => {
        if (!modal)
            return null;
        if (["member", "approveMember", "grantAdmin", "invitationShare"].includes(modal.type) && !isOwner)
            return null;
        const m = modal.data || {};
        let title = "", body: ReactNode = null, footer: ReactNode = null, wide = false;
        const cancel = <button type="button" className="nw-button secondary" onClick={() => setModal(null)}>Cancel</button>;
        const save = (label = "Save") => <>{cancel}<button className="nw-button" type="submit" disabled={busy}>{busy ? <Loader2 size={14} className="nw-spinner"/> : null}{label}</button></>;
        const deleteButton = (action: WorkspaceAction) => m.id && <button type="button" className="nw-button danger small" style={{ marginRight: "auto" }} onClick={() => confirm(`Delete ${modal.type}?`, "This item will be removed. The change remains in the administrator audit trail.", action, { id: m.id })}><Trash2 size={13}/>Delete</button>;
        let onSubmit: ((e: FormEvent<HTMLFormElement>) => Promise<void>) | undefined;
        const submit = (fn: (f: FormData) => Promise<boolean>) => async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (await fn(new FormData(e.currentTarget)))
            setModal(null); };
        if (modal.type === "ticket") {
            title = m.id ? `Edit ${m.key}` : "Create a ticket";
            wide = true;
            body = <div className="nw-form-grid"><Field label="Ticket title" full><FormText name="title" value={m.title} required placeholder="What needs to be done?"/></Field><Field label="Description" full><textarea className="nw-textarea" name="description" defaultValue={m.description || ""} placeholder="Add context, acceptance criteria and useful details…" maxLength={6000}/></Field><Field label="Status"><select name="status" className="nw-select" defaultValue={m.status || state!.columns[0]?.id}>{state!.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><Field label="Priority"><select name="priority" className="nw-select" defaultValue={m.priority || "medium"}>{PRIORITIES.map(p => <option key={p} value={p}>{readable(p)}</option>)}</select></Field><Field label="Assignee"><PersonSelect users={users} selected={m.assigneeId}/></Field><Field label="Due date"><FormText name="dueDate" type="date" value={dateInput(m.dueDate)}/></Field><Field label="Customer or project"><FormText name="customer" value={m.customer} placeholder="Internal or customer name"/></Field><Field label="Location"><FormText name="location" value={m.location} placeholder="Cairo · remote · site name"/></Field><Field label="Tags (comma-separated)" full><FormText name="tags" value={m.tags?.join(", ")} placeholder="Microsoft 365, onboarding, security"/></Field>{state!.customFields.map(f => <Field key={f.id} label={`${f.name}${f.required ? " *" : ""}`}>{f.type === "select" ? <select className="nw-select" name={`custom:${f.id}`} defaultValue={String(m.customFields?.[f.id] ?? "")} required={f.required}><option value="">Select…</option>{f.options.map(o => <option key={o}>{o}</option>)}</select> : f.type === "checkbox" ? <label className="nw-checkbox-line"><input type="checkbox" name={`custom:${f.id}`} defaultChecked={!!m.customFields?.[f.id]}/>{f.name}</label> : <FormText name={`custom:${f.id}`} value={String(m.customFields?.[f.id] ?? "")} required={f.required} type={f.type}/>}</Field>)}</div>;
            onSubmit = submit(f => { const customFields: Record<string, string | number | boolean> = {}; state!.customFields.forEach(c => { const v = f.get(`custom:${c.id}`); if (c.type === "number" && (v === null || v === "")) {
                return;
            } customFields[c.id] = c.type === "checkbox" ? !!v : c.type === "number" ? Number(v) : String(v || ""); }); return mutate(m.id ? "ticket.update" : "ticket.create", { ...(m.id ? { id: m.id } : {}), title: String(f.get("title")), description: String(f.get("description")), status: String(f.get("status")), priority: String(f.get("priority")), assigneeId: String(f.get("assigneeId")) || null, dueDate: String(f.get("dueDate")) || null, customer: String(f.get("customer")), location: String(f.get("location")), tags: String(f.get("tags")).split(",").map(t => t.trim()).filter(Boolean), customFields }, m.id ? "Ticket updated" : "Ticket created"); });
            footer = save(m.id ? "Save changes" : "Create ticket");
        }
        else if (modal.type === "note") {
            title = m.id ? "Edit note" : "New note";
            wide = true;
            body = <><Field label="Title"><FormText name="title" value={m.title} required/></Field><Field label="Note"><textarea className="nw-textarea" name="body" style={{ minHeight: 230 }} defaultValue={m.body || ""} required maxLength={15000}/></Field><div className="nw-form-grid"><Field label="Visibility"><select className="nw-select" name="visibility" defaultValue={m.visibility || "team"}><option value="team">Team</option><option value="private">Only me</option></select></Field><Field label="Pin note"><label className="nw-inline-check"><input type="checkbox" name="pinned" defaultChecked={!!m.pinned}/>Keep near the top</label></Field></div></>;
            onSubmit = submit(f => mutate("note.save", { ...(m.id ? { id: m.id } : {}), title: String(f.get("title")), body: String(f.get("body")), visibility: String(f.get("visibility")), pinned: !!f.get("pinned"), color: m.color || "sand" }, "Note saved"));
            footer = <>{deleteButton("note.delete")}{save()}</>;
        }
        else if (modal.type === "readNote") {
            title = m.title;
            wide = true;
            body = <><div className="nw-flex-between"><span className="nw-person"><Avatar user={member(m.ownerId)} small/>{member(m.ownerId)?.name}</span><span className="nw-small">Updated {fullDate(m.updatedAt)}</span></div><p className="nw-description" style={{ marginTop: 22 }}>{m.body}</p><div className="nw-info-box">This shared note is owned by {member(m.ownerId)?.name || "another team member"}. Only its author can edit it.</div></>;
            footer = <><button className="nw-button secondary" onClick={() => void copy(`${m.title}\n\n${m.body}`, "Note copied")}>Copy note</button><button className="nw-button" onClick={() => setModal(null)}>Done</button></>;
        }
        else if (modal.type === "event") {
            title = m.id ? "Edit calendar event" : "Add calendar event";
            wide = true;
            body = <div className="nw-form-grid"><Field label="Event title" full><FormText name="title" value={m.title} required/></Field><Field label="Start (your local time)"><FormText name="start" value={localDateTime(m.start)} type="datetime-local" required/></Field><Field label="End (your local time)"><FormText name="end" value={localDateTime(m.end || new Date(Date.now() + 3600000).toISOString())} type="datetime-local" required/></Field><Field label="Location"><FormText name="location" value={m.location} placeholder="Online or address"/></Field><Field label="Type"><select className="nw-select" name="type" defaultValue={m.type || "meeting"}>{["meeting", "maintenance", "deadline", "other"].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Description" full><textarea name="description" className="nw-textarea" defaultValue={m.description || ""}/></Field><Field label="Attendees" full><div className="nw-form-grid">{users.filter(u => u.active).map(u => <label className="nw-checkbox-line" key={u.id}><input type="checkbox" name="attendeeIds" value={u.id} defaultChecked={m.attendeeIds?.includes(u.id)}/>{u.name}</label>)}</div></Field></div>;
            onSubmit = submit(f => mutate("event.save", { ...(m.id ? { id: m.id } : {}), title: String(f.get("title")), description: String(f.get("description")), start: new Date(String(f.get("start"))).toISOString(), end: new Date(String(f.get("end"))).toISOString(), location: String(f.get("location")), type: String(f.get("type")), attendeeIds: f.getAll("attendeeIds") }, "Calendar event saved"));
            footer = <>{deleteButton("event.delete")}{m.id && <button type="button" className="nw-button secondary" onClick={() => exportEvent(m)}><Download size={13}/>Calendar file</button>}{save()}</>;
        }
        else if (modal.type === "readEvent") {
            title = m.title;
            body = <><span className="nw-pill">{readable(m.type)}</span><div className="nw-details-grid"><div className="nw-detail"><span>Start</span>{fullDate(m.start)}</div><div className="nw-detail"><span>End</span>{fullDate(m.end)}</div><div className="nw-detail"><span>Location</span>{m.location || "Online"}</div><div className="nw-detail"><span>Owner</span>{member(m.ownerId)?.name}</div></div><p className="nw-description">{m.description}</p><h3 className="nw-section-title">Attendees</h3><div className="nw-button-row">{m.attendeeIds.map((id: string) => <span className="nw-person" key={id}><Avatar user={member(id)} small/>{member(id)?.name}</span>)}</div><div className="nw-info-box">Only the event owner or an administrator can change this event.</div></>;
            footer = <><button className="nw-button secondary" onClick={() => exportEvent(m)}><Download size={13}/>Calendar file</button><button className="nw-button" onClick={() => setModal(null)}>Done</button></>;
        }
        else if (modal.type === "member") {
            const target = m.id ? member(m.id) : null;
            title = m.id ? "Change member role" : "Create an employee invitation";
            if (m.id && (!target || target.sample || target.id === "owner" || accessForMember(target, now.getTime()) !== "approved")) {
                body = <div className="nw-info-box">Roles can only be changed for approved, active employees. The owner role and sample identities cannot be changed here.</div>;
                footer = <button className="nw-button secondary" onClick={() => setModal(null)}>Close</button>;
            }
            else if (target) {
                body = <><div className="nw-invitation-person"><Avatar user={target}/><div><strong>{target.name}</strong><span>{target.email}</span></div></div><Field label="Workspace role"><select className="nw-select" name="role" defaultValue={target.role}><option value="employee">Employee · team work and conversations</option><option value="manager">Manager · team work and team alerts</option><option value="admin">Administrator · workflow, profiles and evidence</option></select></Field><div className="nw-info-box">Only you, the workspace owner, can approve account access or change roles. An administrator can manage workspace features and inspect evidence, but cannot invite, approve, revoke or grant roles to other people.</div></>;
                onSubmit = async e => {
                    e.preventDefault();
                    const role = String(new FormData(e.currentTarget).get("role"));
                    if (role === "admin" && target.role !== "admin") { setModal({ type: "grantAdmin", data: { id: target.id } }); return; }
                    if (await mutate("member.update", { id: target.id, role }, "Workspace role updated")) setModal(null);
                };
                footer = save("Save role");
            }
            else {
                body = <><Field label="Person’s name"><FormText name="name" required/></Field><Field label="Sign-in email"><FormText name="email" type="email" required aria-label="Sign-in email"/><small>This email must match the person’s own sign-in account.</small></Field><Field label="Job title (optional)"><FormText name="jobTitle"/></Field><div className="nw-invitation-role"><Users size={17}/><div><strong>Employee invitation</strong><span>No workspace access until the person accepts and you approve.</span></div></div><div className="nw-info-box">The invitation is valid for seven days. Acceptance and your approval must both happen before it expires. Email delivery is not configured; copy the invitation message after creating it.</div></>;
                onSubmit = async e => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const email = String(form.get("email")).trim().toLowerCase();
                    if (await mutate("member.invite", { name: String(form.get("name")), email, jobTitle: String(form.get("jobTitle") || "") }, "Invitation created. Acceptance and owner approval are still required.")) {
                        const invited = dataRef.current?.state.users.find(user => user.email.toLowerCase() === email && !user.sample);
                        setModal(invited ? { type: "invitationShare", data: { id: invited.id } } : null);
                    }
                };
                footer = save("Create invitation");
            }
        }
        else if (modal.type === "approveMember") {
            const target = member(m.id);
            const canApprove = !!target && !target.sample && accessForMember(target, now.getTime()) === "pending_approval";
            title = "Approve employee access";
            body = target ? <><div className="nw-invitation-person"><Avatar user={target}/><div><strong>{target.name}</strong><span>{target.email}</span></div></div>{memberTimestamps(target)}<div className="nw-info-box">{canApprove ? "This person accepted the invitation with the matching sign-in identity. Approving now allows them to open the employee workspace with the employee role. Any administrator role must be granted separately afterward." : "This invitation is no longer awaiting approval. Refresh the team list and create a new invitation if it has expired or been revoked."}</div></> : <p>This invitation is no longer available.</p>;
            footer = <>{cancel}<button className="nw-button" disabled={busy || !canApprove} onClick={async () => { if (target && await mutate("member.approve", { id: target.id }, "Employee access approved")) setModal(null); }}><CheckCircle2 size={15}/>Approve employee access</button></>;
        }
        else if (modal.type === "grantAdmin") {
            const target = member(m.id);
            const canGrant = !!target && !target.sample && target.id !== "owner" && accessForMember(target, now.getTime()) === "approved";
            title = "Grant administrator privileges?";
            body = <><div className="nw-admin-grant-warning"><Shield size={25}/><div><strong>{target?.name || "This person"} will become a workspace administrator.</strong><p>They can change workflows and settings, manage team profile details, and read or export the administrator evidence log.</p></div></div><p className="nw-modal-explanation">You remain the only person who can create invitations, approve or revoke employee access, and grant or change roles. This grant is recorded in the audit log.</p>{!canGrant && <div className="nw-alert error">This account is not eligible for a role change. Close this dialog and review its current access.</div>}</>;
            footer = <>{cancel}<button className="nw-button" disabled={busy || !canGrant} onClick={async () => { if (target && await mutate("member.update", { id: target.id, role: "admin" }, "Administrator role granted by the owner")) setModal(null); }}><Shield size={15}/>Grant administrator role</button></>;
        }
        else if (modal.type === "invitationShare") {
            const target = member(m.id);
            const url = new URL("/workspace", window.location.origin).href;
            const canShare = !!target && !target.sample && target.id !== "owner" && accessForMember(target, now.getTime()) === "invited";
            const message = target ? `Hello ${target.name},\n\nThe NorthWallEg workspace owner has invited you to join the employee workspace.\n\nOpen ${url} and sign in with ${target.email}. Accept your invitation, then wait for the owner to approve access. Signing in or accepting alone does not open the workspace.\n\n${target.onboarding?.expiresAt ? `Acceptance and approval must be completed by ${invitationTime(target.onboarding.expiresAt)}.\n\n` : ""}If the private review Site is unavailable, ask the owner to share Site access with you separately.` : "";
            title = "Share the employee invitation";
            body = canShare ? <><div className="nw-invitation-person"><Avatar user={target}/><div><strong>{target!.name}</strong><span>{target!.email}</span></div></div><div className="nw-info-box">The invitation is saved. No email has been sent. Copy this message and share it through your chosen channel. The link contains no password or bearer token; acceptance is bound to the invited email.</div><Field label="Invitation message"><textarea className="nw-textarea nw-invitation-message" readOnly value={message} onFocus={e => e.target.select()}/></Field><button className="nw-text-link" onClick={() => void copy(url, "Workspace invitation link copied")}><Share2 size={13}/>Copy workspace link only</button></> : <div className="nw-info-box">This invitation is no longer waiting for acceptance. Review its current status in the Team tab before sharing a new invitation.</div>;
            footer = <><button className="nw-button secondary" onClick={() => setModal(null)}>Done</button>{canShare && <button className="nw-button" onClick={() => void copy(message, "Invitation message copied — no message has been sent")}><Share2 size={15}/>Copy invitation message</button>}</>;
        }
        else if (modal.type === "column") {
            title = m.id ? "Edit workflow column" : "Add workflow column";
            body = <><Field label="Column name"><FormText name="name" value={m.name} required placeholder="Awaiting customer"/></Field><Field label="Colour"><input className="nw-input" type="color" name="color" defaultValue={m.color || "#658879"} style={{ height: 45, width: 100 }}/></Field><label className="nw-checkbox-line"><input type="checkbox" name="isDone" defaultChecked={!!m.isDone}/>Tickets in this column count as completed</label></>;
            onSubmit = submit(f => mutate("column.save", { ...(m.id ? { id: m.id } : {}), name: String(f.get("name")), color: String(f.get("color")), isDone: !!f.get("isDone") }, "Workflow column saved"));
            footer = <>{deleteButton("column.delete")}{save()}</>;
        }
        else if (modal.type === "field") {
            title = m.id ? "Edit custom field" : "Add custom field";
            body = <><Field label="Field name"><FormText name="name" value={m.name} required placeholder="Asset ID"/></Field><Field label="Field type"><select className="nw-select" name="type" defaultValue={m.type || "text"}>{["text", "number", "date", "select", "checkbox"].map(t => <option key={t}>{t}</option>)}</select></Field><Field label="Dropdown options (one per line)"><textarea className="nw-textarea" name="options" defaultValue={m.options?.join("\n") || ""} placeholder={"Standard\nPriority\nCritical"}/><small>Used for select fields only.</small></Field><label className="nw-checkbox-line"><input type="checkbox" name="required" defaultChecked={!!m.required}/>Required for tickets</label></>;
            onSubmit = submit(f => mutate("field.save", { ...(m.id ? { id: m.id } : {}), name: String(f.get("name")), type: String(f.get("type")), options: String(f.get("options")).split("\n").map(x => x.trim()).filter(Boolean), required: !!f.get("required") }, "Custom field saved"));
            footer = <>{deleteButton("field.delete")}{save()}</>;
        }
        else if (modal.type === "rule") {
            title = m.id ? "Edit automation" : "Create automation";
            body = <><Field label="Rule name"><FormText name="name" value={m.name} required placeholder="Route critical tickets to the service lead"/></Field><div className="nw-form-grid"><Field label="When"><select className="nw-select" name="trigger" defaultValue={m.trigger || "ticket.created"}><option value="ticket.created">A ticket is created</option><option value="ticket.updated">A ticket is updated</option></select></Field><Field label="Priority matches"><select className="nw-select" name="priority" defaultValue={m.priority || "any"}><option value="any">Any priority</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></Field><Field label="Assign to"><PersonSelect users={users} name="assignToId" selected={m.assignToId}/></Field><Field label="Move to"><select className="nw-select" name="moveToId" defaultValue={m.moveToId || ""}><option value="">Keep current column</option>{state!.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field></div><Field label="Notify team members"><div className="nw-form-grid">{users.filter(u => u.active).map(u => <label className="nw-checkbox-line" key={u.id}><input type="checkbox" name="notifyUserIds" value={u.id} defaultChecked={m.notifyUserIds?.includes(u.id)}/>{u.name}</label>)}</div></Field><label className="nw-checkbox-line"><input type="checkbox" name="enabled" defaultChecked={m.enabled !== false}/>Enable this rule</label></>;
            onSubmit = submit(f => mutate("rule.save", { ...(m.id ? { id: m.id } : {}), name: String(f.get("name")), trigger: String(f.get("trigger")), priority: String(f.get("priority")), assignToId: String(f.get("assignToId")) || null, moveToId: String(f.get("moveToId")) || null, notifyUserIds: f.getAll("notifyUserIds"), enabled: !!f.get("enabled") }, "Automation saved"));
            footer = <>{deleteButton("rule.delete")}{save()}</>;
        }
        else if (modal.type === "alert") {
            title = "Send a team alert";
            body = <><Field label="Title"><FormText name="title" required placeholder="Maintenance window tonight"/></Field><Field label="Message"><textarea className="nw-textarea" name="body" required maxLength={1500}/></Field><Field label="Importance"><select className="nw-select" name="kind"><option value="info">Information</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select></Field><Field label="Recipients"><div className="nw-form-grid">{users.filter(u => u.active).map(u => <label className="nw-checkbox-line" key={u.id}><input type="checkbox" name="userIds" value={u.id} defaultChecked/>{u.name}</label>)}</div></Field><div className="nw-info-box">Creates an internal workspace notification. It does not send email or phone notifications.</div></>;
            onSubmit = submit(f => mutate("notification.send", { title: String(f.get("title")), body: String(f.get("body")), kind: String(f.get("kind")), userIds: f.getAll("userIds") }, "Team alert sent"));
            footer = save("Send alert");
        }
        else if (modal.type === "channel") {
            title = "New team channel";
            body = <><Field label="Channel name"><FormText name="name" required placeholder="project-delivery"/></Field><Field label="Description"><FormText name="description" placeholder="A place for project updates and handovers"/></Field></>;
            onSubmit = submit(f => mutate("channel.create", { name: String(f.get("name")), description: String(f.get("description")) }, "Channel created"));
            footer = save("Create channel");
        }
        else if (modal.type === "reaction") {
            title = "Add a reaction";
            body = <div className="nw-emoji-picker" style={{ justifyContent: "center" }}>{EMOJIS.map(e => <button key={e} type="button" style={{ fontSize: 29, padding: 12 }} onClick={async () => { if (await mutate(`${m.kind}.react` as WorkspaceAction, { id: m.item.id, emoji: e }, ""))
                setModal(null); }}>{e}</button>)}</div>;
            footer = <button className="nw-button secondary" onClick={() => setModal(null)}>Close</button>;
        }
        else if (modal.type === "forward") {
            title = m.kind === "comment" ? "Forward to another ticket" : "Forward a message";
            body = <><div className="nw-quote"><strong>From {member(m.item.authorId)?.name}</strong>{m.item.body}</div>{m.kind === "comment" ? <Field label="Destination ticket"><select className="nw-select" name="ticketId" required>{activeTickets.filter(t => t.id !== m.item.ticketId).map(t => <option value={t.id} key={t.id}>{t.key} · {t.title}</option>)}</select></Field> : <><Field label="Destination channel"><select className="nw-select" name="channelId">{state!.channels.map(c => <option value={c.id} key={c.id}># {c.name}</option>)}</select></Field><Field label="Or direct message to"><PersonSelect users={users} name="recipientId"/></Field></>}</>;
            onSubmit = submit(f => mutate(`${m.kind}.forward` as WorkspaceAction, { id: m.item.id, ...(m.kind === "comment" ? { ticketId: String(f.get("ticketId")) } : { channelId: String(f.get("channelId")), recipientId: String(f.get("recipientId")) || null }) }, "Forwarded"));
            footer = save("Forward");
        }
        else if (modal.type === "editText") {
            title = `Edit ${m.kind}`;
            body = <Field label="Message"><textarea className="nw-textarea" style={{ minHeight: 150 }} name="body" defaultValue={m.item.body} required maxLength={6000}/></Field>;
            onSubmit = submit(f => mutate(`${m.kind}.update` as WorkspaceAction, { id: m.item.id, body: String(f.get("body")) }, "Message updated"));
            footer = save();
        }
        else if (modal.type === "messageReply") {
            title = `Reply to ${member(m.authorId)?.name || "teammate"}`;
            body = <><div className="nw-quote"><strong>{member(m.authorId)?.name}</strong>{m.body}</div><Composer users={users} busy={busy} placeholder="Write your reply…" onSend={async (body, mentions) => { const ok = await mutate("message.send", { channelId: m.channelId, recipientId: m.recipientId ? (m.authorId === me!.id ? m.recipientId : m.authorId) : null, body, mentions, replyToId: m.id }, "Reply sent"); if (ok)
                setModal(null); return ok; }}/></>;
            footer = <button className="nw-button secondary" onClick={() => setModal(null)}>Close</button>;
        }
        else if (modal.type === "news") {
            title = "Technology & cybersecurity news";
            wide = true;
            body = <><div className="nw-flex-between"><span className="nw-pill gray">English publisher feeds</span><span className="nw-small">{news?.fetchedAt ? `Retrieved ${fullDate(news.fetchedAt)}` : news?.status === "unavailable" ? "No successful retrieval" : "Checking feeds"}{news?.checkedAt && <><br/>Last check {fullDate(news.checkedAt)}</>}</span></div>{news?.status === "cached" && <div className="nw-info-box">Cached publisher headlines{news.fetchedAt ? ` · retrieved ${fullDate(news.fetchedAt)}` : " · retrieval time unavailable"}. The live refresh is currently unavailable; these are previously retrieved publisher stories.</div>}{news?.status === "partial" && <div className="nw-info-box">Some publisher feeds are temporarily unavailable. Available stories are shown below.</div>}<NewsExplorer items={news?.items || []}/></>;
            footer = <button className="nw-button" onClick={() => setModal(null)}>Done</button>;
        }
        else if (modal.type === "runbook") {
            title = m.title;
            wide = true;
            body = <><div className="nw-flex-between"><span className="nw-pill blue">{m.product}</span><span className="nw-small">Approx. {m.estimatedMinutes} minutes</span></div><p className="nw-description" style={{ marginTop: 16 }}>{m.summary}</p>{m.steps.map((s: any, i: number) => <div className="nw-runbook-step" key={i}><span>{i + 1}</span><p>{typeof s === "string" ? s : <><b>{s.title}</b> {s.text || s.description || JSON.stringify(s)}</>}</p></div>)}<h3 className="nw-section-title">Evidence to record</h3><ul style={{ fontSize: 13, lineHeight: 1.9, paddingLeft: 18, color: "#6c8068" }}>{m.evidence.map((s: string) => <li key={s}>{s}</li>)}</ul><div className="nw-info-box"><b>Escalate when:</b> {Array.isArray(m.escalateWhen) ? m.escalateWhen.join(" ") : m.escalateWhen}</div><h3 className="nw-section-title">Official reference material</h3>{m.sourceUrls.map((url: string, i: number) => <a className="nw-resource-source" key={url} href={url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Reference {i + 1} · {new URL(url).hostname}</a>)}</>;
            footer = <><button className="nw-button secondary" onClick={() => void copy(`${m.title}\n\n${m.summary}\n\n${m.steps.map((s: any, i: number) => `${i + 1}. ${typeof s === "string" ? s : s.text || s.description}`).join("\n")}`, "Runbook copied")}>Copy checklist</button><button className="nw-button" onClick={() => setModal(null)}>Done</button></>;
        }
        else if (modal.type === "auditEntry") {
            title = "Inspect evidence event";
            wide = true;
            body = <><div className="nw-details-grid"><div className="nw-detail"><span>Actor</span>{m.actorName}</div><div className="nw-detail"><span>Action</span>{m.action}</div><div className="nw-detail"><span>UTC time</span>{m.timestamp}</div><div className="nw-detail"><span>Sequence</span>{m.sequence}</div></div><Field label="Recorded change"><pre style={{ fontSize: 11, background: "#f5f8f4", padding: 18, borderRadius: 6, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 350, overflow: "auto" }}>{JSON.stringify(m.changes, null, 2)}</pre></Field><Field label="Evidence metadata"><pre style={{ fontSize: 10, whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#7b8d76" }}>{`Request: ${m.requestId}\nObject: ${m.objectId}\nPrevious hash: ${m.previousHash}\nEvent hash: ${m.hash}`}</pre></Field></>;
            footer = <button className="nw-button secondary" onClick={() => setModal(null)}>Close</button>;
        }
        else if (modal.type === "confirm") {
            title = m.title;
            body = <p style={{ fontSize: 14, lineHeight: 1.8, color: "#788c75" }}>{m.description}</p>;
            footer = <>{cancel}<button className="nw-button danger" disabled={busy} onClick={async () => { if (await mutate(m.action, m.payload, m.success || "Change saved")) {
                if (m.action === "member.reinvite") setModal({ type: "invitationShare", data: { id: m.payload.id } });
                else setModal(null);
            } }}>{m.label || "Confirm"}</button></>;
        }
        else if (modal.type === "copy") {
            title = "Copy this text";
            body = <textarea className="nw-textarea" readOnly value={m.text} style={{ minHeight: 180 }} onFocus={e => e.target.select()}/>;
            footer = <button className="nw-button" onClick={() => setModal(null)}>Done</button>;
        }
        const inner = <><div className="nw-modal-head"><h2>{title}</h2><button type="button" className="nw-icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><X size={19}/></button></div><div className="nw-modal-body">{error && <div className="nw-alert error">{error}</div>}{body}</div><div className="nw-modal-footer">{footer}</div></>;
        return <div className="nw-modal-backdrop" onClick={e => { if (e.target === e.currentTarget)
            setModal(null); }}>{onSubmit ? <form className={`nw-modal${wide ? " wide" : ""}`} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label={title}>{inner}</form> : <div className={`nw-modal${wide ? " wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>{inner}</div>}</div>;
    };
    return <div className={`nw-workspace${collapsed ? " nw-collapsed" : ""}`}><aside className="nw-sidebar"><a className="nw-brand" href="/"><span className="nw-mark"><NWMark /></span><span className="nw-brand-text">NorthWallEg<small>Team workspace</small></span></a><div className="nw-nav-label">Workspace</div><nav className="nw-nav">{NAV.map(n => <button key={n.id} title={n.label} className={view === n.id ? "active" : ""} onClick={() => go(n.id)}><n.icon size={18}/>{<span className="nw-nav-text">{n.label}</span>}{n.id === "tickets" && <span className="nw-count">{open.length}</span>}</button>)}</nav>{isAdmin && <><div className="nw-nav-label">Administration</div><nav className="nw-nav"><button title="Admin settings" className={view === "admin" ? "active" : ""} onClick={() => go("admin")}><Settings2 size={18}/>{<span className="nw-nav-text">Admin settings</span>}</button><button title="Evidence log" className={view === "audit" ? "active" : ""} onClick={() => go("audit")}><Shield size={18}/>{<span className="nw-nav-text">Evidence log</span>}</button></nav></>}<div className="nw-sidebar-bottom"><nav className="nw-nav"><button title="Open company website" onClick={() => window.location.assign("/")}><ExternalLink size={17}/>{<span className="nw-nav-text">Company website</span>}</button><button title="Sign out" onClick={() => window.location.assign("/signout-with-chatgpt?return_to=%2F")}><LogOut size={17}/>{<span className="nw-nav-text">Sign out</span>}</button></nav><div className="nw-sidebar-foot"><Avatar user={me}/>{<div className="nw-sidebar-person"><strong>{me!.name}</strong><small>{me!.jobTitle || me!.role}</small></div>}</div></div></aside><main className="nw-main"><header className="nw-topbar"><button className="nw-icon-button" aria-label="Toggle sidebar" onClick={() => setCollapsed(!collapsed)}><Menu size={19}/></button><div className="nw-top-search"><Search size={16}/><input ref={searchRef} aria-label="Search current view" value={query} onChange={e => { setQuery(e.target.value); if (["overview", "admin", "audit", "profile"].includes(view))
        setView("tickets"); }} placeholder={view === "library" ? "Search knowledge" : view === "notes" ? "Search notes" : view === "chat" ? "Search conversation" : view === "calendar" ? "Search events" : "Search tickets"}/><kbd>⌘ K</kbd></div><div className="nw-top-right"><div className="nw-clock"><strong>{now.toLocaleDateString("en-GB", { timeZone: state!.settings.timeZone, weekday: "short", day: "numeric", month: "short" })}</strong><br />{now.toLocaleTimeString("en-GB", { timeZone: state!.settings.timeZone, hour: "2-digit", minute: "2-digit" })} {state!.settings.timeZone.split("/").pop()?.replaceAll("_", " ")} · {now.toLocaleTimeString("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", minute: "2-digit" })} CPH</div><span className="nw-separator"/><button className="nw-icon-button" aria-label={`Notifications, ${unread} unread`} onClick={() => setShowNotifications(!showNotifications)}><Bell size={19}/>{unread > 0 && <span className="nw-badge-dot"/>}</button><button className="nw-button" disabled={!state!.columns.length} onClick={() => setModal({ type: "ticket" })}><Plus size={16}/>Create ticket</button><button className="nw-profile-trigger" aria-label="Open my profile" onClick={() => go("profile")}><Avatar user={me}/></button></div>{showNotifications && <div className="nw-notification-popover"><div className="nw-panel-head"><h3>Notifications <span className="nw-small">{unread} unread</span></h3><button className="nw-text-link" onClick={() => void mutate("notification.readAll", {}, "Notifications marked as read")}>Read all</button></div><div className="nw-notification-list">{notifications.length ? notifications.slice().reverse().map(n => <button className={`nw-notification${!n.read ? " unread" : ""}`} key={n.id} onClick={() => { void mutate("notification.read", { id: n.id }, ""); if (n.objectId && state!.tickets.some(t => t.id === n.objectId)) {
        showTicket(n.objectId);
        setShowNotifications(false);
    } }}><Bell size={16} style={{ marginTop: 3, color: n.kind === "urgent" ? "#bb593d" : "#82947e" }}/><div><strong>{n.title}</strong><p style={{ fontSize: 12, color: "#798b72", margin: "3px 0" }}>{n.body}</p><small>{fullDate(n.createdAt)}</small></div></button>) : <Empty title="Nothing new yet" icon={Bell}/>}</div>{(isAdmin || me!.role === "manager") && <div className="nw-panel-body"><button className="nw-button secondary small" onClick={() => { setModal({ type: "alert" }); setShowNotifications(false); }}><Send size={12}/>Send a team alert</button></div>}</div>}</header><div className={`nw-news-strip${newsPaused ? " paused" : ""}`}><button className="nw-news-label" onClick={() => setModal({ type: "news" })}><Activity size={13}/>{news?.status === "cached" ? "News · cached" : "IT & cyber news"}</button><div className="nw-news-viewport">{news?.items?.length ? <div className="nw-news-track">{[0, 1].map(loop => <div className="nw-news-track-group" key={loop} aria-hidden={loop === 1}>{tickerHeadlines(news.items).map(item => <a key={item.id} href={item.url} target="_blank" rel="noreferrer" tabIndex={loop === 1 ? -1 : 0}><b>{item.source}</b><span>{item.title}</span><time>{shortDate(item.publishedAt)}</time></a>)}</div>)}</div> : <span className="nw-news-unavailable">{news ? "Publisher feeds are temporarily unavailable" : "Checking English publisher feeds…"}</span>}</div>{news?.status === "cached" && <span className="nw-news-cache-status" title={`Cached publisher headlines${news.fetchedAt ? ` · retrieved ${fullDate(news.fetchedAt)}` : " · retrieval time unavailable"} · refresh unavailable`}>{news.fetchedAt ? `Retrieved ${shortDate(news.fetchedAt)}` : "Retrieval time unavailable"} · refresh unavailable</span>}<button className="nw-news-control" onClick={() => setNewsPaused(!newsPaused)} aria-label={newsPaused ? "Resume news ticker" : "Pause news ticker"}>{newsPaused ? "Resume" : "Pause"}</button><button className="nw-news-control" onClick={() => setModal({ type: "news" })}>All news</button></div><div className="nw-content"><div className="nw-breadcrumb"><span>{state!.settings.name}</span><ChevronRight size={11}/><span>{NAV.find(n => n.id === view)?.label || readable(view)}</span></div><div className="nw-page-head"><div><h1>{titles[view].title}</h1><p>{titles[view].description}</p></div><span className="nw-demo-label">Review demo · {state!.settings.demo ? "sample data" : "team workspace"}</span></div>{error && !modal && <div className="nw-alert error"><Flag size={16}/><span style={{ flex: 1 }}>{error}</span><button className="nw-icon-button" aria-label="Dismiss error" onClick={() => setError("")}><X size={14}/></button></div>}{!data.needsSetup && view === "overview" && (!me!.photoUrl || !me!.jobTitle) && <div className="nw-profile-nudge"><Users size={20}/><div><strong>Put a face to your work</strong><p>Add your photograph and job title to complete your team profile.</p></div><button className="nw-button secondary small" onClick={() => go("profile")}>Complete my profile</button></div>}{data.needsSetup ? <section className="nw-panel"><Empty title="Your workspace is ready to take shape" icon={Sparkles}><p>Start with a clean workspace for your team, or explore the features with clearly labelled sample records.</p><div className="nw-flex" style={{justifyContent:"center",flexWrap:"wrap",gap:12}}><button className="nw-button" disabled={busy} onClick={() => void mutate("workspace.initialize", {}, "Your workspace is ready")}><Plus size={15}/>Start empty workspace</button><button className="nw-button secondary" disabled={busy} onClick={() => void mutate("demo.initialize", {}, "Sample workspace ready")}><Sparkles size={15}/>Load sample workspace</button></div></Empty></section> : view === "overview" ? renderOverview() : view === "tickets" ? renderTickets() : view === "calendar" ? renderCalendar() : view === "notes" ? renderNotes() : view === "chat" ? renderChat() : view === "library" ? renderLibrary() : view === "profile" ? <EmployeeProfile key={profileTarget!.id} user={profileTarget!} viewer={me!} users={profileUsers} revision={data.revision} onSaved={accept} onEditMember={id => { if (profileUsers.some(u => u.id === id)) { setProfileMemberId(id); setView("profile"); } }}/> : view === "admin" && isAdmin ? renderAdmin() : view === "audit" && isAdmin ? renderAudit() : null}</div></main>{ticket && <div className="nw-drawer-backdrop" onClick={e => { if (e.target === e.currentTarget)
        setSelectedTicket(null); }}><aside className="nw-drawer" role="dialog" aria-modal="true" aria-label={ticket.title}><div className="nw-drawer-head"><ClipboardList size={16} color="#899b85"/><small>{ticket.key}</small>{ticket.sample && <span className="nw-pill gray">Sample</span>}<button className="nw-icon-button" title="Copy ticket link" onClick={() => void copy(`${window.location.origin}/workspace?ticket=${encodeURIComponent(ticket.id)}`, "Ticket link copied")}><Share2 size={16}/></button><button className="nw-icon-button" title="Edit ticket" onClick={() => setModal({ type: "ticket", data: ticket })}><Pencil size={16}/></button><button className="nw-icon-button" title={ticket.archived ? "Restore ticket" : "Archive ticket"} onClick={async () => { if (await mutate("ticket.archive", { id: ticket.id, archived: !ticket.archived }, ticket.archived ? "Ticket restored" : "Ticket archived"))
        setSelectedTicket(null); }}><Archive size={16}/></button><button className="nw-icon-button" aria-label="Close ticket" onClick={() => setSelectedTicket(null)}><X size={20}/></button></div><div className="nw-drawer-body"><h2 className="nw-drawer-title">{ticket.title}</h2><div className="nw-button-row"><select className="nw-select" aria-label="Ticket status" value={ticket.status} disabled={busy} onChange={e => void mutate("ticket.update", { id: ticket.id, status: e.target.value }, "Status updated")}>{state!.columns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><PriorityBadge priority={ticket.priority}/>{ticket.archived && <span className="nw-pill gray">Archived</span>}</div><div className="nw-details-grid"><div className="nw-detail"><span>Assignee</span><span className="nw-person"><Avatar user={member(ticket.assigneeId)} small/>{member(ticket.assigneeId)?.name || "Unassigned"}</span></div><div className="nw-detail"><span>Due date</span>{shortDate(ticket.dueDate)}</div><div className="nw-detail"><span>Customer</span>{ticket.customer || "Internal"}</div><div className="nw-detail"><span>Location</span>{ticket.location || "—"}</div><div className="nw-detail"><span>Created</span>{fullDate(ticket.createdAt)}</div><div className="nw-detail"><span>Reporter</span>{member(ticket.reporterId)?.name || "Team"}</div><div className="nw-detail"><span>Updated</span>{fullDate(ticket.updatedAt)}</div></div><p className="nw-description">{ticket.description || "No description added yet."}</p><div className="nw-ticket-tags">{ticket.tags.map(t => <span key={t}>{t}</span>)}</div>{state!.customFields.length > 0 && <div style={{ marginTop: 18 }}>{state!.customFields.map(f => <div className="nw-custom-value" key={f.id}><b>{f.name}:</b> {String(ticket.customFields[f.id] ?? "—")}</div>)}</div>}<h3 className="nw-section-title"><CheckCheck size={16}/>Checklist <span className="nw-small">{ticket.checklist.filter(c => c.done).length}/{ticket.checklist.length}</span></h3>{ticket.checklist.map(c => <label className={`nw-checklist-item${c.done ? " done" : ""}`} key={c.id}><input type="checkbox" checked={c.done} disabled={busy} onChange={() => void mutate("ticket.update", { id: ticket.id, checklist: ticket.checklist.map(x => x.id === c.id ? { ...x, done: !x.done } : x) }, "Checklist updated")}/><span>{c.text}</span><button className="nw-icon-button" style={{ marginLeft: "auto", width: 24, height: 24 }} title="Remove checklist item" onClick={() => void mutate("ticket.update", { id: ticket.id, checklist: ticket.checklist.filter(x => x.id !== c.id) }, "Checklist item removed")}><X size={12}/></button></label>)}<form className="nw-inline-form" onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const fd = new FormData(f); const text = String(fd.get("text") || "").trim(); if (text && await mutate("ticket.update", { id: ticket.id, checklist: [...ticket.checklist, { id: crypto.randomUUID(), text, done: false }] }, "Checklist item added"))
        f.reset(); }}><input className="nw-input" name="text" placeholder="Add a checklist item…" maxLength={400} required/><button className="nw-button secondary small" disabled={busy}><Plus size={14}/>Add</button></form><h3 className="nw-section-title"><MessageCircle size={16}/>Conversation <span className="nw-small">{state!.comments.filter(c => c.ticketId === ticket.id && !c.deleted).length}</span></h3>{state!.comments.filter(c => c.ticketId === ticket.id && !c.deleted).map(c => { const original = state!.comments.find(x => x.id === c.replyToId); return <article className="nw-comment" key={c.id}><Avatar user={member(c.authorId)} small/><div className="nw-comment-content"><div className="nw-comment-header"><b>{member(c.authorId)?.name || "Team member"}</b><time>{fullDate(c.createdAt)}</time></div>{c.forwardedFromId && <span className="nw-message-edited">Forwarded</span>}{original && <div className="nw-quote"><strong>{member(original.authorId)?.name}</strong>{original.body.slice(0, 150)}</div>}<div className="nw-comment-text">{messageBody(c.body)}</div>{c.updatedAt !== c.createdAt && <span className="nw-message-edited">Edited</span>}<div className="nw-comment-actions"><ReactionButtons item={c} kind="comment"/><button onClick={() => setModal({ type: "commentReply", data: c })}>Reply</button><button onClick={() => setModal({ type: "reaction", data: { item: c, kind: "comment" } })}>React</button><button onClick={() => setModal({ type: "forward", data: { item: c, kind: "comment" } })}>Forward</button><button onClick={() => void copy(c.body, "Comment copied")}>Copy</button>{c.authorId === me!.id && <button onClick={() => setModal({ type: "editText", data: { item: c, kind: "comment" } })}>Edit</button>}{(c.authorId === me!.id || isAdmin) && <button onClick={() => confirm("Delete comment?", "The comment will be removed. The action remains in the audit trail.", "comment.delete", { id: c.id })}>Delete</button>}</div></div></article>; })}<Composer users={users} busy={busy} placeholder="Add a comment, or @mention someone…" onSend={async (body, mentions) => mutate("comment.add", { ticketId: ticket.id, body, mentions }, "Comment added")}/></div></aside></div>}{modal?.type === "commentReply" ? <div className="nw-modal-backdrop"><div className="nw-modal"><div className="nw-modal-head"><h2>Reply to {member(modal.data.authorId)?.name}</h2><button className="nw-icon-button" aria-label="Close reply" onClick={() => setModal(null)}><X size={18}/></button></div><div className="nw-modal-body"><div className="nw-quote"><strong>{member(modal.data.authorId)?.name}</strong>{modal.data.body}</div>{error && <div className="nw-alert error">{error}</div>}<Composer users={users} busy={busy} placeholder="Write a reply…" onSend={async (body, mentions) => { const ok = await mutate("comment.add", { ticketId: modal.data.ticketId, replyToId: modal.data.id, body, mentions }, "Reply added"); if (ok)
        setModal(null); return ok; }}/></div></div></div> : renderModal()}{toast && <div className="nw-toast" role="status"><CheckCircle2 size={16}/>{toast}</div>}</div>;
}
function Composer({ users, busy, placeholder, onSend }: {
    users: Member[];
    busy: boolean;
    placeholder: string;
    onSend: (body: string, mentions: string[]) => Promise<boolean>;
}) {
    const [body, setBody] = useState("");
    const [emoji, setEmoji] = useState(false);
    const [mention, setMention] = useState(false);
    const [mentioned, setMentioned] = useState<string[]>([]);
    const textarea = useRef<HTMLTextAreaElement>(null);
    const send = async () => { if (!body.trim() || busy)
        return; const matched = users.filter(u => body.includes(`@${u.name}`)).map(u => u.id); if (await onSend(body.trim(), Array.from(new Set(matched)))) {
        setBody("");
        setMentioned([]);
        setEmoji(false);
        setMention(false);
    } };
    return <div className="nw-compose"><textarea ref={textarea} placeholder={placeholder} aria-label={placeholder} value={body} maxLength={6000} onChange={e => { setBody(e.target.value); setMention(e.target.value.endsWith("@")); }} onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void send();
    } }}/>{mention && <div className="nw-mention-list">{users.filter(u => u.active).map(u => <button type="button" key={u.id} onClick={() => { setBody(body.endsWith("@") ? body.slice(0, -1) + `@${u.name} ` : body + ` @${u.name} `); setMentioned([...mentioned, u.id]); setMention(false); textarea.current?.focus(); }}>@{u.name}</button>)}</div>}{emoji && <div className="nw-emoji-picker">{EMOJIS.map(e => <button type="button" key={e} onClick={() => { setBody(body + e); setEmoji(false); textarea.current?.focus(); }}>{e}</button>)}</div>}<div className="nw-compose-bar"><div className="nw-button-row" style={{ gap: 1 }}><button type="button" className="nw-icon-button" title="Add emoji" onClick={() => setEmoji(!emoji)}><Smile size={17}/></button><button type="button" className="nw-icon-button" title="Mention teammate" onClick={() => setMention(!mention)}><span style={{ fontSize: 18 }}>@</span></button><span className="nw-small nw-hidden-mobile" style={{ fontSize: 10, marginLeft: 6 }}>⌘ / Ctrl + Enter to send</span></div><button type="button" className="nw-button small" disabled={busy || !body.trim()} onClick={() => void send()}><Send size={12}/>Send</button></div></div>;
}
