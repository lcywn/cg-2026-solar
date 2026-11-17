# 6주차 보고서

# task 1

**Step 1**
![Task 2 결과](images/week6_task1_step1.png)

**Step2**
![Task 2 결과](images/week6_task1_step2.png)

**Step3**
![Task 2 결과](images/week6_task1_step3.png)


**Step4**

사이트에 올라온 코드만으로는 normal의 변화를 감지하기 힘들어 코드를 다음과 같이 바꿨습니다. 1e-8라는 값을 줄여 접선의 방향의 축소를 줄여 normal 변화를 증폭시켰습니다.
```
float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-20));
```

Normal 강도 0
![Task 2 결과](images/week6_task1_step4_1.png)

Normal 강도 5
![Task 2 결과](images/week6_task1_step4_2.png)

Normal 강도 10
![Task 2 결과](images/week6_task1_step4_3.png)


**Step 5**
환경맵 반사 세기 1
![Task 2 결과](images/week6_task1_step5_1.png)

환경맵 반사 세기 2
![Task 2 결과](images/week6_task1_step5_1.png)


**직접광, ambient, 환경맵 끄기**
![Task 2 결과](images/week6_task1_step6.png)
