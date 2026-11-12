/* 실습 2 시작 코드: 같은 장면의 local → ray → path, 고해상도 성능 실험. */
(() => {
  'use strict';
  const cv=document.querySelector('#cv'),gl=D.context(cv);
  if(!gl)return;
  const camera=[0,0.05,4.5],target=[0,0,-1],light=[0,1.78,-1.7];
  const S=D.UI('#ui',[
    {id:'mode',type:'select',label:'화면',value:'0',options:[
      {value:'0',label:'① Local: 삼각형 + 직접광'},
      {value:'1',label:'② Ray tracing: 그림자 광선'},
      {value:'2',label:'③ Path tracing: 확산 반사'}]},
    {id:'resolution',type:'select',label:'측정 해상도',value:'320',options:[
      {value:'320',label:'320 × 180'}, {value:'640',label:'640 × 360'},
      {value:'960',label:'960 × 540'}, {value:'1280',label:'1280 × 720'},
      {value:'1920',label:'1920 × 1080 (고부하)'}]},
    {id:'samples',type:'select',label:'Path 표본/픽셀',value:'8',options:[
      {value:'4',label:'4개'}, {value:'8',label:'8개'}, {value:'16',label:'16개'},
      {value:'32',label:'32개 (고부하)'}]},
    {id:'bounces',type:'select',label:'Path 최대 반사',value:'2',options:[
      {value:'1',label:'1회'}, {value:'2',label:'2회'}, {value:'3',label:'3회'}, {value:'4',label:'4회'}]},
    {id:'advanced',type:'check',label:'거울·굴절·환경 반사',value:true}
  ]);
  // TODO (실습 2): 여러 실제 기기의 측정 결과를 바탕으로 이 자동 선택 규칙을 수정한다.
  // PC/노트북 구분은 브라우저가 보장하지 않으므로 저장한 기기별 설정이나 간단한 벤치마크를 활용할 수 있다.
  function chooseInitialProfile(){
    const mobile=navigator.userAgentData?.mobile || matchMedia('(pointer:coarse)').matches;
    return mobile?{name:'모바일 기본값',resolution:'320',samples:'4',bounces:'1',advanced:false}
                 :{name:'데스크톱 기본값',resolution:'640',samples:'8',bounces:'2',advanced:true};
  }
  const initialProfile=chooseInitialProfile();
  for(const id of ['resolution','samples','bounces']){
    S[id]=initialProfile[id];
    document.querySelector(`#ui .ctl[data-id="${id}"] select`).value=S[id];
  }
  S.advanced=initialProfile.advanced;
  document.querySelector('#ui .ctl[data-id="advanced"] input').checked=S.advanced;
  document.querySelector('#profile').textContent=`자동 시작 설정: ${initialProfile.name} · ${S.resolution}×${Number(S.resolution)*9/16} · ${S.samples}표본 · ${S.bounces}회 반사 · 고급 효과 ${S.advanced?'켬':'끔'}`;
  const rasterVS=`#version 300 es
  layout(location=0) in vec3 aPos;
  layout(location=1) in vec3 aNormal;
  layout(location=2) in vec3 aColor;
  uniform mat4 uVP;
  out vec3 vPos,vNormal,vColor;
  void main(){vPos=aPos;vNormal=aNormal;vColor=aColor;gl_Position=uVP*vec4(aPos,1.0);}`;
  const rasterFS=`#version 300 es
  precision highp float;
  in vec3 vPos,vNormal,vColor;
  out vec4 outColor;
  vec3 tone(vec3 c){return pow(c/(1.0+c),vec3(1.0/2.2));}
  void main(){
    if(vColor.r>2.0){outColor=vec4(tone(vColor),1.0);return;}
    vec3 d=vec3(0.0,1.78,-1.7)-vPos;
    float n=max(dot(normalize(vNormal),normalize(d)),0.0);
    vec3 c=vColor*(0.025+16.0*n/(1.0+0.25*dot(d,d)));
    outColor=vec4(tone(c),1.0);
  }`;
  const rayVS=`#version 300 es
  layout(location=0) in vec2 aPos;
  void main(){gl_Position=vec4(aPos,0.0,1.0);}`;
  const rayFS=`#version 300 es
  precision highp float;
  uniform vec2 uRes;
  uniform int uMode,uSamples,uBounces,uAdvanced;
  out vec4 outColor;
  const float PI=3.14159265359;
  struct Hit{float t;vec3 p,n,color;int id;};
  void trace(vec3 ro,vec3 rd,out Hit h){
    h.t=1e20;h.id=-1;h.p=vec3(0);h.n=vec3(0);h.color=vec3(0);
    for(int i=0;i<3;i++){
      vec3 c=i==0?vec3(-0.65,-0.70,-1.75):i==1?vec3(0.84,-0.97,-2.25):vec3(0.05,-0.99,-0.53);
      float r=i==0?0.70:i==1?0.43:0.40;
      vec3 oc=ro-c;float b=dot(oc,rd),d=b*b-dot(oc,oc)+r*r;
      if(d<0.0)continue;
      float t=-b-sqrt(d);if(t<0.003)t=-b+sqrt(d);
      if(t>0.003&&t<h.t){h.t=t;h.p=ro+t*rd;h.n=normalize(h.p-c);h.color=i==0?vec3(0.76,0.78,0.72):i==1?vec3(0.27,0.52,0.86):vec3(0.75,0.90,0.98);h.id=i;}
    }
    for(int i=0;i<5;i++){
      vec3 n;float plane,denom,orig;
      if(i==0){n=vec3(0,1,0);plane=-1.4;denom=rd.y;orig=ro.y;}
      else if(i==1){n=vec3(1,0,0);plane=-2.0;denom=rd.x;orig=ro.x;}
      else if(i==2){n=vec3(-1,0,0);plane=2.0;denom=rd.x;orig=ro.x;}
      else if(i==3){n=vec3(0,-1,0);plane=2.0;denom=rd.y;orig=ro.y;}
      else{n=vec3(0,0,1);plane=-3.5;denom=rd.z;orig=ro.z;}
      if(abs(denom)<0.00001)continue;
      float t=(plane-orig)/denom;if(t<0.003||t>=h.t)continue;
      vec3 p=ro+t*rd;
      if(abs(p.x)>2.001||p.y< -1.401||p.y>2.001||p.z< -3.501||p.z>1.501)continue;
      h.t=t;h.p=p;h.n=n;h.id=i+3;
      h.color=i==1?vec3(0.88,0.15,0.10):i==2?vec3(0.12,0.68,0.30):vec3(0.76,0.75,0.69);
    }
  }
  bool lamp(Hit h){return h.id==6&&abs(h.p.x)<0.45&&abs(h.p.z+1.7)<0.35;}
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  vec2 rand2(vec2 seed){return vec2(hash(seed),hash(seed+vec2(19.17,47.31)));}
  vec3 direct(Hit h,vec3 lightPos){
    vec3 d=lightPos-h.p;float dist=length(d);vec3 L=d/dist;
    float n=max(dot(h.n,L),0.0);if(n<=0.0)return vec3(0);
    Hit block;trace(h.p+h.n*0.008,L,block);
    if(block.id>=0&&block.t<dist-0.02)return vec3(0);
    return h.color*(16.0*n/(1.0+0.25*dist*dist));
  }
  // 분석용 환경 조명: 보이지 않는 밝은 창·천장 줄무늬가 반사 방향에 나타난다.
  vec3 sky(vec3 rd){
    vec3 base=mix(vec3(0.015,0.025,0.05),vec3(0.24,0.38,0.56),smoothstep(-0.3,0.8,rd.y));
    float window=smoothstep(0.94,0.99,dot(rd,normalize(vec3(-0.7,0.5,0.5))));
    float strip=smoothstep(0.985,0.999,abs(rd.x))*smoothstep(0.1,0.6,rd.y);
    return base+vec3(2.4,2.1,1.7)*window+vec3(0.6,0.8,1.2)*strip;
  }
  vec3 rayColor(vec3 ro,vec3 rd){
    vec3 radiance=vec3(0),weight=vec3(1);
    for(int bounce=0;bounce<4;bounce++){
      Hit h;trace(ro,rd,h);
      if(h.id<0){radiance+=weight*sky(rd);break;}
      if(lamp(h)){radiance+=weight*vec3(5.0,4.5,3.6);break;}
      if(uAdvanced==1&&h.id==0&&bounce<3){
        radiance+=weight*direct(h,vec3(0,1.78,-1.7))*0.10;
        weight*=vec3(0.88,0.91,0.93);
        rd=reflect(rd,h.n);ro=h.p+h.n*0.008;continue;
      }
      if(uAdvanced==1&&h.id==2&&bounce<3){
        bool entering=dot(rd,h.n)<0.0;
        vec3 N=entering?h.n:-h.n;
        radiance+=weight*(vec3(0.025,0.035,0.045)+sky(reflect(rd,N))*0.06);
        vec3 next=refract(rd,N,entering?1.0/1.45:1.45);
        if(length(next)<0.01)next=reflect(rd,N);
        rd=normalize(next);ro=h.p+rd*0.008;
        weight*=vec3(0.96,0.98,1.0);continue;
      }
      radiance+=weight*(h.color*0.025+direct(h,vec3(0,1.78,-1.7)));
      break;
    }
    return radiance;
  }
  vec3 path(vec3 ro,vec3 rd,int sampleIndex){
    vec3 radiance=vec3(0),weight=vec3(1);
    for(int bounce=0;bounce<5;bounce++){
      Hit h;trace(ro,rd,h);
      if(h.id<0){radiance+=weight*sky(rd);break;}
      if(lamp(h)){radiance+=weight*vec3(5.0,4.5,3.6);break;}
      vec2 seed=gl_FragCoord.xy+vec2(float(sampleIndex)*73.3,float(bounce)*137.9);
      vec2 lightRand=rand2(seed+vec2(3.1,8.4));
      vec3 lightPos=vec3((lightRand.x-0.5)*0.9,1.78,-1.7+(lightRand.y-0.5)*0.7);
      if(uAdvanced==0||h.id!=2)radiance+=weight*direct(h,lightPos)*(uAdvanced==1&&h.id==0?0.10:1.0);
      if(bounce>=uBounces){
        if(uAdvanced==1&&h.id==2)radiance+=weight*(vec3(0.025,0.035,0.045)+sky(reflect(rd,h.n))*0.12);
        break;
      }
      if(uAdvanced==1&&h.id==0){
        rd=reflect(rd,h.n);ro=h.p+h.n*0.008;weight*=vec3(0.88,0.91,0.93);continue;
      }
      if(uAdvanced==1&&h.id==2){
        bool entering=dot(rd,h.n)<0.0;
        vec3 N=entering?h.n:-h.n;
        radiance+=weight*(vec3(0.025,0.035,0.045)+sky(reflect(rd,N))*0.06);
        vec3 next=refract(rd,N,entering?1.0/1.45:1.45);
        if(length(next)<0.01)next=reflect(rd,N);
        rd=normalize(next);ro=h.p+rd*0.008;weight*=vec3(0.96,0.98,1.0);continue;
      }
      vec2 r=rand2(seed);float a=2.0*PI*r.x,rad=sqrt(r.y);
      vec3 T=normalize(cross(abs(h.n.y)<0.9?vec3(0,1,0):vec3(1,0,0),h.n));
      vec3 B=cross(h.n,T);
      rd=normalize(T*(rad*cos(a))+B*(rad*sin(a))+h.n*sqrt(1.0-r.y));
      ro=h.p+h.n*0.008;
      weight*=h.color;
    }
    return radiance;
  }
  vec3 tone(vec3 c){return pow(max(c/(1.0+c),vec3(0)),vec3(1.0/2.2));}
  void main(){
    vec2 uv=(2.0*gl_FragCoord.xy-uRes)/uRes.y;
    vec3 eye=vec3(0,0.05,4.5),target=vec3(0,0,-1);
    vec3 fwd=normalize(target-eye),right=normalize(cross(fwd,vec3(0,1,0))),up=cross(right,fwd);
    vec3 rd=normalize(1.7*fwd+uv.x*right+uv.y*up);
    vec3 col;
    if(uMode==1){
      col=rayColor(eye,rd);
    }else{
      col=vec3(0);
      for(int s=0;s<32;s++){
        if(s>=uSamples)break;
        col+=path(eye,rd,s);
      }
      col/=float(uSamples);
    }
    outColor=vec4(tone(col),1.0);
  }`;
  const rasterProgram=D.program(gl,rasterVS,rasterFS),rayProgram=D.program(gl,rayVS,rayFS);
  const rayU=D.uniforms(gl,rayProgram,['uRes','uMode','uSamples','uBounces','uAdvanced']);
  const rasterVP=gl.getUniformLocation(rasterProgram,'uVP');
  const verts=[];
  function vertex(p,n,c){verts.push(...p,...n,...c);}
  function quad(a,b,c,d,n,color){for(const p of [a,b,c,a,c,d])vertex(p,n,color);}
  const cream=[0.76,0.75,0.69],red=[0.88,0.15,0.10],green=[0.12,0.68,0.30];
  quad([-2,-1.4,1.5],[2,-1.4,1.5],[2,-1.4,-3.5],[-2,-1.4,-3.5],[0,1,0],cream);
  quad([-2,-1.4,-3.5],[-2,-1.4,1.5],[-2,2,1.5],[-2,2,-3.5],[1,0,0],red);
  quad([2,-1.4,1.5],[2,-1.4,-3.5],[2,2,-3.5],[2,2,1.5],[-1,0,0],green);
  quad([-2,2,-3.5],[2,2,-3.5],[2,2,1.5],[-2,2,1.5],[0,-1,0],cream);
  quad([-2,-1.4,-3.5],[2,-1.4,-3.5],[2,2,-3.5],[-2,2,-3.5],[0,0,1],cream);
  quad([-0.45,1.991,-2.05],[0.45,1.991,-2.05],[0.45,1.991,-1.35],[-0.45,1.991,-1.35],[0,-1,0],[5,4.5,3.6]);
  function sphere(center,r,color){
    const rings=22,steps=32;
    function point(i,j){const phi=Math.PI*i/rings,theta=2*Math.PI*j/steps;return [Math.sin(phi)*Math.cos(theta),Math.cos(phi),Math.sin(phi)*Math.sin(theta)];}
    for(let i=0;i<rings;i++)for(let j=0;j<steps;j++){
      const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);
      for(const n of [a,b,c,a,c,d])vertex(center.map((v,k)=>v+r*n[k]),n,color);
    }
  }
  sphere([-0.65,-0.70,-1.75],0.70,[0.76,0.78,0.72]);
  sphere([0.84,-0.97,-2.25],0.43,[0.27,0.52,0.86]);
  sphere([0.05,-0.99,-0.53],0.40,[0.75,0.90,0.98]);
  const meshCount=verts.length/9;
  const meshVao=gl.createVertexArray();gl.bindVertexArray(meshVao);
  const meshBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,meshBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.STATIC_DRAW);
  for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);}
  const quadVao=gl.createVertexArray();gl.bindVertexArray(quadVao);
  const quadBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quadBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,1,1,-1,-1,1,1,-1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindVertexArray(null);
  const projection=D.M4.perspective(D.M4.create(),2*Math.atan(1/1.7),16/9,0.1,50);
  const view=D.M4.lookAt(D.M4.create(),camera,target,[0,1,0]);
  const vp=D.M4.multiply(D.M4.create(),projection,view);
  function draw(mode){
    const w=Number(S.resolution);if(cv.width!==w){cv.width=w;cv.height=w*9/16;}
    gl.viewport(0,0,cv.width,cv.height);gl.clearColor(0.018,0.025,0.045,1);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(mode===0){
      gl.enable(gl.DEPTH_TEST);gl.useProgram(rasterProgram);gl.uniformMatrix4fv(rasterVP,false,vp);
      gl.bindVertexArray(meshVao);gl.drawArrays(gl.TRIANGLES,0,meshCount);
    }else{
      gl.disable(gl.DEPTH_TEST);gl.useProgram(rayProgram);
      gl.uniform2f(rayU.uRes,cv.width,cv.height);
      gl.uniform1i(rayU.uMode,mode);
      gl.uniform1i(rayU.uSamples,Number(S.samples));
      gl.uniform1i(rayU.uBounces,Number(S.bounces));
      gl.uniform1i(rayU.uAdvanced,S.advanced?1:0);
      gl.bindVertexArray(quadVao);gl.drawArrays(gl.TRIANGLES,0,6);
    }
    gl.bindVertexArray(null);
  }
  function median(a){const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)];}
  const names=['Local','Ray tracing','Path tracing'];
  const status=document.querySelector('#status'),result=document.querySelector('#result');
  const timer=gl.getExtension('EXT_disjoint_timer_query_webgl2');
  const onePixel=new Uint8Array(4);
  let measuring=false,lastKey='';
  async function timedDraw(mode){
    if(timer){
      const q=gl.createQuery();
      gl.beginQuery(timer.TIME_ELAPSED_EXT,q);
      draw(mode);
      gl.endQuery(timer.TIME_ELAPSED_EXT);
      for(let i=0;i<300;i++){
        await new Promise(requestAnimationFrame);
        if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){
          const disjoint=gl.getParameter(timer.GPU_DISJOINT_EXT);
          const ns=gl.getQueryParameter(q,gl.QUERY_RESULT);
          gl.deleteQuery(q);
          if(disjoint)throw Error('GPU 타이머가 중단되었습니다. 다시 측정하세요.');
          return ns/1e6;
        }
      }
      gl.deleteQuery(q);
      throw Error('GPU 타이머 응답이 없습니다. 다시 측정하세요.');
    }
    const start=performance.now();
    draw(mode);
    gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,onePixel);
    return performance.now()-start;
  }
  async function measure(){
    if(measuring)return;measuring=true;
    const button=document.querySelector('#measure');button.disabled=true;
    const controls=[...document.querySelectorAll('#ui input,#ui select')];
    controls.forEach(control=>{control.disabled=true;});
    result.textContent='같은 설정에서 방식별 1회 준비 + 5회 측정 중…';
    try{
      const rows=[];
      for(let mode=0;mode<3;mode++){
        await timedDraw(mode); // 셰이더 준비와 첫 렌더의 비용 제외
        const times=[];
        for(let trial=0;trial<5;trial++)times.push(await timedDraw(mode));
        rows.push(median(times));
      }
      const base=rows[0];
      result.innerHTML='<table><thead><tr><th>방식</th><th>중앙값</th><th>Local 대비</th></tr></thead><tbody>'+rows.map((v,i)=>`<tr><td>${names[i]}</td><td>${v.toFixed(2)} ms</td><td>${base>0?(v/base).toFixed(1)+'배':'—'}</td></tr>`).join('')+'</tbody></table>';
      status.textContent=`${timer?'GPU 실행 시간':'브라우저 동기화 포함'} · ${cv.width}×${cv.height} · Path ${S.samples}표본/픽셀 · 최대 ${S.bounces}회 반사 · ${S.advanced?'고급 효과 켬':'고급 효과 끔'}. 다른 기기에서도 같은 조건을 측정하세요.`;
    }catch(e){result.textContent=e.message;}
    finally{
      draw(Number(S.mode));
      lastKey=[S.mode,S.resolution,S.samples,S.bounces,S.advanced].join('|');
      controls.forEach(control=>{control.disabled=false;});
      button.disabled=false;measuring=false;
    }
  }
  document.querySelector('#measure').addEventListener('click',measure);
  D.loop(()=>{
    if(measuring||document.hidden)return;
    const key=[S.mode,S.resolution,S.samples,S.bounces,S.advanced].join('|');
    if(key===lastKey)return;
    lastKey=key;draw(Number(S.mode));
    status.textContent=Number(S.mode)===0?'삼각형 래스터화 + local 직접광: 다른 물체의 그림자가 없습니다.':Number(S.mode)===1?'Ray tracing: 그림자 광선과 선택한 경우 거울 반사·유리 굴절을 계산합니다.':'Path tracing: 여러 경로의 확산 반사와 선택한 경우 거울·유리 경로를 계산합니다.';
    result.textContent='설정이 바뀌었습니다. 「세 방식 측정」을 눌러 같은 조건의 값을 다시 구하세요.';
  });
})();
