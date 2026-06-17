// Probe write access across candidate calendars using the env SA secret.
import crypto from "node:crypto";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_SCOPE = "https://www.googleapis.com/auth/calendar";
const REAGAN = "o81tqeb4425ej2k9il7lhmooh4@group.calendar.google.com";

function b64url(i){return Buffer.from(i).toString("base64").replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");}
async function mint(sa){
  const now=Math.floor(Date.now()/1000);
  const unsigned=`${b64url(JSON.stringify({alg:"RS256",typ:"JWT"}))}.${b64url(JSON.stringify({iss:sa.client_email,scope:CAL_SCOPE,aud:TOKEN_URL,iat:now,exp:now+3600}))}`;
  const s=crypto.createSign("RSA-SHA256");s.update(unsigned);s.end();
  const sig=b64url(s.sign(sa.private_key.replace(/\\n/g,"\n")));
  const r=await fetch(TOKEN_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:`${unsigned}.${sig}`}).toString()});
  const j=await r.json(); if(!r.ok||!j.access_token) throw new Error("mint "+r.status+" "+JSON.stringify(j)); return j.access_token;
}
async function probe(token,id){
  const ins=await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events`,{method:"POST",headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},body:JSON.stringify({summary:"[probe] auto-delete",start:{dateTime:"2026-06-20T07:30:00-04:00"},end:{dateTime:"2026-06-20T07:35:00-04:00"}})});
  const j=await ins.json();
  if(ins.ok&&j.id){await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events/${j.id}`,{method:"DELETE",headers:{Authorization:`Bearer ${token}`}});return `WRITABLE`;}
  return `${ins.status} ${j.error?.message||""}`.trim();
}
async function main(){
  const sa=JSON.parse((process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON||"").trim());
  const token=await mint(sa);
  // List any calendars the SA can see (it owns none, but shared ones may appear).
  const lr=await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList",{headers:{Authorization:`Bearer ${token}`}});
  const lj=await lr.json();
  const shared=(lj.items||[]).map(c=>({id:c.id,role:c.accessRole,summary:c.summary}));
  console.log("calendarList:",lr.status,JSON.stringify(shared));
  const candidates=[REAGAN,"primary",...shared.map(s=>s.id)];
  const seen=new Set();
  for(const id of candidates){ if(seen.has(id))continue; seen.add(id);
    try{console.log(`probe ${id}: ${await probe(token,id)}`);}catch(e){console.log(`probe ${id}: ERR ${e.message}`);}
  }
  process.exit(0);
}
main().catch(e=>{console.error("ERROR",e.message);process.exit(1);});
