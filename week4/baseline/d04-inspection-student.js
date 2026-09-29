/* 학생 확장 시작점. 여기에 본인이 설계한 관찰 인터페이스를 구현하세요.
   제공 기준 버전은 이 파일을 비워 둔 상태입니다.

   const viewer = window.InspectionViewer;
   viewer.controls.state: target, distance, rotation(쿼터니언), fov
   viewer.controls.camera(): 현재 eye/target/up
   viewer.controls.home(): 기본 카메라로 복귀
   viewer.model.poi: 주요 지점의 id/name/position/size/yaw/group
   viewer.model.comparisons: O1/O2 비교 대상 members와 관찰 방향 viewDirection
   viewer.model.tasks: 표지 관찰 6건 + 직교 비교 2건
   viewer.hidden: 일시적으로 숨길 id 또는 group을 담는 Set
   viewer.drawView({eye,target,up,fov,orthographic,halfHeight}, [x,y,w,h])
     : viewport는 CSS 픽셀이 아닌 canvas.width/height 기준, 원점은 왼쪽 아래
   viewer.render = (viewer) => { ... } : 기본 한 화면 그리기를 대체할 선택적 콜백
   document.querySelector('#student-ui'): 본인이 만든 UI를 넣을 자리

   기본 이벤트를 바꾸려면 d04-inspection-controls.js를 수정해도 됩니다.
   중요한 정보는 실제 구조물과 함께 관찰하도록 하고, 답만 목록에 표시하지 마세요.
*/
