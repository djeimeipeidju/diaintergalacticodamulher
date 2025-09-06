// public/feed.js — feed protegido (auth + vídeo + comentários) [v3]
import {
  // Auth
  auth, onAuthStateChanged, signOut,
  // Firestore
  db, doc, getDoc, setDoc, updateDoc,
  collection, addDoc, serverTimestamp,
  query, orderBy, onSnapshot, limit
} from "./firebase-init.js";

/* =========================
   Admins (mesma lógica do index)
   ========================= */
const DEFAULT_ADMINS = [
  "s.e.t.i.inteligencia2@gmail.com",
  "s.e.t.i.inteligencia3@gmail.com",
  "djeimepeidju@gmail.com"
];
const norm = (s) => (s || "").normalize("NFKC").trim().toLowerCase();
const RAW_LIST = (Array.isArray(window.ADMIN_EMAILS) && window.ADMIN_EMAILS.length)
  ? window.ADMIN_EMAILS
  : DEFAULT_ADMINS;
const ADMIN_SET = new Set(RAW_LIST.map(norm));
const isAdmin = (email) => ADMIN_SET.has(norm(email));

/* =========================
   Elementos da UI
   ========================= */
const whoEl = document.getElementById("who");
const btnLogout = document.getElementById("btnLogout");
const btnChangeVideo = document.getElementById("btnChangeVideo");
const btnPublishComment = document.getElementById("btnPublishComment");
const videoBox = document.getElementById("videoBox");
const commentList = document.getElementById("commentList");

/* =========================
   Autenticação (proteção de rota)
   ========================= */
let currentUser = null;

onAuthStateChanged(auth, async (u) => {
  if (!u) {
    location.href = "index.html";
    return;
  }
  currentUser = u;
  whoEl.textContent = u.displayName ? `${u.displayName} (${u.email})` : (u.email || "Usuário autenticado");

  // Iniciar listeners do Firestore após auth
  startVideoListener();
  startCommentsListener();

  // Se não for admin, desabilita botões de ação
  if (!isAdmin(u.email || "")) {
    btnChangeVideo?.setAttribute("disabled", "true");
    btnPublishComment?.setAttribute("disabled", "true");
  }
});

btnLogout?.addEventListener("click", async () => {
  await signOut(auth);
  location.href = "index.html";
});

/* =========================
   Vídeo — leitura e troca
   Estrutura: doc /posts/current { url, updatedAt, author }
   ========================= */
const currentPostRef = doc(db, "posts", "current");

function youtubeEmbedFromUrl(url) {
  try {
    const u = new URL(url);
    // padrões comuns: https://www.youtube.com/watch?v=ID  |  https://youtu.be/ID
    let id = "";
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      id = u.searchParams.get("v") || "";
      // playlist/time etc são ignorados propositalmente
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

function renderVideo(url) {
  videoBox.innerHTML = ""; // limpa

  const embed = youtubeEmbedFromUrl(url);
  if (embed) {
    const iframe = document.createElement("iframe");
    iframe.width = "100%";
    iframe.height = "360";
    iframe.src = embed;
    iframe.title = "YouTube video player";
    iframe.frameBorder = "0";
    iframe.allow =
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    videoBox.appendChild(iframe);
    return;
  }

  // fallback simples — link clicável
  const p = document.createElement("p");
  p.className = "muted";
  p.innerHTML = `Vídeo atual: <a href="${url}" target="_blank" rel="noopener">${url}</a>`;
  videoBox.appendChild(p);
}

async function startVideoListener() {
  const snap = await getDoc(currentPostRef);
  if (snap.exists() && snap.data()?.url) {
    renderVideo(snap.data().url);
  }

  // Poderíamos usar onSnapshot(doc) para tempo real; manter simples:
  // (Se quiser tempo real no vídeo também, descomente abaixo)
  // onSnapshot(currentPostRef, (d) => {
  //   if (d.exists() && d.data()?.url) renderVideo(d.data().url);
  // });
}

btnChangeVideo?.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!isAdmin(currentUser.email || "")) {
    alert("Apenas administradores podem trocar o vídeo.");
    return;
  }
  const url = prompt("Cole a URL do vídeo (YouTube recomendado):");
  if (!url) return;

  try {
    await setDoc(
      currentPostRef,
      { url, updatedAt: serverTimestamp(), author: currentUser.email || "" },
      { merge: true }
    );
    renderVideo(url);
  } catch (err) {
    alert("Erro ao salvar vídeo: " + err.message);
  }
});

/* =========================
   Comentários — leitura (4 últimos) e publicação
   Estrutura: /posts/current/comments/{autoId} { text, author, createdAt }
   ========================= */
const commentsCol = collection(db, "posts", "current", "comments");

function renderComments(items) {
  commentList.innerHTML = "";
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "Sem comentários ainda.";
    commentList.appendChild(li);
    return;
  }
  for (const c of items) {
    const li = document.createElement("li");
    li.innerHTML = `<b>${c.author || "Anônimo"}</b> — ${c.text}`;
    commentList.appendChild(li);
  }
}

function startCommentsListener() {
  const q = query(commentsCol, orderBy("createdAt", "desc"), limit(4));
  onSnapshot(q, (qs) => {
    const items = [];
    qs.forEach((d) => items.push(d.data()));
    renderComments(items);
  });
}

btnPublishComment?.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!isAdmin(currentUser.email || "")) {
    alert("Apenas administradores podem publicar comentários.");
    return;
  }
  const text = prompt("Escreva o comentário a publicar:");
  if (!text || !text.trim()) return;

  try {
    await addDoc(commentsCol, {
      text: text.trim(),
      author: currentUser.email || "",
      createdAt: serverTimestamp()
    });
    // lista atualiza pelo onSnapshot
  } catch (err) {
    alert("Erro ao publicar comentário: " + err.message);
  }
}
);
