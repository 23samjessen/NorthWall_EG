// Transactional in-memory persistence for testing the real auth service only.
// This contains storage primitives, not a second authentication implementation.
export class MemoryAuthStore {
  constructor() {
    this.data={accounts:new Map(),flows:new Map(),sessions:new Map(),limits:new Map(),events:[]};
    this.tail=Promise.resolve();
    this.failNextCommit=false;
  }
  async readAccountByEmail(email) { await this.tail; return structuredClone([...this.data.accounts.values()].find(a=>a.email===email)||null); }
  async readAccountById(id) { await this.tail; return structuredClone(this.data.accounts.get(id)||null); }
  async readFlow(hash) { await this.tail; return structuredClone(this.data.flows.get(hash)||null); }
  async readSession(hash) { await this.tail; return structuredClone(this.data.sessions.get(hash)||null); }
  async transaction(callback) {
    const previous=this.tail; let release;
    this.tail=new Promise(resolve=>{release=resolve;});
    await previous;
    const snapshot=structuredClone(this.data);
    const copy=value=>structuredClone(value||null);
    const tx={
      connection:{isolatedTestTransaction:true},
      accountByEmail:async email=>copy([...this.data.accounts.values()].find(a=>a.email===email)),
      accountById:async id=>copy(this.data.accounts.get(id)),
      insertAccount:async a=>{ if([...this.data.accounts.values()].some(x=>x.email===a.email||x.userId===a.userId)) throw new Error('Duplicate account'); this.data.accounts.set(a.id,copy(a)); },
      updateAccount:async a=>{this.data.accounts.set(a.id,copy(a));},
      flowByHash:async hash=>copy(this.data.flows.get(hash)),
      insertFlow:async f=>{this.data.flows.set(f.tokenHash,copy(f));},
      updateFlow:async f=>{for(const [key,value] of this.data.flows)if(value.id===f.id)this.data.flows.delete(key);this.data.flows.set(f.tokenHash,copy(f));},
      deleteFlow:async hash=>{this.data.flows.delete(hash);},
      deleteFlowsForEmail:async email=>{for(const [key,value]of this.data.flows)if(value.email===email)this.data.flows.delete(key);},
      deleteFlowsForAccount:async id=>{for(const [key,value]of this.data.flows)if(value.accountId===id)this.data.flows.delete(key);},
      sessionByHash:async hash=>copy(this.data.sessions.get(hash)),
      insertSession:async s=>{this.data.sessions.set(s.tokenHash,copy(s));},
      touchSession:async(hash,time)=>{this.data.sessions.get(hash).lastSeenAt=time;},
      deleteSession:async hash=>{this.data.sessions.delete(hash);},
      revokeSessions:async id=>{for(const [key,value]of this.data.sessions)if(value.accountId===id)this.data.sessions.delete(key);},
      rate:async(key,limit,window,now)=>{
        let row=this.data.limits.get(key);
        if(!row||row.expiresAt<=now){row={attempts:1,expiresAt:now+window};this.data.limits.set(key,row);return{allowed:true,retryAt:row.expiresAt};}
        if(row.attempts>=limit)return{allowed:false,retryAt:row.expiresAt};
        row.attempts++;return{allowed:true,retryAt:row.expiresAt};
      },
      event:async e=>{this.data.events.push(copy(e));},
    };
    try { const result=await callback(tx);if(this.failNextCommit){this.failNextCommit=false;throw new Error('Injected transaction failure');}return result; }
    catch(error){this.data=snapshot;throw error;}
    finally{release();}
  }
  async cleanup(now,retention) {
    await this.tail;
    for(const [key,f]of this.data.flows)if(f.expiresAt<now)this.data.flows.delete(key);
    for(const [key,s]of this.data.sessions)if(s.absoluteExpiresAt<now||s.lastSeenAt+1800000<now)this.data.sessions.delete(key);
    for(const [key,r]of this.data.limits)if(r.expiresAt<now)this.data.limits.delete(key);
    this.data.events=this.data.events.filter(e=>e.createdAt>=now-retention);
  }
}
