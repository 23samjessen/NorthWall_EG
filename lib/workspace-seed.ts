import type { Member, WorkspaceState, Ticket } from './workspace-types';

export const defaultColumns = [
  {id:'new', name:'New', color:'#6a7583', isDone:false},
  {id:'progress', name:'In progress', color:'#bb651e', isDone:false},
  {id:'waiting', name:'Waiting', color:'#8872b8', isDone:false},
  {id:'resolved', name:'Resolved', color:'#397a66', isDone:true},
];
export function emptyState(owner: Member): WorkspaceState {
  return {users:[owner],columns:defaultColumns,customFields:[],tickets:[],comments:[],messages:[],channels:[{id:'general',name:'team',description:'Company announcements and everyday coordination'},{id:'operations',name:'operations',description:'Incidents, handovers and delivery'}],notes:[],events:[],notifications:[],rules:[],settings:{name:'NorthWallEg',timeZone:'Africa/Cairo',demo:true}};
}
export function demoState(owner: Member, now = new Date()): WorkspaceState {
  const t = now.toISOString();
  const date=(offset:number,hour=10)=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()+offset);d.setUTCHours(Math.floor(hour),Math.round((hour%1)*60),0,0);return d.toISOString();};
  const state=emptyState(owner);
  state.users.push(
    {id:'demo-nora',userId:null,name:'Nora Hassan',email:'nora@demo.invalid',role:'manager',active:true,color:'#b36a47',jobTitle:'Service delivery · sample',sample:true,createdAt:t},
    {id:'demo-omar',userId:null,name:'Omar Ali',email:'omar@demo.invalid',role:'employee',active:true,color:'#477a7c',jobTitle:'Network engineer · sample',sample:true,createdAt:t},
    {id:'demo-maya',userId:null,name:'Maya Ibrahim',email:'maya@demo.invalid',role:'employee',active:true,color:'#776b96',jobTitle:'Cloud engineer · sample',sample:true,createdAt:t}
  );
  const seeds=[
    ['MFA rollout for the finance team','Finish the pilot group, verify emergency access and document the approved rollout.','progress','high','demo-maya','Demo · Nile Studio','Cairo',1,['Microsoft 365','Identity']],
    ['Review a suspicious sign-in alert','Correlate the sign-in, device and user context before taking containment action.','new','critical',owner.id,'Demo · Delta Logistics','Remote',0,['Security','Entra ID']],
    ['Prepare branch network upgrade','Confirm the VLAN plan, maintenance window and tested rollback steps.','progress','medium','demo-omar','Demo · Nile Studio','Giza',3,['Networks','Change']],
    ['OneDrive sync issue on design laptops','Collect the sync error codes, verify storage and resolve the affected libraries.','new','medium','demo-maya','Demo · Horizon Design','Alexandria',2,['Support','OneDrive']],
    ['Review supplier access','Waiting for the customer to confirm access owners and removal dates.','waiting','high','demo-nora','Demo · Delta Logistics','Remote',4,['Access review','GRC']],
    ['Update the new starter checklist','Confirm licenses, device enrollment and the handover notes for the next cohort.','progress','low','demo-nora','Demo · NorthWallEg','Cairo',5,['Onboarding','Operations']],
    ['Test the backup restore procedure','An example completed ticket. The record is illustrative and is not evidence of a real restore test.','resolved','high','demo-omar','Demo · Nile Studio','Cairo',-1,['Backup','Recovery']],
    ['Publish the website accessibility updates','Example delivery completed. Review keyboard navigation and mobile contact flow.','resolved','medium',owner.id,'Demo · Horizon Design','Remote',-2,['Web','Delivery']],
    ['Create the incident contact tree','Document the customer-approved contacts and escalation responsibilities.','waiting','medium','demo-nora','Demo · Delta Logistics','Remote',6,['Incident response']],
    ['Investigate Teams meeting audio','Collect device and meeting diagnostics before changing client settings.','new','low','demo-maya','Demo · Nile Studio','Cairo',3,['Teams','Support']],
    ['Validate VPN certificate renewal','Prepare the certificate renewal, maintenance window and rollback plan.','progress','high','demo-omar','Demo · Delta Logistics','Giza',2,['VPN','Certificates']],
    ['Document the SharePoint permissions review','Example completion record for the sample knowledge base.','resolved','medium',owner.id,'Demo · Horizon Design','Remote',-3,['SharePoint','Access review']],
  ];
  state.tickets=seeds.map((s,i)=>({id:`ticket-${i+1}`,key:`NW-${String(101+i)}`,title:s[0],description:s[1],status:s[2],priority:s[3],assigneeId:s[4],reporterId:owner.id,customer:s[5],location:s[6],dueDate:date(s[7] as number),tags:s[8],checklist:[{id:`check-${i}-1`,text:'Confirm the scope and owner',done:i%3===0},{id:`check-${i}-2`,text:'Record checks and evidence',done:s[2]==='resolved'},{id:`check-${i}-3`,text:'Document the handover',done:s[2]==='resolved'}],customFields:{},createdAt:date(-4),updatedAt:date(-1),archived:false,sample:true})) as Ticket[];
  state.comments=[{id:'comment-sample-1',ticketId:'ticket-1',authorId:'demo-maya',body:'Pilot group is ready. Please review the rollout checklist before the next change window. (Sample discussion)',replyToId:null,mentions:[owner.id],reactions:[{emoji:'👍',userIds:['demo-nora']}],createdAt:date(-1,9),updatedAt:date(-1,9)},{id:'comment-sample-2',ticketId:'ticket-1',authorId:owner.id,body:'Thanks, I will review the recovery and emergency-access steps. (Sample reply)',replyToId:'comment-sample-1',mentions:[],reactions:[],createdAt:date(-1,10),updatedAt:date(-1,10)}];
  state.messages=[
    {id:'message-sample-1',channelId:'general',authorId:'demo-nora',recipientId:null,body:'Welcome to the NorthWallEg workspace. Today’s handover and priorities are on the board. (Sample message)',replyToId:null,mentions:[],reactions:[{emoji:'👋',userIds:['demo-omar','demo-maya']}],createdAt:date(0,8),updatedAt:date(0,8),pinned:true},
    {id:'message-sample-2',channelId:'operations',authorId:'demo-omar',recipientId:null,body:'Branch network plan is ready for review. The maintenance window is in the calendar. (Sample message)',replyToId:null,mentions:[owner.id],reactions:[],createdAt:date(0,9),updatedAt:date(0,9),pinned:false}
  ];
  state.notes=[{id:'note-1',title:'Morning handover',body:'Review new incidents\nConfirm customer commitments\nCheck today’s change windows\nUpdate tickets before the afternoon handover\n\nSample team note.',ownerId:owner.id,visibility:'team',color:'sand',pinned:true,createdAt:t,updatedAt:t},{id:'note-2',title:'My focus for this week',body:'Review the demo board and customize the columns for our actual process.\n\nThis is a private sample note.',ownerId:owner.id,visibility:'private',color:'blue',pinned:false,createdAt:t,updatedAt:t}];
  state.events=[{id:'event-1',title:'Team delivery check-in · sample',description:'Priorities, blockers and customer follow-up.',start:date(1,8),end:date(1,8.5),location:'Cairo / online',attendeeIds:state.users.map(u=>u.id),ownerId:owner.id,type:'meeting',createdAt:t,updatedAt:t},{id:'event-2',title:'Branch upgrade window · sample',description:'Review approved changes and rollback ownership.',start:date(3,17),end:date(3,19),location:'Giza',attendeeIds:['demo-omar',owner.id],ownerId:owner.id,type:'maintenance',createdAt:t,updatedAt:t}];
  state.notifications=[{id:'notification-1',userId:owner.id,title:'Sample workspace is ready',body:'These customers, people and tickets are illustrative. The owner invites real employees through Administration, then approves access after each person accepts.',kind:'info',objectId:null,read:false,createdAt:t},{id:'notification-2',userId:owner.id,title:'You were mentioned in NW-101',body:'Maya asked for a review of the rollout checklist. Sample notification.',kind:'mention',objectId:'ticket-1',read:false,createdAt:t}];
  state.customFields=[{id:'field-reference',name:'Customer reference',type:'text',options:[],required:false}];
  state.rules=[{id:'rule-urgent',name:'Notify admin about critical tickets',enabled:true,trigger:'ticket.created',priority:'critical',assignToId:null,moveToId:null,notifyUserIds:[owner.id]}];
  return state;
}
