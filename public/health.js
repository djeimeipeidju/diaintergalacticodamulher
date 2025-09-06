import {
  app, auth, db,
  GoogleAuthProvider, signInWithPopup, signOut,
  doc, getDoc, setDoc, collection, addDoc, serverTimestamp
} from "./firebase-init.js";

const el = (id)=>document.getElementById(id);
const mark = (id, ok, msg) => {
  const n = el(id);
  n.className = ok ? "ok" : "no";
  n.textContent = (ok ? "OK" : "ERRO") + (msg ? ` — ${msg}` : "");
};

const BUILD = "health-H2";

// Identidade
el("proj").textContent = app?.options?.projectId || "(sem projectId)";
el("build").textContent = BUILD;

// Botões
el("btnLogin").onclick = async ()=>{
  try { await signInWithPopup(auth, new GoogleAuthProvider()); }
  finally { renderAuth(); }
};
el("btnLogout").onclick = async ()=>{ await signOut(auth); renderAuth(); };
el("btnRun").onclick = runAll;
el("btnSetVideo").onclick = setCurrentVideo;

// Render auth + UID
function renderAuth(){
  const u = auth.currentUser;
  el("auth").className = u ? "ok" : "no";
  el("auth").textContent = u ? `OK — ${u.email}` : "ERRO — não autenticado";
  if (el("uid")) el("uid").textContent = u ? u.uid : "—";
}

// Testes
async function testRead(){
  try { await getDoc(doc(db,"posts","current")); mark("read", true); }
  catch(e){ mark("read", false, e.code || e.message); }
}

async function testWrite(){
  try {
    await setDoc(doc(db,"_health","ping"), {
      at: serverTimestamp(),
      by: auth.currentUser?.email || "(anon)"
    }, {merge:true});
    mark("write", true);
  } catch(e){ mark("write", false, e.code || e.message); }
}

async function testCommentWrite(){
  try {
    await addDoc(collection(db,"posts","current","comments"), {
      text: "[health] ping",
      author: auth.currentUser?.email || "(anon)",
      createdAt: serverTimestamp()
    });
    mark("cwrite", true);
  } catch(e){ mark("cwrite", false, e.code || e.message); }
}

async function runAll(){
  renderAuth();
  await testRead();
  await testWrite();
  await testCommentWrite();
}

// Seed de vídeo atual (somente admin pelas rules)
async function setCurrentVideo(){
  const url = prompt("URL do vídeo (YouTube ou .mp4/.webm):");
  if(!url) return;
  try{
    await setDoc(doc(db,"posts","current"), { url });
    alert("OK: posts/current.url atualizado.");
    await testRead();
  }catch(e){
    alert("Falhou: " + (e.code || e.message));
  }
}

renderAuth();
