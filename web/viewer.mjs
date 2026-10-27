import {decodeRle,displayIndex,changeSelection,maskIndex,activeLayout,placeCameraLabels,focusCamera,switchLayout,focusedCamera,photoPath,visibilityLayers,coverageSummary,pixelColor,activeVehicles,focusVehicle,clearSelection,switchScenario,vehicleObservations,hitMapTarget} from './viewer_model.mjs';
const $=id=>document.getElementById(id),canvas=$('plan'),ctx=canvas.getContext('2d');
let data,decoded,state={layout:'existing11',scenario:'empty',band:'low',mode:'any',focus:null,vehicle:null,showSingle:true,showOverlap:true,viewport:{scale:1,x:0,y:0}},raster=document.createElement('canvas'),drag,cameraLabels=[],galleryKey=null;
const selectedColor='#f3a64a',selectedInk='#603c10';
function size(){const r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*devicePixelRatio);canvas.height=Math.round(r.height*devicePixelRatio);return [r.width,r.height];}
function fit(){if(!data)return;const [w,h]=size(),[x0,x1,y0,y1]=data.bounds;state.viewport={scale:Math.min((w-50)/(x1-x0),(h-40)/(y1-y0)),x:w/2,y:h/2};draw();}
function point(x,y){const b=data.bounds,v=state.viewport;return [v.x+(x-(b[0]+b[1])/2)*v.scale,v.y-(y-(b[2]+b[3])/2)*v.scale];}
function polygon(points,fill,stroke,lineWidth=.7){ctx.beginPath();points.forEach((p,i)=>{const [x,y]=point(...p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke();}}
function vehicleImage(view,scenarioLabel){
 const photo=document.createElement('img');photo.src=view.path;photo.alt=`${view.camera.id} · ${scenarioLabel} · 차량 ${state.vehicle}`;photo.width=view.width;photo.height=view.height;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${view.width} ${view.height}`);svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('aria-hidden','true');
 const [x1,y1,x2,y2]=view.box,box=document.createElementNS('http://www.w3.org/2000/svg','rect');
 for(const [name,value] of Object.entries({x:x1,y:y1,width:x2-x1,height:y2-y1,fill:'none',stroke:selectedColor,'stroke-width':2,'vector-effect':'non-scaling-stroke'}))box.setAttribute(name,value);
 svg.append(box);return [photo,svg];
}
function closeVehiclePhoto(){if($('vehicle-dialog').open)$('vehicle-dialog').close();$('vehicle-dialog-photo').replaceChildren();}
function openVehiclePhoto(view,scenarioLabel){
 $('vehicle-dialog-title').textContent=[`차량 ${state.vehicle}`,view.camera.id,view.camera.roleLabel].filter(Boolean).join(' · ');
 $('vehicle-dialog-photo').replaceChildren(...vehicleImage(view,scenarioLabel));$('vehicle-dialog').showModal();
}
function galleryCard(view,scenarioLabel){
 const card=document.createElement('article');card.className='gallery-card';
 const title=document.createElement('h3');title.textContent=[view.camera.id,view.camera.roleLabel].filter(Boolean).join(' · ');
 const button=document.createElement('button');button.type='button';button.className='vehicle-photo';button.title='차량 표시와 함께 크게 보기';button.setAttribute('aria-label',`${view.camera.id} · 차량 ${state.vehicle} 크게 보기`);button.style.aspectRatio=`${view.width} / ${view.height}`;
 button.append(...vehicleImage(view,scenarioLabel));button.addEventListener('click',()=>openVehiclePhoto(view,scenarioLabel));card.append(title,button);return card;
}
function showPhoto(){
 const scenarioLabel=data.scenarios.find(s=>s.id===state.scenario).label,gallery=$('vehicle-gallery'),vehicleMode=Boolean(state.vehicle);
 $('photo-panel').classList.toggle('vehicle-mode',vehicleMode);
 $('camera-height').hidden=vehicleMode;$('camera-location').hidden=vehicleMode;
 if(vehicleMode){
  const views=vehicleObservations(data,state),key=`${state.layout}|${state.scenario}|${state.vehicle}`;
  $('photo-title').textContent=`차량 ${state.vehicle} · 카메라 ${views.length}대`;
  $('camera-height').textContent='';$('camera-location').textContent='';
  $('photo').removeAttribute('src');$('photo').alt='';$('photo-link').removeAttribute('href');$('photo').hidden=true;$('photo-link').hidden=true;
  if(galleryKey!==key){closeVehiclePhoto();gallery.replaceChildren(...views.map(view=>galleryCard(view,scenarioLabel)));gallery.scrollTop=0;galleryKey=key;}
  gallery.hidden=!views.length;$('photo-empty').hidden=Boolean(views.length);$('photo-empty').textContent='현재 배치에서 이 차량이 보이는 카메라가 없습니다.';
  $('photo-note').textContent='시뮬레이션에서 보이는 차량 부분을 표시합니다.';
  return;
 }
 if(galleryKey!==null){closeVehiclePhoto();gallery.replaceChildren();gallery.scrollTop=0;galleryKey=null;}
 gallery.hidden=true;$('photo-empty').hidden=true;
 const camera=focusedCamera(data,state),path=photoPath(data,state);
 $('photo-title').textContent=camera?[camera.id,camera.roleLabel].filter(Boolean).join(' · '):'카메라나 차량을 선택하세요';
 $('camera-height').textContent=camera?(camera.placementHeightM===undefined?`촬영점 높이 ${camera.position[2].toFixed(2)} m`:`설치 높이 ${camera.placementHeightM.toFixed(2)} m`):'';
 $('camera-location').textContent=camera?`X ${camera.position[0].toFixed(2)} m · Y ${camera.position[1].toFixed(2)} m`:'';
 if(path){if($('photo').getAttribute('src')!==path)$('photo').setAttribute('src',path);$('photo').alt=`${camera.id} · ${scenarioLabel}`;$('photo-link').setAttribute('href',path);}else{$('photo').removeAttribute('src');$('photo').alt='';$('photo-link').removeAttribute('href');}
 $('photo').hidden=!path;$('photo-link').hidden=!path;$('photo-note').textContent='사진은 고정된 카메라 시점과 차량 배치를 보여 줍니다.';
}
function showCoverage(summary,context){
 const format=metric=>`${metric.percent.toFixed(2)}%`;
 $('coverage-context').textContent=context;
 for(const name of ['total','single','overlap'])$('coverage-'+name).textContent=format(summary[name]);
 $('coverage-selected-label').textContent=state.focus?`선택한 카메라 · ${state.focus}`:'선택한 카메라';
 $('coverage-selected').textContent=summary.selected?format(summary.selected):'카메라를 선택하세요';
 $('coverage-basis').textContent='주차면·통로·입출차·충전 구역 중 구조물·차량을 제외한 영역 기준입니다. 선택 영역은 전체에 포함됩니다.';
 $('coverage').hidden=false;
}
function rebuild(){
 const [si,bi,mi]=maskIndex(data,state),g=data.grid,n=g.nx*g.ny,layout=activeLayout(data,state);
 const focusIndex=layout.cameras.findIndex(c=>c.id===state.focus),layers=visibilityLayers(decoded.layouts[state.layout][si][bi][mi],focusIndex,n),occupied=decoded.occupied[si][bi],staticMask=decoded.static[bi];
 raster.width=g.nx;raster.height=g.ny;const rc=raster.getContext('2d'),im=rc.createImageData(g.nx,g.ny);
 for(let row=0;row<g.ny;row++)for(let col=0;col<g.nx;col++){const i=row*g.nx+col,j=displayIndex(col,row,g.nx,g.ny)*4;im.data.set([...pixelColor(staticMask[i],occupied[i],layers.counts[i],layers.focus[i],decoded.ground[i],decoded.region[i],state.showSingle,state.showOverlap),255],j);}
 rc.putImageData(im,0,0);
 showCoverage(coverageSummary(layers,decoded.region,staticMask,occupied,focusIndex>=0),`${layout.label} · ${data.scenarios[si].label} · ${data.heightBands[bi].label} · ${data.visibilityModes[mi].label}`);
 $('count').textContent=`${layout.cameras.length}대`;$('vehicles').textContent=`차량 ${data.scenarios[si].vehicleCount}대`;
 $('status').textContent=`${state.vehicle?`차량 ${state.vehicle}`:state.focus??'전체 시야'} · ${data.heightBands[bi].label} · ${data.visibilityModes[mi].label}`;
 document.querySelectorAll('#cameras button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===state.focus)));$('clear').disabled=!(state.focus||state.vehicle);showPhoto();draw();
}
function draw(){
 if(!data)return;size();ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);const [xmin,xmax,ymin,ymax]=data.bounds,tl=point(xmin,ymax),br=point(xmax,ymin);ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,tl[0],tl[1],br[0]-tl[0],br[1]-tl[1]);
 for(const s of data.stalls)polygon(s.corners,null,'#939fa8');
 const vehicles=activeVehicles(data,state);for(const v of vehicles)polygon(v.footprint,null,'#727e87');const selectedVehicle=vehicles.find(v=>v.id===state.vehicle);if(selectedVehicle)polygon(selectedVehicle.footprint,null,selectedColor,2.5);
 ctx.font='10px Arial';ctx.textAlign='center';ctx.textBaseline='middle';const labels=data.stalls.map(s=>({id:s.id,p:s.corners.reduce((a,p)=>[a[0]+p[0]/s.corners.length,a[1]+p[1]/s.corners.length],[0,0])}));if(state.scenario==='double')for(const v of vehicles.filter(v=>v.kind==='double'))labels.push({id:v.id,p:v.center});for(const l of labels){const p=point(...l.p);ctx.fillStyle='#ffffffcf';ctx.fillRect(p[0]-18,p[1]-6,36,12);ctx.fillStyle='#45545f';ctx.fillText(l.id,...p);}
 activeLayout(data,state).cameras.forEach(c=>{const p=point(...c.position),f=c.forward,fn=Math.hypot(f[0],f[1]),q=point(c.position[0]+f[0]/fn*1.3,c.position[1]+f[1]/fn*1.3);ctx.strokeStyle=ctx.fillStyle=c.id===state.focus?selectedColor:'#657987';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(...p);ctx.lineTo(...q);ctx.stroke();ctx.beginPath();ctx.arc(...p,c.id===state.focus?5:4,0,2*Math.PI);ctx.fill();if(c.id===state.focus){ctx.strokeStyle=selectedInk;ctx.lineWidth=1.2;ctx.stroke();}});
 cameraLabels=placeCameraLabels(activeLayout(data,state).cameras.map(c=>{const p=point(...c.position);return {id:c.id,x:p[0],y:p[1]};}),canvas.width/devicePixelRatio,canvas.height/devicePixelRatio);
 for(const label of cameraLabels){const b=label.box,color=label.id===state.focus?selectedInk:'#657987';ctx.strokeStyle=color;ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(label.x,label.y);ctx.lineTo(b.x+b.w/2,b.y+b.h/2);ctx.stroke();ctx.fillStyle=label.id===state.focus?'#fff0d7':'#fffffff0';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.fillStyle=color;ctx.font='bold 11px Arial';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(label.id,b.x+3,b.y+b.h/2);}
 ctx.fillStyle='#435863';ctx.font='12px Arial';ctx.textAlign='left';ctx.fillText('+Y ↑',14,22);ctx.fillText('5 m',14,canvas.height/devicePixelRatio-26);ctx.fillRect(14,canvas.height/devicePixelRatio-20,5*state.viewport.scale,2);
}
function update(patch){state=changeSelection(state,patch);rebuild();}
function focus(id){state=focusCamera(state,id);rebuild();}
function renderCameras(){
 $('cameras').replaceChildren();$('layout-description').textContent=activeLayout(data,state).description;
 for(const camera of activeLayout(data,state).cameras){const button=document.createElement('button');button.type='button';button.className='camera-button';button.dataset.camera=camera.id;button.textContent=camera.id;button.setAttribute('aria-pressed','false');button.addEventListener('click',()=>focus(camera.id));$('cameras').append(button);}
}
$('vehicle-dialog-close').addEventListener('click',closeVehiclePhoto);$('vehicle-dialog').addEventListener('close',()=>$('vehicle-dialog-photo').replaceChildren());
$('show-single').addEventListener('change',e=>update({showSingle:e.target.checked}));$('show-overlap').addEventListener('change',e=>update({showOverlap:e.target.checked}));
$('layout').addEventListener('change',e=>{state=switchLayout(state,e.target.value);renderCameras();rebuild();});$('band').addEventListener('change',e=>update({band:e.target.value}));$('mode').addEventListener('change',e=>update({mode:e.target.value}));$('scenario').addEventListener('change',e=>{state=switchScenario(data,state,e.target.value);rebuild();});$('fit').addEventListener('click',fit);$('clear').addEventListener('click',()=>{state=clearSelection(state);rebuild();});
canvas.addEventListener('wheel',e=>{if(!data)return;e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,v=state.viewport,f=Math.exp(-e.deltaY*.001);v.x=x+(v.x-x)*f;v.y=y+(v.y-y)*f;v.scale*=f;draw();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(!data)return;drag={startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||!data)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>=4)drag.moved=true;state.viewport.x+=e.clientX-drag.x;state.viewport.y+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;draw();});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const click=!drag.moved;drag=null;if(click){const r=canvas.getBoundingClientRect(),target=hitMapTarget(data,state,cameraLabels,e.clientX-r.left,e.clientY-r.top);if(target?.type==='camera')focus(target.id);else if(target?.type==='vehicle'){state=focusVehicle(state,target.id);rebuild();}}});canvas.addEventListener('pointercancel',()=>drag=null);window.addEventListener('resize',draw);
function addOption(select,value,label){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
for(const el of document.querySelectorAll('button,select,input'))el.disabled=true;
try{const response=await fetch('./viewer-data.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);data=await response.json();if(!data.coverageRegion||typeof data.coverageRegion.label!=='string'||!Array.isArray(data.coverageRegion.polygons)||!Array.isArray(data.coverageRegion.mask))throw new Error('운영 영역 데이터가 없습니다');if(!data.vehicleObservations||data.vehicleObservations.version!==1||data.vehicleObservations.boxFormat!=='xyxy'||data.vehicleObservations.maxExclusive!==true||!data.vehicleObservations.layouts)throw new Error('차량 관측 데이터가 없습니다');const n=data.grid.nx*data.grid.ny,d=r=>decodeRle(r,n);decoded={region:d(data.coverageRegion.mask),ground:d(data.masks.ground),static:data.masks.static.map(d),occupied:data.masks.occupied.map(a=>a.map(d)),layouts:Object.fromEntries(data.layouts.map(l=>[l.id,l.visibility.map(a=>a.map(b=>b.map(c=>c.map(d))))]))};for(const layout of data.layouts)addOption($('layout'),layout.id,layout.label);for(const band of data.heightBands)addOption($('band'),band.id,band.label);for(const mode of data.visibilityModes)addOption($('mode'),mode.id,mode.label);$('layout').value=state.layout;$('band').value=state.band;$('mode').value=state.mode;$('scenario').value=state.scenario;renderCameras();for(const el of document.querySelectorAll('button,select,input'))el.disabled=false;rebuild();fit();}catch(error){$('status').textContent=`시야 데이터를 불러오지 못했습니다 (${error.message}). 페이지를 새로 열어 주세요.`;}
