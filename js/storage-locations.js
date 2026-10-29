(()=>{'use strict';
const KEY='my-wardrobe-furniture-v1';
function idFor(unit,kind,index){const raw=unit+'|'+kind+'|'+index;let h=2166136261;for(let i=0;i<raw.length;i++){h^=raw.charCodeAt(i);h=Math.imul(h,16777619)}return 'loc_'+(h>>>0).toString(36)+'_'+(index+1)}
function locations(){let units=[];try{units=JSON.parse(localStorage.getItem(KEY)||'[]')}catch{}if(!Array.isArray(units))return [];
return units.flatMap(u=>{if(!u||!u.id)return [];const name=u.name||'Unnamed furniture';const make=(kind,i)=>({id:idFor(String(u.id),kind,i),name:name+' — '+(kind==='rail'?'Rail':kind==='shelf'?'Shelf':'Drawer')+' '+(i+1),type:kind,x:0,y:0,w:30,h:15,unitId:u.id,compartmentIndex:i});
if(u.type==='rail')return [make('rail',0)];if(u.type==='floating_shelf')return [make('shelf',0)];
return [...Array.from({length:Math.max(0,Number(u.rails)||0)},(_,i)=>make('rail',i)),...Array.from({length:Math.max(0,Number(u.shelves)||0)},(_,i)=>make('shelf',i)),...Array.from({length:Math.max(0,Number(u.drawers)||0)},(_,i)=>make('drawer',i))]})}
window.wardrobeStorageLocations={locations,idFor};
})();