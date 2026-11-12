/* 7주차 기본 ray tracing 실습 1 시작 코드: TODO 1~3을 수업 페이지의 코드로 채운다. */
(() => {
  'use strict';
  const cv=document.querySelector('#cv'),gl=D.context(cv);
  if(!gl)return;
  const VS=`#version 300 es
  layout(location=0) in vec2 aPos;
  void main(){gl_Position=vec4(aPos,0.0,1.0);}`;
  const FS=`#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform vec3 uEye;
  uniform int uShadow;
  uniform vec4 uBodies[3];   // xyz = 중심, w = 반지름
  uniform vec3 uColors[3];
  out vec4 outColor;

  // TODO 1: 화면 픽셀에서 출발하는 카메라 광선의 방향을 만든다.
  vec3 cameraRay(vec2 pixel,vec3 eye){
   // return vec3(0.0,0.0,-1.0); // 시작 상태: 모두 같은 방향
   vec2 uv=(2.0*pixel-uRes)/uRes.y;
   vec3 target=vec3(0.0,0.0,-1.8);
   vec3 forward=normalize(target-eye);
   vec3 right=normalize(cross(forward,vec3(0.0,1.0,0.0)));
   vec3 up=cross(right,forward);
   return normalize(1.7*forward+uv.x*right+uv.y*up);
  }

  // TODO 2: 광선과 구의 가까운 양수 교차 거리 t를 계산한다.
  float hitSphere(vec3 ro,vec3 rd,vec3 center,float radius){
    // return -1.0; // 시작 상태: 모든 구를 놓친다
    vec3 oc=ro-center;
    float a=dot(rd,rd);
    float halfB=dot(oc,rd);
    float c=dot(oc,oc)-radius*radius;
    float disc=halfB*halfB-a*c;
    if(disc<0.0)return -1.0;
    float root=sqrt(disc);
    float t=(-halfB-root)/a;
    if(t>0.002)return t;
    t=(-halfB+root)/a;
    return t>0.002?t:-1.0;
  }

  float traceScene(vec3 ro,vec3 rd,out int hitId){
    float nearest=1e20;
    hitId=-1;
    for(int i=0;i<3;i++){
      float t=hitSphere(ro,rd,uBodies[i].xyz,uBodies[i].w);
      if(t>0.0&&t<nearest){nearest=t;hitId=i;}
    }
    // 넓은 관측실: 바닥(3)과 뒷벽(4)도 광선으로 직접 교차한다.
    if(abs(rd.y)>0.0001){
      float t=(-1.12-ro.y)/rd.y;
      vec3 p=ro+t*rd;
      if(t>0.002&&t<nearest&&abs(p.x)<3.0&&p.z> -4.5&&p.z<0.8){nearest=t;hitId=3;}
    }
    if(abs(rd.z)>0.0001){
      float t=(-4.5-ro.z)/rd.z;
      vec3 p=ro+t*rd;
      if(t>0.002&&t<nearest&&abs(p.x)<3.0&&p.y> -1.12&&p.y<1.85){nearest=t;hitId=4;}
    }
    return nearest;
  }

  vec3 surfaceColor(int id,vec3 p){
    if(id==1){
      float bands=0.76+0.24*sin(18.0*p.y+2.0*sin(4.0*p.x));
      return uColors[1]*bands;
    }
    if(id==3){
      float tile=mod(floor(p.x*3.0)+floor(p.z*3.0),2.0);
      return mix(vec3(0.13,0.18,0.24),vec3(0.56,0.63,0.69),tile);
    }
    if(id==4)return vec3(0.33,0.39,0.48);
    return uColors[id];
  }

  // TODO 3: 별의 직접광과 그림자 광선으로 색을 계산한다.
  vec3 shade(vec3 ro,vec3 rd,float t,int id){
    //return surfaceColor(id,ro+t*rd); // 시작 상태: 교차가 구현되면 평평한 색만 표시
    if(id==0)return uColors[0];
    //return surfaceColor(id,ro+t*rd); // 시작 상태: 교차가 구현되면 평평한 색만 표시
    vec3 p=ro+t*rd;
    vec3 N=id==3?vec3(0.0,1.0,0.0):id==4?vec3(0.0,0.0,1.0):normalize(p-uBodies[id].xyz);
    vec3 toStar=uBodies[0].xyz-p;
    float lightDistance=length(toStar);
    vec3 L=toStar/lightDistance;
    float visible=1.0;
    if(uShadow==1){
     int blockerId;
      float blockerT=traceScene(p+N*0.004,L,blockerId);
      if(blockerId>0&&blockerT<lightDistance-0.004)visible=0.0;
    }
    float diffuse=max(dot(N,L),0.0);
    float power=4.0/(1.0+0.18*lightDistance*lightDistance);
    float ambient=id==2?0.13:0.045;
    return surfaceColor(id,p)*(ambient+visible*diffuse*power);

  }

  vec3 displayColor(vec3 c){return pow(c/(1.0+c),vec3(1.0/2.2));}
  void main(){
    vec3 ro=uEye;
    vec3 rd=cameraRay(gl_FragCoord.xy,ro);
    int id;
    float t=traceScene(ro,rd,id);
    if(id<0){
      float sky=0.5+0.5*rd.y;
      outColor=vec4(vec3(0.015,0.025,0.05)+sky*vec3(0.035,0.055,0.09),1.0);
      return;
    }
    outColor=vec4(displayColor(shade(ro,rd,t,id)),1.0);
  }`;
  const program=D.program(gl,VS,FS),U=D.uniforms(gl,program,['uRes','uEye','uShadow','uBodies','uColors']);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);
  const S=D.UI('#ui',[
    {id:'shadow',type:'check',label:'그림자 광선',value:true},
    {id:'orbit',label:'위성 공전 위치',min:0,max:360,step:1,value:0,fmt:v=>`${Math.round(v)}°`},
    {id:'scale',label:'렌더 해상도',min:0.4,max:1,step:0.1,value:1}
  ]);
  const cam=D.orbit(cv,{dist:5.8,yaw:0.48,pitch:0.20,min:3.8,max:9});
  document.querySelector('#reset').onclick=()=>{cam.dist=5.8;cam.yaw=0.48;cam.pitch=0.20;};
  const bodies=new Float32Array([
    -2.10,1.00,0.70,0.42, // 0 별: 광원 겸 발광 구
     0.45,-0.12,-2.00,0.78, // 1 행성
     0.00,0.00,0.00,0.29 // 2 위성: 매 프레임 행성 주위를 공전
  ]);
  const colors=new Float32Array([4.0,2.7,0.8,0.50,0.71,0.95,0.82,0.85,0.88]);
  // 0°: 별—위성—행성(일식), 180°: 별—행성—위성(월식).
  const delta=[bodies[0]-bodies[4],bodies[1]-bodies[5],bodies[2]-bodies[6]];
  const deltaLength=Math.hypot(...delta);
  const starward=delta.map(v=>v/deltaLength);
  const sideLength=Math.hypot(starward[0],starward[2]);
  const sideways=[starward[2]/sideLength,0,-starward[0]/sideLength];
  function updateMoon(degrees){
    const a=degrees*Math.PI/180;
    for(let i=0;i<3;i++)bodies[8+i]=bodies[4+i]+1.50*(Math.cos(a)*starward[i]+Math.sin(a)*sideways[i]);
  }
  const orbitInput=document.querySelector('.ctl[data-id="orbit"] input');
  const orbitValue=document.querySelector('.ctl[data-id="orbit"] .val');
  const playButton=document.querySelector('#play');
  let playing=false;
  orbitInput.addEventListener('input',()=>{playing=false;playButton.textContent='공전 재생';});
  function setOrbit(degrees){
    S.orbit=(degrees+360)%360;
    orbitInput.value=Math.round(S.orbit);
    orbitValue.textContent=`${Math.round(S.orbit)}°`;
  }
  document.querySelector('#solar').onclick=()=>{
    playing=false;playButton.textContent='공전 재생';setOrbit(0);
    cam.yaw=-0.20;cam.pitch=0.20;cam.dist=5.8;
  };
  document.querySelector('#lunar').onclick=()=>{
    playing=false;playButton.textContent='공전 재생';setOrbit(180);
    cam.yaw=1.22;cam.pitch=0.28;cam.dist=5.8;
  };
  playButton.onclick=()=>{playing=!playing;playButton.textContent=playing?'공전 일시정지':'공전 재생';};
  let lastKey='',visible=true;
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(cv);
  D.loop((now,dt)=>{
    if(!visible||document.hidden)return;
    if(playing)setOrbit(S.orbit+30*Math.min(dt,0.05));
    updateMoon(S.orbit);
    D.fit(cv,S.scale);
    const key=[cv.width,cv.height,S.shadow,S.orbit,cam.yaw,cam.pitch,cam.dist].join('|');
    if(key===lastKey)return;
    lastKey=key;
    gl.viewport(0,0,cv.width,cv.height);gl.useProgram(program);
    gl.uniform2f(U.uRes,cv.width,cv.height);
    gl.uniform3fv(U.uEye,cam.eye([0,0,-2]));
    gl.uniform1i(U.uShadow,S.shadow?1:0);
    gl.uniform4fv(U.uBodies,bodies);
    gl.uniform3fv(U.uColors,colors);
    gl.bindVertexArray(vao);gl.drawArrays(gl.TRIANGLES,0,6);gl.bindVertexArray(null);
    const angle=S.orbit;
    const event=angle<18||angle>342?'일식: 위성 그림자가 행성에 생깁니다.':angle>162&&angle<198?'월식: 위성이 행성 그림자에 들어갑니다.':'식이 아닌 공전 위치입니다.';
    document.querySelector('#status').textContent=`${event} 카메라 광선 → 구 교차 → 그림자 순서로 확인하세요.`;
  });
})();
