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
 if (failed) {
  const status=document.querySelector('#status');
  status.textContent='텍스처를 불러오지 못했습니다. HTTP 서버와 assets/week06 경로를 확인해 주세요.';
  status.hidden=false;
 }
});

const cam = D.orbit(cv,{dist:11,yaw:.6,pitch:.35,min:3,max:20});
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create();
const model=D.M4.create();
const target=[0,1,0];
const starOrbit=document.querySelector('#star-orbit');
const moonOrbit=document.querySelector('#moon-orbit');
const starDistance={min:1.18,max:5};
const moonDistance={min:1.47,max:4.13};
let starAngle,moonAngle;
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

function renderScene(time,dt) {
 const starRadius=orbitRadius(starOrbit,starDistance);
 const moonRadius=orbitRadius(moonOrbit,moonDistance);

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

 drawPlanet([0,1.6,0],1.0,[.82,.36,.22],time);

 const moonPosition=[Math.cos(moonAngle)*moonRadius,1.6,Math.sin(moonAngle)*moonRadius];
 drawPlanet(moonPosition,.42,[.85,.15,.15],time,moonAngle);

 drawSun(lightPosition,.22,[1.0,.82,.35]);
}

gl.enable(gl.DEPTH_TEST);
D.loop((time,dt) => {
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
 renderScene(time,dt);
 gl.bindVertexArray(null);
});
})();
