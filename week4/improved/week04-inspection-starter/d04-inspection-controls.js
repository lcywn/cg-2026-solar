/* 가상 구(arcball)에 포인터를 투영하는 기본 트랙볼.
   회전 상태는 쿼터니언이며 카메라의 eye/up을 함께 회전합니다. */
window.InspectionControls = function(canvas) {
  const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const dot=(a,b)=>a.reduce((sum,value,index)=>sum+value*b[index],0);
  const mul=(a,b)=>[
    a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
    a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const rotate=(q,v)=>mul(mul(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);
  const dampRotation=(q,factor)=>{const rotation=normalize(q),angle=2*Math.acos(Math.max(-1,Math.min(1,rotation[3])));if(angle<1e-7)return rotation;const axis=normalize(rotation.slice(0,3)),half=angle*factor/2;return [...axis.map(value=>value*Math.sin(half)),Math.cos(half)];};
  const initialDistance=30/1.3;
  const homeRotation=()=>normalize(mul([0,Math.sin(.3),0,Math.cos(.3)],[Math.sin(-.22),0,0,Math.cos(.22)]));
  const makeState=()=>({target:[3,3,0],distance:30,rotation:[0,0,0,1],fov:45,actions:0});
  const states=[makeState(),makeState(),makeState(),makeState()];
  let active=0,state=states[0],comparisonLayout=false;
  function resetView(index=active){
    const view=states[index],rotations=[[0,0,0,1],homeRotation(),[0,Math.sin(Math.PI/4),0,Math.cos(Math.PI/4)],[0,1,0,0]];
    view.target=[3,3,0];view.distance=index===1?30:initialDistance;view.rotation=[...rotations[index]];view.fov=45;view.actions++;
  }
  function resetAllViews(){for(let index=0;index<states.length;index++)resetView(index);}
  function home(){resetView(active);}
  for(let index=0;index<states.length;index++)resetView(index);
  function viewports(width,height){
    if(comparisonLayout){const halfWidth=width/2,halfHeight=height/2;return [{left:0,top:0,width:halfWidth,height:halfHeight},{left:halfWidth,top:0,width:halfWidth,height:halfHeight},{left:0,top:halfHeight,width:halfWidth,height:halfHeight},{left:halfWidth,top:halfHeight,width:halfWidth,height:halfHeight}];}
    const scale=1.35,columns=[active%2===0?scale:1,active%2===1?scale:1],rows=[active<2?scale:1,active>=2?scale:1],columnTotal=columns[0]+columns[1],rowTotal=rows[0]+rows[1],columnWidths=columns.map(value=>width*value/columnTotal),rowHeights=rows.map(value=>height*value/rowTotal);
    return [0,1,2,3].map(index=>{const column=index%2,row=Math.floor(index/2);return {left:column===0?0:columnWidths[0],top:row===0?0:rowHeights[0],width:columnWidths[column],height:rowHeights[row]};});
  }
  function viewIndex(e){const r=canvas.getBoundingClientRect(),views=viewports(r.width,r.height);return views.findIndex(view=>e.clientX>=r.left+view.left&&e.clientX<r.left+view.left+view.width&&e.clientY>=r.top+view.top&&e.clientY<r.top+view.top+view.height);}
  function setActive(index){active=Math.max(0,Math.min(states.length-1,index));state=states[active];}
  function setActiveFromEvent(e){setActive(viewIndex(e));}
  function viewRect(){const r=canvas.getBoundingClientRect(),view=viewports(r.width,r.height)[active];return {left:r.left+view.left,top:r.top+view.top,width:view.width,height:view.height};}
  function sphere(e){const r=viewRect(),s=Math.min(r.width,r.height),x=(2*(e.clientX-r.left)-r.width)/s,y=(r.height-2*(e.clientY-r.top))/s,d=x*x+y*y;return d<=1?[x,y,Math.sqrt(1-d)]:normalize([x,y,0]);}
  let drag=null;
  canvas.style.touchAction='none';
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(drag || ![0,2].includes(e.button))return;
    setActiveFromEvent(e);
    drag={id:e.pointerId,p:sphere(e),x:e.clientX,y:e.clientY,q:[...state.rotation],target:[...state.target],pan:e.shiftKey||e.button===2};
    state.actions++;canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
    if(!drag || drag.id!==e.pointerId)return;
    if(drag.pan){
      const r=canvas.getBoundingClientRect(),unit=2*state.distance*Math.tan(state.fov*Math.PI/360)/r.height;
      const right=rotate(drag.q,[1,0,0]),up=rotate(drag.q,[0,1,0]);
      state.target=drag.target.map((v,i)=>v-(e.clientX-drag.x)*unit*right[i]+(e.clientY-drag.y)*unit*up[i]);
    }else{
      // 현재 포인터에서 시작점으로의 역회전은 카메라를 움직여 물체가 드래그를 따라가게 합니다.
      const current=sphere(e),dot=current.reduce((v,x,i)=>v+x*drag.p[i],0);
      let q=[...cross(current,drag.p),1+dot];
      if(Math.hypot(...q)<1e-7){const axis=normalize(cross(current,Math.abs(current[0])<.9?[1,0,0]:[0,1,0]));q=[...axis,0];}
      state.rotation=normalize(mul(drag.q,dampRotation(q,.9)));
    }
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.distance=Math.max(.06,Math.min(100,state.distance*Math.exp(e.deltaY*.001)));state.actions++;},{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();state.actions++;
    if(e.key==='Home'){home();return;}
    if(e.key==='+')state.distance=Math.max(.06,state.distance/1.12);
    else if(e.key==='-')state.distance=Math.min(100,state.distance*1.12);
    else {const h=e.key==='ArrowLeft'?.06:e.key==='ArrowRight'?-.06:0,v=e.key==='ArrowUp'?.06:e.key==='ArrowDown'?-.06:0;state.rotation=normalize(mul(state.rotation,normalize([v,h,0,1])));}
  });
  function panScreen(horizontal,vertical){
    const r=viewRect(),unit=2*state.distance*Math.tan(state.fov*Math.PI/360)/r.height, right=rotate(state.rotation,[1,0,0]),up=rotate(state.rotation,[0,1,0]),step=24*unit;
    state.target=state.target.map((value,index)=>value-horizontal*step*right[index]+vertical*step*up[index]);
    state.actions++;
  }
  function levelHorizon(){
    const offset=normalize(rotate(state.rotation,[0,0,1])),horizontal=Math.hypot(offset[0],offset[2]),yaw=Math.atan2(offset[0],offset[2]),pitch=-Math.atan2(offset[1],horizontal||1);
    state.rotation=normalize(mul([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[Math.sin(pitch/2),0,0,Math.cos(pitch/2)]));
    state.actions++;
  }
  function focusOn(target,normal,radius){
    const direction=normalize(normal),worldUp=Math.abs(direction[1])>.98?[0,0,1]:[0,1,0],desiredUp=normalize(worldUp.map((value,index)=>value-direction[index]*dot(worldUp,direction))),distance=Math.max(.06,radius/(.666667*Math.tan(state.fov*Math.PI/360)));
    const start=[0,0,1],between=normalize([...cross(start,direction),1+dot(start,direction)]),currentUp=rotate(between,[0,1,0]),roll=Math.atan2(dot(direction,cross(currentUp,desiredUp)),dot(currentUp,desiredUp)),rollQ=[direction[0]*Math.sin(roll/2),direction[1]*Math.sin(roll/2),direction[2]*Math.sin(roll/2),Math.cos(roll/2)];
    state.target=[...target];state.distance=distance;state.rotation=normalize(mul(rollQ,between));state.actions++;
  }
  function setComparisonLayout(enabled){comparisonLayout=enabled;}
  function camera(index=active){const view=states[index],offset=rotate(view.rotation,[0,0,view.distance]);return {eye:view.target.map((v,i)=>v+offset[i]),target:[...view.target],up:rotate(view.rotation,[0,1,0]),fov:view.fov};}
  return {get state(){return state;},get activeView(){return active;},setActive,setActiveFromEvent,home,resetView,resetAllViews,camera,panScreen,levelHorizon,focusOn,setComparisonLayout,viewports};
};
