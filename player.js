const video=document.getElementById("video"),message=document.getElementById("message");
const fit=new URLSearchParams(location.search).get("fit")||"contain";
video.style.objectFit=["contain","cover","fill"].includes(fit)?fit:"contain";
let playlist=[],index=0,currentUrl=null,loop=true;
function openDB(){return new Promise((resolve,reject)=>{
  const req=indexedDB.open("ChromeVideoLoopDB",2);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains("settings"))req.result.createObjectStore("settings")};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
})}
async function getPlaylist(){
  const db=await openDB();
  return new Promise((resolve,reject)=>{
    const req=db.transaction("settings").objectStore("settings").get("playlist");
    req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
  });
}
function release(){if(currentUrl){URL.revokeObjectURL(currentUrl);currentUrl=null}}
async function playAt(i){
  if(!playlist.length){message.textContent="Video eklemek için Chrome eklenti ayarlarını aç.";message.style.display="flex";video.pause();video.removeAttribute("src");return}
  index=(i+playlist.length)%playlist.length;
  try{
    const file=await playlist[index].getFile();
    release();currentUrl=URL.createObjectURL(file);video.src=currentUrl;
    message.style.display="none";
    try{await video.play()}catch{message.textContent="Oynatmayı başlatmak için sayfaya tıkla.";message.style.display="flex"}
  }catch(e){message.textContent="Video dosyası okunamadı: "+(playlist[index]?.name||"");message.style.display="flex"}
}
async function refreshPlaylist(){
  try{playlist=await getPlaylist();index=0;if(playlist.length)await playAt(0);else await playAt(0)}
  catch(e){message.textContent="Oynatma listesi okunamadı.";message.style.display="flex"}
}
video.addEventListener("ended",()=>{if(index<playlist.length-1)playAt(index+1);else if(loop)playAt(0)});
window.addEventListener("message",e=>{if(e.data?.type==="CVL_PLAYLIST_CHANGED")refreshPlaylist()});
document.addEventListener("visibilitychange",()=>{if(!document.hidden&&video.paused&&video.src)video.play().catch(()=>{})});
refreshPlaylist();