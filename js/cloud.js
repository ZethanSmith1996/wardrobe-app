/* My Wardrobe Stage 4.2 — Appwrite adapter. No server API keys belong here. */
(() => {
  'use strict';
  const A = window.Appwrite;
  const client = new A.Client().setEndpoint('https://fra.cloud.appwrite.io/v1').setProject('6ae1475800005a49aa07');
  const account = new A.Account(client), db = new A.TablesDB(client), storage = new A.Storage(client);
  const DATABASE='wardrobe_db', BUCKET='clothing_photos';
  const KEY='wardrobe-prototype-v1';
  const tables={sections:'wardrobe_sections',items:'clothing_items',history:'laundry_history'};
  const $=s=>document.querySelector(s);
  let user=null, ready=false, busy=false, pending=false, timer=null, lastSnapshot=null;
  let cloudIds={sections:new Set(),items:new Set()};
  const notice=(message,error=false)=>{const el=$('#cloud-notice');el.textContent=message;el.classList.toggle('error',error)};
  const safe=x=>String(x??'');
  const perms=()=>[A.Permission.read(A.Role.user(user.$id)),A.Permission.update(A.Role.user(user.$id)),A.Permission.delete(A.Role.user(user.$id))];
  const parse=()=>JSON.parse(localStorage.getItem(KEY)||'{"sections":[],"items":[]}');
  const clone=x=>JSON.parse(JSON.stringify(x));
  const id=()=>A.ID.unique();
  const fileFromData=(data,name)=>{const [header,b64]=data.split(',');const mime=(header.match(/data:([^;]+)/)||[])[1]||'image/jpeg';const bytes=atob(b64),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new File([arr],name,{type:mime})};
  async function uploadPhoto(data){if(!data?.startsWith('data:image/'))return null;const file=fileFromData(data,'wardrobe-'+Date.now()+'.jpg');const r=await storage.createFile({bucketId:BUCKET,fileId:id(),file,permissions:perms()});return r.$id}
  async function photoUrl(fileId){if(!fileId)return null;try{const response=await storage.getFileDownload({bucketId:BUCKET,fileId});const result=await fetch(response,{credentials:'include'});if(!result.ok)throw Error('Photo access failed');return URL.createObjectURL(await result.blob())}catch(e){console.warn('Photo could not load',e);return null}}
  async function allRows(tableId){let rows=[],offset=0;while(true){const page=await db.listRows({databaseId:DATABASE,tableId,queries:[A.Query.limit(100),A.Query.offset(offset)]});rows.push(...page.rows);if(page.rows.length<100)break;offset+=page.rows.length}return rows}
  const sectionData=s=>({owner_id:user.$id,name:safe(s.name),section_type:safe(s.type),x:Number(s.x)||0,y:Number(s.y)||0,width:Number(s.w)||12,height:Number(s.h)||9});
  const itemData=x=>({owner_id:user.$id,name:safe(x.name),category:safe(x.category),colour:safe(x.colour),status:safe(x.status),section_id:safe(x.section)||null,photo_id:safe(x.photo_id)||null,notes:safe(x.notes)||null});
  async function upsert(tableId,rowId,data,exists){if(exists)return db.updateRow({databaseId:DATABASE,tableId,rowId,data});return db.createRow({databaseId:DATABASE,tableId,rowId,data,permissions:perms()})}
  async function history(itemId,oldStatus,newStatus){await db.createRow({databaseId:DATABASE,tableId:tables.history,rowId:id(),data:{owner_id:user.$id,clothing_id:itemId,previous_status:oldStatus||null,new_status:newStatus,changed_at:new Date().toISOString()},permissions:perms()})}
  async function pull(){notice('Loading your cloud wardrobe…');const [sections,items]=await Promise.all([allRows(tables.sections),allRows(tables.items)]);cloudIds={sections:new Set(sections.map(s=>s.$id)),items:new Set(items.map(x=>x.$id))};const output={sections:sections.map(s=>({id:s.$id,name:s.name,type:s.section_type,x:s.x,y:s.y,w:s.width,h:s.height})),items:[]};for(const x of items){output.items.push({id:x.$id,name:x.name,category:x.category,colour:x.colour||'',status:x.status,section:x.section_id||'',photo_id:x.photo_id||null,photo:await photoUrl(x.photo_id)})}localStorage.setItem(KEY,JSON.stringify(output));lastSnapshot=clone(output);ready=true;window.dispatchEvent(new Event('wardrobe-cloud-loaded'));notice('Cloud connected · '+output.items.length+' clothing items');$('#cloud-actions').hidden=false}
  async function push(){if(!ready||!user)return;if(busy){pending=true;return}busy=true;try{const s=parse();const currentSectionIds=new Set(s.sections.map(x=>x.id)),currentItemIds=new Set(s.items.map(x=>x.id));
    // Save sections first, so clothing location references remain valid.
    for(const section of s.sections){await upsert(tables.sections,section.id,sectionData(section),cloudIds.sections.has(section.id));cloudIds.sections.add(section.id)}
    for(const item of s.items){if(item.photo?.startsWith('data:image/')&&!item.photo_id){item.photo_id=await uploadPhoto(item.photo);item.photo=null;const live=parse();const target=live.items.find(x=>x.id===item.id);if(target){target.photo_id=item.photo_id;target.photo=null;localStorage.setItem(KEY,JSON.stringify(live))}}
      const old=lastSnapshot?.items?.find(x=>x.id===item.id);await upsert(tables.items,item.id,itemData(item),cloudIds.items.has(item.id));cloudIds.items.add(item.id);if(old&&old.status!==item.status)await history(item.id,old.status,item.status);
    }
    for(const existing of [...cloudIds.items])if(!currentItemIds.has(existing)){await db.deleteRow({databaseId:DATABASE,tableId:tables.items,rowId:existing});cloudIds.items.delete(existing)}
    for(const existing of [...cloudIds.sections])if(!currentSectionIds.has(existing)){await db.deleteRow({databaseId:DATABASE,tableId:tables.sections,rowId:existing});cloudIds.sections.delete(existing)}
    lastSnapshot=clone(parse());notice('All changes saved to Appwrite');
  }catch(e){console.error(e);notice('Cloud save failed: '+(e.message||e),true)}finally{busy=false;if(pending){pending=false;setTimeout(push,150)}}}
  function schedule(){if(!ready)return;clearTimeout(timer);notice('Saving changes…');timer=setTimeout(push,650)}
  async function importLocal(){if(!ready)return;const raw=localStorage.getItem('wardrobe-stage4-local-backup');if(!raw)return notice('No local backup found',true);let data;try{data=JSON.parse(raw)}catch{return notice('Local backup could not be read',true)}if(!Array.isArray(data.items)||!Array.isArray(data.sections))return notice('Local backup is invalid',true);
    if(!confirm('Import your original local wardrobe into this account? This ADDS its clothing and sections to your cloud wardrobe. Sample items will also be imported if present.'))return;
    notice('Importing your local wardrobe…');try{const current=parse(),map=new Map();for(const s of data.sections){const newId=id();map.set(s.id,newId);current.sections.push({...s,id:newId})}for(const x of data.items)current.items.push({...x,id:id(),section:map.get(x.section)||''});localStorage.setItem(KEY,JSON.stringify(current));await push();await pull();notice('Local wardrobe imported successfully')}catch(e){notice('Import failed: '+e.message,true)}}
  async function signIn(email,password,register){notice(register?'Creating account…':'Signing in…');try{if(register)await account.create({userId:id(),email,password});await account.createEmailPasswordSession({email,password});await initialize()}catch(e){notice(e.message||'Authentication failed',true)}}
  async function initialize(){user=await account.get();$('#auth-screen').hidden=true;$('#cloud-user').textContent=user.email;$('#cloud-user').hidden=false;$('#cloud-logout').hidden=false;const backupKey='wardrobe-stage4-local-backup';if(!localStorage.getItem(backupKey)){const original=localStorage.getItem(KEY);if(original)localStorage.setItem(backupKey,original)}await pull()}
  async function logout(){if(!confirm('Sign out? Your cloud wardrobe remains saved.'))return;ready=false;await account.deleteSession({sessionId:'current'});user=null;$('#auth-screen').hidden=false;$('#cloud-logout').hidden=true;$('#cloud-user').hidden=true;$('#cloud-actions').hidden=true;notice('Signed out')}
  document.addEventListener('DOMContentLoaded',async()=>{
    $('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);await signIn(safe(f.get('email')).trim(),safe(f.get('password')),e.submitter?.value==='register')});
    $('#cloud-logout').addEventListener('click',logout);
    $('#cloud-import').addEventListener('click',importLocal);
    $('#cloud-refresh').addEventListener('click',async()=>{if(!confirm('Reload from Appwrite? Unsaved local changes may be lost.'))return;try{ready=false;await pull()}catch(e){notice(e.message,true)}});
    window.addEventListener('wardrobe-local-changed',schedule);
    try{await initialize()}catch(e){$('#auth-screen').hidden=false;notice('Sign in to connect your wardrobe')}
  });
  window.WardrobeCloud={get active(){return ready},uploadPhoto};
})();
