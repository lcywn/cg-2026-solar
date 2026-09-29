/* 가상 구(arcball)에 포인터를 투영하는 기본 트랙볼.
   회전 상태는 쿼터니언이며 카메라의 eye/up을 함께 회전합니다. */
window.InspectionControls = function(canvas) {
  const normalize=v=>{const n=Math.hypot(...v)||1;return v.map(x=>x/n);};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const mul=(a,b)=>[
    a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
    a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
    a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const rotate=(q,v)=>mul(mul(q,[...v,0]),[-q[0],-q[1],-q[2],q[3]]).slice(0,3);
  const state={target:[3,3,0],distance:30,rotation:[0,0,0,1],fov:45,actions:0};
  function home(){state.target=[3,3,0];state.distance=30;state.rotation=normalize(mul([0,Math.sin(.3),0,Math.cos(.3)],[Math.sin(-.22),0,0,Math.cos(.22)]));state.fov=45;}
  home();
  function sphere(e){const r=canvas.getBoundingClientRect(),s=Math.min(r.width,r.height),x=(2*(e.clientX-r.left)-r.width)/s,y=(r.height-2*(e.clientY-r.top))/s,d=x*x+y*y;return d<=1?[x,y,Math.sqrt(1-d)]:normalize([x,y,0]);}
  let drag=null;
  canvas.style.touchAction='none';
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(drag || ![0,2].includes(e.button))return;
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
      state.rotation=normalize(mul(drag.q,normalize(q)));
    }
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
  canvas.addEventListener('wheel',e=>{e.preventDefault();state.distance=Math.max(.12,Math.min(100,state.distance*Math.exp(e.deltaY*.001)));state.actions++;},{passive:false});
  canvas.addEventListener('keydown',e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(e.key))return;e.preventDefault();state.actions++;
    if(e.key==='Home'){home();return;}
    if(e.key==='+')state.distance=Math.max(.12,state.distance/1.12);
    else if(e.key==='-')state.distance=Math.min(100,state.distance*1.12);
    else {const h=e.key==='ArrowLeft'?.06:e.key==='ArrowRight'?-.06:0,v=e.key==='ArrowUp'?.06:e.key==='ArrowDown'?-.06:0;state.rotation=normalize(mul(state.rotation,normalize([v,h,0,1])));}
  });
  function camera(){const offset=rotate(state.rotation,[0,0,state.distance]);return {eye:state.target.map((v,i)=>v+offset[i]),target:[...state.target],up:rotate(state.rotation,[0,1,0])};}
  return {state,home,camera};
};
