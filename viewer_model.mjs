export function decodeRle(rle, size) { const out=new Uint8Array(size); for(let i=0;i<rle.length;i+=2) out.fill(1,rle[i],rle[i]+rle[i+1]); return out; }
export function displayIndex(col,row,nx,ny){return (ny-1-row)*nx+col;}
export function changeSelection(state,patch){return {...state,...patch,viewport:state.viewport};}
export function maskIndex(data,state){return [data.scenarios.findIndex(s=>s.id===state.scenario),data.heightBands.findIndex(b=>b.id===state.band),data.visibilityModes.findIndex(m=>m.id===state.mode)];}

export function activeLayout(data,state){return data.layouts.find(layout=>layout.id===state.layout);}
export function focusCamera(state,cameraId){return changeSelection(state,{focus:state.focus===cameraId?null:cameraId});}
export function switchLayout(state,layout){return changeSelection(state,{layout,focus:null});}
export function focusedCamera(data,state){return activeLayout(data,state).cameras.find(c=>c.id===state.focus);}
export function photoPath(data,state){return focusedCamera(data,state)?.images?.[state.scenario]??null;}
export function visibilityLayers(masks,focusIndex,size){const counts=new Uint8Array(size);for(const mask of masks)for(let i=0;i<size;i++)counts[i]+=mask[i];return {counts,focus:focusIndex<0?new Uint8Array(size):masks[focusIndex]};}
export function pixelColor(staticCell,occupiedCell,count,focused,ground){return staticCell?[57,69,78]:occupiedCell?[148,155,161]:focused?[243,166,74]:count>=2?[88,169,180]:count===1?[200,224,239]:ground?[250,251,252]:[235,239,242];}
export function hitCamera(labels,x,y){const label=labels.find(l=>x>=l.box.x&&x<=l.box.x+l.box.w&&y>=l.box.y&&y<=l.box.y+l.box.h);if(label)return label.id;const markers=labels.filter(l=>Math.hypot(l.x-x,l.y-y)<=8).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y));return markers[0]?.id??null;}
export function placeCameraLabels(items,width,height){
 const placed=[];
 for(const item of items){
  const w=item.id.length*7+6,h=15;let box;
  const candidates=[];
  for(let row=0;row<=items.length;row++)for(const sign of row?[1,-1]:[1])for(const side of [1,-1])candidates.push({x:side===1?item.x+8:item.x-8-w,y:item.y-18+sign*row*17,w,h});
  box=candidates.find(b=>b.x>=0&&b.y>=0&&b.x+b.w<=width&&b.y+b.h<=height&&!placed.some(p=>b.x<p.box.x+p.box.w+3&&b.x+b.w+3>p.box.x&&b.y<p.box.y+p.box.h+3&&b.y+b.h+3>p.box.y))||candidates[0];
  placed.push({...item,box});
 }
 return placed;
}
