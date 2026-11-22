"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CheckCircle2, ImagePlus, Loader2, RefreshCw, Save, ShieldCheck, Trash2, Users } from "lucide-react";
import type { Member, WorkspaceResponse } from "@/lib/workspace-types";

type Details = { name: string; jobTitle: string; department: string; workPhone: string; location: string; bio: string };
const detailsOf = (user: Member): Details => ({ name: user.name, jobTitle: user.jobTitle || "", department: user.department || "", workPhone: user.workPhone || "", location: user.location || "", bio: user.bio || "" });
const initialsOf = (name: string) => name.split(/\s+/).map(word => word[0]).slice(0, 2).join("").toUpperCase();
export function employeePhotoUrl(value?: string) { return value?.startsWith("/api/profile-photo?") ? value : undefined; }

export function EmployeePortrait({ user, className = "" }: { user: Member; className?: string }) {
  const [failed, setFailed] = useState(false);
  const photo = employeePhotoUrl(user.photoUrl);
  useEffect(() => setFailed(false), [photo]);
  return <span className={`nw-employee-portrait ${className}`} style={{ background: `${user.color || "#66877b"}20`, color: user.color || "#315c50" }}>
    {photo && !failed ? <img src={photo} alt={`${user.name} profile photograph`} onError={() => setFailed(true)} /> : <span>{initialsOf(user.name)}</span>}
  </span>;
}

