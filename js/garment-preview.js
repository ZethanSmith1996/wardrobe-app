/* Stage 5.5.3 — read-only clothing preview, using the same compartment IDs as Storage. */
(()=>{'use strict';
const KEY='wardrobe-prototype-v1',DATABASE='wardrobe_db',TABLE='clothing_items';
let garments=[],connected=false,notice='';
const client=new Appwrite.Client().setEndpoint('https://fra.cloud.appwrite.io/v1').setProject('6ae1475800005a49aa07');
const account=new Appwrite.Account(client),db=new Appwrite.TablesDB(client);
function emit(){window.dispatchEvent(new Event('wardrobe-garments-updated'));const el=document.getElementById('garmentPreviewStatus');if(el)el.textContent=notice}
function fromLocal(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');return Array.isArray(d.items)?d.items:[]}catch{return []}}
function sanitize(items){return items.filter(x=>x&&x.section&&String(x.status||'').toLowerCase()==='available').map(x=>({id:String(x.id),name:String(x.name||'Garment'),category:String(x.category||''),colour:String(x.colour||''),section:String(x.section),status:String(x.status),notes:String(x.notes||''),photoId:String(x.photoId||'')}))}
async function reload(){
 try{
  const user=await account.get();connected=true;
  let rows=[],offset=0;
  do{
   const page=await db.listRows({databaseId:DATABASE,tableId:TABLE,queries:[Appwrite.Query.limit(100),Appwrite.Query.offset(offset)]});
   const batch=page.rows||[];rows.push(...batch.filter(x=>x.owner_id===user.$id));offset+=batch.length;
   if(batch.length<100)break;
  }while(offset<10000);
  garments=sanitize(rows.map(x=>({id:x.$id,name:x.name,category:x.category,colour:x.colour,section:x.section_id,status:x.status,notes:x.notes,photoId:x.photo_id})));
  notice='Showing '+garments.length+' available catalogue garments in their assigned locations.';
 }catch(e){
  // Do not display possibly stale clothing belonging to a previously signed-in account.
  connected=false;garments=[];notice='Sign in on My Wardrobe to load your actual clothing preview.';
 }
 emit();
}
window.wardrobeGarmentPreview={itemsFor:locationId=>garments.filter(x=>x.section===locationId),all:()=>garments.slice(),byId:id=>garments.find(x=>x.id===id),reload,get connected(){return connected}};
window.addEventListener('focus',reload);
window.addEventListener('storage',e=>{if(e.key===KEY)reload()});
window.addEventListener('load',reload);
})();
