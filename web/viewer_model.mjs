export function decodeRle(rle, size) { const out=new Uint8Array(size); for(let i=0;i<rle.length;i+=2) out.fill(1,rle[i],rle[i]+rle[i+1]); return out; }
export function displayIndex(col,row,nx,ny){return (ny-1-row)*nx+col;}
export function changeSelection(state,patch){return {...state,...patch,viewport:state.viewport};}
export function maskIndex(data,state){return [data.scenarios.findIndex(s=>s.id===state.scenario),data.heightBands.findIndex(b=>b.id===state.band),data.visibilityModes.findIndex(m=>m.id===state.mode)];}

export function activeLayout(data,state){return data.layouts.find(layout=>layout.id===state.layout);}
export function focusCamera(state,cameraId){return changeSelection(state,{focus:state.focus===cameraId?null:cameraId,vehicle:null});}
export function focusVehicle(state,vehicleId){return changeSelection(state,{vehicle:state.vehicle===vehicleId?null:vehicleId,focus:null});}
export function clearSelection(state){return changeSelection(state,{focus:null,vehicle:null});}
export function activeVehicles(data,state){return state.scenario==='empty'?[]:data.vehicles.filter(vehicle=>state.scenario==='double'||vehicle.kind==='normal');}
export function switchScenario(data,state,scenario){const next=changeSelection(state,{scenario});return activeVehicles(data,next).some(vehicle=>vehicle.id===next.vehicle)?next:changeSelection(next,{vehicle:null});}
export function vehicleObservations(data,state){if(!state.vehicle)return [];const records=data.vehicleObservations.layouts[state.layout][state.scenario];return activeLayout(data,state).cameras.flatMap(camera=>{const row=records[camera.id],box=row.boxes[state.vehicle];return box?[{camera,path:camera.images[state.scenario],width:row.width,height:row.height,box}]:[];});}
export function switchLayout(state,layout){return changeSelection(state,{layout,focus:null});}
export function focusedCamera(data,state){return activeLayout(data,state).cameras.find(c=>c.id===state.focus);}
export function photoPath(data,state){return focusedCamera(data,state)?.images?.[state.scenario]??null;}
export function visibilityLayers(masks,focusIndex,size){const counts=new Uint8Array(size);for(const mask of masks)for(let i=0;i<size;i++)counts[i]+=mask[i];return {counts,focus:focusIndex<0?new Uint8Array(size):masks[focusIndex]};}
export function coverageSummary(layers,region,staticMask,occupied,hasFocus){
 let freeCells=0,singleCells=0,overlapCells=0,selectedCells=0;
 for(let i=0;i<region.length;i++){
  if(!region[i]||staticMask[i]||occupied[i])continue;
  freeCells++;
  if(layers.counts[i]===1)singleCells++;else if(layers.counts[i]>=2)overlapCells++;
  if(hasFocus&&layers.focus[i])selectedCells++;
 }
 const metric=cells=>({cells,percent:cells/freeCells*100});
 return {free:metric(freeCells),total:metric(singleCells+overlapCells),single:metric(singleCells),overlap:metric(overlapCells),selected:hasFocus?metric(selectedCells):null};
}
export function pixelColor(staticCell,occupiedCell,count,focused,ground,inRegion,showSingle,showOverlap){if(!inRegion)return staticCell?[93,103,111]:[177,185,191];return staticCell?[57,69,78]:occupiedCell?[148,155,161]:focused?[243,166,74]:count>=2&&showOverlap?[88,169,180]:count===1&&showSingle?[200,224,239]:ground?[250,251,252]:[235,239,242];}
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

export function worldPoint(data,state,x,y){const b=data.bounds,v=state.viewport;return [(x-v.x)/v.scale+(b[0]+b[1])/2,(v.y-y)/v.scale+(b[2]+b[3])/2];}
export function pointInPolygon(points,x,y){
 let inside=false;
 for(let i=0,j=points.length-1;i<points.length;j=i++){
  const [ax,ay]=points[j],[bx,by]=points[i],dx=bx-ax,dy=by-ay;
  const epsilon=Number.EPSILON*Math.max(1,Math.abs(x),Math.abs(y),Math.abs(ax),Math.abs(ay),Math.abs(bx),Math.abs(by))*8;
  if(Math.abs((x-ax)*dy-(y-ay)*dx)<=epsilon*(Math.abs(dx)+Math.abs(dy))&&x>=Math.min(ax,bx)-epsilon&&x<=Math.max(ax,bx)+epsilon&&y>=Math.min(ay,by)-epsilon&&y<=Math.max(ay,by)+epsilon)return true;
  if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
 }
 return inside;
}
export function hitVehicle(data,state,x,y){return activeVehicles(data,state).find(vehicle=>pointInPolygon(vehicle.footprint,x,y))?.id??null;}
export function hitMapTarget(data,state,labels,x,y){const camera=hitCamera(labels,x,y);if(camera)return {type:'camera',id:camera};const vehicle=hitVehicle(data,state,...worldPoint(data,state,x,y));return vehicle?{type:'vehicle',id:vehicle}:null;}
