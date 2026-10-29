/* Stage 5.5.1: per-user Appwrite room state. Requires wardrobe_room_state table. */
(()=>{'use strict';
const A=window.Appwrite, status=document.getElementById('roomCloudStatus');
if(!A){status.textContent='Appwrite SDK unavailable. Room remains saved locally.';return}
const client=new A.Client().setEndpoint('https://fra.cloud.appwrite.io/v1').setProject('6ae1475800005a49aa07');
const account=new A.Account(client),db=new A.TablesDB(client);
const DATABASE='wardrobe_db',TABLE='wardrobe_room_state';
const keys={room:'my-wardrobe-room-v1',furniture:'my-wardrobe-furniture-v1',appearance:'my-wardrobe-appearance-v1'};
const defaults={room:{length:2.38,width:1.98,height:2.61,doorWidth:.76,doorWall:'south',doorOffset:.61},furniture:[],appearance:{finish:'oak',flooring:'oak',wallColour:'cream',lighting:'warm',led:true,shadows:true,showGarments:true}};
let user=null,connected=false,saving=false,pending=false,timer=null,cloudVersion=null;
const el=id=>document.getElementById(id);
function message(s,error=false){status.textContent=s;status.style.color=error?'#f3a9a9':''}
function readLocal(){const result={};for(const [name,key] of Object.entries(keys)){try{result[name]=JSON.parse(localStorage.getItem(key)||'null')??defaults[name]}catch{result[name]=defaults[name]}}return result}
function applyLocal(data){if(!data||typeof data!=='object'||!Array.isArray(data.furniture)||!data.room||!data.appearance)throw Error('Invalid room data');
 for(const [name,key] of Object.entries(keys))localStorage.setItem(key,JSON.stringify(data[name]));
 window.roomDesigner?.reload();window.wardrobeFurniture?.reload();window.wardrobeAppearance?.reload();renderCompartments()}
const rowId=()=> 'room_'+user.$id;
function permissions(){return [A.Permission.read(A.Role.user(user.$id)),A.Permission.update(A.Role.user(user.$id)),A.Permission.delete(A.Role.user(user.$id))]}
async function getRow(){try{return await db.getRow({databaseId:DATABASE,tableId:TABLE,rowId:rowId()})}catch(e){if(e.code===404)return null;throw e}}
function renderCompartments(){
 const target=el('compartmentList'),entries=window.wardrobeFurniture?.getCompartments()||[];
 target.replaceChildren();el('compartmentCount').textContent=entries.length+' locations';
 if(!entries.length){target.textContent='Add rails, shelves or drawers to create storage locations.';return}
 for(const c of entries){const li=document.createElement('li');li.textContent=c.label;const small=document.createElement('small');small.textContent=' · ID '+c.id;li.appendChild(small);target.appendChild(li)}
}
async function saveCloud(){
 if(!connected||!user)return;if(saving){pending=true;return}
 saving=true;message('Saving room to Appwrite…');
 try{
  const payload=JSON.stringify({schema:1,...readLocal()});
  const data={owner_id:user.$id,payload};
  const args={databaseId:DATABASE,tableId:TABLE,rowId:rowId()};
  if(cloudVersion===null){const row=await db.createRow({...args,data,permissions:permissions()});cloudVersion=row.$updatedAt}
  else{const row=await db.updateRow({...args,data});cloudVersion=row.$updatedAt}
  message('Room, furniture and appearance saved to Appwrite.');
 }catch(e){message('Cloud save failed: '+(e.message||e),true);console.error(e)}
 finally{saving=false;if(pending){pending=false;setTimeout(saveCloud,200)}}
}
function schedule(){renderCompartments();if(!connected)return;clearTimeout(timer);timer=setTimeout(saveCloud,1000)}
async function connect(){
 message('Connecting to your Appwrite account…');
 try{
  user=await account.get();const row=await getRow();
  if(row){if(row.owner_id!==user.$id)throw Error('Room belongs to another user');
   const remote=JSON.parse(row.payload);applyLocal(remote);cloudVersion=row.$updatedAt;message('Cloud room loaded. Changes now sync automatically.');
  }else{
   cloudVersion=null;message('No cloud room yet. Upload this device’s layout to start syncing.');
   el('roomUpload').hidden=false;
  }
  connected=true;el('roomReload').hidden=false;el('roomUpload').hidden=false;renderCompartments();
 }catch(e){message('Cloud unavailable: '+(e.message||e)+'. Sign in on the Wardrobe page first; your room is still saved locally.',true)}
}
el('roomUpload').onclick=()=>{if(confirm('Upload this device’s room and replace the cloud version?'))saveCloud()};
el('roomReload').onclick=async()=>{if(!confirm('Replace this device’s room with the saved cloud layout?'))return;try{const row=await getRow();if(!row)throw Error('No cloud layout found');applyLocal(JSON.parse(row.payload));cloudVersion=row.$updatedAt;message('Cloud room loaded.')}catch(e){message(e.message,true)}};
window.addEventListener('wardrobe-room-local-changed',schedule);
window.addEventListener('load',()=>{renderCompartments();connect()});
})();
