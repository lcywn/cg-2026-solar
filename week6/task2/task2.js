(() => {
'use strict';

const cv = document.querySelector('#cv');
const gl = D.context(cv);
if (!gl) return;

const VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uVP,uModel;
out vec3 vP,vN;
out vec2 vUV;
out vec3 vLocal;


void main(){
 vec4 world=uModel*vec4(aPos,1.0);
 vP=world.xyz;
 vN=mat3(uModel)*aNormal;
 vUV=aUV;
 vLocal=aPos;
 gl_Position=uVP*world;
}`;

const FS = `#version 300 es
precision highp float;
const float PI=3.14159265;
in vec3 vP,vN;
in vec2 vUV;
in vec3 vLocal;

out vec4 outColor;
uniform sampler2D uColor,uNormal,uARM,uEnv;
uniform vec3 uEye,uLight,uLightColor,uTint;
uniform float uRough,uMetal,uNormalStrength,uPower,uAmbient,uEnvPower;
uniform bool uEmissive,uUseMaps;
uniform bool uIsIcePlanet; //중앙행성이면 t, 아니면 f... 얼음행성 색변경용
uniform bool uSurfaceChanges;
uniform float uStarDistance;
uniform bool uChocolateMaskView;
uniform float uEruption;       // 카다이프 분출 강도
uniform float uTime;           // 애니메이션 시간
uniform float uFlowReach;      // 현재 줄기가 뻗은 길이
uniform bool uKataifiMaskView; // 흑백 마스크 보기

vec3 srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
vec3 linearToSrgb(vec3 c){
 return mix(12.92*c,1.055*pow(c,vec3(1.0/2.4))-.055,step(vec3(.0031308),c));
}
vec3 directPBR(vec3 N,vec3 V,vec3 L,vec3 base,float rough,float metal,vec3 radiance){
 vec3 H=normalize(V+L);
 float nl=max(dot(N,L),0.0),nv=max(dot(N,V),0.0);
 float nh=max(dot(N,H),0.0),vh=max(dot(V,H),0.0);
 float a=rough*rough,a2=a*a;
 float den=nh*nh*(a2-1.0)+1.0;
 float D=a2/max(PI*den*den,1e-6);
 float k=(rough+1.0)*(rough+1.0)/8.0;
 float G=(nl/(nl*(1.0-k)+k))*(nv/(nv*(1.0-k)+k));
 vec3 F0=mix(vec3(.04),base,metal);
 vec3 F=F0+(1.0-F0)*pow(1.0-vh,5.0);
 vec3 kd=(1.0-F)*(1.0-metal);
 return (kd*base/PI+D*G*F/max(4.0*nl*nv,1e-4))*nl*radiance;
}

void main(){
 if(uEmissive){
  outColor=vec4(linearToSrgb(uTint),1.0);
  return;
 }

 vec3 N=normalize(vN),V=normalize(uEye-vP);
 vec3 base=uTint;
 float ao=1.0,rough=uRough,metal=uMetal;
 if(uUseMaps){
  vec3 textureColor=srgbToLinear(texture(uColor,vUV).rgb);
  base=uIsIcePlanet
   ? vec3(dot(textureColor,vec3(.2126,.7152,.0722)))*uTint
   : textureColor*uTint;

  vec3 arm=texture(uARM,vUV).rgb;
  ao=arm.r;
  rough=max(arm.g*uRough,.045);
  metal=arm.b*uMetal;
 }
   // 중앙 우유얼음 행성에만 초콜릿 코팅 적용
 if(uIsIcePlanet){

  // 극지방일수록 1, 적도일수록 0
  float latitude=abs(normalize(vLocal).y);

  // 초콜릿 경계를 불규칙하게 만들기
  float noise=sin(vLocal.x*12.0)*sin(vLocal.z*15.0)*0.08;

  // 태양에서 멀어질수록 초콜릿 코팅 확대
  float boundary=mix(1.15,-0.28,uStarDistance);

  float chocolateMask=smoothstep(
   boundary-0.06,
   boundary+0.06,
   latitude+noise
  );

  // 흑백 마스크 진단
  if(uChocolateMaskView){
   outColor=vec4(vec3(uSurfaceChanges?chocolateMask:0.0),1.0);
   return;
  }

  // 색상과 roughness 변화
  if(uSurfaceChanges){
   base=mix(base,vec3(0.16,0.055,0.025),chocolateMask);
   rough=mix(rough,0.22,chocolateMask);
  }
 }


 // ===== 카다이프 화산 =====
 if(uIsIcePlanet){

  vec3 pos=normalize(vLocal);
  vec3 center=normalize(vec3(0.0,0.5,0.866));

  vec3 right=normalize(cross(vec3(0,1,0),center));
  vec3 up=normalize(cross(center,right));

  // 분화구에서 얼마나 떨어졌는지
  float r=acos(clamp(dot(pos,center),-1.0,1.0));
  float angle=atan(dot(pos,up),dot(pos,right));

  // 각도에 따라 가장자리를 불규칙하게 만들어 둥근 화구에 뾰족한 암석을 더한다.
  float craterRadius=0.095
      +0.012*sin(angle*5.0+0.4)
      +0.009*sin(angle*9.0-0.8)
      +0.018*pow(abs(sin(angle*6.0+0.3)),3.0);
  float craterInterior=1.0-smoothstep(craterRadius-0.008,craterRadius+0.006,r);
  float craterOuter=1.0-smoothstep(craterRadius+0.035,craterRadius+0.055,r);
  float craterRim=craterOuter*(1.0-craterInterior);

  // 2. 굵고 구불구불한 분출 영역
  // 방향에 따라 흐름이 불규칙하게 휘어지도록 계산
  float curve=
      0.23*sin(angle*3.0+r*3.5)
     +0.14*sin(angle*2.0-r*5.0+1.3)
     +0.08*sin(angle*5.0+r*2.0);

  // 작은 표면 굴곡
  float noise=
      sin(pos.x*17.0+pos.z*11.0)
     *sin(pos.y*21.0-pos.x*13.0)*0.045;

  // 3. 분화구에서 바깥으로 차오르는 경계
  float speed=2.0+uEruption*8.0;

  // 새 분출물이 바깥으로 밀려나는 울컥거림
  float pulse=0.04*uEruption*
      sin(r*16.0-uTime*speed);

  float front=max(0.0,
      uFlowReach*(0.75+curve)
      +noise*uEruption
      +pulse
  );

  // 경계 안쪽을 전부 초록색으로 채움
  float flowMask=1.0-smoothstep(
      front-0.07,
      front+0.04,
      r
  );

  // 4. 퍼진 영역 사이에 원래 표면이 조금 남도록
  float patches=
      sin(pos.x*11.0+pos.y*6.0)
     *sin(pos.z*13.0-pos.y*8.0);

  float gaps=smoothstep(-0.8,-0.25,patches);

  // 분화구 근처는 연결, 바깥쪽은 불규칙하게
  float outer=smoothstep(0.18,0.55,r);

  flowMask*=mix(1.0,0.35+0.65*gaps,outer*0.65);
  flowMask*=uEruption;
  //flowMask *= step(0.001, uFlowReach);

  // 5. 피스타치오 초록색
  vec3 green=srgbToLinear(vec3(0.32,0.52,0.17));
  vec3 gold=srgbToLinear(vec3(0.92,0.72,0.32));

  // 6. 작은 카다이프 조각 (짧은 세로선)
  vec2 p=vec2(dot(pos,right),dot(pos,up))*55.0;
  vec2 cell=floor(p);
  vec2 f=fract(p);

  float random=fract(sin(
      dot(cell,vec2(127.1,311.7))
  )*43758.5453);

  // 드문드문 황금색 조각 배치
  float particle=
      step(0.93,random)
     *(1.0-smoothstep(0.06,0.11,abs(f.x-0.5)))
     *(1.0-smoothstep(0.23,0.32,abs(f.y-0.5)));

  vec3 kataifiColor=mix(green,gold,particle);

  // 7. 흑백 마스크 진단
  if(uKataifiMaskView){
    outColor=vec4(vec3(uSurfaceChanges?flowMask:0.0),1.0);
    return;
  }

  if(uSurfaceChanges){
  // 8. 카다이프 PBR 재질 적용
  base=mix(base,kataifiColor,flowMask);
  rough=mix(rough,0.85,flowMask);

  // 기존 암석 텍스처의 명암을 갈색 화구 테두리에도 유지한다.
  vec3 rockColor=srgbToLinear(texture(uColor,vUV).rgb);
  float rockDetail=dot(rockColor,vec3(.2126,.7152,.0722));
  vec3 rimColor=vec3(0.20,0.075,0.032)*(0.65+0.7*rockDetail);
  float innerDepth=1.0-smoothstep(0.0,craterRadius,r);
  vec3 innerColor=mix(vec3(0.035,0.012,0.005),vec3(0.008,0.003,0.002),innerDepth);
  base=mix(base,rimColor,craterRim);
  base=mix(base,innerColor,craterInterior);
  rough=mix(rough,0.9,craterOuter);
  }
 }



 if(uUseMaps&&uNormalStrength>0.0){
  vec3 dp1=dFdx(vP),dp2=dFdy(vP);
  vec2 du1=dFdx(vUV),du2=dFdy(vUV);
  vec3 T=cross(dp2,N)*du1.x+cross(N,dp1)*du2.x;
  vec3 B=cross(dp2,N)*du1.y+cross(N,dp1)*du2.y;
  float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-20));
  vec3 mapN=texture(uNormal,vUV).xyz*2.0-1.0;
  mapN.xy*=uNormalStrength;
  N=normalize(mat3(T*inv,B*inv,N)*normalize(mapN));
 }

 vec3 toLight=uLight-vP;
 float distanceToLight=length(toLight);
 vec3 L=toLight/max(distanceToLight,1e-5);
 vec3 radiance=uLightColor*uPower/(1.0+.08*distanceToLight*distanceToLight);
 vec3 color=directPBR(N,V,L,base,rough,metal,radiance);
 vec3 F0=mix(vec3(.04),base,metal);
 color+=uAmbient*ao*(base*(1.0-metal)*(1.0-F0)+F0);

 vec3 reflected=reflect(-V,N);
 vec2 envUV=vec2(atan(reflected.z,reflected.x)/(2.0*PI)+.5,
                 asin(clamp(reflected.y,-1.0,1.0))/PI+.5);
 vec3 envColor=srgbToLinear(textureLod(uEnv,envUV,rough*7.0).rgb);
 color+=uEnvPower*ao*envColor*F0;

 color=max(color,vec3(0.0));
 color=color/(1.0+color);
 outColor=vec4(linearToSrgb(color),1.0);
}`;

const prog = D.program(gl, VS, FS);
const U = D.uniforms(gl, prog, [
 'uVP','uModel','uEye','uLight','uLightColor','uTint',
 'uRough','uMetal','uNormalStrength','uPower','uAmbient','uEnvPower',
// 'uEmissive','uUseMaps','uIsIcePlanet','uColor','uNormal','uARM','uEnv'
 'uEmissive','uUseMaps','uIsIcePlanet','uSurfaceChanges',
 'uStarDistance','uChocolateMaskView',
 'uEruption','uTime','uFlowReach','uKataifiMaskView',
 'uColor','uNormal','uARM','uEnv'
]);
const sphere = D.upload(gl, D.revolution(D.profiles.sphere(1, 48), 96));
const floor = D.upload(gl,{
 pos:new Float32Array([-8,0,-8, 8,0,-8, 8,0,8, -8,0,8]),
 nrm:new Float32Array([0,1,0, 0,1,0, 0,1,0, 0,1,0]),
 uv:new Float32Array([0,0, 1,0, 1,1, 0,1]),
 idx:new Uint16Array([0,2,1, 0,3,2])
});
const textures = {};
let failed = false;

function loadTexture(name, extension, fallback) {
 const texture = gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D, texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(fallback));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);
 const promise = new Promise(resolve => {
  const image = new Image();
  image.onload = () => {
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
   gl.generateMipmap(gl.TEXTURE_2D);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
   resolve();
  };
  image.onerror = () => { failed = true; resolve(); };
  image.src = 'assets/week06/'+name+'.'+extension;
 });
 return {texture,promise};
}

const rock = 'rock_boulder_dry';
[
 ['color',rock+'_Diffuse','jpg',[128,128,128,255]],
 ['normal',rock+'_nor_gl','jpg',[128,128,255,255]],
 ['arm',rock+'_arm','png',[255,180,0,255]],
 ['env','studio_small_09_tonemapped','jpg',[96,96,96,255]],
].forEach(([key,name,extension,fallback]) => {
 const loaded=loadTexture(name,extension,fallback);
 textures[key]=loaded.texture;
 textures[key+'_ready']=loaded.promise;
});

Promise.all(Object.values(textures).filter(value => value instanceof Promise)).then(() => {
 if (failed) {
  const status=document.querySelector('#status');
  status.textContent='텍스처를 불러오지 못했습니다. HTTP 서버와 assets/week06 경로를 확인해 주세요.';
  status.hidden=false;
 }
});

const initialCamera={dist:11,yaw:.6,pitch:.35};
const cam = D.orbit(cv,{...initialCamera,min:3,max:20});
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create();
const model=D.M4.create();
const target=[0,1,0];
const starOrbit=document.querySelector('#star-orbit');
const moonOrbit=document.querySelector('#moon-orbit');
const resultView=document.querySelector('#result-view');
const motionToggle=document.querySelector('#motion-toggle');
const surfaceToggle=document.querySelector('#surface-toggle');
document.querySelector('#camera-reset').addEventListener('click',()=>{
 Object.assign(cam,initialCamera);
});
const starDistance={min:1.18,max:5};
const moonDistance={min:1.47,max:4.13};
let starAngle,moonAngle;
let flowReach=0;
let motionPlaying=true,surfaceChanges=true;
let simulationTime=performance.now()*.001;
let clockUpdatedAt=simulationTime,previousFrameTime=simulationTime;

function updateSimulationClock(now) {
 if(motionPlaying) simulationTime+=now-clockUpdatedAt;
 clockUpdatedAt=now;
}

motionToggle.addEventListener('click',()=>{
 updateSimulationClock(performance.now()*.001);
 motionPlaying=!motionPlaying;
 motionToggle.textContent=motionPlaying?'모션 일시정지':'모션 재생';
});
surfaceToggle.addEventListener('click',()=>{
 surfaceChanges=!surfaceChanges;
 surfaceToggle.textContent=surfaceChanges?'기본 행성 보기':'변화한 행성 보기';
});
[starOrbit,moonOrbit].forEach(input=>{
 const value=document.querySelector('#'+input.id+'-value');
 const updateValue=()=>{ value.textContent=input.value; };
 input.addEventListener('input',updateValue);
 updateValue();
});

function orbitRadius(input,distance) {
 const fraction=(Number(input.value)-Number(input.min))/(Number(input.max)-Number(input.min));
 return distance.min+fraction*(distance.max-distance.min);
}

function bindTexture(texture,unit,uniform) {
 gl.activeTexture(gl.TEXTURE0+unit);
 gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.uniform1i(U[uniform],unit);
}

function draw(mesh,transform,options) {
 const {tint,emissive=false,useMaps=false,isIcePlanet=false,rough=.8,metal=.08,normalStrength=0}=options;
 gl.uniformMatrix4fv(U.uModel,false,transform);
 gl.uniform3fv(U.uTint,tint);
 gl.uniform1i(U.uEmissive,emissive?1:0);
 gl.uniform1i(U.uUseMaps,useMaps?1:0);
 gl.uniform1i(U.uIsIcePlanet,isIcePlanet?1:0);
 gl.uniform1f(U.uRough,rough);
 gl.uniform1f(U.uMetal,metal);
 gl.uniform1f(U.uNormalStrength,normalStrength);
 gl.bindVertexArray(mesh.vao);
 gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);
}

function setTransform(position,scale,rotation) {
 D.M4.identity(model);
 if(position)D.M4.translate(model,model,position);
 if(rotation)D.M4.rotateY(model,model,rotation);
 D.M4.scale(model,model,[scale,scale,scale]);
 return model;
}

function drawPlanet(position,scale,tint,time,rotationOffset=0,isIcePlanet=false) {
 const transform=setTransform(position,scale,time*.12+rotationOffset);
 draw(sphere,transform,{tint,useMaps:true,isIcePlanet,rough:.82,metal:.08,normalStrength:1.35});
}

function drawSun(position,radius,tint) {
 const transform=setTransform(position,radius);
 draw(sphere,transform,{tint,emissive:true});
}

function renderScene(time,dt) {
 /*
 const starRadius=orbitRadius(starOrbit,starDistance);
 const moonRadius=orbitRadius(moonOrbit,moonDistance);
 const starAmount=Number(starOrbit.value)/100;
 gl.uniform1f(U.uStarDistance,starAmount);
 gl.uniform1i(U.uChocolateMaskView,0);
 */
const starRadius=orbitRadius(starOrbit,starDistance);
const moonRadius=orbitRadius(moonOrbit,moonDistance);

const starAmount=Number(starOrbit.value)/100;

// 작은 행성이 가까울수록 분출 증가
const eruption=1.0-Number(moonOrbit.value)/100;

// 목표 길이까지 서서히 성장하거나 줄어듦
/*const targetReach=0.8*eruption;
const delta=Math.max(0,Math.min(dt,0.05));

flowReach+=(targetReach-flowReach)
           *Math.min(1,delta*(0.25+eruption*0.8)); */

const targetReach=1.65*eruption;
const delta=Math.max(0,Math.min(dt,0.05));

flowReach+=(targetReach-flowReach)
           *Math.min(1,delta*(0.8+eruption*1.6));

// 셰이더에 값 전달
gl.uniform1f(U.uStarDistance,starAmount);
gl.uniform1f(U.uEruption,eruption);
gl.uniform1f(U.uTime,time);
gl.uniform1f(U.uFlowReach,flowReach);

// 진단 화면 설정
gl.uniform1i(U.uChocolateMaskView,resultView.value==='chocolate'?1:0);
gl.uniform1i(U.uKataifiMaskView,resultView.value==='kataifi'?1:0);
gl.uniform1i(U.uSurfaceChanges,surfaceChanges?1:0);

 if (starAngle === undefined) {
  starAngle=time*.4;
  moonAngle=time*.9;
 } else {
  starAngle=(starAngle+dt*.4*starDistance.max/starRadius)%(2*Math.PI);
  moonAngle=(moonAngle+dt*.9*moonDistance.max/moonRadius)%(2*Math.PI);
 }
 // Preserve the original height at radius 5 while approaching the central planet.
 const lightPosition=[Math.cos(starAngle)*starRadius,1.6+starRadius*.4,Math.sin(starAngle)*starRadius];
 gl.uniform3fv(U.uLight,lightPosition);
 gl.uniform3f(U.uLightColor,1.0,.78,.2);
 gl.uniform1f(U.uPower,3.5);
 gl.uniform1f(U.uAmbient,.095);
 gl.uniform1f(U.uEnvPower,.35);

 D.M4.identity(model);
 draw(floor,model,{tint:[.055,.065,.09],rough:.94,metal:0});

 drawPlanet([0,1.6,0],1.0,[1,1,1],time,0,true);

 const moonPosition=[Math.cos(moonAngle)*moonRadius,1.6,Math.sin(moonAngle)*moonRadius];
 drawPlanet(moonPosition,.42,[.85,.15,.15],time,moonAngle);

 drawSun(lightPosition,.22,[1.0,.82,.35]);
}

gl.enable(gl.DEPTH_TEST);
D.loop(() => {
 updateSimulationClock(performance.now()*.001);
 const dt=simulationTime-previousFrameTime;
 previousFrameTime=simulationTime;
 D.fit(cv);
 gl.viewport(0,0,cv.width,cv.height);
 gl.clearColor(.012,.018,.032,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

 const eye=cam.eye(target);
 D.M4.lookAt(view,eye,target,[0,1,0]);
 D.M4.perspective(proj,Math.PI/4,cv.width/cv.height,.1,100);
 D.M4.multiply(vp,proj,view);

 gl.useProgram(prog);
 gl.uniformMatrix4fv(U.uVP,false,vp);
 gl.uniform3fv(U.uEye,eye);
 bindTexture(textures.color,0,'uColor');
 bindTexture(textures.normal,1,'uNormal');
 bindTexture(textures.arm,2,'uARM');
 bindTexture(textures.env,3,'uEnv');
 renderScene(simulationTime,dt);
 gl.bindVertexArray(null);
});
})();
