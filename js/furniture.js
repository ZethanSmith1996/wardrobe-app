(()=>{'use strict';
const KEY='my-wardrobe-furniture-v1';const $=id=>document.getElementById(id);const api=window.roomDesigner;
const types={wardrobe:'Wardrobe',shelves:'Shelving tower',drawers:'Drawer cabinet',rail:'Floating rail',floating_shelf:'Floating shelf'};
const initial={wardrobe:{width:.8,depth:.52,height:2.3,shelves:2,rails:1,drawers:1},shelves:{width:.65,depth:.36,height:2.15,shelves:5,rails:0,drawers:0},drawers:{width:.7,depth:.48,height:1.05,shelves:0,rails:0,drawers:4},rail:{width:.9,depth:.32,height:.035,base:1.85,shelves:0,rails:1,drawers:0},floating_shelf:{width:.8,depth:.3,height:.035,base:1.35,shelves:1,rails:0,drawers:0}};
let units=[];try{const data=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(data))units=data.filter(v=>v&&types[v.type]).map(v=>({...v,id:String(v.id)}))}catch{}let selected=units[0]?.id||null;let drag=null;let snapEnabled=true;
const n=(v,d)=>Number.isFinite(Number(v))?Number(v):d;
function limit(v,a,b){return Math.max(a,Math.min(b,v))}
function span(wall,room){return wall==='north'||wall==='south'?room.width:room.length}
function maxWidth(u,room){return Math.max(.2,span(u.wall,room)-.04)}
function fit(u,room){u.width=limit(n(u.width,.6),.2,maxWidth(u,room));u.depth=limit(n(u.depth,.4),.15,Math.min(.75,room.width/2-.1,room.length/2-.1));u.height=limit(n(u.height,1.8),u.type==='rail'||u.type==='floating_shelf'?.02:.3,room.height-.04);u.base=limit(n(u.base,0),0,Math.max(0,room.height-u.height-.02));if(u.type==='rail'){u.height=.035;u.shelves=0;u.rails=1;u.drawers=0}if(u.type==='floating_shelf'){u.shelves=1;u.rails=0;u.drawers=0};u.offset=limit(n(u.offset,0),.02,Math.max(.02,span(u.wall,room)-u.width-.02));for(const k of ['shelves','rails','drawers'])u[k]=limit(Math.round(n(u[k],0)),0,12)}
function collidesDoor(u,room){if(u.wall!==room.doorWall)return false;const a=u.offset,b=u.offset+u.width,c=room.doorOffset,d=c+room.doorWidth;return a<d+.08&&b>c-.08}
function snapOffset(u,raw,room){const maximum=Math.max(.02,span(u.wall,room)-u.width-.02);let pos=limit(raw,.02,maximum);if(!snapEnabled)return Math.round(pos*100)/100;const candidates=[.02,maximum];for(const other of units){if(other.id!==u.id&&other.wall===u.wall){candidates.push(other.offset+other.width,other.offset-u.width)}}let best=pos,dist=.051;for(const candidate of candidates){const d=Math.abs(candidate-pos);if(d<dist&&candidate>=.02&&candidate<=maximum){best=candidate;dist=d}}return Math.round(best*100)/100}
function moveUnit(id,offset){const u=units.find(v=>v.id===id);if(!u)return;u.offset=snapOffset(u,offset,api.getRoom());save()}
function save(){localStorage.setItem(KEY,JSON.stringify(units));window.dispatchEvent(new Event('wardrobe-room-local-changed'));api.refresh();editor();renderObjectList()}
function chooseWall(type,room){return type==='rail'||type==='floating_shelf'?'east':'west'}
function add(type){const room=api.getRoom(),preset=initial[type];const u={id:'u'+Date.now()+Math.random().toString(36).slice(2,7),name:types[type]+' '+(units.length+1),type,wall:chooseWall(type,room),offset:.1,base:0,...preset};fit(u,room);units.push(u);selected=u.id;save();$('furnitureNotice').textContent='Added '+u.name+'. Select it in the Object List or drag it along its wall.'}
function unit(){return units.find(u=>u.id===selected)}
function selectUnit(id){if(!units.some(u=>u.id===id))return;selected=id;editor();renderObjectList();api.refresh()}
function renderObjectList(){const el=$('objectList');if(!el)return;el.replaceChildren();$('objectCount').textContent=units.length+' object'+(units.length===1?'':'s');if(!units.length){const p=document.createElement('p');p.className='hint';p.textContent='No furniture added yet.';el.appendChild(p);return}for(const u of units){const btn=document.createElement('button');btn.type='button';btn.className='object-entry'+(u.id===selected?' selected':'');btn.setAttribute('aria-pressed',String(u.id===selected));const name=document.createElement('strong');name.textContent=u.name;const meta=document.createElement('small');meta.textContent=types[u.type]+' · '+u.wall+' wall · '+Math.round(u.width*100)+' cm';btn.append(name,meta);btn.onclick=()=>selectUnit(u.id);el.appendChild(btn)}}
function editor(){const el=$('unitEditor'),u=unit();if(!u){el.innerHTML='<p class="hint">Choose a unit in the 2D plan to edit it.</p>';return}const room=api.getRoom();fit(u,room);const field=(label,key,step,min,max)=>`<label>${label}<input data-prop="${key}" type="number" step="${step}" min="${min}" max="${max}" value="${u[key]}"></label>`;
el.innerHTML=`<h3>Selected storage unit</h3><label>Name<input data-prop="name" type="text" maxlength="65" value=""></label><label>Wall<select data-prop="wall">${['west','east','north','south'].map(w=>`<option value="${w}" ${w===u.wall?'selected':''}>${w[0].toUpperCase()+w.slice(1)} wall</option>`).join('')}</select></label><div class="unit-fields">${field('Along wall (m)','offset','.01',0,15)}${field('Width (m)','width','.01',.2,5)}${field('Depth (m)','depth','.01',.15,.75)}${field('Height (m)','height','.01',.3,6)}${field('Height above floor (m)','base','.01',0,6)}${u.type==='rail'||u.type==='floating_shelf'?'':`${field('Shelves','shelves','1',0,12)}${field('Rails','rails','1',0,12)}${field('Drawers','drawers','1',0,12)}`}</div><div class="unit-actions"><button id="duplicateUnit" type="button">Duplicate</button><button id="deleteUnit" type="button" class="danger">Delete unit</button></div><p class="hint">Measurements are in metres. Height above floor allows vertical stacking. Snap to nearby units and wall ends is available.</p>`;
el.querySelector('[data-prop="name"]').value=u.name;
el.querySelectorAll('[data-prop]').forEach(input=>input.addEventListener('change',()=>{const key=input.dataset.prop;const previous={...u};if(key==='name')u.name=input.value.trim()||types[u.type];else if(key==='wall'){u.wall=input.value;u.offset=.1}else u[key]=Number(input.value);if(key==='offset')u.offset=snapOffset(u,u.offset,api.getRoom());fit(u,api.getRoom());if(collidesDoor(u,api.getRoom())){$('furnitureNotice').textContent='Warning: this unit overlaps the doorway. Move it away from the entrance.'}else $('furnitureNotice').textContent='Saved to this browser.';save()}));
$('deleteUnit').onclick=()=>{const locIds=new Set((window.wardrobeStorageLocations?.locations()||[]).filter(x=>x.unitId===u.id).map(x=>x.id));let assigned=[];try{assigned=(JSON.parse(localStorage.getItem('wardrobe-prototype-v1')||'{}').items||[]).filter(x=>locIds.has(x.section))}catch{}if(!confirm('Delete '+u.name+' from this room?'+(assigned.length?'\n\n'+assigned.length+' clothing item(s) will need a new location in Storage.':'')+'\n\nClothing records will not be deleted.'))return;units=units.filter(x=>x.id!==u.id);selected=units[0]?.id||null;save()};
$('duplicateUnit').onclick=()=>{const clone={...u,id:'u'+Date.now()+Math.random().toString(36).slice(2,6),name:u.name+' copy',offset:u.offset+u.width+.05};fit(clone,api.getRoom());units.push(clone);selected=clone.id;save()};}
function geom(u,c){const {room,x,y,w,l,scale}=c;const t=u.depth*scale;const along=u.offset*scale;const wide=u.width*scale;switch(u.wall){case 'north':return {x:x+along,y:y,width:wide,height:t};case 'south':return {x:x+along,y:y+l-t,width:wide,height:t};case 'east':return {x:x+w-t,y:y+along,width:t,height:wide};default:return {x,y:y+along,width:t,height:wide}}}
function draw2d(c){const ns='http://www.w3.org/2000/svg';for(const u of units){fit(u,c.room);const g=geom(u,c),r=document.createElementNS(ns,'rect');for(const [k,v] of Object.entries(g))r.setAttribute(k,v);r.setAttribute('rx','3');r.setAttribute('fill',u.type==='drawers'?'#856b59':u.type==='rail'?'#617f88':u.type==='floating_shelf'?'#ba9d71':'#b09572');r.setAttribute('stroke',u.id===selected?'#55bfff':'#4b3b2e');r.setAttribute('stroke-width',u.id===selected?'4':'2');r.setAttribute('tabindex','0');r.setAttribute('role','button');r.setAttribute('aria-label','Edit '+u.name);r.style.cursor='grab';r.style.touchAction='none';r.addEventListener('click',()=>{selectUnit(u.id)});r.addEventListener('pointerdown',e=>{e.preventDefault();selectUnit(u.id);drag={id:u.id,wall:u.wall,start:e.clientX,startY:e.clientY,offset:u.offset,rect:c.svg.getBoundingClientRect(),scale:c.scale};r.setPointerCapture(e.pointerId)});r.addEventListener('pointermove',e=>{if(!drag||drag.id!==u.id)return;const rect=drag.rect;const factor=480/rect.width;const delta=(u.wall==='north'||u.wall==='south'?(e.clientX-drag.start):(e.clientY-drag.start))*factor/drag.scale;u.offset=snapOffset(u,drag.offset+delta,c.room);const q=geom(u,c);for(const [k,v] of Object.entries(q))r.setAttribute(k,v)});r.addEventListener('pointerup',()=>{if(drag){drag=null;save()}});r.addEventListener('pointercancel',()=>{drag=null;save()});c.svg.appendChild(r);const text=document.createElementNS(ns,'text');text.setAttribute('x',g.x+g.width/2);text.setAttribute('y',g.y+g.height/2+3);text.setAttribute('font-size','10');text.setAttribute('text-anchor','middle');text.setAttribute('fill','#fff');text.setAttribute('pointer-events','none');text.textContent=u.type==='rail'?'Rail':u.type==='floating_shelf'?'Shelf':u.type==='drawers'?'Drawers':u.type==='shelves'?'Shelves':'Wardrobe';c.svg.appendChild(text)} }
function draw3d({scene,room,THREE}){
 const mats={
  wood:new THREE.MeshStandardMaterial({color:0xb28c66,roughness:.68}),
  inside:new THREE.MeshStandardMaterial({color:0xc8ad8b,roughness:.82}),
  edge:new THREE.MeshStandardMaterial({color:0x71563f,roughness:.76}),
  front:new THREE.MeshStandardMaterial({color:0xa78260,roughness:.57}),
  metal:new THREE.MeshStandardMaterial({color:0xbac3c9,metalness:.78,roughness:.26}),
  darkMetal:new THREE.MeshStandardMaterial({color:0x626e75,metalness:.75,roughness:.3}),
  selected:new THREE.MeshStandardMaterial({color:0x52bdfd,emissive:0x14608a,transparent:true,opacity:.78,depthWrite:false})
 };
 function wallAnchor(u){
  const w=u.width,d=u.depth,center=-span(u.wall,room)/2+u.offset+w/2;
  if(u.wall==='west')return [-room.width/2+d/2,-room.length/2+u.offset+w/2,Math.PI/2];
  if(u.wall==='east')return [room.width/2-d/2,-room.length/2+u.offset+w/2,-Math.PI/2];
  if(u.wall==='north')return [center,-room.length/2+d/2,0];
  return [center,room.length/2-d/2,Math.PI];
 }
 const a=window.wardrobeAppearance?.get()||{finish:'oak',shadows:true};const palette={oak:[0xb28c66,0xc8ad8b,0x71563f,0xa78260],walnut:[0x59402f,0x795b46,0x34251d,0x654a37],white:[0xe5e3dc,0xf5f3ed,0xb5b5ae,0xdad8d1],graphite:[0x4d5358,0x64696d,0x282c30,0x575b60]};const colors=palette[a.finish]||palette.oak;for(const [key,i] of [['wood',0],['inside',1],['edge',2],['front',3]])mats[key].color.setHex(colors[i]);
 // Lightweight illustrative garments. These are not the user's actual catalogue items.
 const displayClothes=window.wardrobeAppearance?.get?.().showGarments!==false;
 const garmentPalette=[0x4e657d,0xb9a49b,0x42594f,0x9b7970,0xd8c9ae,0x6e7484];
 function sampleClothes(group,THREE,w,railY,railZ,count){
  const n=Math.min(count,Math.max(1,Math.floor(w/.15)));
  for(let i=0;i<n;i++){
   const x=(i-(n-1)/2)*Math.min(.15,(w-.12)/Math.max(1,n));
   const fabric=new THREE.MeshStandardMaterial({color:garmentPalette[i%garmentPalette.length],roughness:.96,side:THREE.DoubleSide});
   const hanger=new THREE.MeshStandardMaterial({color:0x87939b,metalness:.7,roughness:.33});
   const hook=new THREE.Mesh(new THREE.TorusGeometry(.012,.003,5,10,Math.PI*1.4),hanger);
   hook.rotation.y=Math.PI/2;hook.position.set(x,railY-.014,railZ);group.add(hook);
   const shape=new THREE.Shape();
   shape.moveTo(-.035,0);shape.lineTo(-.068,-.033);shape.lineTo(-.085,-.087);shape.lineTo(-.058,-.099);
   shape.lineTo(-.043,-.073);shape.lineTo(-.045,-.27);shape.lineTo(.045,-.27);
   shape.lineTo(.043,-.073);shape.lineTo(.058,-.099);shape.lineTo(.085,-.087);
   shape.lineTo(.068,-.033);shape.lineTo(.035,0);shape.lineTo(-.035,0);
   const shirt=new THREE.Mesh(new THREE.ShapeGeometry(shape),fabric);
   shirt.position.set(x,railY-.055,railZ);group.add(shirt);
  }
 }
 function foldedClothes(group,THREE,w,y,z){
  for(let i=0;i<Math.min(3,Math.max(1,Math.floor(w/.25)));i++){
   const x=(i-1)*Math.min(.23,w/3);
   for(let layer=0;layer<3;layer++){
    const m=new THREE.Mesh(new THREE.BoxGeometry(.16,.022,.17),new THREE.MeshStandardMaterial({color:garmentPalette[(i*2+layer)%garmentPalette.length],roughness:.93}));
    m.position.set(x,y+.015+layer*.024,z);group.add(m);
   }
  }
 }
 for(const u of units){
  fit(u,room);
  const w=u.width,h=u.height,d=u.depth,t=Math.min(.022,w/14),group=new THREE.Group();
  const [x,z,rotation]=wallAnchor(u);group.position.set(x,u.base||0,z);group.rotation.y=rotation;
  group.userData.wardrobeUnitId=u.id;scene.add(group);
  function part(a,b,c,px,py,pz,mat=mats.wood){
   const m=new THREE.Mesh(new THREE.BoxGeometry(Math.max(.003,a),Math.max(.003,b),Math.max(.003,c)),mat);
   m.position.set(px,py,pz);m.userData.wardrobeUnitId=u.id;m.castShadow=!!a.shadows;m.receiveShadow=!!a.shadows;group.add(m);return m;
  }
  function cylinder(radius,length,px,py,pz,mat=mats.metal,axis='x'){
   const m=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,14),mat);
   if(axis==='x')m.rotation.z=Math.PI/2;
   else if(axis==='z')m.rotation.x=Math.PI/2;
   m.position.set(px,py,pz);m.userData.wardrobeUnitId=u.id;m.castShadow=!!a.shadows;m.receiveShadow=!!a.shadows;group.add(m);return m;
  }
  // Selection outline is deliberately shallow so it does not look like another shelf.
  if(u.id===selected){
   part(w+.028,.007,Math.min(d+.02,.78),0,h+.018,0,mats.selected);
  }
  if(u.type==='rail'){
   // Bare wall-fixed chrome rail, two rear brackets, and small end caps.
   const rodY=.018,rodZ=Math.min(d*.27,.11);
   cylinder(.013,w,0,rodY,rodZ);
   for(const side of [-1,1]){
    const px=side*(w/2-.035);
    cylinder(.009,Math.max(.06,d*.55),px,rodY,(-d/2+rodZ)/2,mats.darkMetal,'z');
    part(.055,.065,.012,px,rodY,-d/2+.008,mats.metal);
    cylinder(.018,.016,side*(w/2-.006),rodY,rodZ,mats.darkMetal);
   }
   if(displayClothes)sampleClothes(group,THREE,w,rodY,rodZ,Math.min(5,Math.floor(w/.15)));
   continue;
  }
  if(u.type==='floating_shelf'){
   // Single solid plank with discreet wall brackets; no carcass or dividers.
   part(w,.035,d,0,.018,0,mats.wood);
   part(w,.006,d,0,.038,0,mats.inside);
   for(const side of [-1,1]){
    const px=side*Math.min(w*.32,w/2-.055);
    part(.022,.055,Math.min(d*.56,.18),px,-.027,-d*.23,mats.darkMetal);
    part(.032,.095,.012,px,-.045,-d/2+.008,mats.darkMetal);
   }
   if(displayClothes)foldedClothes(group,THREE,w,.04,0);
   continue;
  }
  // Complete units: cabinet carcass with a contrasting back, edges and feet.
  part(w,t,d,0,t/2,0);
  part(w,t,d,0,h-t/2,0);
  part(t,h,d,-w/2+t/2,h/2,0);
  part(t,h,d,w/2-t/2,h/2,0);
  part(w-.03,h-.03,.012,0,h/2,-d/2+.009,mats.inside);
  part(w,.012,.015,0,h-.009,d/2-.009,mats.edge);
  part(w,.012,.015,0,.012,d/2-.009,mats.edge);
  const bottom=.055,usable=Math.max(.1,h-.12);
  if(u.type==='drawers'){
   const count=Math.max(1,u.drawers||4),gap=.009,drawerH=(usable-gap*(count-1))/count;
   for(let i=0;i<count;i++){
    const yy=bottom+drawerH*(i+.5)+gap*i;
    part(w-.065,drawerH-.012,.035,0,yy,d/2-.013,mats.front);
    part(w-.095,.007,.008,0,yy+(drawerH-.012)/2-.008,d/2+.007,mats.edge);
    // Horizontal brushed-metal drawer pull.
    cylinder(.007,Math.min(.17,w*.4),0,yy,d/2+.024,mats.metal);
    for(const px of [-.055,.055])cylinder(.005,.024,px,yy,d/2+.013,mats.darkMetal,'z');
   }
   continue;
  }
  const shelves=Math.max(0,u.shelves||0);
  for(let i=1;i<=shelves;i++){
   const yy=bottom+usable*i/(shelves+1);
   part(w-.045,.026,d-.035,0,yy,0,mats.wood);
   part(w-.045,.006,.012,0,yy+.01,d/2-.027,mats.edge);
   if(displayClothes&&i===shelves)foldedClothes(group,THREE,w,yy+.018,0);
  }
  const rails=Math.max(0,u.rails||0);
  for(let i=0;i<rails;i++){
   const yy=bottom+usable*(i+1)/(rails+1);
   cylinder(.011,Math.max(.08,w-.095),0,yy,d/2-.105,mats.metal);
   if(displayClothes)sampleClothes(group,THREE,w,yy,d/2-.105,Math.min(4,Math.floor(w/.16)));
   for(const side of [-1,1]){
    part(.028,.02,.065,side*(w/2-.055),yy,d/2-.11,mats.darkMetal);
   }
  }
  if(u.type==='wardrobe'&&u.drawers>0){
   const count=Math.min(u.drawers,4),dh=Math.min(.19,usable*.4/count);
   for(let i=0;i<count;i++){
    const yy=bottom+dh*(i+.5);
    part(w-.068,dh-.008,.027,0,yy,d/2-.012,mats.front);
    cylinder(.006,Math.min(.13,w*.3),0,yy,d/2+.012,mats.metal);
   }
  }
 }
}
document.querySelectorAll('[data-add-unit]').forEach(b=>b.onclick=()=>add(b.dataset.addUnit));window.wardrobeFurniture={draw2d,draw3d,selectUnit,moveUnit,getSelected:()=>selected,getUnits:()=>units.map(u=>({...u})),
 getCompartments:()=>units.flatMap(u=>{
  const make=(kind,i)=>({id:u.id+':'+kind+':'+i,unitId:u.id,unitName:u.name,kind,index:i+1,label:u.name+' — '+(kind==='rail'?'Rail':kind==='shelf'?'Shelf':'Drawer')+' '+(i+1)});
  if(u.type==='rail')return [make('rail',0)];
  if(u.type==='floating_shelf')return [make('shelf',0)];
  return [...Array.from({length:u.rails||0},(_,i)=>make('rail',i)),...Array.from({length:u.shelves||0},(_,i)=>make('shelf',i)),...Array.from({length:u.drawers||0},(_,i)=>make('drawer',i))];
 }),
 reload:()=>{try{const next=JSON.parse(localStorage.getItem(KEY)||'[]');units=Array.isArray(next)?next.filter(v=>v&&types[v.type]):[]}catch{units=[]}selected=units[0]?.id||null;editor();renderObjectList();api.refresh()},
 setSnap:v=>{snapEnabled=!!v},isSnap:()=>snapEnabled};editor();renderObjectList();api.refresh();
})();
