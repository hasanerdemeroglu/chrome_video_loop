const $ = id => document.getElementById(id);
let config = { enabled:true, domains:[], position:"right", panelSize:38, fit:"contain" };
let playlist = []; // FileSystemFileHandle entries stored in extension-origin IndexedDB
let folderHandle = null;
let dbPromise;
function db(){
  if(!dbPromise) dbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open("ChromeVideoLoopDB",2);
    req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains("settings"))d.createObjectStore("settings")};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
  return dbPromise;
}
async function getValue(key){
  const d=await db();return new Promise((resolve,reject)=>{
    const r=d.transaction("settings").objectStore("settings").get(key);
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
async function putValues(values){
  const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction("settings","readwrite"),s=tx.objectStore("settings");
    Object.entries(values).forEach(([k,v])=>s.put(v,k));
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
  });
}
async function savePlaylist(){await putValues({playlist,folderHandle});}
async function saveConfig(){await chrome.runtime.sendMessage({type:"SET_PANEL_CONFIG",config});}
function render(){
  $("enabled").checked=config.enabled;
  $("size").value=config.panelSize;$("sizeText").textContent=config.panelSize+"%";
  $("fit").value=config.fit||"contain";
  document.querySelectorAll("[data-pos]").forEach(b=>b.classList.toggle("selected",b.dataset.pos===config.position));
  const box=$("domains");box.innerHTML="";
  if(!config.domains.length)box.innerHTML='<small>Henüz site eklenmedi.</small>';
  config.domains.forEach((domain,i)=>{
    const chip=document.createElement("span");chip.className="chip";
    const label=document.createElement("span");label.textContent=domain;
    const remove=document.createElement("button");remove.textContent="×";remove.title="Kaldır";
    remove.addEventListener("click",async()=>{config.domains.splice(i,1);render();await saveConfig()});
    chip.append(label,remove);box.append(chip);
  });
  const list=$("playlist");list.innerHTML="";
  if(!playlist.length)list.innerHTML='<div class="empty">Video listen burada görünecek.</div>';
  playlist.forEach((item,i)=>{
    const row=document.createElement("div");row.className="video-row";
    const num=document.createElement("span");num.className="index";num.textContent=String(i+1).padStart(2,"0");
    const name=document.createElement("span");name.className="filename";name.textContent=item.name;
    const del=document.createElement("button");del.textContent="×";del.title="Listeden kaldır";
    del.addEventListener("click",async()=>{playlist.splice(i,1);await savePlaylist();render();notifyPlayer()});
    row.append(num,name,del);list.append(row);
  });
  $("count").textContent=playlist.length+" video";
  $("folderLabel").textContent=folderHandle?"Klasör: "+folderHandle.name:(playlist.length?"Dosyalar elle eklendi":"Henüz kaynak seçilmedi");
}
function notifyPlayer(){chrome.runtime.sendMessage({type:"PLAYLIST_CHANGED"}).catch(()=>{})}
function cleanDomain(value){return value.trim().toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split("/")[0].split(":")[0]}
async function addDomain(value){
  const d=cleanDomain(value);
  if(!d||!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)){$("domain").focus();return}
  if(!config.domains.includes(d))config.domains.push(d);
  $("domain").value="";render();await saveConfig();
}
async function addFolder(){
  if(!window.showDirectoryPicker){alert("Bu Chrome sürümü klasör seçimini desteklemiyor.");return}
  try{
    folderHandle=await window.showDirectoryPicker({mode:"read"});
    const permission=await folderHandle.requestPermission({mode:"read"});
    if(permission!=="granted")return;
    playlist=[];
    for await(const entry of folderHandle.values()){
      if(entry.kind==="file"&&/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(entry.name))playlist.push(entry);
    }
    playlist.sort((a,b)=>a.name.localeCompare(b.name,"tr",{numeric:true,sensitivity:"base"}));
    await savePlaylist();render();notifyPlayer();
  }catch(e){if(e.name!=="AbortError")alert("Klasör okunamadı: "+e.message)}
}
async function addFiles(files){
  const handles=[];
  try{
    // File picker returns persistent handles, unlike transient input File objects.
    if(window.showOpenFilePicker){
      const picked=await window.showOpenFilePicker({multiple:true,types:[{description:"Video dosyaları",accept:{"video/*":[".mp4",".webm",".ogg",".ogv",".mov",".m4v"]}}]});
      handles.push(...picked);
    }else{
      const selected=Array.from(files||[]);
      selected.forEach(file=>handles.push({name:file.name,getFile:async()=>file}));
    }
    const existing=new Set(playlist.map(x=>x.name));
    handles.forEach(h=>{if(!existing.has(h.name))playlist.push(h)});
    await savePlaylist();render();notifyPlayer();
  }catch(e){if(e.name!=="AbortError")alert("Dosyalar eklenemedi: "+e.message)}
}
$("chooseFolder").addEventListener("click",addFolder);
$("chooseFiles").addEventListener("click",()=>{if(window.showOpenFilePicker)addFiles();else $("fileInput").click()});
$("fileInput").addEventListener("change",e=>addFiles(e.target.files));
$("rescan").addEventListener("click",async()=>{
  if(!folderHandle){alert("Önce bir klasör seçmelisin.");return}
  try{
    if(await folderHandle.requestPermission({mode:"read"})!=="granted")return;
    playlist=[];
    for await(const entry of folderHandle.values())if(entry.kind==="file"&&/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(entry.name))playlist.push(entry);
    playlist.sort((a,b)=>a.name.localeCompare(b.name,"tr",{numeric:true,sensitivity:"base"}));
    await savePlaylist();render();notifyPlayer();
  }catch(e){alert("Klasör taranamadı: "+e.message)}
});
$("clearList").addEventListener("click",async()=>{playlist=[];folderHandle=null;await savePlaylist();render();notifyPlayer()});
$("enabled").addEventListener("change",async e=>{config.enabled=e.target.checked;await saveConfig()});
$("add").addEventListener("click",()=>addDomain($("domain").value));
$("domain").addEventListener("keydown",e=>{if(e.key==="Enter")addDomain($("domain").value)});
$("addCurrent").addEventListener("click",async()=>{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  try{await addDomain(new URL(tab.url).hostname)}catch{$("domain").placeholder="Bu sayfaya izin verilemiyor"}
});
document.querySelectorAll("[data-pos]").forEach(b=>b.addEventListener("click",async()=>{config.position=b.dataset.pos;render();await saveConfig()}));
$("size").addEventListener("input",e=>{config.panelSize=Number(e.target.value);$("sizeText").textContent=config.panelSize+"%"});
$("size").addEventListener("change",saveConfig);
$("fit").addEventListener("change",async e=>{config.fit=e.target.value;await saveConfig()});
(async()=>{
  try{
    const c=await chrome.runtime.sendMessage({type:"GET_PANEL_CONFIG"});if(c)config=c;
    playlist=await getValue("playlist")||[];folderHandle=await getValue("folderHandle")||null;
    render();
  }catch(e){console.error(e)}
})();