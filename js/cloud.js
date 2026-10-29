/* My Wardrobe Stage 4.2 — Appwrite adapter. No server API keys belong here. */
(() => {
  'use strict';
  const A = window.Appwrite;
  const client = new A.Client().setEndpoint('https://fra.cloud.appwrite.io/v1').setProject('6ae1475800005a49aa07');
  const account = new A.Account(client), db = new A.TablesDB(client), storage = new A.Storage(client);
  const DATABASE='wardrobe_db', BUCKET='clothing_photos';
  const KEY='wardrobe-prototype-v1';
  const tables={sections:'wardrobe_sections',items:'clothing_items',history:'laundry_history',details:'clothing_details',categories:'wardrobe_category_settings'};
  const $=s=>document.querySelector(s);
  let user=null, ready=false, busy=false, pending=false, timer=null, lastSnapshot=null;
  let cloudIds={sections:new Set(),items:new Set(),details:new Set()};
  const notice=(message,error=false)=>{const el=$('#cloud-notice');el.textContent=message;el.classList.toggle('error',error)};
  const safe=x=>String(x??'');
  const perms=()=>[A.Permission.read(A.Role.user(user.$id)),A.Permission.update(A.Role.user(user.$id)),A.Permission.delete(A.Role.user(user.$id))];
  const parse=()=>JSON.parse(localStorage.getItem(KEY)||'{"sections":[],"items":[]}');
  const clone=x=>JSON.parse(JSON.stringify(x));
  const id=()=>A.ID.unique();
  const fileFromData=(data,name)=>{const [header,b64]=data.split(',');const mime=(header.match(/data:([^;]+)/)||[])[1]||'image/jpeg';const bytes=atob(b64),arr=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)arr[i]=bytes.charCodeAt(i);return new File([arr],name,{type:mime})};
  async function uploadPhoto(data){
    if(!data?.startsWith('data:image/'))return null;
    const file=fileFromData(data,'wardrobe-'+Date.now()+'.jpg');
    const fileId=id();
    const uploaded=await storage.createFile({bucketId:BUCKET,fileId,file,permissions:perms()});
    if(!uploaded?.$id)throw Error('Storage did not return a file ID');
    // Verify the file is actually readable before recording its ID in the database.
    const confirmed=await storage.getFile({bucketId:BUCKET,fileId:uploaded.$id});
    if(confirmed.$id!==uploaded.$id)throw Error('Uploaded photograph could not be verified');
    return uploaded.$id;
  }
  async function photoUrl(fileId){
    if(!fileId)return null;
    try{
      // The Web SDK returns a URL here, not authenticated image bytes. A bare
      // fetch of that URL can fail on Safari when third-party cookies are blocked.
      // A short-lived user JWT preserves the existing private file permissions.
      const token=await account.createJWT();
      const url=storage.getFileView({bucketId:BUCKET,fileId});
      const response=await fetch(url,{
        headers:{'X-Appwrite-Project':'6ae1475800005a49aa07','X-Appwrite-JWT':token.jwt},
        cache:'no-store'
      });
      if(!response.ok)throw Error('Photo request returned '+response.status);
      const blob=await response.blob();
      if(!blob.type.startsWith('image/'))throw Error('Storage returned non-image data');
      return URL.createObjectURL(blob);
    }catch(e){console.warn('Photo could not load',fileId,e);return null}
  }
  async function allRows(tableId){let rows=[],offset=0;while(true){const page=await db.listRows({databaseId:DATABASE,tableId,queries:[A.Query.limit(100),A.Query.offset(offset)]});rows.push(...page.rows);if(page.rows.length<100)break;offset+=page.rows.length}return rows}
  const sectionData=s=>({owner_id:user.$id,name:safe(s.name),section_type:safe(s.type),x:Number(s.x)||0,y:Number(s.y)||0,width:Number(s.w)||12,height:Number(s.h)||9});
  const itemData=x=>({owner_id:user.$id,name:safe(x.name),category:safe(x.category),colour:safe(x.colour),status:safe(x.status),section_id:safe(x.section)||null,photo_id:safe(x.photo_id)||null,notes:safe(x.notes)||null});
  async function upsert(tableId,rowId,data,exists){if(exists)return db.updateRow({databaseId:DATABASE,tableId,rowId,data});return db.createRow({databaseId:DATABASE,tableId,rowId,data,permissions:perms()})}
  async function history(itemId,oldStatus,newStatus){await db.createRow({databaseId:DATABASE,tableId:tables.history,rowId:id(),data:{owner_id:user.$id,clothing_id:itemId,previous_status:oldStatus||null,new_status:newStatus,changed_at:new Date().toISOString()},permissions:perms()})}
  async function pull(){notice('Loading your cloud wardrobe…');const [sections,items,details,categoryRows]=await Promise.all([allRows(tables.sections),allRows(tables.items),allRows(tables.details),allRows(tables.categories)]);cloudIds={sections:new Set(sections.map(s=>s.$id)),items:new Set(items.map(x=>x.$id)),details:new Set(details.map(x=>x.$id))};const detailMap=new Map(details.filter(d=>d.owner_id===user.$id).map(d=>[d.clothing_id,d]));const categoryRow=categoryRows.find(x=>x.owner_id===user.$id);cloudIds.categoriesExists=!!categoryRow;if(categoryRow){try{window.wardrobeCategories?.replace(JSON.parse(categoryRow.payload))}catch(e){console.warn('Invalid category settings',e)}}const output={sections:sections.map(s=>({id:s.$id,name:s.name,type:s.section_type,x:s.x,y:s.y,w:s.width,h:s.height})),items:[]};for(const x of items){output.items.push({id:x.$id,name:x.name,category:x.category,colour:x.colour||'',status:x.status,section:x.section_id||'',notes:x.notes||'',photo_id:x.photo_id||null,photo:await photoUrl(x.photo_id),...JSON.parse(detailMap.get(x.$id)?.payload||'{}')})}localStorage.setItem(KEY,JSON.stringify(output));lastSnapshot=clone(output);ready=true;window.dispatchEvent(new Event('wardrobe-cloud-loaded'));notice('Cloud connected · '+output.items.length+' clothing items');$('#cloud-actions').hidden=false}
  async function push(){if(!ready||!user)return;if(busy){pending=true;return}busy=true;try{const s=parse();const currentSectionIds=new Set(s.sections.map(x=>x.id)),currentItemIds=new Set(s.items.map(x=>x.id));
    // Save sections first, so clothing location references remain valid.
    for(const section of s.sections){await upsert(tables.sections,section.id,sectionData(section),cloudIds.sections.has(section.id));cloudIds.sections.add(section.id)}
    for(const item of s.items){
      // A data URL is the actual photograph. Never discard it until upload and
      // verification succeed. Older builds could leave stale photo_id values.
      if(item.photo?.startsWith('data:image/')){
        const uploadedId=await uploadPhoto(item.photo);
        item.photo_id=uploadedId;
        const live=parse();const target=live.items.find(x=>x.id===item.id);
        if(target){target.photo_id=uploadedId;target.photo=null;localStorage.setItem(KEY,JSON.stringify(live))}
      }
      const old=lastSnapshot?.items?.find(x=>x.id===item.id);
      await upsert(tables.items,item.id,itemData(item),cloudIds.items.has(item.id));
      cloudIds.items.add(item.id);
      const detail={subcategory:item.subcategory||'',brand:item.brand||'',size:item.size||'',material:item.material||'',fit:item.fit||'',season:item.season||[],occasion:item.occasion||[],purchaseDate:item.purchaseDate||'',purchasePrice:item.purchasePrice??null};
      await upsert(tables.details,item.id,{owner_id:user.$id,clothing_id:item.id,payload:JSON.stringify(detail)},cloudIds.details.has(item.id));cloudIds.details.add(item.id);
      if(old&&old.status!==item.status)await history(item.id,old.status,item.status);
    }
    for(const existing of [...cloudIds.items])if(!currentItemIds.has(existing)){await db.deleteRow({databaseId:DATABASE,tableId:tables.items,rowId:existing});cloudIds.items.delete(existing);if(cloudIds.details.has(existing)){await db.deleteRow({databaseId:DATABASE,tableId:tables.details,rowId:existing});cloudIds.details.delete(existing)}}
    for(const existing of [...cloudIds.sections])if(!currentSectionIds.has(existing)){await db.deleteRow({databaseId:DATABASE,tableId:tables.sections,rowId:existing});cloudIds.sections.delete(existing)}
    // Clean up unused photos after the database changes have been saved.
    // Failures here do not invalidate the saved clothing changes.
    const beforeIds=new Set((lastSnapshot?.items||[]).map(x=>x.photo_id).filter(Boolean));
    const afterIds=new Set(parse().items.map(x=>x.photo_id).filter(Boolean));
    for(const photoId of beforeIds){if(!afterIds.has(photoId)){
      try{await storage.deleteFile({bucketId:BUCKET,fileId:photoId})}
      catch(error){console.warn('Photo cleanup failed',photoId,error)}
    }}
    const catPayload=JSON.stringify(window.wardrobeCategories?.all()||{});await upsert(tables.categories,'categories_'+user.$id,{owner_id:user.$id,payload:catPayload},cloudIds.categoriesExists);cloudIds.categoriesExists=true;lastSnapshot=clone(parse());notice('All changes saved to Appwrite');
  }catch(e){console.error(e);notice('Cloud save failed: '+(e.message||e),true)}finally{busy=false;if(pending){pending=false;setTimeout(push,150)}}}
  function schedule(){if(!ready)return;clearTimeout(timer);notice('Saving changes…');timer=setTimeout(push,650)}
  async function importLocal(){if(!ready)return;const raw=localStorage.getItem('wardrobe-stage4-local-backup');if(!raw)return notice('No local backup found',true);let data;try{data=JSON.parse(raw)}catch{return notice('Local backup could not be read',true)}if(!Array.isArray(data.items)||!Array.isArray(data.sections))return notice('Local backup is invalid',true);
    if(!confirm('Import your original local wardrobe into this account? This ADDS its clothing and sections to your cloud wardrobe. Sample items will also be imported if present.'))return;
    notice('Importing your local wardrobe…');try{const current=parse(),map=new Map();for(const s of data.sections){const newId=id();map.set(s.id,newId);current.sections.push({...s,id:newId})}for(const x of data.items)current.items.push({...x,id:id(),section:map.get(x.section)||''});localStorage.setItem(KEY,JSON.stringify(current));await push();if($('#cloud-notice').classList.contains('error'))return;await pull();notice('Local wardrobe imported successfully')}catch(e){notice('Import failed: '+e.message,true)}}
  async function signIn(email,password,register){notice(register?'Creating account…':'Signing in…');try{if(register)await account.create({userId:id(),email,password});await account.createEmailPasswordSession({email,password});await initialize()}catch(e){notice(e.message||'Authentication failed',true)}}
  async function initialize(){user=await account.get();$('#auth-screen').hidden=true;$('#cloud-user').textContent=user.email;$('#cloud-user').hidden=false;$('#cloud-logout').hidden=false;const backupKey='wardrobe-stage4-local-backup';if(!localStorage.getItem(backupKey)){const original=localStorage.getItem(KEY);if(original)localStorage.setItem(backupKey,original)}await pull()}
  async function logout(){if(!confirm('Sign out? Your cloud wardrobe remains saved.'))return;ready=false;await account.deleteSession({sessionId:'current'});user=null;$('#auth-screen').hidden=false;$('#cloud-logout').hidden=true;$('#cloud-user').hidden=true;$('#cloud-actions').hidden=true;notice('Signed out')}
  document.addEventListener('DOMContentLoaded',async()=>{
    $('#auth-form').addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(e.target);await signIn(safe(f.get('email')).trim(),safe(f.get('password')),e.submitter?.value==='register')});
    $('#cloud-logout').addEventListener('click',logout);
    $('#cloud-import').addEventListener('click',importLocal);
    $('#cloud-refresh').addEventListener('click',async()=>{if(!confirm('Reload from Appwrite? Unsaved local changes may be lost.'))return;try{ready=false;await pull()}catch(e){notice(e.message,true)}});
    window.addEventListener('wardrobe-local-changed',schedule);window.addEventListener('wardrobe-categories-changed',schedule);
    try{await initialize()}catch(e){$('#auth-screen').hidden=false;notice('Sign in to connect your wardrobe')}
  });
  window.WardrobeCloud={get active(){return ready},uploadPhoto};
})();