export default function EmployeeProfile({ user, viewer, users, revision, onSaved, onEditMember }: {
  user: Member; viewer: Member; users: Member[]; revision: number;
  onSaved: (response: WorkspaceResponse) => void;
  onEditMember: (id: string) => void;
}) {
  const [details, setDetails] = useState<Details>(() => detailsOf(user));
  const [editRevision, setEditRevision] = useState(revision);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [removePrompt, setRemovePrompt] = useState(false);
  const [directorySearch, setDirectorySearch] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const own = user.id === viewer.id;
  const complete = !!user.jobTitle?.trim() && !!user.photoUrl;
  useEffect(() => { if (!dirty) { setDetails(detailsOf(user)); setEditRevision(revision); } }, [user, revision, dirty]);
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function change(key: keyof Details, value: string) {
    if (!dirty) setEditRevision(revision);
    setDirty(true); setDetails(previous => ({ ...previous, [key]: value })); setMessage("");
  }
  function clearSelection() { setFile(null); if (input.current) input.current.value = ""; }
  async function perform(url: string, options: RequestInit, success: string, resetDetails = false) {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(url, options);
      const result = await response.json() as WorkspaceResponse & { error?: string };
      if (response.status === 409) throw new Error("The workspace changed while this form was open. Reload saved details, review them, and try again. Your changes were not saved.");
      if (!response.ok) throw new Error(result.error || "The profile could not be saved.");
      onSaved(result); setEditRevision(result.revision);
      if (resetDetails) { setDetails(detailsOf(result.state.users.find(member => member.id === user.id) || result.user)); setDirty(false); }
      setMessage(success); clearSelection(); setRemovePrompt(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The request could not be completed."); }
    finally { setBusy(false); }
  }
  function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    void perform("/api/workspace", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: own ? "profile.update" : "member.update", payload: { ...details, ...(own ? {} : { id: user.id }) }, revision: editRevision }) }, "Profile details saved.", true);
  }
  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    setError(""); setMessage(""); const selected = event.target.files?.[0];
    if (!selected) { clearSelection(); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) { setError("Choose a JPEG, PNG or WebP photograph."); clearSelection(); return; }
    if (selected.size > 2 * 1024 * 1024) { setError("The photograph must be no larger than 2 MB."); clearSelection(); return; }
    setFile(selected); setRemovePrompt(false);
  }
  function upload() {
    if (!file || busy || dirty) return;
    const body = new FormData(); body.set("file", file); body.set("memberId", user.id); body.set("revision", String(revision));
    void perform("/api/profile-photo", { method: "POST", body }, "Profile photograph saved.");
  }
  async function reload() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/workspace", { cache: "no-store" });
      const next = await response.json() as WorkspaceResponse & { error?: string };
      if (!response.ok) throw new Error(next.error || "Could not reload saved details.");
      onSaved(next); setDetails(detailsOf(next.state.users.find(member => member.id === user.id) || next.user)); setEditRevision(next.revision); setDirty(false); clearSelection(); setRemovePrompt(false); setMessage("Saved profile reloaded.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not reload."); }
    finally { setBusy(false); }
  }
  const directory = users.filter(member => member.active && `${member.name} ${member.jobTitle || ""} ${member.department || ""}`.toLowerCase().includes(directorySearch.toLowerCase()));
  return <div className="nw-profile-area">
    <div className={`nw-profile-completion ${complete ? "complete" : ""}`}><ShieldCheck size={22}/><div><strong>{complete ? "Profile complete" : "Complete your team profile"}</strong><p>{complete ? "A photograph and job title help your colleagues recognise your work." : "Add one photograph and a job title. Your workspace remains available while you prepare your profile."}</p></div><span className="nw-pill">{Number(!!user.photoUrl) + Number(!!user.jobTitle?.trim())}/2 complete</span></div>
    {error && <div className="nw-alert error" role="alert">{error}</div>}
    {message && <div className="nw-profile-success" role="status"><CheckCircle2 size={17}/>{message}</div>}
    <div className="nw-profile-grid">
      <section className="nw-panel nw-profile-photo-panel"><div className="nw-panel-head"><div><h2>Profile photograph</h2><p>One photograph, visible to your team</p></div><Camera size={19}/></div><div className="nw-profile-photo-body">
        {preview ? <img className="nw-profile-preview" src={preview} alt="Selected photograph preview"/> : <EmployeePortrait user={user} className="large"/>}
        <h3>{user.name}</h3><p>{user.jobTitle || "Job title to be added"}</p><span className="nw-profile-account">{user.email}</span>
        <input ref={input} id={`portrait-${user.id}`} type="file" accept="image/jpeg,image/png,image/webp" className="nw-profile-file" onChange={chooseFile} disabled={busy || dirty} aria-label="Choose profile photograph"/>
        <button type="button" className="nw-button secondary" onClick={() => input.current?.click()} disabled={busy || dirty}><ImagePlus size={16}/>{user.photoUrl ? "Choose replacement" : "Choose photograph"}</button>
        <small>JPEG, PNG or WebP · maximum 2 MB</small>
        {dirty && <p className="nw-profile-hint">Save your profile details before changing the photograph.</p>}
        {file && <div className="nw-profile-selection"><span>{file.name}</span><div className="nw-button-row"><button type="button" className="nw-button" disabled={busy || dirty} onClick={upload}>{busy ? <Loader2 size={16} className="nw-spinner"/> : <Camera size={16}/>}Save photograph</button><button type="button" className="nw-button secondary" onClick={clearSelection} disabled={busy}>Cancel</button></div><small>Saving replaces the current photograph.</small></div>}
        {!!user.photoUrl && !file && <button type="button" className="nw-text-link" disabled={busy || dirty} onClick={() => setRemovePrompt(true)}><Trash2 size={14}/>Remove photograph</button>}
        {removePrompt && <div className="nw-profile-selection"><p>Remove this photograph and return to initials?</p><div className="nw-button-row"><button type="button" className="nw-button danger small" disabled={busy || dirty} onClick={() => void perform("/api/profile-photo", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberId: user.id, revision }) }, "Profile photograph removed.")}>Remove photograph</button><button type="button" className="nw-button secondary small" onClick={() => setRemovePrompt(false)}>Keep photograph</button></div></div>}
      </div></section>
      <section className="nw-panel"><div className="nw-panel-head"><div><h2>{own ? "Your profile details" : `Profile details · ${user.name}`}</h2><p>{own ? "Keep your name and professional details up to date" : "Administrator profile management"}</p></div></div><form className="nw-panel-body" onSubmit={saveDetails}>
        <div className="nw-form-grid">
          <label className="nw-field"><span>Display name *</span><input className="nw-input" value={details.name} onChange={event => change("name", event.target.value)} maxLength={120} required disabled={busy}/></label>
          <label className="nw-field"><span>Job title *</span><input className="nw-input" value={details.jobTitle} onChange={event => change("jobTitle", event.target.value)} maxLength={120} placeholder="Network & Cybersecurity Engineer" required disabled={busy}/></label>
          <label className="nw-field"><span>Department</span><input className="nw-input" value={details.department} onChange={event => change("department", event.target.value)} maxLength={80} placeholder="Engineering" disabled={busy}/></label>
          <label className="nw-field"><span>Work phone</span><input className="nw-input" type="tel" value={details.workPhone} onChange={event => change("workPhone", event.target.value)} maxLength={40} placeholder="Add a work contact number" disabled={busy}/></label>
          <label className="nw-field full"><span>Work location</span><input className="nw-input" value={details.location} onChange={event => change("location", event.target.value)} maxLength={120} placeholder="City, office or remote" disabled={busy}/></label>
          <label className="nw-field full"><span>About your work</span><textarea className="nw-textarea" value={details.bio} onChange={event => change("bio", event.target.value)} maxLength={600} placeholder="Responsibilities, specialisms and how you help the team" disabled={busy}/><small>{details.bio.length}/600 characters</small></label>
        </div><p className="nw-profile-hint">Your title describes your work. Account permissions are managed separately by an administrator.</p><div className="nw-button-row"><button type="submit" className="nw-button" disabled={busy || !dirty}>{busy ? <Loader2 size={16} className="nw-spinner"/> : <Save size={16}/>}Save profile</button><button type="button" className="nw-button secondary" disabled={busy} onClick={() => void reload()}><RefreshCw size={15}/>Reload saved details</button></div>
        {dirty && <small className="nw-profile-unsaved">Unsaved changes · reloading discards these typed changes.</small>}
      </form></section>
    </div>
    <section className="nw-panel"><div className="nw-panel-head"><div><h2><Users size={18}/>Team directory</h2><p>One profile for each active teammate</p></div><input className="nw-input nw-directory-search" aria-label="Find teammate" placeholder="Find a teammate or title…" value={directorySearch} onChange={event => setDirectorySearch(event.target.value)}/></div><div className="nw-directory-grid">{directory.map(member => <article className="nw-directory-card" key={member.id}><EmployeePortrait user={member}/><div><h3>{member.name}{member.sample && <span className="nw-pill gray">Sample</span>}</h3><p>{member.jobTitle || "Job title to be added"}</p>{member.department && <small>{member.department}</small>}<small>{member.photoUrl && member.jobTitle ? "Profile complete" : !member.photoUrl && !member.jobTitle ? "Photograph and job title needed" : !member.photoUrl ? "Photograph needed" : "Job title needed"}</small>{(viewer.role === "admin" || member.id === viewer.id) && <button type="button" className="nw-text-link" disabled={busy || dirty} onClick={() => onEditMember(member.id)}>{member.id === viewer.id ? "Edit my profile" : "Manage profile"}</button>}</div></article>)}{!directory.length && <p className="nw-profile-hint">No teammates match this search.</p>}</div></section>
    <p className="nw-profile-hint">Employee profiles stay inside this workspace. The company website’s public team section is maintained separately.</p>
  </div>;
}
