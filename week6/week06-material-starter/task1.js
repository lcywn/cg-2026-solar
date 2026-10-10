/* 6주차 실습 1 시작 코드. TODO 1~5를 직접 작성하여 완성하세요.
 * 비교 예제 d06-materials.js는 정답을 확인하는 참고 자료입니다.
 * Copilot에 각 TODO와 week06.md 수식을 읽히고 코드를 제안받아도 됩니다.
 * 각 단계에서 무엇이 왜 달라졌는지 직접 화면으로 검증하세요.
 */
(() => {
'use strict';
const cv=document.querySelector('#cv'), gl=D.context(cv); if(!gl)return;
const VS=`#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUV;
uniform mat4 uVP;
out vec3 vP,vN; out vec2 vUV;
void main(){vP=aPos;vN=aNormal;vUV=aUV;gl_Position=uVP*vec4(aPos,1.);}`;
const FS=`#version 300 es
precision highp float;
const float PI=3.14159265;
in vec3 vP,vN; in vec2 vUV; out vec4 outColor;
uniform sampler2D uColor,uNormal,uARM,uEnv;
uniform vec3 uEye,uLight,uTint;
uniform float uRough,uMetal,uNormalStrength,uPower,uAmbient,uEnvPower;

vec3 srgbToLinear(vec3 c){
 return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));
}
vec3 linearToSrgb(vec3 c){
 return mix(12.92*c,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));
}

// TODO 2: D(GGX), F(Schlick), G(Smith-Schlick)를 계산해
// 직접광 PBR 결과를 반환하세요. 6주차 3-2절을 참고하세요.
vec3 directPBR(vec3 N,vec3 V,vec3 L,vec3 base,float rough,float metal){
 // TODO 2: 이 줄을 교체
 vec3 H = normalize(V + L);
 float nl = max(dot(N,L),0.0), nv = max(dot(N,V),0.0);
 float nh = max(dot(N,H),0.0), vh = max(dot(V,H),0.0);
 float a = rough*rough, a2 = a*a;
 float den = nh*nh*(a2-1.0)+1.0;
 float D = a2 / max(PI*den*den, 1e-6); //법선분포 D
 float k = (rough+1.0)*(rough+1.0)/8.0;

 float G = (nl/(nl*(1.0-k)+k)) * (nv/(nv*(1.0-k)+k)); //masking / shadowing G
 vec3 F0 = mix(vec3(0.04), base, metal);

 vec3 F = F0 + (1.0-F0)*pow(1.0-vh,5.0); //Fresnel F
 vec3 kd = (1.0-F)*(1.0-metal);
 return (kd*base/PI + D*G*F/max(4.0*nl*nv,1e-4))*nl*uPower;
 
}

void main(){
 vec3 N=normalize(vN),V=normalize(uEye-vP),L=normalize(uLight);
 vec3 base=uTint;
 
// TODO 1: texture(uColor,vUV).rgb를 읽어 선형화하고 base에 사용하세요.
 base = srgbToLinear(texture(uColor, vUV).rgb) * uTint;

 // 수치 맵에는 sRGB 변환을 적용하지 마세요.

 float rough=uRough,metal=uMetal,ao=1.0;
 
 // TODO 3: uARM의 R(AO), G(roughness), B(metallic)를 읽으세요.
 vec3 arm = texture(uARM, vUV).rgb;
 ao = arm.r;
 rough = max(arm.g*uRough, 0.045);
 metal = arm.b*uMetal; 

 // 슬라이더 uRough/uMetal은 맵 값에 곱하는 배율입니다.

 // TODO 4: uNormal에서 접선 공간 법선을 읽고 N을 바꾸세요.
 // vP와 vUV의 dFdx/dFdy로 TBN을 만들어도 됩니다.
 // uNormalStrength=0이면 기하 법선을 그대로 사용하세요.
 if (uNormalStrength > 0.0) {
  vec3 dp1=dFdx(vP), dp2=dFdy(vP);
  vec2 du1=dFdx(vUV), du2=dFdy(vUV);
  vec3 T=cross(dp2,N)*du1.x+cross(N,dp1)*du2.x;
  vec3 B=cross(dp2,N)*du1.y+cross(N,dp1)*du2.y;
  float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-8));
  vec3 mapN=texture(uNormal,vUV).xyz*2.0-1.0;
  mapN.xy *= uNormalStrength;
  N=normalize(mat3(T*inv,B*inv,N)*normalize(mapN));
}


 /* Task2를 위한 삭제
 float nl=max(dot(N,L),0.0);
 vec3 R=reflect(-L,N);
 vec3 color=base*(uAmbient+uPower*nl)
           +vec3(0.6)*uPower*pow(max(dot(R,V),0.0),32.0)*step(0.0001,nl);
*/

 vec3 color = directPBR(N,V,L,base,rough,metal);
 vec3 F0 = mix(vec3(0.04),base,metal);
//uAmbient = 0.0; // TODO 2: 직접광만 비교할 때는 uAmbient=0으로 설정
 color += uAmbient * ao * (base*(1.0-metal)*(1.0-F0)+F0);

 // TODO 2: 위의 Phong 두 줄을 directPBR(...) 호출과 ambient로 교체하세요.
 // 환경맵을 끄고 uAmbient=0일 때 직접광만 비교해 보세요.

 // TODO 5: 환경 파노라마를 reflect(-V,N) 방향으로 조회해 반사를 더하세요.
 // 금속에서 정반사색은 base, 유전체의 정면 반사율은 약 0.04입니다.
 // 이미지 밝기 uEnvPower와 상수 ambient uAmbient는 별개로 유지하세요.
 vec3 reflected = reflect(-V,N);
 vec2 envUV = vec2(atan(reflected.z,reflected.x)/(2.0*PI)+0.5,
                  asin(clamp(reflected.y,-1.0,1.0))/PI+0.5);
 vec3 envColor = srgbToLinear(textureLod(uEnv,envUV,rough*7.0).rgb);
 vec3 envF0 = mix(vec3(0.04),base,metal);
 color += uEnvPower * ao * envColor * envF0;


 color=max(color,vec3(0.0));
 color=color/(1.0+color); // HDR → 표시 범위
 outColor=vec4(linearToSrgb(color),1.0);
}`;
const prog=D.program(gl,VS,FS),U=D.uniforms(gl,prog,[
 'uVP','uEye','uLight','uTint','uRough','uMetal','uNormalStrength','uPower','uAmbient','uEnvPower',
 'uColor','uNormal','uARM','uEnv'
]);
const mesh=D.upload(gl,D.cube(1.9));
const assets={wood_planks:['Diffuse','nor_gl','arm'],rusty_metal_04:['Diffuse','nor_gl','arm'],rock_boulder_dry:['Diffuse','nor_gl','arm']};
const textures={},jobs=[];let failed=false;
function load(name){
 const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([128,128,255,255]));
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
 jobs.push(new Promise(resolve=>{const img=new Image();img.onload=()=>{
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
  resolve();
 };img.onerror=()=>{failed=true;resolve();};
 img.src='assets/week06/'+name+(name.endsWith('_arm')?'.png':'.jpg');}));
 return tex;
}
for(const [asset,kinds] of Object.entries(assets))textures[asset]=kinds.map(kind=>load(asset+'_'+kind));
const envTex=load('studio_small_09_tonemapped');
Promise.all(jobs).then(()=>{document.querySelector('#status').textContent=failed?'텍스처 로딩 실패: HTTP 서버와 파일 경로 확인':'텍스처 로딩 완료 · task1.js의 TODO 1부터 작성하세요';});
document.querySelector('#ui').innerHTML='';
const S=D.UI('#ui',[
 {id:'material',type:'select',label:'재질 선택',value:'rusty_metal_04',options:[
  {value:'rusty_metal_04',label:'녹슨 금속'},{value:'wood_planks',label:'나무'},{value:'rock_boulder_dry',label:'돌'}]},
 {id:'rough',label:'roughness 배율',min:.05,max:1,step:.01,value:1},
 {id:'metal',label:'metallic 배율',min:0,max:1,step:.01,value:1},
 {id:'normal',label:'normal 강도',min:0,max:10,step:.1,value:5},
 {id:'power',label:'직접광 세기',min:0,max:8,step:.1,value:4},
 {id:'ambient',label:'상수 ambient',min:0,max:1,step:.01,value:.15},
 {id:'env',label:'환경맵 반사 세기',min:0,max:3,step:.1,value:1.5},
]);

const cam=D.orbit(cv,{dist:3.7,pitch:.15});document.querySelector('#reset').onclick=()=>{cam.dist=3.7;cam.yaw=0;cam.pitch=.15;};
const view=D.M4.create(),proj=D.M4.create(),vp=D.M4.create();
document.querySelector('#note').textContent='시작 코드: 회색 큐브와 Phong 조명만 작동합니다. task1.js의 TODO 1~5를 직접 채우세요.';
let visible=true;new IntersectionObserver(e=>visible=e[0].isIntersecting).observe(cv);
D.loop(()=>{
 if(!visible||document.hidden)return;
 D.fit(cv);gl.viewport(0,0,cv.width,cv.height);D.clearColor(gl);gl.enable(gl.DEPTH_TEST);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 const eye=cam.eye([0,0,0]);D.M4.lookAt(view,eye,[0,0,0],[0,1,0]);D.M4.perspective(proj,Math.PI/4,cv.width/cv.height,.1,100);D.M4.multiply(vp,proj,view);
 gl.useProgram(prog);gl.uniformMatrix4fv(U.uVP,false,vp);gl.uniform3fv(U.uEye,eye);
 gl.uniform3fv(U.uLight,[.6,.7,1.]);gl.uniform3fv(U.uTint,[.6,.6,.6]);
 for(const [key,value] of Object.entries({uRough:S.rough,uMetal:S.metal,uNormalStrength:S.normal,uPower:S.power,uAmbient:S.ambient,uEnvPower:S.env}))gl.uniform1f(U[key],value);
 [...textures[S.material],envTex].forEach((tex,i)=>{
  gl.activeTexture(gl.TEXTURE0+i);gl.bindTexture(gl.TEXTURE_2D,tex);
  gl.uniform1i(U[['uColor','uNormal','uARM','uEnv'][i]],i);
 });
 gl.bindVertexArray(mesh.vao);gl.drawElements(gl.TRIANGLES,mesh.count,gl.UNSIGNED_SHORT,0);gl.bindVertexArray(null);
});
})();
