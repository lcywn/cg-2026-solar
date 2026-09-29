/* 수업용으로 직접 구성한 가상 복합 연구시설. 외부 모델·이미지 의존성 없음.
   길이 단위는 m로 가정합니다. boxes와 signs는 원본 위치/크기를 유지하세요. */
window.InspectionModel = (() => {
  const boxes=[],signs=[];
  function box(id,position,size,color,group='structure'){boxes.push({id,position,size,color,group});}
  const concrete=[.66,.71,.77],steel=[.25,.36,.47],blue=[.15,.45,.7],orange=[.85,.4,.12];
  box('ground',[3,-.35,0],[23,.4,15],[.78,.81,.8],'site');
  for(let floor=0;floor<3;floor++){
    const y=floor*3;
    box('floor-'+floor,[0,y,0],[12,.18,8],concrete);
    box('back-'+floor,[0,y+1.5,-4],[12,3,.18],[.56,.64,.7]);
    for(const x of [-5.8,0,5.8])for(const z of [-3.8,3.8])box(`column-${floor}-${x}-${z}`,[x,y+1.5,z],[.24,3,.24],steel);
    for(const x of [-5.8,5.8])box(`beam-${floor}-${x}`,[x,y+2.85,0],[.3,.3,8],steel);
    for(let i=0;i<10;i++)box(`step-${floor}-${i}`,[-5,y+.15+i*.27,-2.8+i*.56],[1.25,.2,.58],[.65,.66,.6]);
    for(let i=0;i<4;i++){
      box(`bench-${floor}-${i}`,[-2.6+i*1.7,y+.9,-1.9],[1.15,.16,1.1],[.55,.45,.32],'furniture');
      box(`leg-${floor}-${i}`,[-2.6+i*1.7,y+.45,-1.9],[.15,.9,.15],steel,'furniture');
    }
    // 낮은 전면 난간과 실내 칸막이. 정면을 열어 내부를 관찰할 수 있습니다.
    for(let i=-5;i<=5;i++)box(`rail-${floor}-${i}`,[i,y+.48,3.8],[.05,.85,.05],steel);
    box(`rail-top-${floor}`,[0,y+.92,3.8],[11,.06,.06],steel);
    box(`partition-${floor}`,[-1,y+1.25,-.3],[.12,2.5,2.5],[.7,.77,.76]);
  }
  box('roof-left',[-4,9,0],[4,.2,8],concrete);
  box('roof-right',[4,9,0],[4,.2,8],concrete);
  for(let i=0;i<3;i++)box('solar-'+i,[-4,9.22,-2+i*2],[3,.18,1.6],[.13,.25,.43],'roof');
  box('roof-walkway',[0,9,-1],[4,.2,1.5],concrete);
  box('entry-post',[-2,.8,4.05],[.12,1.6,.12],steel);
  box('entry-backing',[-2,1.6,4.05],[2,.85,.1],steel);
  box('roof-service',[.5,9.3,-1],[1.8,.6,1.1],blue,'equipment');
  // 별관과 본관을 잇는 2층 연결 다리.
  box('bridge',[7.5,3,0],[3,.22,2],concrete);
  for(const z of [-1,1])box('bridge-rail-'+z,[7.5,3.6,z],[3,.1,.1],steel);
  box('annex-floor',[11,0,0],[5,.2,5],concrete);
  box('annex-back',[11,1.6,-2.5],[5,3.2,.2],concrete);
  for(const x of [8.6,13.4])for(const z of [-2.3,2.3])box(`annex-pillar-${x}-${z}`,[x,1.6,z],[.25,3.2,.25],steel);
  box('annex-roof',[11,3.3,-.8],[5,.2,3.4],concrete);
  box('valve-body',[3,.85,-2.5],[.8,1.5,.8],orange,'equipment');
  box('valve-pipe',[3,1.4,-2.5],[2.6,.16,.16],orange,'equipment');
  box('cabinet',[-3,3.8,1],[.8,1.4,.6],blue,'equipment');
  box('rear-pipe',[0,4.2,-4.25],[4,.2,.2],orange,'equipment');
  box('annex-pump',[11,1.05,.9],[1.4,1.8,1.3],blue,'equipment');
  const poi=[
    {id:'P1',name:'본관 입구 안내',task:'안내판의 동 이름과 층수를 확인하세요.',position:[-2,1.6,4.12],size:[2,.85],yaw:0,text:['ENTRY A','LEVELS 3'],group:'entry'},
    {id:'P2',name:'1층 안쪽 밸브',task:'밸브의 식별 번호와 상태를 읽으세요.',position:[3,1.25,-2.085],size:[.55,.28],yaw:0,text:['V-07','OPEN'],group:'equipment'},
    {id:'P3',name:'2층 제어함',task:'작은 명판의 회로 번호와 전압을 읽으세요.',position:[-3,4.05,1.315],size:[.28,.16],yaw:0,text:['B-12','24 V'],group:'equipment'},
    {id:'P4',name:'옥상 서비스 장치',task:'장치의 이름과 점검 주기를 확인하세요.',position:[.5,9.42,-.435],size:[.9,.4],yaw:0,text:['FILTER','30 DAYS'],group:'roof'},
    {id:'P5',name:'본관 뒤쪽 배관',task:'뒤쪽 표지의 배관 용도와 유량을 읽으세요.',position:[0,4.6,-4.4],size:[.65,.35],yaw:Math.PI,text:['RETURN','8 L/min'],group:'equipment'},
    {id:'P6',name:'별관 펌프',task:'별관 장치의 제한 온도를 확인하세요.',position:[11,1.4,1.565],size:[.42,.22],yaw:0,text:['LIMIT','80 C'],group:'equipment'},
  ];
  // O1: 깊이가 다른 두 패널의 상단 높이와 폭을 전면 직교 뷰에서 비교합니다.
  box('o1-a',[-6.8,2.6,5.2],[1.2,1.6,.25],blue,'comparison-front');
  box('o1-b',[-3.8,2.6,6.8],[1.2,1.6,.25],orange,'comparison-front');
  for(const [id,x,z] of [['a',-6.8,5.2],['b',-3.8,6.8]])
    box('o1-post-'+id,[x,.9,z],[.12,1.8,.12],steel,'comparison-front');
  // O2: 좌우 위치와 높이가 다른 두 장치의 전면 끝(z)을 측면에서 비교합니다.
  box('o2-a',[9.3,4.15,0],[1.4,.7,2],blue,'comparison-side');
  box('o2-b',[12.3,5.35,-.6],[1.4,.7,2],orange,'comparison-side');
  box('o2-post-a',[9.3,3.55,0],[.18,.5,.18],steel,'comparison-side');
  box('o2-post-b',[12.3,4.15,-.6],[.18,1.7,.18],steel,'comparison-side');
  signs.push(
    {id:'O1-A',position:[-6.8,2.6,5.335],size:[.7,.4],yaw:0,text:['PANEL','A'],group:'comparison-front'},
    {id:'O1-B',position:[-3.8,2.6,6.935],size:[.7,.4],yaw:0,text:['PANEL','B'],group:'comparison-front'},
    {id:'O2-A',position:[10.01,4.15,0],size:[.7,.35],yaw:Math.PI/2,text:['UNIT','A'],group:'comparison-side'},
    {id:'O2-B',position:[13.01,5.35,-.6],size:[.7,.35],yaw:Math.PI/2,text:['UNIT','B'],group:'comparison-side'},
  );
  const comparisons=[
    {id:'O1',name:'전면 패널 정렬',task:'전면 직교 뷰에서 파랑 A·주황 B 패널의 상단 높이와 폭이 같은지 비교하세요.',position:[-5.3,2.6,6],members:['o1-a','o1-b'],viewDirection:[0,0,-1]},
    {id:'O2',name:'측면 돌출 비교',task:'오른쪽 측면 직교 뷰에서 A·B 장치의 전면 끝을 비교하세요. 어느 쪽이 건물 앞쪽(+z)으로 더 돌출되나요?',position:[10.8,4.75,-.3],members:['o2-a','o2-b'],viewDirection:[-1,0,0]},
  ];
  poi.forEach(p=>signs.push(p));
  return {boxes,signs,poi,comparisons,tasks:[...poi,...comparisons],bounds:{min:[-8,-.55,-7.5],max:[14.5,9.7,7.5]}};
})();
