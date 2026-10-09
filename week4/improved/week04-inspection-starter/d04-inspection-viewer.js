/* WebGL2 렌더러. drawView를 여러 번 호출하면 분할 뷰를 구성할 수 있습니다.
   기본 기능은 트랙볼/이동/거리 조절/전체 보기뿐이며 자동 안내는 구현하지 않습니다. */
(() => {
  'use strict';
  const canvas=document.querySelector('#cv'),gl=canvas.getContext('webgl2',{antialias:true}),read=document.querySelector('#readings');
  if(!gl){read.textContent='WebGL2를 사용할 수 없습니다. 지원하는 브라우저에서 열어 주세요.';return;}
  const M=D.M4,model=window.InspectionModel,controls=window.InspectionControls(canvas);
  const program=D.program(gl,`#version 300 es
    layout(location=0) in vec3 aPos;layout(location=1) in vec3 aNormal;layout(location=2) in vec2 aUV;
    uniform mat4 uModel,uVP;uniform mat3 uNormal;out vec3 vN;out vec2 vUV;
    void main(){vN=uNormal*aNormal;vUV=aUV;gl_Position=uVP*uModel*vec4(aPos,1.0);}
  `,`#version 300 es
    precision highp float;in vec3 vN;in vec2 vUV;uniform vec3 uColor;uniform bool uText;uniform sampler2D uMap;uniform float uAlpha;out vec4 outColor;
    void main(){if(uText){vec4 tex=texture(uMap,vUV);outColor=vec4(tex.rgb,tex.a*uAlpha);return;}float light=.48+.52*max(dot(normalize(vN),normalize(vec3(.4,1,.6))),0.0);outColor=vec4(uColor*light,uAlpha);}
  `);
  const U=D.uniforms(gl,program,['uModel','uVP','uNormal','uColor','uText','uMap','uAlpha']);
  const cube=D.upload(gl,D.cube(1));
  const plane=D.upload(gl,{pos:new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0]),nrm:new Float32Array([0,0,1,0,0,1,0,0,1,0,0,1]),uv:new Float32Array([0,0,1,0,1,1,0,1]),idx:new Uint16Array([0,1,2,0,2,3])});
  function makeGrid(width,height,cellSize=40,lineWidth=1){
    const rows=Math.ceil(height/cellSize),columns=Math.ceil(width/cellSize),xThickness=lineWidth/width,yThickness=lineWidth/height;
    const positions=[],normals=[],uvs=[],indices=[];
    const addLine=(x1,y1,x2,y2)=>{const offset=positions.length/3;positions.push(x1,y1,0,x2,y1,0,x2,y2,0,x1,y2,0);normals.push(0,0,1,0,0,1,0,0,1,0,0,1);uvs.push(0,0,0,0,0,0,0,0);indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);};
    for(let column=0;column<=columns;column++){const x=-1+2*Math.min(column*cellSize,width)/width;addLine(x-xThickness,-1,x+xThickness,1);}
    for(let row=0;row<=rows;row++){const y=-1+2*Math.min(row*cellSize,height)/height;addLine(-1,y-yThickness,1,y+yThickness);}
    return D.upload(gl,{pos:new Float32Array(positions),nrm:new Float32Array(normals),uv:new Float32Array(uvs),idx:new Uint16Array(indices)});
  }
  const grids=new Map();
  function getGrid(width,height){const key=`${width}x${height}`;if(!grids.has(key))grids.set(key,makeGrid(width,height));return grids.get(key);}
  function matrix(position,size,yaw=0){const m=M.create();M.translate(m,m,position);M.rotateY(m,m,yaw);M.scale(m,m,size);return m;}
  const parts=model.boxes.map(p=>({...p,matrix:matrix(p.position,p.size)}));
  function texture(sign){
    const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');
    ctx.fillStyle='#fff9e9';ctx.fillRect(0,0,512,256);ctx.fillStyle='#122337';ctx.fillRect(0,0,512,62);
    ctx.fillStyle='#ffffff';ctx.font='bold 40px sans-serif';ctx.textAlign='center';ctx.fillText(sign.id,256,46);
    ctx.fillStyle='#122337';ctx.font='bold 60px sans-serif';ctx.fillText(sign.text[0],256,140);ctx.fillText(sign.text[1],256,220);
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,c);
    gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    return tex;
  }
  const signs=model.signs.map(p=>({...p,matrix:matrix(p.position,[...p.size,1],p.yaw),texture:texture(p)}));
  const add=(a,b)=>a.map((value,index)=>value+b[index]);
  const scale=(v,s)=>v.map(value=>value*s);
  const sub=(a,b)=>a.map((value,index)=>value-b[index]);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const normalize=v=>{const length=Math.hypot(...v)||1;return v.map(value=>value/length);};
  function rayBoxDistance(origin,direction,center,size){
    const min=center.map((value,index)=>value-size[index]/2),max=center.map((value,index)=>value+size[index]/2);let near=0,far=Infinity;
    for(let axis=0;axis<3;axis++){
      if(Math.abs(direction[axis])<1e-8){if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;continue;}
      let first=(min[axis]-origin[axis])/direction[axis],last=(max[axis]-origin[axis])/direction[axis];
      if(first>last)[first,last]=[last,first];near=Math.max(near,first);far=Math.min(far,last);if(near>far)return null;
    }
    return far<0?null:near>=0?near:far;
  }
  function rayBoxHit(origin,direction,center,size){
    const min=center.map((value,index)=>value-size[index]/2),max=center.map((value,index)=>value+size[index]/2);let near=0,far=Infinity,nearAxis=-1,nearSign=0,farAxis=-1,farSign=0;
    for(let axis=0;axis<3;axis++){
      if(Math.abs(direction[axis])<1e-8){if(origin[axis]<min[axis]||origin[axis]>max[axis])return null;continue;}
      let first=(min[axis]-origin[axis])/direction[axis],last=(max[axis]-origin[axis])/direction[axis],firstSign=-1,lastSign=1;
      if(first>last){[first,last]=[last,first];[firstSign,lastSign]=[lastSign,firstSign];}
      if(first>near){near=first;nearAxis=axis;nearSign=firstSign;}
      if(last<far){far=last;farAxis=axis;farSign=lastSign;}
      if(near>far)return null;
    }
    if(far<0)return null;
    const distance=near>=0?near:far,axis=near>=0?nearAxis:farAxis,sign=near>=0?nearSign:farSign;
    if(axis<0)return null;
    const normal=[0,0,0];normal[axis]=sign;return {distance,normal};
  }
  function pickAt(event){
    const rect=canvas.getBoundingClientRect(),index=controls.activeView,view=controls.viewports(rect.width,rect.height)[index],localX=event.clientX-rect.left-view.left,localY=event.clientY-rect.top-view.top;
    if(localX<0||localX>view.width||localY<0||localY>view.height)return null;
    const camera=controls.camera(index),forward=normalize(sub(camera.target,camera.eye)),right=normalize(cross(forward,camera.up||[0,1,0])),up=normalize(cross(right,forward)),aspect=view.width/view.height,tangent=Math.tan((camera.fov||45)*Math.PI/360),horizontal=2*localX/view.width-1,vertical=1-2*localY/view.height;
    const direction=normalize(add(forward,add(scale(right,horizontal*tangent*aspect),scale(up,vertical*tangent)))),candidates=[...parts,...signs.map(sign=>({...sign,size:[sign.size[0],sign.size[1],.08]}))];
    let selected=null,distance=Infinity;
    for(const object of candidates){if(hidden.has(object.id)||hidden.has(object.group))continue;const hit=rayBoxDistance(camera.eye,direction,object.position,object.size);if(hit!==null&&hit<distance){selected=object;distance=hit;}}
    return selected?.id||null;
  }
  function pickFocusAt(event){
    const rect=canvas.getBoundingClientRect(),index=controls.activeView,view=controls.viewports(rect.width,rect.height)[index],localX=event.clientX-rect.left-view.left,localY=event.clientY-rect.top-view.top;
    if(localX<0||localX>view.width||localY<0||localY>view.height)return null;
    const camera=controls.camera(index),forward=normalize(sub(camera.target,camera.eye)),right=normalize(cross(forward,camera.up||[0,1,0])),up=normalize(cross(right,forward)),aspect=view.width/view.height,tangent=Math.tan((camera.fov||45)*Math.PI/360),horizontal=2*localX/view.width-1,vertical=1-2*localY/view.height,direction=normalize(add(forward,add(scale(right,horizontal*tangent*aspect),scale(up,vertical*tangent)))),candidates=[...parts,...signs.map(sign=>({...sign,size:[sign.size[0],sign.size[1],.08]}))];
    let selected=null,distance=Infinity,normal=null;
    for(const object of candidates){if(hidden.has(object.id)||hidden.has(object.group))continue;const hit=rayBoxHit(camera.eye,direction,object.position,object.size);if(hit&&hit.distance<distance){selected=object;distance=hit.distance;normal=hit.normal;}}
    return selected?{target:selected.position,normal,radius:Math.hypot(...selected.size)/2}:null;
  }
  const view=M.create(),projection=M.create(),vp=M.create();
  const hidden=new Set();
  function drawMesh(mesh,m,color,text=false,alpha=1){gl.uniformMatrix4fv(U.uModel,false,m);gl.uniformMatrix3fv(U.uNormal,false,M.normalFrom(m));gl.uniform3fv(U.uColor,color);gl.uniform1i(U.uText,text?1:0);gl.uniform1f(U.uAlpha,alpha);gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);}
  function containsPoint(point,center,size){return point.every((value,index)=>Math.abs(value-center[index])<=size[index]/2);}
  function drawSign(sign,alpha=1){
    drawMesh(plane,sign.matrix,[.25,.28,.32],false,alpha);gl.enable(gl.CULL_FACE);gl.depthFunc(gl.LEQUAL);gl.bindTexture(gl.TEXTURE_2D,sign.texture);drawMesh(plane,sign.matrix,[1,1,1],true,alpha);gl.depthFunc(gl.LESS);gl.disable(gl.CULL_FACE);
  }
  function drawComparisonGrid(width,height){
    gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    const identity=M.create();gl.uniformMatrix4fv(U.uVP,false,identity);drawMesh(getGrid(width,height),identity,[.2,.2,.2],false,.35);gl.uniformMatrix4fv(U.uVP,false,vp);
    gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);
  }
  // viewport: 그리기 버퍼의 픽셀 좌표 [x,y,width,height]. 원점은 왼쪽 아래입니다.
  function drawView(camera,viewport=[0,0,canvas.width,canvas.height],filter=null,gridView=false){
    const [x,y,w,h]=viewport;if(w<=0||h<=0)return;
    gl.viewport(x,y,w,h);gl.enable(gl.SCISSOR_TEST);gl.scissor(x,y,w,h);D.clearColor(gl);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.SCISSOR_TEST);
    M.lookAt(view,camera.eye,camera.target,camera.up||[0,1,0]);
    if(camera.orthographic){const half=camera.halfHeight||8;M.ortho(projection,-half*w/h,half*w/h,-half,half,camera.near||.02,camera.far||180);}
    else M.perspective(projection,(camera.fov||controls.state.fov)*Math.PI/180,w/h,camera.near||.02,camera.far||180);
    M.multiply(vp,projection,view);gl.useProgram(program);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform1i(U.uMap,0);gl.activeTexture(gl.TEXTURE0);
    if(gridView)drawComparisonGrid(w,h);
    const transparentParts=new Set(parts.filter(part=>containsPoint(camera.eye,part.position,part.size)).map(part=>part.id));
    const transparentSigns=new Set(signs.filter(sign=>containsPoint(camera.eye,sign.position,[sign.size[0],sign.size[1],.08])).map(sign=>sign.id));
    gl.disable(gl.CULL_FACE);
    for(const p of parts)if(!hidden.has(p.id)&&!hidden.has(p.group)&&(!filter||filter.has(p.id)||filter.has(p.group))&&!transparentParts.has(p.id))drawMesh(cube,p.matrix,p.color);
    // 명판의 뒷면은 어두운 무지 면으로 표시하고 앞쪽에서만 글자를 읽습니다.
    for(const s of signs)if(!hidden.has(s.id)&&!hidden.has(s.group)&&(!filter||filter.has(s.id)||filter.has(s.group))&&!transparentSigns.has(s.id))drawSign(s);
    if(transparentParts.size||transparentSigns.size){
      gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
      for(const p of parts)if(transparentParts.has(p.id)&&!hidden.has(p.id)&&!hidden.has(p.group))drawMesh(cube,p.matrix,p.color,false,.35);
      for(const s of signs)if(transparentSigns.has(s.id)&&!hidden.has(s.id)&&!hidden.has(s.group))drawSign(s,.35);
      gl.depthMask(true);gl.disable(gl.BLEND);
    }
  }
  gl.enable(gl.DEPTH_TEST);
  let started=null,last='';
  const api={canvas,gl,model,controls,hidden,drawView,render:null};window.InspectionViewer=api;
  document.querySelector('#home').addEventListener('click',()=>{controls.home();controls.state.actions++;});
  document.querySelector('#measure').addEventListener('click',()=>{started=performance.now();controls.state.actions=0;});
  const viewport=document.querySelector('.viewport'),compareButton=document.querySelector('#compare-mode');
  const previousStepButton=document.querySelector('#step-previous'),nextStepButton=document.querySelector('#step-next');
  const stepIndicator=document.querySelector('#step-indicator');
  let inspectionStep=0;
  function showInspectionStep(step){
    inspectionStep=step<1?model.poi.length:step>model.poi.length?1:step;
    stepIndicator.value='P'+inspectionStep;
    stepIndicator.textContent='P'+inspectionStep;
    const point=model.poi[inspectionStep-1],sign=signs.find(item=>item.id===point.id);
    if(!sign)return;
    controls.focusOn(sign.position,[Math.sin(sign.yaw),0,Math.cos(sign.yaw)],point.size[0]/2,250,2000);
  }
  previousStepButton.addEventListener('click',()=>showInspectionStep(inspectionStep===0?model.poi.length:inspectionStep-1));
  nextStepButton.addEventListener('click',()=>showInspectionStep(inspectionStep===0?1:inspectionStep+1));
  let comparisonMode=false;
  compareButton.addEventListener('click',()=>{
    comparisonMode=!comparisonMode;controls.setComparisonLayout(comparisonMode);viewport.classList.toggle('compare-mode',comparisonMode);compareButton.classList.toggle('active',comparisonMode);
    if(comparisonMode){controls.setTarget(0,model.comparisons.find(item=>item.id==='O1').position);controls.setTarget(2,model.comparisons.find(item=>item.id==='O2').position);}
  });
  document.querySelector('#reset-view').addEventListener('click',()=>controls.resetAllViews());
  document.querySelector('#level-horizon').addEventListener('click',()=>controls.levelHorizon());
  const hideButton=document.querySelector('#hide-mode'),unhideButton=document.querySelector('#unhide-all');
  let hideMode=false;
  function setHideMode(enabled){hideMode=enabled;viewport.classList.toggle('hide-mode',enabled);hideButton.classList.toggle('active',enabled);hideButton.textContent=enabled?'숨기기 종료':'숨기기';}
  hideButton.addEventListener('click',()=>setHideMode(!hideMode));
  unhideButton.addEventListener('click',()=>{hidden.clear();setHideMode(false);});
  canvas.addEventListener('pointerdown',event=>{
    if(!hideMode)return;
    event.preventDefault();event.stopImmediatePropagation();controls.setActiveFromEvent(event);
    const id=pickAt(event);if(id)hidden.add(id);
  },true);
  canvas.addEventListener('dblclick',event=>{
    if(hideMode)return;
    controls.setActiveFromEvent(event);
    const picked=pickFocusAt(event);if(picked)controls.focusOn(picked.target,picked.normal,picked.radius);
  });
  document.querySelectorAll('[data-pan]').forEach(button=>button.addEventListener('click',()=>{const [horizontal,vertical]=button.dataset.pan.split(',').map(Number);controls.panScreen(horizontal,vertical);}));
  canvas.addEventListener('click',e=>controls.setActiveFromEvent(e));
  const quadLayout=document.querySelector('.quad-borders'),quadBorders=document.querySelectorAll('.quad-border');
  document.querySelector('#level-horizon').addEventListener('click',()=>controls.levelHorizon());
  for(const p of model.tasks){const li=document.createElement('li');const title=document.createElement('strong');title.textContent=p.id+' '+p.name;li.append(title,document.createElement('br'),document.createTextNode(p.task));document.querySelector('#tasks').appendChild(li);}
  D.loop(()=>{
    const r=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    if(api.render)api.render(api);else if(comparisonMode){
      const halfWidth=canvas.width/2,halfHeight=canvas.height/2,scale=3.5/3/2*1.8,initialDistance=30/1.3;
      const ortho=index=>{const camera=controls.camera(index);return {...camera,orthographic:true,halfHeight:scale*camera.distance/initialDistance};};
      drawView(ortho(0),[0,halfHeight,halfWidth,halfHeight],new Set(['comparison-front']),'O1');
      drawView(controls.camera(1),[halfWidth,halfHeight,halfWidth,halfHeight]);
      drawView(ortho(2),[0,0,halfWidth,halfHeight],new Set(['comparison-side']),'O2');
      drawView(controls.camera(3),[halfWidth,0,halfWidth,halfHeight]);
    }else{
      const views=controls.viewports(canvas.width,canvas.height);
      for(let index=0;index<4;index++){
        const view=views[index],x=Math.round(view.left),y=Math.round(canvas.height-view.top-view.height),width=Math.round(view.width),height=Math.round(view.height);
        drawView(controls.camera(index),[x,y,width,height]);
      }
    }
    const active=controls.activeView,scale=1.35;
    quadLayout.style.gridTemplateColumns=`${active%2===0?scale:1}fr ${active%2===1?scale:1}fr`;
    quadLayout.style.gridTemplateRows=`${active<2?scale:1}fr ${active>=2?scale:1}fr`;
    quadBorders.forEach((border,index)=>border.classList.toggle('active',index===controls.activeView));
    const s=controls.state,value=`기본 트랙볼 · 거리 ${s.distance.toFixed(2)}m · FOV ${s.fov}°\n회전 중심 (${s.target.map(v=>v.toFixed(2)).join(', ')})\n측정 ${started===null?'시작 전':((performance.now()-started)/1000).toFixed(0)+'초'} · 기본 조작 ${s.actions}회`;
    if(value!==last){read.textContent=value;last=value;}
  });
})();
