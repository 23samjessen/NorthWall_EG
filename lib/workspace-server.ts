import { env, trustedIdentity } from '../hostinger/runtime-env';
import type { Member, MemberOnboarding, OnboardingResponse, WorkspaceState, WorkspaceResponse, AuditEntry, Ticket, Comment, Message, Note, CalendarEvent, CustomField, AutomationRule } from './workspace-types';
import { emptyState, demoState } from './workspace-seed';
import resources from './knowledge-resources.json';

export class ApiError extends Error { constructor(public status:number, public code:string, message:string){super(message);} }
type Identity={userId:string;email:string;name:string};
type Stored={id:string;payload:string;revision:number;last_hash:string;updated_at:string};
type AnyData=Record<string,unknown>;
type PhotoMetadata={key:string;contentType:'image/png'|'image/jpeg'|'image/webp';bytes:number;width:number;height:number;sha256:string;uploadedAt:string};
type StoredMember=Member&{_profilePhoto?:PhotoMetadata};
const MAX_PHOTO_BYTES=2*1024*1024;
const MAX_PHOTO_REQUEST_BYTES=MAX_PHOTO_BYTES+16*1024;
const MAX_AUDIT_EXPORT_BYTES=8*1024*1024;
const MAX_AUDIT_EXPORT_ROWS=10000;
const INVITATION_LIFETIME_MS=7*24*60*60*1000;
// This expression contains only fixed column names. BLOB lengths measure UTF-8
// bytes, including multibyte text, before any history rows enter worker memory.
const AUDIT_BYTES_SQL='COALESCE(SUM(length(CAST(id AS BLOB))+length(CAST(sequence AS BLOB))+length(CAST(timestamp AS BLOB))+length(CAST(actor_id AS BLOB))+length(CAST(actor_name AS BLOB))+length(CAST(action AS BLOB))+length(CAST(object_id AS BLOB))+length(CAST(request_id AS BLOB))+length(CAST(changes AS BLOB))+length(CAST(previous_hash AS BLOB))+length(CAST(hash AS BLOB))),0)';
const PROFILE_FIELDS=['name','jobTitle','department','workPhone','location','bio'] as const;
function profileDetails(member:Member){return {name:member.name,jobTitle:member.jobTitle||'',department:member.department||'',workPhone:member.workPhone||'',location:member.location||'',bio:member.bio||''};}
function publicMember(member:Member,includeIdentityAnchor=false):Member{
  const {_profilePhoto,photoUrl:_url,photoUpdatedAt:_updated,profileCompletion:_completion,...safe}=member as StoredMember;
  if(safe.onboarding&&!includeIdentityAnchor){const {identityAnchorUserId:_anchor,...onboarding}=safe.onboarding;safe.onboarding=onboarding;}
  const hasPhoto=!!_profilePhoto;const hasJobTitle=!!member.jobTitle?.trim();
  return {...safe,active:member.sample?member.active:accountEnabled(member),...(_profilePhoto?{photoUrl:`/api/profile-photo?memberId=${encodeURIComponent(member.id)}&v=${_profilePhoto.sha256.slice(0,16)}`,photoUpdatedAt:_profilePhoto.uploadedAt}:{}),profileCompletion:{hasPhoto,hasJobTitle,complete:hasPhoto&&hasJobTitle}};
}
function photoEvidence(photo:PhotoMetadata|undefined){if(!photo)return null;const {key:_key,...metadata}=photo;return metadata;}

