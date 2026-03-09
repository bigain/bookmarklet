javascript:(function(){

/* ================= 설정 ================= */

const STRATEGY = [
  {watch:{CRCL_NO:"13016",SPRC_NO:"001"}},
  {watch:{CRCL_NO:"15257",SPRC_NO:"004"}}
];

const EXTEND_INTERVAL = 180000; // 3분
const EXTEND_RETRY = 5000;      // 연장 실패 재시도

let running = true;
let autoMode = true;
let lastCounts = {};
let cycleIndex = 0;
let cycleRound = 1;
let errorCount = 0;

let blinkInterval = null;
let extendInterval = null;
let originalTitle = document.title;

/* ================= 유틸 ================= */

function keyOf(o){ return o.CRCL_NO + "-" + o.SPRC_NO; }

function nextDelay(){
  const base = parseFloat(delayInput.value) || 0.3;
  return (base + Math.random()*0.5) * 1000;
}

/* ================= UI ================= */

const panel = document.createElement("div");
panel.style.position="fixed";
panel.style.top="10px";
panel.style.left="50%";
panel.style.transform="translateX(-50%)";
panel.style.background="#4a4a4a";
panel.style.color="#00ff00";
panel.style.padding="14px";
panel.style.fontSize="14px";
panel.style.zIndex="999999";
panel.style.borderRadius="4px";
panel.style.width="220px";

panel.innerHTML=`
<div style="display:flex;justify-content:space-between;margin-bottom:10px">
<div id="sw_status">실행 중 (1/1)</div>
<div>
지연
<input id="delaySec" type="text" value="0.3" style="width:30px;text-align:center">
</div>
</div>

<div style="display:flex;gap:8px">
<button id="modeBtn" style="width:68px">자 동</button>
<button id="runBtn" style="width:68px">중 단</button>
<button id="exitBtn" style="width:68px">종 료</button>
</div>
`;

document.body.appendChild(panel);

const statusEl=document.getElementById("sw_status");
const delayInput=document.getElementById("delaySec");
const modeBtn=document.getElementById("modeBtn");
const runBtn=document.getElementById("runBtn");
const exitBtn=document.getElementById("exitBtn");

/* ================= 세션 연장 ================= */

function clickExtend(){

  const frame=document.querySelector("#Main");
  if(!frame){
    console.log("iframe 없음");
    setTimeout(clickExtend,EXTEND_RETRY);
    return;
  }

  const doc=frame.contentDocument;
  if(!doc){
    console.log("iframe document 없음");
    setTimeout(clickExtend,EXTEND_RETRY);
    return;
  }

  const btn=doc.querySelector("#btnTimer");

  if(btn){
    btn.click();
    console.log("세션 연장 성공",new Date().toLocaleTimeString());
  }else{
    console.log("연장 버튼 없음 → 재시도");
    setTimeout(clickExtend,EXTEND_RETRY);
  }

}

function startExtend(){
  clickExtend();
  extendInterval=setInterval(clickExtend,EXTEND_INTERVAL);
}

/* ================= 버튼 ================= */

modeBtn.onclick=function(){
  autoMode=!autoMode;
  modeBtn.innerText=autoMode?"자 동":"수 동";
};

runBtn.onclick=function(){

  running=!running;

  runBtn.innerText=running?"중 단":"시 작";

  statusEl.innerText=(running?"실행 중 ":"중단 됨 ")
  +`(${cycleIndex+1}/${cycleRound})`;

  if(running){
    check();
  }

};

exitBtn.onclick=function(){

  running=false;
  clearInterval(extendInterval);
  clearInterval(blinkInterval);
  document.title=originalTitle;
  panel.remove();

};

/* ================= 감지 ================= */

function startBlink(){

  let flag=false;

  blinkInterval=setInterval(()=>{

    document.title=flag?"🚨 자리 발생":originalTitle;

    flag=!flag;

  },1000);

}

function check(){

  if(!running||!autoMode)return;

  statusEl.innerText=`실행 중 (${cycleIndex+1}/${cycleRound})`;

  fetch("/d/c/lectList?fake="+Date.now(),{

    method:"POST",
    credentials:"include",
    headers:{"X-Requested-With":"XMLHttpRequest"},
    body:(()=>{

      const f=new FormData();
      f.append("pMainMenuGbn","S");
      f.append("pSearchType","1");
      return f;

    })()

  })

  .then(r=>r.json())

  .then(data=>{

    errorCount=0;

    const rows=data.rows||[];

    const s=STRATEGY[cycleIndex];

    const row=rows.find(r=>

      r.CRCL_NO===s.watch.CRCL_NO &&
      r.SPRC_NO===s.watch.SPRC_NO

    );

    if(row){

      const key=keyOf(s.watch);

      const current=Number(row.RSRV_ERCS_PPL);

      const previous=lastCounts[key];

      if(previous!==undefined&&current<previous){

        startBlink();

        alert("자리 발생 감지!");

        clearInterval(blinkInterval);

        document.title=originalTitle;

      }

      lastCounts[key]=current;

    }

    cycleIndex++;

    if(cycleIndex>=STRATEGY.length){

      cycleIndex=0;

      cycleRound++;

    }

    if(running){

      setTimeout(check,nextDelay());

    }

  })

  .catch(()=>{

    errorCount++;

    if(errorCount>=5){

      running=false;

      alert("네트워크 오류 → 중단");

      return;

    }

    setTimeout(check,nextDelay());

  });

}

/* ================= 시작 ================= */

startExtend(); // 세션 연장은 항상 유지
check();

})();
