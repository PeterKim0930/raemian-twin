import {decodeRle,displayIndex,changeSelection,maskIndex,activeLayout,placeCameraLabels,focusCamera,switchLayout,focusedCamera,photoPath,visibilityLayers,coverageSummary,pixelColor,hitCamera} from './viewer_model.mjs';
const $=id=>document.getElementById(id),canvas=$('plan'),ctx=canvas.getContext('2d');
let data,decoded,state={layout:'existing11',scenario:'empty',band:'low',mode:'any',focus:null,viewport:{scale:1,x:0,y:0}},raster=document.createElement('canvas'),drag,cameraLabels=[];
const selectedColor='#f3a64a',selectedInk='#603c10';
function size(){const r=canvas.getBoundingClientRect();canvas.width=Math.round(r.width*devicePixelRatio);canvas.height=Math.round(r.height*devicePixelRatio);return [r.width,r.height];}
function fit(){if(!data)return;const [w,h]=size(),[x0,x1,y0,y1]=data.bounds;state.viewport={scale:Math.min((w-50)/(x1-x0),(h-40)/(y1-y0)),x:w/2,y:h/2};draw();}
function point(x,y){const b=data.bounds,v=state.viewport;return [v.x+(x-(b[0]+b[1])/2)*v.scale,v.y-(y-(b[2]+b[3])/2)*v.scale];}
function polygon(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>{const [x,y]=point(...p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=.7;ctx.stroke();}}
function showPhoto(){
 const camera=focusedCamera(data,state),path=photoPath(data,state),scenarioLabel=data.scenarios.find(s=>s.id===state.scenario).label;
 $('photo-title').textContent=camera?[camera.id,camera.roleLabel].filter(Boolean).join(' · '):'카메라를 선택하세요';
 $('camera-height').textContent=camera?(camera.placementHeightM===undefined?`촬영점 높이 ${camera.position[2].toFixed(2)} m`:`설치 높이 ${camera.placementHeightM.toFixed(2)} m`):'';
 $('camera-location').textContent=camera?`X ${camera.position[0].toFixed(2)} m · Y ${camera.position[1].toFixed(2)} m`:'';
 if(path){if($('photo').getAttribute('src')!==path)$('photo').setAttribute('src',path);$('photo').alt=`${camera.id} · ${scenarioLabel}`;$('photo-link').setAttribute('href',path);}else{$('photo').removeAttribute('src');$('photo').alt='';$('photo-link').removeAttribute('href');}
 $('photo').hidden=!path;$('photo-link').hidden=!path;
}
function showCoverage(summary,context){
 const format=metric=>`${metric.areaM2.toFixed(2)} ㎡ · ${metric.percent.toFixed(2)}%`;
 $('coverage-context').textContent=context;
 for(const name of ['total','single','overlap'])$('coverage-'+name).textContent=format(summary[name]);
 $('coverage-selected-label').textContent=state.focus?`선택한 카메라 · ${state.focus}`:'선택한 카메라';
 $('coverage-selected').textContent=summary.selected?format(summary.selected):'카메라를 선택하세요';
 $('coverage-basis').textContent=`벽·기둥·차량을 제외한 지도 전체 영역 ${summary.free.areaM2.toFixed(2)} ㎡ 기준입니다. 선택 영역은 전체에 포함됩니다.`;
 $('coverage').hidden=false;
}
function rebuild(){
 const [si,bi,mi]=maskIndex(data,state),g=data.grid,n=g.nx*g.ny,layout=activeLayout(data,state);
 const focusIndex=layout.cameras.findIndex(c=>c.id===state.focus),layers=visibilityLayers(decoded.layouts[state.layout][si][bi][mi],focusIndex,n),occupied=decoded.occupied[si][bi],staticMask=decoded.static[bi];
 raster.width=g.nx;raster.height=g.ny;const rc=raster.getContext('2d'),im=rc.createImageData(g.nx,g.ny);
 for(let row=0;row<g.ny;row++)for(let col=0;col<g.nx;col++){const i=row*g.nx+col,j=displayIndex(col,row,g.nx,g.ny)*4;im.data.set([...pixelColor(staticMask[i],occupied[i],layers.counts[i],layers.focus[i],decoded.ground[i]),255],j);}
 rc.putImageData(im,0,0);
 showCoverage(coverageSummary(layers,decoded.ground,staticMask,occupied,g.step,focusIndex>=0),`${layout.label} · ${data.scenarios[si].label} · ${data.heightBands[bi].label} · ${data.visibilityModes[mi].label}`);
 $('count').textContent=`${layout.cameras.length}대`;$('vehicles').textContent=`차량 ${data.scenarios[si].vehicleCount}대`;
 $('status').textContent=`${state.focus??'전체 시야'} · ${data.heightBands[bi].label} · ${data.visibilityModes[mi].label}`;
 document.querySelectorAll('#cameras button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.camera===state.focus)));$('clear').disabled=!state.focus;showPhoto();draw();
}
function draw(){
 if(!data)return;size();ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);const [xmin,xmax,ymin,ymax]=data.bounds,tl=point(xmin,ymax),br=point(xmax,ymin);ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,tl[0],tl[1],br[0]-tl[0],br[1]-tl[1]);
 for(const s of data.stalls)polygon(s.corners,null,'#939fa8');
 const vehicles=state.scenario==='empty'?[]:data.vehicles.filter(v=>state.scenario==='double'||v.kind==='normal');for(const v of vehicles)polygon(v.footprint,null,'#727e87');
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
$('layout').addEventListener('change',e=>{state=switchLayout(state,e.target.value);renderCameras();rebuild();});$('band').addEventListener('change',e=>update({band:e.target.value}));$('mode').addEventListener('change',e=>update({mode:e.target.value}));$('scenario').addEventListener('change',e=>update({scenario:e.target.value}));$('fit').addEventListener('click',fit);$('clear').addEventListener('click',()=>update({focus:null}));
canvas.addEventListener('wheel',e=>{if(!data)return;e.preventDefault();const r=canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,v=state.viewport,f=Math.exp(-e.deltaY*.001);v.x=x+(v.x-x)*f;v.y=y+(v.y-y)*f;v.scale*=f;draw();},{passive:false});
canvas.addEventListener('pointerdown',e=>{if(!data)return;drag={startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(!drag||!data)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>=4)drag.moved=true;state.viewport.x+=e.clientX-drag.x;state.viewport.y+=e.clientY-drag.y;drag.x=e.clientX;drag.y=e.clientY;draw();});
canvas.addEventListener('pointerup',e=>{if(!drag)return;const click=!drag.moved;drag=null;if(click){const r=canvas.getBoundingClientRect(),id=hitCamera(cameraLabels,e.clientX-r.left,e.clientY-r.top);if(id)focus(id);}});canvas.addEventListener('pointercancel',()=>drag=null);window.addEventListener('resize',draw);
function addOption(select,value,label){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
for(const el of document.querySelectorAll('button,select'))el.disabled=true;
try{const response=await fetch('./viewer-data.json');if(!response.ok)throw new Error(`HTTP ${response.status}`);data=await response.json();const n=data.grid.nx*data.grid.ny,d=r=>decodeRle(r,n);decoded={ground:d(data.masks.ground),static:data.masks.static.map(d),occupied:data.masks.occupied.map(a=>a.map(d)),layouts:Object.fromEntries(data.layouts.map(l=>[l.id,l.visibility.map(a=>a.map(b=>b.map(c=>c.map(d))))]))};for(const layout of data.layouts)addOption($('layout'),layout.id,layout.label);for(const band of data.heightBands)addOption($('band'),band.id,band.label);for(const mode of data.visibilityModes)addOption($('mode'),mode.id,mode.label);$('layout').value=state.layout;$('band').value=state.band;$('mode').value=state.mode;$('scenario').value=state.scenario;renderCameras();for(const el of document.querySelectorAll('button,select'))el.disabled=false;rebuild();fit();}catch(error){$('status').textContent=`시야 데이터를 불러오지 못했습니다 (${error.message}). 페이지를 새로 열어 주세요.`;}