const id=(prefix:string)=>`${prefix}_${crypto.randomUUID()}`;
const iso=()=>new Date().toISOString();
const fail=(code:string,message:string,status=400):never=>{throw new ApiError(status,code,message);};
const db=():D1Database=>{if(!env.DB)throw new ApiError(503,'storage_unavailable','Workspace storage is not configured.');return env.DB;};
export function requestIdentity(_request:Request):Identity {
  const identity=trustedIdentity();
  if(!identity)throw new ApiError(401,'sign_in_required','Sign in to access the employee workspace.');
  return identity;
}
function bootstrapAllowed(identity:Identity){
  const raw=(env as unknown as Record<string,unknown>).ADMIN_EMAILS;
  const allowed=typeof raw==='string'?raw:'';
  return allowed.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(identity.email);
}
function bootstrapMember(identity:Identity):Member{return {id:'owner',userId:identity.userId,name:identity.name==='23samjessen'?'Sam Jessen':identity.name,email:identity.email,role:'admin',active:true,color:'#245b53',jobTitle:identity.email==='23samjessen@gmail.com'?'Network & Cybersecurity Engineer':'Workspace administrator',createdAt:iso()};}
function ownerAccount(member:Member){return member.id==='owner'&&!!member.userId&&member.active&&member.role==='admin'&&!member.sample;}
function identityAnchor(member:Member):string|null|undefined{
  const saved=member.onboarding?.identityAnchorUserId;if(typeof saved==='string'&&saved)return saved;
  if(saved!==undefined&&saved!==null)return undefined;
  if(member.userId)return member.userId;
  // Existing bound records establish continuity from their persisted ID. An
  // older lifecycle record that already lost its binding is never guessed.
  return saved===null||!member.onboarding?null:undefined;
}
function identityCanBind(member:Member,userId:string){const anchor=identityAnchor(member);return anchor!==undefined&&(anchor===null||anchor===userId);}
function retiredAccount(member:Member){return member.id!=='owner'&&!member.sample&&!member.active&&!member.userId&&member.onboarding?.status==='revoked';}
function approvedOnboarding(member:Member){
  const onboarding=member.onboarding;if(!onboarding||onboarding.status!=='approved'||onboarding.invitedBy!=='owner'||onboarding.approvedBy!=='owner'||!onboarding.invitationId||!member.userId)return false;
  if(identityAnchor(member)!==member.userId)return false;
  const invited=Date.parse(onboarding.invitedAt),accepted=Date.parse(onboarding.acceptedAt||''),approved=Date.parse(onboarding.approvedAt||''),expires=Date.parse(onboarding.expiresAt);
  return [invited,accepted,approved,expires].every(Number.isFinite)&&invited<=accepted&&accepted<=approved&&approved<expires;
}
function accountEnabled(member:Member){return !member.sample&&member.active&&(ownerAccount(member)||member.id!=='owner'&&approvedOnboarding(member));}
function assignableMember(member:Member){return member.sample?member.active:accountEnabled(member);}
function accountOwner(state:WorkspaceState,user:Member){const owner=state.users.find(member=>member.id==='owner');if(!owner||!ownerAccount(owner)||user.id!==owner.id||user.userId!==owner.userId)fail('owner_required','Only the workspace owner can manage invitations and account access.',403);}
function invitationCurrent(onboarding:MemberOnboarding|undefined,time=Date.now()){return !!onboarding&&onboarding.invitedBy==='owner'&&!!onboarding.invitationId&&Number.isFinite(Date.parse(onboarding.invitedAt))&&Number.isFinite(Date.parse(onboarding.expiresAt))&&Date.parse(onboarding.invitedAt)<=time&&Date.parse(onboarding.expiresAt)>time;}
function newInvitation(user:Member,time:string,anchor:string|null=null):MemberOnboarding{return {status:'invited',invitationId:id('invitation'),invitedAt:time,invitedBy:user.id,expiresAt:new Date(Date.parse(time)+INVITATION_LIFETIME_MS).toISOString(),identityAnchorUserId:anchor};}
function accountEvidence(member:Member){const {identityAnchorUserId:_anchor,...onboarding}=member.onboarding||{};return {id:member.id,email:member.email,userId:member.userId,role:member.role,active:member.active,onboarding:member.onboarding?onboarding:null,identityContinuity:typeof identityAnchor(member)==='string'};}
function memberFor(state:WorkspaceState,identity:Identity):Member {
  const member=state.users.find(u=>u.userId===identity.userId);
  if(!member||!accountEnabled(member))throw new ApiError(403,'membership_required','Your account needs an owner invitation and approval before the employee workspace is available.');
  return member;
}
function ownInvitation(state:WorkspaceState,identity:Identity){
  const bound=state.users.find(member=>!member.sample&&member.userId===identity.userId);
  if(bound)return accountEnabled(bound)||bound.email.toLowerCase()===identity.email?bound:undefined;
  const candidates=state.users.filter(member=>member.id!=='owner'&&!member.sample&&!member.userId&&member.email.toLowerCase()===identity.email&&identityCanBind(member,identity.userId));
  return candidates.find(member=>member.onboarding?.status==='invited')||candidates[0];
}
function onboardingFor(member:Member|undefined,identity:Identity):OnboardingResponse{
  if(!member||member.sample||!identityCanBind(member,identity.userId))return {status:'not_invited',email:identity.email};
  if(member.userId===identity.userId&&accountEnabled(member))return {status:'approved',email:member.email};
  const onboarding=member.onboarding;if(!onboarding)return {status:'not_invited',email:identity.email};
  const details={email:member.email,...(onboarding.invitationId?{invitationId:onboarding.invitationId}:{}),expiresAt:onboarding.expiresAt,...(onboarding.acceptedAt?{acceptedAt:onboarding.acceptedAt}:{})};
  if(onboarding.status==='revoked')return {status:'revoked',...details};
  if(onboarding.status!=='invited'&&onboarding.status!=='pending_approval')return {status:'not_invited',email:identity.email};
  if(!invitationCurrent(onboarding))return {status:'expired',...details};
  return {status:onboarding.status,...details};
}
export async function readInvitationStatus(request:Request):Promise<OnboardingResponse>{const identity=requestIdentity(request);const record=await load();if(!record)return {status:'not_invited',email:identity.email};const state=JSON.parse(record.payload) as WorkspaceState;return onboardingFor(ownInvitation(state,identity),identity);}
function admin(user:Member){if(user.role!=='admin')throw new ApiError(403,'admin_required','Only an administrator can use this action.');}
function manager(user:Member){if(user.role!=='admin'&&user.role!=='manager')throw new ApiError(403,'manager_required','A manager or administrator is required for this action.');}
export function visibleState(state:WorkspaceState,user:Member):WorkspaceState {
  const users=state.users.filter(member=>ownerAccount(user)||member.sample||accountEnabled(member)).map(member=>{const visible=publicMember(member,ownerAccount(user));if(!ownerAccount(user)&&member.id!==user.id)delete visible.onboarding;return visible;});
  return {...state,users,notes:state.notes.filter(n=>n.visibility==='team'||n.ownerId===user.id),messages:state.messages.filter(m=>!m.recipientId||m.recipientId===user.id||m.authorId===user.id),notifications:state.notifications.filter(n=>n.userId===user.id)};
}
async function load(){return db().prepare('SELECT id,payload,revision,last_hash,updated_at FROM workspace WHERE id = ?').bind('main').first<Stored>();}
function responseFor(state:WorkspaceState,user:Member,revision:number,needsSetup=false):WorkspaceResponse{return {user:publicMember(user,ownerAccount(user)),state:visibleState(state,user),revision,needsSetup,resources};}
export async function readWorkspace(request:Request):Promise<WorkspaceResponse>{
  const identity=requestIdentity(request);const record=await load();
  if(!record){if(!bootstrapAllowed(identity))fail('membership_required','This workspace has not been enabled for your account.',403);const owner=bootstrapMember(identity);return responseFor(emptyState(owner),owner,0,true);}
  const state=JSON.parse(record.payload) as WorkspaceState;const user=memberFor(state,identity);return responseFor(state,user,record.revision);
}
export function validateSameOrigin(request:Request){
  const origin=request.headers.get('origin');const site=request.headers.get('sec-fetch-site');
  if(site==='cross-site'||site==='same-site')fail('origin_rejected','Use the workspace on its own site to make changes.',403);
  if(origin){let parsed:URL;try{parsed=new URL(origin);}catch{fail('origin_rejected','Invalid request origin.',403);}if(parsed!.origin!==new URL(request.url).origin)fail('origin_rejected','Request origin does not match this site.',403);}
  else if(site!=='same-origin')fail('origin_required','A same-origin browser request is required.',403);
}
export function validateWriteOrigin(request:Request){
  validateSameOrigin(request);
  const mediaType=request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
  if(mediaType!=='application/json')fail('json_required','Send JSON for workspace changes.',415);
}
function str(value:unknown,name:string,max=200,required=false){if(value===undefined||value===null){if(required)fail('invalid_input',`${name} is required.`);return '';}if(typeof value!=='string')fail('invalid_input',`${name} must be text.`);const clean=(value as string).trim();if(clean.length>max||required&&!clean)fail('invalid_input',`${name} must contain ${required?'1 to':'at most'} ${max} characters.`);return clean;}
function bool(value:unknown,fallback=false){if(value===undefined)return fallback;if(typeof value!=='boolean')fail('invalid_input','Expected true or false.');return value as boolean;}
function choice<T extends string>(v:unknown,allowed:T[],name:string):T{if(typeof v!=='string'||!allowed.includes(v as T))fail('invalid_input',`Choose a valid ${name}.`);return v as T;}
function strings(v:unknown,name:string,max=40){if(v===undefined)return [];if(!Array.isArray(v)||v.length>max)fail('invalid_input',`${name} must be a list of at most ${max} entries.`);return [...new Set((v as unknown[]).map(x=>str(x,name,150,true)))];}
function when(v:unknown,name:string,nullable=true):string|null{if(v===undefined||v===null||v===''){if(nullable)return null;fail('invalid_input',`${name} is required.`);}const value=str(v,name,50,true);const d=new Date(value);if(!Number.isFinite(d.getTime()))fail('invalid_input',`${name} must be a valid date.`);return d.toISOString();}
function activeUser(state:WorkspaceState,value:unknown,nullable=false){if(nullable&&(value===null||value===undefined||value===''))return null;const userId=str(value,'User',100,true);if(!state.users.some(u=>u.id===userId&&assignableMember(u)))fail('unknown_user','Choose an active, approved team member or a sample assignment persona.');return userId;}
function mentions(state:WorkspaceState,v:unknown){return strings(v,'Mentions',20).map(m=>activeUser(state,m) as string);}
function get<T extends {id:string}>(items:T[],raw:unknown,label:string):T{const entry=items.find(x=>x.id===str(raw,`${label} ID`,100,true));if(!entry)fail('not_found',`${label} was not found.`,404);return entry!;}
function notify(state:WorkspaceState,userIds:string[],title:string,body:string,kind:'info'|'warning'|'urgent'|'mention'|'assignment',objectId:string|null,time:string){for(const userId of new Set(userIds)){if(state.users.some(u=>u.id===userId&&accountEnabled(u)))state.notifications.push({id:id('notification'),userId,title,body,kind,objectId,read:false,createdAt:time});}if(state.notifications.length>2000)state.notifications=state.notifications.slice(-2000);}
function mentionAlerts(state:WorkspaceState,ids:string[],user:Member,body:string,objectId:string,time:string){notify(state,ids.filter(x=>x!==user.id),`${user.name} mentioned you`,body.slice(0,240),'mention',objectId,time);}
function customValues(state:WorkspaceState,v:unknown,existing:Record<string,string|number|boolean>={}):Record<string,string|number|boolean>{
  if(v===undefined)v=existing;if(!v||typeof v!=='object'||Array.isArray(v))fail('invalid_input','Custom fields must be an object.');const out:Record<string,string|number|boolean>={};
  for(const [key,val] of Object.entries(v as AnyData)){const field=state.customFields.find(f=>f.id===key);if(!field)fail('unknown_field','An unknown custom field was supplied.');
    if(field!.type==='number'){if(typeof val!=='number'||!Number.isFinite(val))fail('invalid_input',`${field!.name} must be a number.`);out[key]=val as number;}
    else if(field!.type==='checkbox')out[key]=bool(val);
    else {const text=str(val,field!.name,500);if(field!.type==='select'&&text&&!field!.options.includes(text))fail('invalid_input',`Choose a listed value for ${field!.name}.`);if(field!.type==='date'&&text)when(text,field!.name);out[key]=text;}}
  for(const field of state.customFields.filter(f=>f.required)){if(out[field.id]===undefined||out[field.id]==='')fail('required_field',`${field.name} is required.`);}
  return out;
}
function reaction(target:{reactions:{emoji:string;userIds:string[]}[]},emoji:unknown,userId:string){const allowed=['👍','❤️','😂','🎉','👀','✅','🙏','🔥','👋','🚀','😮','😢'];const selected=choice(emoji,allowed,'reaction');let item=target.reactions.find(r=>r.emoji===selected);if(!item){item={emoji:selected,userIds:[]};target.reactions.push(item);}if(item.userIds.includes(userId))item.userIds=item.userIds.filter(x=>x!==userId);else item.userIds.push(userId);target.reactions=target.reactions.filter(r=>r.userIds.length);}
function canReadMessage(message:Message,user:Member){return !message.recipientId||message.recipientId===user.id||message.authorId===user.id;}
function runRules(state:WorkspaceState,ticket:Ticket,trigger:'ticket.created'|'ticket.updated',time:string){for(const rule of state.rules.filter(r=>r.enabled&&r.trigger===trigger&&(r.priority==='any'||r.priority===ticket.priority))){if(rule.assignToId&&state.users.some(u=>u.id===rule.assignToId&&assignableMember(u)))ticket.assigneeId=rule.assignToId;if(rule.moveToId&&state.columns.some(c=>c.id===rule.moveToId))ticket.status=rule.moveToId;notify(state,rule.notifyUserIds,rule.name,`${ticket.key}: ${ticket.title}`,'info',ticket.id,time);}}
export function applyAction(state:WorkspaceState,user:Member,action:string,p:AnyData,time=iso()):{objectId:string;changes:unknown}{
  let objectId='workspace';let changes:unknown={};
  const has=(key:string)=>Object.prototype.hasOwnProperty.call(p,key);
  switch(action){
    case 'profile.update':{
      if(('id' in p&&p.id!==user.id)||('memberId' in p&&p.memberId!==user.id))fail('profile_owner_required','You can only update your own profile.',403);
      if(Object.keys(p).some(key=>!PROFILE_FIELDS.includes(key as typeof PROFILE_FIELDS[number])))fail('profile_field_not_allowed','Profile updates accept personal details only. Account access and email are managed separately.',400);
      const member=get(state.users,user.id,'Member');const before=profileDetails(member);
      member.name=str(p.name,'Name',120,true);member.jobTitle=str(p.jobTitle,'Job title',120,true);
      if(has('department'))member.department=str(p.department,'Department',80);
      if(has('workPhone'))member.workPhone=str(p.workPhone,'Work phone',40);
      if(has('location'))member.location=str(p.location,'Location',120);
      if(has('bio'))member.bio=str(p.bio,'Bio',600);
      member.profileUpdatedAt=time;objectId=member.id;changes={before,after:profileDetails(member)};break;
    }
    case 'ticket.create':case 'ticket.update':{
      const updating=action==='ticket.update';if(!updating&&state.tickets.length>=1000)fail('capacity','This review demo supports up to 1,000 total tickets, including archived records.');
      const current=updating?get(state.tickets,p.id,'Ticket'):null;const before=current?structuredClone(current):null;
      const next:Ticket=current||{id:id('ticket'),key:`NW-${Math.max(100,...state.tickets.map(t=>Number(t.key.replace('NW-',''))||100))+1}`,title:'',description:'',status:state.columns[0].id,priority:'medium',assigneeId:null,reporterId:user.id,customer:'',location:'',dueDate:null,tags:[],checklist:[],customFields:{},createdAt:time,updatedAt:time,archived:false};
      if(!updating||has('title'))next.title=str(p.title,'Title',200,true);
      for(const key of ['description','customer','location'] as const)if(has(key))next[key]=str(p[key],key,key==='description'?6000:200);
      if(has('status')){next.status=str(p.status,'Status',100,true);if(!state.columns.some(c=>c.id===next.status))fail('invalid_status','Choose an existing workflow column.');}
      if(has('priority'))next.priority=choice(p.priority,['critical','high','medium','low'],'priority');
      if(has('assigneeId'))next.assigneeId=activeUser(state,p.assigneeId,true);
      if(has('dueDate'))next.dueDate=when(p.dueDate,'Due date');
      if(has('tags'))next.tags=strings(p.tags,'Tags',12);
      if(has('checklist')){if(!Array.isArray(p.checklist)||p.checklist.length>60)fail('invalid_input','Checklist accepts at most 60 items.');next.checklist=(p.checklist as AnyData[]).map(c=>({id:typeof c.id==='string'?str(c.id,'Checklist ID',100,true):id('check'),text:str(c.text,'Checklist item',400,true),done:bool(c.done)}));}
      next.customFields=customValues(state,p.customFields,next.customFields);next.updatedAt=time;
      if(!updating)state.tickets.push(next);runRules(state,next,updating?'ticket.updated':'ticket.created',time);
      if(next.assigneeId&&next.assigneeId!==before?.assigneeId&&next.assigneeId!==user.id)notify(state,[next.assigneeId],`${next.key} assigned to you`,next.title,'assignment',next.id,time);
      objectId=next.id;changes={before,after:next};break;
    }
    case 'ticket.archive':{const ticket=get(state.tickets,p.id,'Ticket');ticket.archived=bool(p.archived,true);ticket.updatedAt=time;objectId=ticket.id;changes={archived:ticket.archived};break;}
    case 'comment.add':case 'comment.forward':{
      if(state.comments.length>=5000)fail('capacity','The demo comment limit has been reached.');const ticket=get(state.tickets,p.ticketId,'Ticket');
      const source=action==='comment.forward'?get(state.comments,p.id,'Comment'):null;if(source?.deleted)fail('not_found','That comment was deleted.',404);
      const replyToId=p.replyToId?str(p.replyToId,'Reply',100):null;if(replyToId&&!state.comments.some(c=>c.id===replyToId&&c.ticketId===ticket.id))fail('invalid_reply','Reply to a comment in this ticket.');
      const entry:Comment={id:id('comment'),ticketId:ticket.id,authorId:user.id,body:source?source.body:str(p.body,'Comment',6000,true),replyToId,mentions:mentions(state,p.mentions),reactions:[],createdAt:time,updatedAt:time,forwardedFromId:source?.id||null};
      state.comments.push(entry);mentionAlerts(state,entry.mentions,user,entry.body,ticket.id,time);const parent=state.comments.find(c=>c.id===replyToId);if(parent&&parent.authorId!==user.id)notify(state,[parent.authorId],`${user.name} replied to your comment`,entry.body.slice(0,240),'info',ticket.id,time);objectId=entry.id;changes={ticketId:ticket.id,body:entry.body,replyToId,forwardedFromId:entry.forwardedFromId};break;
    }
    case 'comment.update':case 'comment.delete':case 'comment.react':{
      const entry=get(state.comments,p.id,'Comment');if(entry.deleted)fail('not_found','That comment was deleted.',404);objectId=entry.id;
      if(action==='comment.react'){reaction(entry,p.emoji,user.id);changes={emoji:p.emoji};}
      else {if(entry.authorId!==user.id&&!(action==='comment.delete'&&user.role==='admin'))fail('forbidden','You can only edit your own comments.',403);const before=entry.body;if(action==='comment.delete'){entry.body='Message removed';entry.deleted=true;entry.mentions=[];}else entry.body=str(p.body,'Comment',6000,true);entry.updatedAt=time;changes={before,after:entry.body};}break;
    }
    case 'message.send':case 'message.forward':{
      if(state.messages.length>=5000)fail('capacity','The demo message limit has been reached.');const channel=get(state.channels,p.channelId||'general','Channel');
      const source=action==='message.forward'?get(state.messages,p.id,'Message'):null;if(source&&(!canReadMessage(source,user)||source.deleted))fail('not_found','Message was not found.',404);
      const recipientId=activeUser(state,p.recipientId,true);const replyToId=p.replyToId?str(p.replyToId,'Reply',100):null;
      if(replyToId){const parent=get(state.messages,replyToId,'Message');if(!canReadMessage(parent,user)||parent.channelId!==channel.id||((parent.recipientId||recipientId)&&!(parent.authorId===user.id&&parent.recipientId===recipientId||parent.authorId===recipientId&&parent.recipientId===user.id)))fail('invalid_reply','Reply within the same conversation.');}
      const entry:Message={id:id('message'),channelId:channel.id,authorId:user.id,recipientId,body:source?source.body:str(p.body,'Message',6000,true),replyToId,mentions:mentions(state,p.mentions),reactions:[],createdAt:time,updatedAt:time,forwardedFromId:source?.id||null,pinned:false};
      if(recipientId)entry.mentions=entry.mentions.filter(x=>x===recipientId||x===user.id);
      state.messages.push(entry);mentionAlerts(state,entry.mentions,user,entry.body,entry.id,time);if(recipientId&&recipientId!==user.id)notify(state,[recipientId],`Message from ${user.name}`,entry.body.slice(0,160),'info',entry.id,time);objectId=entry.id;changes={channelId:channel.id,recipientId,body:entry.body,replyToId,forwardedFromId:entry.forwardedFromId};break;
    }
    case 'message.update':case 'message.delete':case 'message.react':case 'message.pin':{
      const entry=get(state.messages,p.id,'Message');if(!canReadMessage(entry,user)||entry.deleted)fail('not_found','Message was not found.',404);objectId=entry.id;
      if(action==='message.react'){reaction(entry,p.emoji,user.id);changes={emoji:p.emoji};}
      else if(action==='message.pin'){entry.pinned=bool(p.pinned,!entry.pinned);changes={pinned:entry.pinned};}
      else {if(entry.authorId!==user.id&&!(action==='message.delete'&&user.role==='admin'))fail('forbidden','You can only edit your own messages.',403);const before=entry.body;if(action==='message.delete'){entry.body='Message removed';entry.deleted=true;entry.mentions=[];}else entry.body=str(p.body,'Message',6000,true);entry.updatedAt=time;changes={before,after:entry.body};}break;
    }
    case 'channel.create':{manager(user);if(state.channels.length>=30)fail('capacity','The demo supports up to 30 channels.');const entry={id:id('channel'),name:str(p.name,'Channel name',60,true),description:str(p.description,'Description',300)};state.channels.push(entry);objectId=entry.id;changes=entry;break;}
    case 'note.save':{
      const existing=p.id?get(state.notes,p.id,'Note'):null;if(existing&&existing.ownerId!==user.id)fail('forbidden','Only the note owner can edit this note.',403);
      const entry:Note=existing||{id:id('note'),title:'',body:'',ownerId:user.id,visibility:'private',color:'sand',pinned:false,createdAt:time,updatedAt:time};
      entry.title=str(p.title??entry.title,'Title',200,true);entry.body=str(p.body??entry.body,'Note',15000);if(has('visibility'))entry.visibility=choice(p.visibility,['private','team'],'visibility');if(has('color'))entry.color=choice(p.color,['sand','blue','green','rose','purple'],'note color');if(has('pinned'))entry.pinned=bool(p.pinned);entry.updatedAt=time;if(!existing){if(state.notes.length>=500)fail('capacity','The demo note limit has been reached.');state.notes.push(entry);}objectId=entry.id;changes={title:entry.title,visibility:entry.visibility,length:entry.body.length};break;
    }
    case 'note.delete':{const note=get(state.notes,p.id,'Note');if(note.ownerId!==user.id)fail('forbidden','Only the note owner can delete this note.',403);state.notes=state.notes.filter(n=>n.id!==note.id);objectId=note.id;changes={title:note.title};break;}
    case 'event.save':{
      const existing=p.id?get(state.events,p.id,'Event'):null;if(existing&&existing.ownerId!==user.id&&user.role!=='admin')fail('forbidden','Only the event owner or an administrator can change this event.',403);
      const entry:CalendarEvent=existing||{id:id('event'),title:'',description:'',start:time,end:time,location:'',attendeeIds:[],ownerId:user.id,type:'meeting',createdAt:time,updatedAt:time};
      entry.title=str(p.title??entry.title,'Title',200,true);entry.description=str(p.description??entry.description,'Description',4000);entry.location=str(p.location??entry.location,'Location',200);entry.start=when(p.start??entry.start,'Start',false)!;entry.end=when(p.end??entry.end,'End',false)!;if(entry.end<=entry.start)fail('invalid_date','The end must be after the start.');if(has('type'))entry.type=choice(p.type,['meeting','maintenance','deadline','other'],'event type');if(has('attendeeIds'))entry.attendeeIds=mentions(state,p.attendeeIds);entry.updatedAt=time;if(!existing){if(state.events.length>=1000)fail('capacity','The demo event limit has been reached.');state.events.push(entry);}notify(state,entry.attendeeIds.filter(x=>x!==user.id),`${existing?'Updated':'New'} event: ${entry.title}`,`${entry.start} · ${entry.location}`,'info',entry.id,time);objectId=entry.id;changes=entry;break;
    }
    case 'event.delete':{const event=get(state.events,p.id,'Event');if(event.ownerId!==user.id&&user.role!=='admin')fail('forbidden','Only the event owner or an administrator can remove it.',403);state.events=state.events.filter(e=>e.id!==event.id);objectId=event.id;changes={title:event.title};break;}
    case 'notification.send':{manager(user);const recipients=strings(p.userIds,'Recipients',100).map(x=>activeUser(state,x) as string);if(!recipients.length)fail('invalid_input','Choose at least one recipient.');const title=str(p.title,'Alert title',200,true);const body=str(p.body,'Alert',1500,true);const kind=choice(p.kind||'info',['info','warning','urgent'],'alert type');notify(state,recipients,title,body,kind,null,time);changes={recipients,title,body,kind};break;}
    case 'notification.read':{const entry=get(state.notifications,p.id,'Notification');if(entry.userId!==user.id)fail('not_found','Notification not found.',404);entry.read=bool(p.read,true);objectId=entry.id;changes={read:entry.read};break;}
    case 'notification.readAll':{state.notifications.filter(n=>n.userId===user.id).forEach(n=>{n.read=true;});changes={userId:user.id};break;}
    case 'column.save':{admin(user);const existing=p.id?get(state.columns,p.id,'Column'):null;const entry=existing||{id:id('column'),name:'',color:'#637584',isDone:false};entry.name=str(p.name??entry.name,'Column name',60,true);if(has('color')){const c=str(p.color,'Color',7,true);if(!/^#[0-9a-f]{6}$/i.test(c))fail('invalid_input','Use a six-digit hex color.');entry.color=c;}if(has('isDone'))entry.isDone=bool(p.isDone);if(!existing){if(state.columns.length>=12)fail('capacity','The demo supports up to 12 columns.');state.columns.push(entry);}objectId=entry.id;changes=entry;break;}
    case 'column.delete':{admin(user);const column=get(state.columns,p.id,'Column');if(state.columns.length===1||state.tickets.some(t=>t.status===column.id)||state.rules.some(r=>r.moveToId===column.id))fail('column_in_use','Move this column’s tickets and update its automation rules before deleting it.');state.columns=state.columns.filter(c=>c.id!==column.id);objectId=column.id;changes=column;break;}
    case 'column.reorder':{admin(user);const ids=strings(p.ids,'Columns',12);if(ids.length!==state.columns.length||ids.some(x=>!state.columns.some(c=>c.id===x)))fail('invalid_input','Provide every column exactly once.');state.columns=ids.map(x=>state.columns.find(c=>c.id===x)!);changes={ids};break;}
    case 'field.save':{admin(user);const existing=p.id?get(state.customFields,p.id,'Field'):null;const entry:CustomField=existing||{id:id('field'),name:'',type:'text',options:[],required:false};entry.name=str(p.name??entry.name,'Field name',60,true);if(has('type')){const type=choice(p.type,['text','number','date','select','checkbox'],'field type');if(existing&&existing.type!==type&&state.tickets.some(t=>Object.prototype.hasOwnProperty.call(t.customFields,existing.id)))fail('field_in_use','Create a new field to change a type already used by tickets.');entry.type=type;}if(has('options'))entry.options=strings(p.options,'Options',40);if(entry.type==='select'&&!entry.options.length)fail('invalid_input','A select field needs at least one option.');if(has('required'))entry.required=bool(p.required);if(!existing){if(state.customFields.length>=30)fail('capacity','The demo supports up to 30 custom fields.');state.customFields.push(entry);}objectId=entry.id;changes=entry;break;}
    case 'field.delete':{admin(user);const field=get(state.customFields,p.id,'Field');state.customFields=state.customFields.filter(f=>f.id!==field.id);state.tickets.forEach(t=>{delete t.customFields[field.id];});objectId=field.id;changes={name:field.name};break;}
    case 'member.invite':{
      accountOwner(state,user);if(Object.keys(p).some(key=>!['name','email','jobTitle'].includes(key)))fail('invitation_field_not_allowed','Invite with a name, email and optional job title. Account roles are granted separately after approval.');
      if(state.users.length>=100)fail('capacity','The demo supports up to 100 members.');const email=str(p.email,'Email',250,true).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.endsWith('.invalid'))fail('invalid_email','Enter a real member email address.');if(state.users.some(u=>u.email.toLowerCase()===email&&!retiredAccount(u)))fail('duplicate_member','A current member or invitation already uses this email. Revoke that access before creating a separate replacement record.');
      const entry:Member={id:id('member'),userId:null,name:str(p.name,'Name',120,true),email,role:'employee',active:false,color:'#54716a',jobTitle:str(p.jobTitle,'Job title',120),onboarding:newInvitation(user,time),createdAt:time};state.users.push(entry);objectId=entry.id;changes={after:accountEvidence(entry),invitationSent:false};break;
    }
    case 'member.approve':case 'member.revoke':case 'member.reinvite':{
      accountOwner(state,user);if(Object.keys(p).some(key=>key!=='id'))fail('invitation_field_not_allowed','Choose the existing member only. Invitation state is managed by the server.');
      const member=get(state.users,p.id,'Member');if(member.id==='owner')fail('owner_protected','The workspace owner cannot be revoked, reissued or replaced through member actions.');if(member.sample)fail('sample_account','Sample personas are for assignments only and cannot become login accounts.');
      const before=structuredClone(accountEvidence(member));const onboarding=member.onboarding;const anchor=identityAnchor(member);
      if(action==='member.approve'){
        if(onboarding?.status!=='pending_approval'||!member.userId||member.active||!Number.isFinite(Date.parse(onboarding.acceptedAt||''))||Date.parse(onboarding.acceptedAt!)<Date.parse(onboarding.invitedAt)||Date.parse(onboarding.acceptedAt!)>Date.parse(time))fail('acceptance_required','The invited person must accept the current invitation before the owner can approve access.');
        if(!invitationCurrent(onboarding,Date.parse(time)))fail('invitation_expired','The invitation expired. Reissue it and ask the person to accept again.',409);
        if(anchor!==member.userId)fail('identity_continuity_required','This account does not match the identity originally bound to the member record.',403);
        member.role='employee';member.active=true;member.onboarding={...onboarding!,status:'approved',approvedAt:time,approvedBy:user.id,identityAnchorUserId:anchor};
      }else if(action==='member.reinvite'){
        if(anchor===undefined)fail('identity_continuity_unknown','The previous account identity cannot be verified. Keep this record revoked and create a separate employee invitation.');
        if(state.users.some(other=>other.id!==member.id&&other.email.toLowerCase()===member.email.toLowerCase()&&!retiredAccount(other)))fail('duplicate_member','Another current member or invitation uses this email. Revoke that account before reissuing this historical record.');
        member.role='employee';member.active=false;member.userId=null;member.onboarding=newInvitation(user,time,anchor!);
      }else{
        member.role='employee';member.active=false;member.userId=null;
        // A legacy account has no historical invitation to invent. The new
        // revocation generation cannot be accepted and still records who revoked it.
        const prior=onboarding||{invitationId:id('invitation'),invitedAt:'',invitedBy:'',expiresAt:''};
        member.onboarding={status:'revoked',invitationId:prior.invitationId,invitedAt:prior.invitedAt,invitedBy:prior.invitedBy,expiresAt:prior.expiresAt,revokedAt:time,revokedBy:user.id,...(anchor!==undefined?{identityAnchorUserId:anchor}:{})};
      }
      objectId=member.id;changes={before,after:accountEvidence(member),...(action==='member.reinvite'?{invitationSent:false}:{})};break;
    }
    case 'member.update':{
      admin(user);const accountKeys=Object.keys(p).filter(key=>key!=='id'&&!PROFILE_FIELDS.includes(key as typeof PROFILE_FIELDS[number]));if(accountKeys.length)accountOwner(state,user);
      if(has('active'))fail('approval_workflow_required','Use owner approval or revocation to change account access.');if(accountKeys.some(key=>key!=='role'))fail('member_field_not_allowed','Member updates accept safe profile details and an owner-managed role only.');
      const member=get(state.users,p.id,'Member');const before={...profileDetails(member),role:member.role,active:accountEnabled(member)};const next={...member};
      if(has('role')){if(member.id==='owner')fail('owner_protected','The owner must retain active administrator access.');if(member.sample)fail('sample_account','Sample personas cannot become login accounts.');if(!accountEnabled(member))fail('approval_required','Approve the accepted invitation before granting an account role.');next.role=choice(p.role,['admin','manager','employee'],'role');}
      if(has('name'))next.name=str(p.name,'Name',120,true);if(has('jobTitle'))next.jobTitle=str(p.jobTitle,'Job title',120);if(has('department'))next.department=str(p.department,'Department',80);if(has('workPhone'))next.workPhone=str(p.workPhone,'Work phone',40);if(has('location'))next.location=str(p.location,'Location',120);if(has('bio'))next.bio=str(p.bio,'Bio',600);if(PROFILE_FIELDS.some(has))next.profileUpdatedAt=time;
      Object.assign(member,next);objectId=member.id;changes={before,after:{...profileDetails(member),role:member.role,active:accountEnabled(member)}};break;
    }
    case 'rule.save':{
      admin(user);const existing=p.id?get(state.rules,p.id,'Rule'):null;const entry:AutomationRule=existing||{id:id('rule'),name:'',enabled:true,trigger:'ticket.created',priority:'any',assignToId:null,moveToId:null,notifyUserIds:[]};entry.name=str(p.name??entry.name,'Rule name',100,true);if(has('enabled'))entry.enabled=bool(p.enabled);if(has('trigger'))entry.trigger=choice(p.trigger,['ticket.created','ticket.updated'],'trigger');if(has('priority'))entry.priority=choice(p.priority,['any','critical','high','medium','low'],'priority');if(has('assignToId'))entry.assignToId=activeUser(state,p.assignToId,true);if(has('moveToId'))entry.moveToId=p.moveToId?get(state.columns,p.moveToId,'Column').id:null;if(has('notifyUserIds'))entry.notifyUserIds=mentions(state,p.notifyUserIds);if(!existing){if(state.rules.length>=30)fail('capacity','The demo supports up to 30 automation rules.');state.rules.push(entry);}objectId=entry.id;changes=entry;break;
    }
    case 'rule.delete':{admin(user);const rule=get(state.rules,p.id,'Rule');state.rules=state.rules.filter(r=>r.id!==rule.id);objectId=rule.id;changes={name:rule.name};break;}
    case 'settings.update':{admin(user);if(has('name'))state.settings.name=str(p.name,'Workspace name',80,true);if(has('timeZone')){const zone=str(p.timeZone,'Time zone',80,true);try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{fail('invalid_timezone','Use a valid IANA time zone.');}state.settings.timeZone=zone;}changes=state.settings;break;}
    default:fail('unknown_action','That workspace action is not supported.');
  }
  return {objectId,changes};
}
export function canonical(value:unknown):string {if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';const obj=value as Record<string,unknown>;return '{'+Object.keys(obj).filter(k=>obj[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(obj[k])).join(',')+'}';}
export async function digest(value:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function save(state:WorkspaceState,old:Stored|null,user:Member,action:string,objectId:string,changes:unknown,request:Request){
  if(action.startsWith('note.')){
    const currentNote=state.notes.find(n=>n.id===objectId);
    const previousNote=old?(JSON.parse(old.payload) as WorkspaceState).notes.find(n=>n.id===objectId):undefined;
    const noteEvidence=async(note:Note|undefined)=>note?{visibility:note.visibility,ownerId:note.ownerId,titleHash:await digest(note.title),bodyHash:await digest(note.body),bodyLength:note.body.length,pinned:note.pinned}:null;
    changes={noteMetadataOnly:true,before:await noteEvidence(previousNote),after:await noteEvidence(currentNote)};
  }
  const privateMessage=action.startsWith('message.')?state.messages.find(m=>m.id===objectId&&m.recipientId):null;
  if(privateMessage){const before=changes&&typeof changes==='object'?(changes as AnyData).before:undefined;changes={privateConversation:true,channelId:privateMessage.channelId,recipientId:privateMessage.recipientId,replyToId:privateMessage.replyToId,bodyHash:await digest(privateMessage.body),bodyLength:privateMessage.body.length,pinned:privateMessage.pinned,deleted:!!privateMessage.deleted,...(typeof before==='string'?{previousBodyHash:await digest(before)}:{})};}
  const revision=(old?.revision||0)+1;const previousHash=old?.last_hash||'GENESIS';const timestamp=iso();const requestId=request.headers.get('cf-ray')?.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,80)||id('request');const eventBase={id:id('audit'),sequence:revision,timestamp,actorId:user.id,actorName:user.name,action,objectId,requestId,changes,previousHash};const hash=await digest(eventBase);const payload=JSON.stringify(state);
  if(new TextEncoder().encode(payload).length>1_500_000)fail('capacity','This demo workspace has reached its storage limit. Export records before adding more.');
  const database=db();const write=old?database.prepare('UPDATE workspace SET payload=?,revision=?,last_hash=?,updated_at=? WHERE id=? AND revision=? AND last_hash=?').bind(payload,revision,hash,timestamp,'main',old.revision,old.last_hash):database.prepare('INSERT OR IGNORE INTO workspace(id,payload,revision,last_hash,updated_at) VALUES(?,?,?,?,?)').bind('main',payload,revision,hash,timestamp);
  const auditWrite=database.prepare('INSERT INTO audit_events(id,sequence,timestamp,actor_id,actor_name,action,object_id,request_id,changes,previous_hash,hash) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM workspace WHERE id=? AND revision=? AND last_hash=?)').bind(eventBase.id,revision,timestamp,user.id,user.name,action,objectId,requestId,JSON.stringify(changes),previousHash,hash,'main',revision,hash);
  const results=await database.batch([write,auditWrite]);if(results[0].meta.changes!==1)fail('revision_conflict','Someone changed the workspace. Reload it and try again.',409);if(results[1].meta.changes!==1)throw new ApiError(500,'audit_write_failed','The change could not be recorded.');return revision;
}
async function acceptInvitation(request:Request,identity:Identity,record:Stored|null,payload:AnyData):Promise<OnboardingResponse>{
  if(Object.keys(payload).some(key=>key!=='invitationId'))fail('invitation_field_not_allowed','Accept the invitation shown for your signed-in account only.');
  const invitationId=str(payload.invitationId,'Invitation',100,true);
  if(!record)fail('invitation_required','The owner must invite your signed-in email before you can request access.',403);
  const state=JSON.parse(record!.payload) as WorkspaceState;const member=ownInvitation(state,identity);const onboarding=member?.onboarding;
  if(!member||member.id==='owner'||member.sample||member.email.toLowerCase()!==identity.email||!identityCanBind(member,identity.userId)||!onboarding||onboarding.invitationId!==invitationId)fail('invitation_required','This invitation is not available for your signed-in account. Ask the owner for the current invitation.',403);
  if(onboarding!.status==='approved'&&member!.userId===identity.userId&&accountEnabled(member!))return onboardingFor(member,identity);
  if(onboarding!.status!=='invited'&&onboarding!.status!=='pending_approval')fail('invitation_unavailable','This invitation is no longer available. Ask the owner to reissue it.',403);
  const time=iso();if(!invitationCurrent(onboarding,Date.parse(time)))fail('invitation_expired','The invitation expired. Ask the owner to reissue it.',409);
  if(onboarding!.status==='pending_approval'){
    if(member!.userId!==identity.userId||member!.active)fail('invitation_unavailable','This invitation is no longer available for this account.',403);
    return onboardingFor(member,identity);
  }
  if(member!.userId||member!.active||state.users.some(other=>other.id!==member!.id&&other.userId===identity.userId))fail('invitation_unavailable','This invitation is no longer available for this account.',403);
  const before=structuredClone(accountEvidence(member!));member!.userId=identity.userId;member!.role='employee';member!.active=false;member!.onboarding={...onboarding!,status:'pending_approval',acceptedAt:time,identityAnchorUserId:identity.userId};
  await save(state,record!,member!,'invitation.accept',member!.id,{before,after:accountEvidence(member!)},request);
  return onboardingFor(member,identity);
}
export async function mutateWorkspace(request:Request):Promise<WorkspaceResponse|OnboardingResponse>{
  validateWriteOrigin(request);const identity=requestIdentity(request);
  const bytes=await boundedBody(request,65536);let input:AnyData;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('invalid_json','The request is not valid JSON.');}if(!input!||typeof input!=='object'||Array.isArray(input))fail('invalid_json','Send an action object.');
  const action=str(input!.action,'Action',80,true);const payload=input!.payload??{};if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('invalid_input','Action payload must be an object.');
  const record=await load();if(action==='invitation.accept')return acceptInvitation(request,identity,record,payload as AnyData);
  if(!record){if(!bootstrapAllowed(identity))fail('membership_required','This workspace is not enabled for your account.',403);requireRevision(input!.revision,0);if(action!=='demo.initialize'&&action!=='workspace.initialize')fail('setup_required','Initialize the workspace first.',409);const owner=bootstrapMember(identity);const sampleData=action==='demo.initialize';const state=sampleData?demoState(owner):emptyState(owner);state.settings.demo=sampleData;const revision=await save(state,null,owner,action,'workspace',{sampleData,ticketCount:state.tickets.length},request);return responseFor(state,owner,revision);}
  const state=JSON.parse(record.payload) as WorkspaceState;const user=memberFor(state,identity);
  // Check membership before reporting revision conflicts: pending or uninvited
  // identities cannot use writes as an oracle for the private workspace revision.
  requireRevision(input!.revision,record.revision);
  if(action==='demo.initialize'||action==='workspace.initialize')fail('already_initialized','The workspace has already been initialized. Existing records are preserved.',409);
  const change=applyAction(state,user,action,payload as AnyData);const revision=await save(state,record,user,action,change.objectId,change.changes,request);return responseFor(state,user,revision);
}
export async function readAudit(request:Request){
  const identity=requestIdentity(request);const record=await load();if(!record){if(!bootstrapAllowed(identity))fail('admin_required','Administrator access is required.',403);return {audit:[],chainValid:true,chainScope:'complete',total:0,headHash:'GENESIS',exportedAt:iso()};}
  const state=JSON.parse(record.payload) as WorkspaceState;const user=memberFor(state,identity);admin(user);
  // D1 batches execute transactionally: the head and rows must come from one
  // snapshot, or a legitimate concurrent write could look like tampering.
  const database=db();const snapshot=await database.batch<Record<string,unknown>>([
    database.prepare('SELECT id,payload,revision,last_hash,updated_at FROM workspace WHERE id = ?').bind('main'),
    database.prepare(`SELECT COUNT(*) AS total,${AUDIT_BYTES_SQL} AS bytes FROM audit_events`),
    database.prepare(`SELECT id,sequence,timestamp,actor_id,actor_name,action,object_id,request_id,changes,previous_hash,hash FROM audit_events WHERE (SELECT COUNT(*) <= ? AND ${AUDIT_BYTES_SQL} <= ? FROM audit_events) ORDER BY sequence ASC LIMIT ?`).bind(MAX_AUDIT_EXPORT_ROWS,MAX_AUDIT_EXPORT_BYTES,MAX_AUDIT_EXPORT_ROWS+1),
  ]);
  const auditRecord=snapshot[0].results[0] as unknown as Stored|undefined;
  if(!auditRecord)fail('revision_conflict','The workspace changed. Reload it and try again.',409);
  // Access may have been revoked after the inexpensive initial check.
  admin(memberFor(JSON.parse(auditRecord!.payload) as WorkspaceState,identity));
  const totals=snapshot[1].results[0];const rows=snapshot[2];
  if(Number(totals.total)>MAX_AUDIT_EXPORT_ROWS||Number(totals.bytes)>MAX_AUDIT_EXPORT_BYTES||rows.results.length>MAX_AUDIT_EXPORT_ROWS)fail('export_too_large','The audit exceeds the safe export limit of 10,000 events or 8 MiB of stored event data. Use a protected administrator database backup for the complete record.',413);
  const audit:AuditEntry[]=rows.results.map(r=>({id:String(r.id),sequence:Number(r.sequence),timestamp:String(r.timestamp),actorId:String(r.actor_id),actorName:String(r.actor_name),action:String(r.action),objectId:String(r.object_id),requestId:String(r.request_id),changes:JSON.parse(String(r.changes)),previousHash:String(r.previous_hash),hash:String(r.hash)}));
  let valid=true;let previous='GENESIS';let sequence=1;for(const event of audit){const {hash,...base}=event;if(event.previousHash!==previous||event.sequence!==sequence||await digest(base)!==hash)valid=false;previous=hash;sequence++;}if(previous!==auditRecord!.last_hash||audit.length!==auditRecord!.revision)valid=false;
  return {audit:audit.slice().reverse(),chainValid:valid,chainScope:'complete',total:audit.length,headHash:auditRecord!.last_hash,exportedAt:iso(),integrityNote:'Hash chaining detects changes when compared with a trusted exported head. Database administrators can rewrite both data and hashes; export and retain independent signed evidence for forensic use.'};
}

function photoBucket():R2Bucket{if(!env.BUCKET)fail('photo_storage_unavailable','Profile photo storage is not configured.',503);return env.BUCKET!;}
function photoTarget(state:WorkspaceState,user:Member,memberId:unknown):StoredMember{
  const member=get(state.users,memberId,'Member') as StoredMember;
  if(member.id!==user.id&&user.role!=='admin')fail('profile_owner_required','You can only change your own profile photo.',403);
  return member;
}
function requireRevision(value:unknown,current:number):number{
  const revision=typeof value==='string'&&/^\d{1,15}$/.test(value)?Number(value):value;
  if(!Number.isSafeInteger(revision)||Number(revision)<0)fail('invalid_revision','A current workspace revision is required.');
  if(revision!==current)fail('revision_conflict','Someone changed the workspace. Reload it and try again.',409);
  return revision as number;
}
async function profileContext(request:Request){
  const identity=requestIdentity(request);const record=await load();
  if(!record)fail('setup_required','Initialize the employee workspace before adding a profile photo.',409);
  const state=JSON.parse(record!.payload) as WorkspaceState;const user=memberFor(state,identity);
  return {identity,record:record!,state,user};
}
async function boundedBody(request:Request,maximum:number):Promise<Uint8Array>{
  const declared=request.headers.get('content-length');
  if(declared&&(!/^\d+$/.test(declared)||Number(declared)>maximum))fail('body_too_large','The request is too large.',413);
  if(!request.body)fail('empty_body','The request body is empty.');
  const reader=request.body!.getReader();const chunks:Uint8Array[]=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>maximum){await reader.cancel();fail('body_too_large','The request is too large.',413);}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
function imageDimensions(width:number,height:number){
  if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<1||height<1||width>8192||height>8192||width*height>16_000_000)fail('image_dimensions','Choose a photo no larger than 8192 pixels on either side and 16 megapixels in total.',415);
  return {width,height};
}
export function inspectProfilePhoto(bytes:Uint8Array,mime:string):{contentType:PhotoMetadata['contentType'];extension:string;width:number;height:number}{
  if(!bytes.byteLength||bytes.byteLength>MAX_PHOTO_BYTES)fail('photo_size','Choose a PNG, JPEG or WebP photo up to 2 MiB.',413);
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const text=(at:number,size:number)=>String.fromCharCode(...bytes.subarray(at,at+size));
  const invalid=():never=>fail('invalid_image','The file content does not match a supported PNG, JPEG or WebP photo.',415);
  if(mime==='image/png'){
    if(bytes.length<45||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||view.getUint32(8)!==13||text(12,4)!=='IHDR')invalid();
    const dimensions=imageDimensions(view.getUint32(16),view.getUint32(20));
    const validDepth:Record<number,number[]>={0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]};
    if(!validDepth[bytes[25]]?.includes(bytes[24])||bytes[26]!==0||bytes[27]!==0||bytes[28]>1)invalid();
    let offset=8;let imageData=false;let end=false;let headers=0;
    while(offset<bytes.length){
      if(offset+12>bytes.length)invalid();const size=view.getUint32(offset);const type=text(offset+4,4);if(size>bytes.length-offset-12)invalid();
      if(type==='IHDR'&&++headers>1)invalid();if(type==='acTL')fail('animated_photo','Choose a still photo instead of an animated PNG.',415);
      if(type==='IDAT'&&size>0)imageData=true;
      offset+=size+12;if(type==='IEND'){if(size!==0||offset!==bytes.length)invalid();end=true;break;}
    }
    if(!imageData||!end||headers!==1)invalid();return {contentType:'image/png',extension:'png',...dimensions};
  }
  if(mime==='image/jpeg'){
    if(bytes.length<20||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)invalid();
    let offset=2;let dimensions:{width:number;height:number}|null=null;let scan=false;
    while(offset<bytes.length-2){
      if(bytes[offset++]!==255)invalid();while(bytes[offset]===255)offset++;const marker=bytes[offset++];
      if(marker===0||marker===216||marker===217)invalid();if(marker===1||(marker>=208&&marker<=215))continue;
      if(offset+2>bytes.length)invalid();const size=view.getUint16(offset);if(size<2||offset+size>bytes.length-2)invalid();
      if([192,193,194].includes(marker)){
        if(dimensions||size<8||bytes[offset+2]!==8)invalid();const components=bytes[offset+7];if(![1,3,4].includes(components)||size!==8+3*components)invalid();
        dimensions=imageDimensions(view.getUint16(offset+5),view.getUint16(offset+3));
      } else if(marker>=192&&marker<=207&&![196,200,204].includes(marker))invalid();
      if(marker===218){if(!dimensions||size<6)invalid();scan=true;break;}offset+=size;
    }
    if(!dimensions||!scan)invalid();return {contentType:'image/jpeg',extension:'jpg',...dimensions!};
  }
  if(mime==='image/webp'){
    if(bytes.length<26||text(0,4)!=='RIFF'||text(8,4)!=='WEBP'||view.getUint32(4,true)!==bytes.length-8)invalid();
    const u24=(offset:number)=>bytes[offset]|bytes[offset+1]<<8|bytes[offset+2]<<16;
    let offset=12;let canvas:{width:number;height:number}|null=null;let image:{width:number;height:number}|null=null;
    while(offset<bytes.length){
      if(offset+8>bytes.length)invalid();const type=text(offset,4);const size=view.getUint32(offset+4,true);const at=offset+8;if(size>bytes.length-at)invalid();
      if(type==='ANIM'||type==='ANMF')fail('animated_photo','Choose a still photo instead of an animated WebP.',415);
      if(type==='VP8X'){
        if(canvas||size!==10||bytes[at]&0xc1||bytes[at+1]||bytes[at+2]||bytes[at+3])invalid();
        if(bytes[at]&2)fail('animated_photo','Choose a still photo instead of an animated WebP.',415);
        canvas=imageDimensions(u24(at+4)+1,u24(at+7)+1);
      }
      if(type==='VP8 '){
        if(image||size<10||bytes[at]&1||bytes[at+3]!==157||bytes[at+4]!==1||bytes[at+5]!==42)invalid();
        image=imageDimensions(view.getUint16(at+6,true)&0x3fff,view.getUint16(at+8,true)&0x3fff);
      }
      if(type==='VP8L'){
        if(image||size<5||bytes[at]!==47)invalid();const bits=view.getUint32(at+1,true);if(bits>>>29)invalid();
        image=imageDimensions((bits&0x3fff)+1,((bits>>>14)&0x3fff)+1);
      }
      offset=at+size+(size%2);if(offset>bytes.length)invalid();
    }
    if(!image||canvas&&(canvas.width!==image.width||canvas.height!==image.height))invalid();
    return {contentType:'image/webp',extension:'webp',...image!};
  }
  return fail('photo_type','Choose a PNG, JPEG or WebP file. SVG, GIF and remote image URLs are not supported.',415);
}
async function cleanupPhoto(bucket:R2Bucket,key:string){try{await bucket.delete(key);}catch{console.warn('Profile photo object cleanup requires a later storage check.');}}
export async function uploadProfilePhoto(request:Request):Promise<WorkspaceResponse>{
  validateSameOrigin(request);const {record,state,user}=await profileContext(request);
  const contentType=request.headers.get('content-type')||'';
  if(!/^multipart\/form-data\s*;/i.test(contentType)||!contentType.toLowerCase().includes('boundary='))fail('multipart_required','Upload a file using multipart form data.',415);
  const bytes=await boundedBody(request,MAX_PHOTO_REQUEST_BYTES);let form:FormData;
  try{form=await new Response(bytes.buffer as ArrayBuffer,{headers:{'Content-Type':contentType}}).formData();}catch{fail('invalid_upload','The photo upload form could not be read.');}
  const allowed=['file','memberId','revision'];if([...form!.keys()].some(key=>!allowed.includes(key))||allowed.some(key=>form!.getAll(key).length!==1))fail('invalid_upload','Upload exactly one file with its member and revision.');
  requireRevision(form!.get('revision'),record.revision);const target=photoTarget(state,user,form!.get('memberId'));const file=form!.get('file');
  if(!file||typeof file==='string'||typeof file.arrayBuffer!=='function')fail('file_required','Choose a local profile photo file.');
  if((file as File).size>MAX_PHOTO_BYTES)fail('photo_size','Choose a photo up to 2 MiB.',413);
  const imageBytes=new Uint8Array(await (file as File).arrayBuffer());const inspected=inspectProfilePhoto(imageBytes,(file as File).type.toLowerCase());
  const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',imageBytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const bucket=photoBucket();const key=`profile-photos/${encodeURIComponent(target.id)}/${crypto.randomUUID()}.${inspected.extension}`;
  const previous=target._profilePhoto;const uploadedAt=iso();const photo:PhotoMetadata={key,contentType:inspected.contentType,bytes:imageBytes.byteLength,width:inspected.width,height:inspected.height,sha256,uploadedAt};
  let commitAttempted=false;
  try{
    const stored=await bucket.put(key,imageBytes,{httpMetadata:{contentType:photo.contentType,cacheControl:'private, no-store'},customMetadata:{memberId:target.id,sha256}});
    if(!stored)fail('photo_storage_unavailable','The profile photo could not be stored. Please try again.',503);
    target._profilePhoto=photo;target.profileUpdatedAt=uploadedAt;
    commitAttempted=true;
    const revision=await save(state,record,user,'profile.photo.upload',target.id,{before:photoEvidence(previous),after:photoEvidence(photo)},request);
    if(previous?.key&&previous.key!==key)await cleanupPhoto(bucket,previous.key);
    return responseFor(state,user,revision);
  }catch(error){
    // A known CAS failure cannot have committed. For an ambiguous storage failure,
    // check the saved pointer before deleting a possibly committed new object.
    if(!commitAttempted||error instanceof ApiError&&(error.code==='revision_conflict'||error.code==='capacity'))await cleanupPhoto(bucket,key);
    else try{const current=await load();const currentState=current?JSON.parse(current.payload) as WorkspaceState:null;const linked=(currentState?.users.find(member=>member.id===target.id) as StoredMember|undefined)?._profilePhoto?.key===key;if(!linked)await cleanupPhoto(bucket,key);}catch{console.warn('Profile photo commit status needs verification before object cleanup.');}
    throw error;
  }
}
export async function removeProfilePhoto(request:Request):Promise<WorkspaceResponse>{
  validateWriteOrigin(request);const {record,state,user}=await profileContext(request);const bytes=await boundedBody(request,4096);let input:AnyData;
  try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('invalid_json','Send the member and current revision as JSON.');}
  if(!input!||typeof input!=='object'||Array.isArray(input)||Object.keys(input!).some(key=>!['memberId','revision'].includes(key)))fail('invalid_input','Send the member and current revision only.');
  requireRevision(input!.revision,record.revision);const target=photoTarget(state,user,input!.memberId);const previous=target._profilePhoto;
  if(!previous)return responseFor(state,user,record.revision);
  const bucket=photoBucket();delete target._profilePhoto;target.profileUpdatedAt=iso();
  const revision=await save(state,record,user,'profile.photo.remove',target.id,{before:photoEvidence(previous),after:null},request);
  await cleanupPhoto(bucket,previous.key);return responseFor(state,user,revision);
}
export async function readProfilePhoto(request:Request):Promise<Response>{
  const {state,user}=await profileContext(request);const memberId=new URL(request.url).searchParams.get('memberId')||user.id;const member=get(state.users,memberId,'Member') as StoredMember;
  if(!accountEnabled(member)&&user.role!=='admin')fail('photo_not_found','The profile photo is unavailable.',404);
  const photo=member._profilePhoto;if(!photo?.key||!photo.key.startsWith(`profile-photos/${encodeURIComponent(member.id)}/`))return fail('photo_not_found','This member has not added a profile photo.',404);
  const stored=await photoBucket().get(photo.key);if(!stored)return fail('photo_not_found','The profile photo is unavailable.',404);
  return new Response(stored.body,{headers:{'Content-Type':photo.contentType,'Content-Length':String(stored.size),'Content-Disposition':`inline; filename="profile-photo.${photo.contentType==='image/jpeg'?'jpg':photo.contentType==='image/png'?'png':'webp'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Content-Security-Policy':"default-src 'none'; sandbox",'Vary':'Cookie'}});
}
export function apiFailure(error:unknown){if(error instanceof ApiError)return Response.json({error:error.message,code:error.code},{status:error.status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});console.error('Workspace operation failed',error instanceof Error?error.name:'UnknownError');return Response.json({error:'The workspace could not complete this request. Try again shortly.',code:'internal_error'},{status:500,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});}
