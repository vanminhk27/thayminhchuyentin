const q=document.getElementById("search"),topic=document.getElementById("topic"),items=[...document.querySelectorAll(".item")],count=document.getElementById("count"),empty=document.getElementById("empty");
const params=new URLSearchParams(location.search);if(params.get("q"))q.value=params.get("q");
function normalize(text){return text.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function filter(){const s=normalize(q.value.trim()),t=topic.value;let visible=0;items.forEach(item=>{const show=normalize(item.textContent).includes(s)&&(t==="all"||item.dataset.topic===t);item.style.display=show?"grid":"none";if(show)visible++});count.textContent=visible+" / "+items.length+" bài";empty.style.display=visible?"none":"block"}
q.addEventListener("input",filter);topic.addEventListener("change",filter);filter();

