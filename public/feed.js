// public/feed.js — feed protegido (auth + vídeo + comentários) [v4 robust]
// - Captura erros de permissão nos onSnapshot/getDoc/addDoc/setDoc
// - Exibe mensagens amigáveis e não quebra a UI

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
   Helpers de UI/Erros
   ========================= */
function uiAlert(msg) {
  try { alert(msg); } catch { console.log("[ALERT]", msg); }
}
function showMuted(el, text) {
  if (!el) return;
  el.innerHTML = "";
  const p = document.createElement("p");
  p.className = "muted";
  p.textContent = text;
  el.appendChild(p);
}
function handleSnapshotError(ctx, err, targetEl) {
  console.error(`[onSnapshot:${ctx}]`, err?.code, err?.message);
  const perm = err?.code === "permission-denied";
  if (perm) {
    showMuted(
      targetEl,
      "Sem permissão de leitura. Verifique as Regras do Firestore (libere read em /posts e /posts/current/comments)."
    );
  } else {
    showMuted(targetEl, `Erro ao ler (${ctx}). Tente recarregar a página.`);
  }
}
function handleWriteError(ctx, err) {
  console.error(`[write:${ctx}]`, err?.code, err?.message);
  const perm = err?.code === "permission-denied";
  if (perm) {
    uiAlert("Sem permissão para escrever. Garanta que seu e-mail está nas regras (admin).");
  } else {
    uiAlert(`Erro ao ${ctx}: ${err?.message || "desconhecido"}`);
  }
}

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
  whoEl && (whoEl.textContent = u.displayName ? `${u.displayName} (${u.email})` : (u.email || "Usuário autenticado"));

  // listeners do Firestore após auth
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
    let id = "";
    if (u.hostname.includes("youtu.be")) {
      id = u.pathname.slice(1);
    } else if (u.hostname.includes("youtube.com")) {
      id = u.searchParams.get("v") || "";
    }
    return id ? `https://www.youtube.com/embed/${id}` : null;
  } catch {
    return null;
  }
}

function renderVideo(url) {
  if (!videoBox) return;
  videoBox.innerHTML = "";

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

  const p = document.createElement("p");
  p.className = "muted";
  p.innerHTML = `Vídeo atual: <a href="${url}" target="_blank" rel="noopener">${url}</a>`;
  videoBox.appendChild(p);
}

async function startVideoListener() {
  // 1) Tentativa inicial via getDoc (com try/catch)
  try {
    const snap = await getDoc(currentPostRef);
    if (snap.exists() && snap.data()?.url) {
      renderVideo(snap.data().url);
    } else {
      showMuted(videoBox, "Nenhum vídeo definido ainda.");
    }
  } catch (err) {
    handleSnapshotError("post(getDoc)", err, videoBox);
  }

  // 2) Tempo real com tratamento de erro
  try {
    onSnapshot(
      currentPostRef,
      (d) => {
        if (d.exists() && d.data()?.url) {
          renderVideo(d.data().url);
        }
      },
      (err) => handleSnapshotError("post(onSnapshot)", err, videoBox)
    );
  } catch (err) {
    handleSnapshotError("post(listener-setup)", err, videoBox);
  }
}

btnChangeVideo?.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!isAdmin(currentUser.email || "")) {
    uiAlert("Apenas administradores podem trocar o vídeo.");
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
    renderVideo(url); // resposta imediata
  } catch (err) {
    handleWriteError("salvar vídeo", err);
  }
});

/* =========================
   Comentários — leitura (4 últimos) e publicação
   Estrutura: /posts/current/comments/{autoId} { text, author, createdAt }
   ========================= */
const commentsCol = collection(db, "posts", "current", "comments");

function renderComments(items) {
  if (!commentList) return;
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
  const qy = query(commentsCol, orderBy("createdAt", "desc"), limit(4));
  try {
    onSnapshot(
      qy,
      (qs) => {
        const items = [];
        qs.forEach((d) => items.push(d.data()));
        renderComments(items);
      },
      (err) => handleSnapshotError("comments(onSnapshot)", err, commentList)
    );
  } catch (err) {
    handleSnapshotError("comments(listener-setup)", err, commentList);
  }
}

btnPublishComment?.addEventListener("click", async () => {
  if (!currentUser) return;
  if (!isAdmin(currentUser.email || "")) {
    uiAlert("Apenas administradores podem publicar comentários.");
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
    handleWriteError("publicar comentário", err);
  }
});
