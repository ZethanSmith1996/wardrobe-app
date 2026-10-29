/* My Wardrobe 5.6.2: browser-side editing and gallery management. */
(()=>{'use strict';
const MAX=8, el=id=>document.getElementById(id);
let photos=[], currentId=null, busy=false;
const err=message=>{el('gallery-error').textContent=message||''};
const id=()=>crypto.randomUUID?.()||('p'+Date.now()+Math.random());
function normalise(p){return {id:p.id||id(),fileId:p.fileId||null,src:p.src||'',label:p.label||'',isNew:!!p.isNew}}
function render(){const root=el('gallery-editor');root.replaceChildren();photos.forEach((p,i)=>{
 const card=document.createElement('div');card.className='gallery-edit-card';
 const img=document.createElement('img');img.src=p.src;img.alt='Garment photo '+(i+1);card.append(img);
 const title=document.createElement('small');title.textContent=(i===0?'★ Cover · ':'')+'Photo '+(i+1);card.append(title);
 const controls=document.createElement('div');controls.className='gallery-buttons';
 function btn(label,action,disabled=false){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=label;b.disabled=disabled||busy;b.onclick=action;controls.append(b)}
 btn('Cover',()=>move(i,0),i===0);btn('←',()=>move(i,i-1),i===0);btn('→',()=>move(i,i+1),i===photos.length-1);
 btn('Edit',()=>edit(i));btn('Remove',()=>{photos.splice(i,1);render()});card.append(controls);root.append(card)
 });el('gallery-files').disabled=photos.length>=MAX||busy;
}
function move(from,to){if(to<0||to>=photos.length)return;const [p]=photos.splice(from,1);photos.splice(to,0,p);render()}
async function decode(src){const image=new Image();image.src=src;await image.decode();return image}
async function transform(src,{rotation=0,crop=null,max=1400}={}){
 const image=await decode(src),sw=image.naturalWidth,sh=image.naturalHeight;
 const x=crop?Math.round(crop.x*sw):0,y=crop?Math.round(crop.y*sh):0,w=crop?Math.round(crop.w*sw):sw,h=crop?Math.round(crop.h*sh):sh;
 const rotated=Math.abs(rotation%180)===90,outW=rotated?h:w,outH=rotated?w:h,scale=Math.min(1,max/Math.max(outW,outH));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(outW*scale));canvas.height=Math.max(1,Math.round(outH*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#f7f5f0';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(image,x,y,w,h,-w*scale/2,-h*scale/2,w*scale,h*scale);
 return canvas.toDataURL('image/jpeg',.8)
}
async function addFiles(files){err('');for(const file of files){if(photos.length>=MAX){err('Maximum 8 photos per garment.');break}if(!file.type.startsWith('image/')){err('Only image files can be added.');continue}if(file.size>25*1024*1024){err('A photograph is too large (25 MB limit).');continue}
 try{const src=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});photos.push(normalise({src:await transform(src),isNew:true}));render()}catch(e){err('Could not process '+file.name+': '+e.message)}}el('gallery-files').value=''}
function edit(index){const photo=photos[index];const dlg=el('gallery-edit-dialog');const preview=el('gallery-crop-preview');let rotation=0,crop=null;
 function update(){preview.src=photo.src;preview.style.transform='rotate('+rotation+'deg)';el('gallery-crop').value=crop?'square':'full'}
 el('gallery-rotate-left').onclick=()=>{rotation=(rotation+270)%360;update()};el('gallery-rotate-right').onclick=()=>{rotation=(rotation+90)%360;update()};
 el('gallery-crop').onchange=e=>{if(e.target.value==='square'){decode(photo.src).then(im=>{const w=im.naturalWidth,h=im.naturalHeight;if(w>h)crop={x:(w-h)/2/w,y:0,w:h/w,h:1};else crop={x:0,y:(h-w)/2/h,w:1,h:w/h}})}else crop=null};
 el('gallery-edit-apply').onclick=async()=>{try{photo.src=await transform(photo.src,{rotation,crop});photo.fileId=null;photo.isNew=true;dlg.close();render()}catch(e){err('Editing failed: '+e.message)}};
 el('gallery-edit-cancel').onclick=()=>dlg.close();update();dlg.showModal()}
async function prepare(){if(busy)throw Error('Already uploading photographs');busy=true;err('Uploading photos…');render();try{
 if(!window.WardrobeCloud?.active)throw Error('Please sign in and wait for the cloud connection before saving photographs.');
 for(const p of photos){if(p.isNew||!p.fileId){p.fileId=await window.WardrobeCloud.uploadPhoto(p.src);p.isNew=false}}
 err('');return photos.map(p=>({id:p.id,fileId:p.fileId,label:p.label}));
 }catch(e){err('Photo upload failed: '+e.message);throw e}finally{busy=false;render()}}
function open(item){currentId=item?.id||null;photos=(item?.photos||[]).map(normalise);
 if(!photos.length&&(item?.photo_id||item?.photo))photos=[normalise({fileId:item.photo_id||null,src:item.photo||'',isNew:!item.photo_id})];
 render();err('')}
function get(){return photos.map(p=>({...p}))}
function has(){return photos.length>0}
function clear(){photos=[];render();err('')}
window.WardrobeGallery={open,prepare,get,has,clear};
el('gallery-files').addEventListener('change',e=>addFiles([...e.target.files]));
})();
