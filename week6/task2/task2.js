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
void main(){
 vec4 world=uModel*vec4(aPos,1.0);
 vP=world.xyz;
 vN=mat3(uModel)*aNormal;
 vUV=aUV;
 gl_Position=uVP*world;
}`;

const FS = `#version 300 es
precision highp float;
const float PI=3.14159265;
in vec3 vP,vN;
in vec2 vUV;
out vec4 outColor;
uniform sampler2D uColor,uNormal,uARM,uEnv;
uniform vec3 uEye,uLight,uLightColor,uTint;
uniform float uRough,uMetal,uNormalStrength,uPower,uAmbient,uEnvPower;
uniform bool uEmissive,uUseMaps;

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
  base=srgbToLinear(texture(uColor,vUV).rgb)*uTint;
  vec3 arm=texture(uARM,vUV).rgb;
  ao=arm.r;
  rough=max(arm.g*uRough,.045);
  metal=arm.b*uMetal;
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
 'uEmissive','uUseMaps','uColor','uNormal','uARM','uEnv'
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
 document.querySelector('#status').textContent = failed
  ? '텍스처를 불러오지 못했습니다. HTTP 서버와 assets/week06 경로를 확인해 주세요.'
  : '암석 표면 텍스처와 normal map을 적용했습니다.';
});

const cam = D.orbit(cv,{dist:11,yaw:.6,pitch:.35,min:3,max:20});
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create();
const model=D.M4.create();
const fixedSunPosition=[-1.65,.1,1.4];
const targets={
 option1:[.1,0,0],
 option2:[0,1,0]
};
let scene='option2';
const status=document.querySelector('#status');

function bindTexture(texture,unit,uniform) {
 gl.activeTexture(gl.TEXTURE0+unit);
 gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.uniform1i(U[uniform],unit);
}

function draw(mesh,transform,options) {
 const {tint,emissive=false,useMaps=false,rough=.8,metal=.08,normalStrength=0}=options;
 gl.uniformMatrix4fv(U.uModel,false,transform);
 gl.uniform3fv(U.uTint,tint);
 gl.uniform1i(U.uEmissive,emissive?1:0);
 gl.uniform1i(U.uUseMaps,useMaps?1:0);
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

function drawPlanet(position,scale,tint,time,rotationOffset=0) {
 const transform=setTransform(position,scale,time*.12+rotationOffset);
 draw(sphere,transform,{tint,useMaps:true,rough:.82,metal:.08,normalStrength:1.35});
}

function drawSun(position,radius,tint) {
 const transform=setTransform(position,radius);
 draw(sphere,transform,{tint,emissive:true});
}

function renderOption1(time) {
 const sunPosition=fixedSunPosition;
 gl.uniform3fv(U.uLight,sunPosition);
 gl.uniform3f(U.uLightColor,1.0,.76,.53);
 gl.uniform1f(U.uPower,4.0);
 gl.uniform1f(U.uAmbient,.075);
 gl.uniform1f(U.uEnvPower,.48);
 drawPlanet([.55,0,0],1.12,[.78,.82,.86],time);
 drawSun(sunPosition,.36,[1.0,.3,.025]);
}

function renderOption2(time) {
 const lightPosition=[Math.cos(time*.4)*5.0,3.6,Math.sin(time*.4)*5.0];
 gl.uniform3fv(U.uLight,lightPosition);
 gl.uniform3f(U.uLightColor,1.0,.78,.2);
 gl.uniform1f(U.uPower,3.5);
 gl.uniform1f(U.uAmbient,.095);
 gl.uniform1f(U.uEnvPower,.35);

 /* D.M4.identity(model);
 draw(floor,model,{tint:[.055,.065,.09],rough:.94,metal:0});

 drawPlanet([0,1.6,0],1.0,[.82,.36,.22],time);

 const moonAngle=time*.9;
 const moonPosition=[Math.cos(moonAngle)*2.8,1.6,Math.sin(moonAngle)*2.8];
 drawPlanet(moonPosition,.42,[.85,.15,.15],time,moonAngle);

 // drawPlanet([4.2,1.6,3.4],.39,[1.0,.65,.75],time);
 // drawPlanet([-2.3,1.6,-2.5],1.3,[.4,.56,.64],time);
 drawSun(lightPosition,.22,[1.0,.82,.35]);
 
 //바닥에 붙어있던 행성들 삭제
 */

 D.M4.identity(model);
 draw(floor,model,{tint:[.055,.065,.09],rough:.94,metal:0});

 // 중앙 갈색 행성 (유지)
 drawPlanet([0,1.6,0],1.0,[.82,.36,.22],time);

 // 오른쪽 작은 붉은 행성 (유지)
 const moonAngle=time*.9;
 const moonPosition=[Math.cos(moonAngle)*2.8,1.6,Math.sin(moonAngle)*2.8];
 drawPlanet(moonPosition,.42,[.85,.15,.15],time,moonAngle);

 // 태양 (유지)
 drawSun(lightPosition,.22,[1.0,.82,.35]);
}

document.querySelectorAll('[data-scene]').forEach(button=>{
 button.addEventListener('click',()=>{
  scene=button.dataset.scene;
  document.querySelectorAll('[data-scene]').forEach(option=>{
   option.setAttribute('aria-pressed',String(option===button));
  });
  const isWeek5=scene==='option2';
  cv.setAttribute('aria-label',isWeek5
   ? '바닥과 여러 행성, 공전하는 별이 있는 장면'
   : '태양빛을 받는 암석 행성');
  document.querySelector('#scene-label').textContent=isWeek5
   ? '5주차 장면 구성 · 공전하는 별과 행성들'
   : '별빛을 받는 암석 행성';
  document.querySelector('#scene-title').textContent=isWeek5
   ? '5주차 장면에서 출발'
   : '태양과 관찰 행성';
  document.querySelector('#scene-description').textContent=isWeek5
   ? '바닥, 중앙 행성, 공전하는 달과 주변 행성, 이동하는 발광별을 배치했습니다.'
   : '별빛을 받는 암석 행성입니다. 드래그로 시점을 돌리고 휠로 확대해 보세요.';
  document.querySelector('#scene-note').textContent=isWeek5
   ? '5주차 장면 구성을 바탕으로 행성에 PBR 재질과 normal map을 적용했습니다.'
   : '행성 표면에는 암석 텍스처와 PBR 조명, normal map을 적용했습니다.';
  cam.dist=isWeek5?11:5.7;
  cam.yaw=isWeek5?.6:.03;
  cam.pitch=isWeek5?.35:.12;
 });
});

gl.enable(gl.DEPTH_TEST);
D.loop(time => {
 D.fit(cv);
 gl.viewport(0,0,cv.width,cv.height);
 gl.clearColor(.012,.018,.032,1);
 gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);

 const target=targets[scene];
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
 if(scene==='option2')renderOption2(time);
 else renderOption1(time);
 gl.bindVertexArray(null);
});
})();
