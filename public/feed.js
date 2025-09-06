import {
  auth, db,
  onAuthStateChanged, signOut,
  doc, getDoc,
  collection, query, orderBy, limit, onSnapshot,
  addDoc, serverTimestamp
} from "./firebase-init.js";

/* Utilidades */
const $ = (s, r=document) => r.querySelector(s);
const escapeHTML = (s) => s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* Guarda de rota (precisa estar logado) */
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.href = "index.html";
    return;
  }
  $("#who").textContent = `${user.displayName || user.email} — autenticado`;
  $("#btnLogout").onclick = async () => { await signOut(auth); };

  await loadCurrentVideo();
  listenComments();
  bindForm();
});

/* Player 16:9 com YouTube ou arquivo */
async function loadCurrentVideo(){
  const hint = $("#videoHint");
  const player = $("#player");
  player.innerHTML = "";
  hint.textContent = "";

  const snap = await getDoc(doc(db, "posts", "current"));
  const url = snap.exists() ? snap.data().url : null;

  if (!url) {
    hint.textContent = "Nenhum vídeo definido. Use o botão 'Definir vídeo atual (admin)' no /health.html.";
    return;
  }

  if (isYouTube(url)) {
    const id = youTubeId(url);
    const embed = `https://www.youtube.com/embed/${id}`;
    player.innerHTML = `<iframe class="fill" src="${embed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;
    hint.textContent = "Origem: YouTube";
  } else if (isMedia(url)) {
    player.innerHTML = `<video class="fill" src="${url}" controls playsinline></video>`;
    hint.textContent = "Origem: arquivo de mídia";
  } else {
    hint.textContent = "Formato de URL não reconhecido.";
  }
}

function isMedia(u){
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(u);
}
function isYouTube(u){
  return /youtu\.be\/|youtube\.com\/(watch\?v=|embed\/)/i.test(u);
}
function youTubeId(u){
  // cobre youtu.be/<id>, youtube.com/watch?v=<id>, /embed/<id>
  const m1 = u.match(/youtu\.be\/([\w\-]{6,})/i);
  if (m1) return m1[1];
  const m2 = u.match(/[?&]v=([\w\-]{6,})/i);
  if (m2) return m2[1];
  const m3 = u.match(/embed\/([\w\-]{6,})/i);
  if (m3) return m3[1];
  return u;
}

/* Caixa única de comentários — 4 visíveis (overflow para os demais) */
let unsub = null;
function listenComments(){
  if (unsub) unsub();
  const q = query(
    collection(db, "posts", "current", "comments"),
    orderBy("createdAt", "desc")
  );
  unsub = onSnapshot(q, (snap) => {
    const box = $("#comments");
    if (snap.empty) {
      box.innerHTML = `<div class="muted">Nenhum comentário ainda.</div>`;
      return;
    }
    const items = [];
    snap.forEach(doc => {
      const d = doc.data();
      const text = escapeHTML(d.text || "");
      const author = escapeHTML(d.author || "");
      const when = d.createdAt?.toDate?.() ? d.createdAt.toDate().toLocaleString() : "";
      items.push(
        `<div class="item">
           <div>${text}</div>
           <small>${author}${when ? " — " + when : ""}</small>
         </div>`
      );
    });
    // Renderiza todos, mas só 4 ficam visíveis pelo height da .list
    box.innerHTML = items.join("");
  });
}

/* Envio de novo comentário (regra exige author == email do usuário) */
function bindForm(){
  $("#commentForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const t = $("#commentText");
    const text = (t.value || "").trim();
    if (!text) return;
    const user = auth.currentUser;
    try{
      await addDoc(collection(db, "posts", "current", "comments"), {
        text,
        author: user.email,
        createdAt: serverTimestamp()
      });
      t.value = "";
    }catch(err){
      alert("Falhou ao comentar: " + (err.code || err.message));
    }
  });
}
