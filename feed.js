/* feed.js — feed público (admins podem publicar)
 * Requisitos:
 *  - firebase-init.js expõe { auth, db, storage }
 *  - ADMIN_EMAILS definido em window
 */

const q = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);

const postsList       = byId('postsList');
const composer        = byId('composer');
const postText        = byId('postText');
const postUrl         = byId('postUrl');
const postFile        = byId('postFile');
const btnPublish      = byId('btnPublish');

const adminBadge      = byId('adminBadge');
const btnLogout       = byId('btnLogout');

const loadSentinel    = byId('loadSentinel');

const commentsPanel   = byId('commentsPanel');
const commentsList    = byId('commentsList');
const commentText     = byId('commentText');
const commentFile     = byId('commentFile');
const btnSendComment  = byId('btnSendComment');

let currentUser = null;
let isAdmin = false;

let newestUnsub = null;       // unsubscribe dos posts recentes (tempo real)
let afterDoc = null;          // paginação (startAfter)
let loadingMore = false;
let selectedPostId = null;    // post atualmente selecionado na lateral
let commentsUnsub = null;

// ---------- Auth ----------

firebase.auth().onAuthStateChanged(async (user) => {
  currentUser = user || null;
  isAdmin = !!(user && window.ADMIN_EMAILS && window.ADMIN_EMAILS.includes(user.email));
  console.log('[Auth] user:', user?.email || '(anon)');
  console.log('[Auth] isAdmin:', isAdmin);

  // UI de sessão
  adminBadge.hidden = !isAdmin;
  btnLogout.hidden = !user;
  composer.hidden = !isAdmin;

  // Inicia o feed
  resetFeed();
  await loadRecentRealtime(); // onSnapshot p/ últimos N
});

btnLogout?.addEventListener('click', () => firebase.auth().signOut());

// ---------- Feed: tempo real + scroll infinito ----------

// Reinicia estado de feed
function resetFeed() {
  postsList.innerHTML = '';
  afterDoc = null;
  if (newestUnsub) { newestUnsub(); newestUnsub = null; }
}

// Query base (ordem decrescente)
function basePostsQuery(limitQty = 10) {
  return firebase.firestore()
    .collection('posts')
    .orderBy('createdAt', 'desc')
    .limit(limitQty);
}

// Tempo real dos mais recentes (primeira “dobra”)
async function loadRecentRealtime() {
  if (newestUnsub) { newestUnsub(); newestUnsub = null; }

  const q = basePostsQuery(10);
  newestUnsub = q.onSnapshot((snap) => {
    if (snap.empty) return;

    // Mantém referência p/ paginação (o último documento do lote)
    afterDoc = snap.docs[snap.docs.length - 1];

    // Render: substitui os mais recentes (evita duplicar)
    const seen = new Set();
    snap.docs.forEach((doc) => {
      seen.add(doc.id);
      renderOrUpdatePost(doc.id, doc.data());
    });

    // Remove cartões que não estão mais entre os 10 mais novos (evita drift)
    [...postsList.children].forEach(card => {
      const id = card.dataset.id;
      if (id && !seen.has(id) && !card.dataset.older) {
        postsList.removeChild(card);
      }
    });
  });
}

// Scroll infinito: quando o sentinel entra na viewport, busca mais (older)
const io = new IntersectionObserver(async (entries) => {
  if (!entries.some(e => e.isIntersecting)) return;
  await loadMoreOlder();
}, { root: null, rootMargin: '200px', threshold: 0 });

io.observe(loadSentinel);

async function loadMoreOlder() {
  if (loadingMore || !afterDoc) return;
  loadingMore = true;

  const q = firebase.firestore()
    .collection('posts')
    .orderBy('createdAt', 'desc')
    .startAfter(afterDoc)
    .limit(10);

  const snap = await q.get();
  if (!snap.empty) {
    afterDoc = snap.docs[snap.docs.length - 1];
    snap.docs.forEach(doc => renderOrAppendOlder(doc.id, doc.data()));
  }
  loadingMore = false;
}

// ---------- Render de post ----------

function renderOrUpdatePost(id, data) {
  // Procura se já existe
  let card = postsList.querySelector(`.post-card[data-id="${id}"]`);
  if (!card) {
    // Novo: insere no topo
    card = document.createElement('article');
    card.className = 'card post-card';
    card.dataset.id = id;
    postsList.prepend(card);
  }
  card.innerHTML = postHtml(id, data);
  bindPostCard(card, id, data);
}

function renderOrAppendOlder(id, data) {
  // Não duplica se já renderizado
  if (postsList.querySelector(`.post-card[data-id="${id}"]`)) return;
  const card = document.createElement('article');
  card.className = 'card post-card';
  card.dataset.id = id;
  card.dataset.older = '1'; // marca como “mais antigo”
  card.innerHTML = postHtml(id, data);
  postsList.appendChild(card);
  bindPostCard(card, id, data);
}

function postHtml(id, data) {
  const ts = data.createdAt?.toDate ? data.createdAt.toDate() : new Date();
  const tsStr = ts.toLocaleString('pt-BR', { hour12: false });

  const media = renderMedia(data);
  const text = data.text ? `<p class="post-text">${escapeHtml(data.text)}</p>` : '';

  return `
    <header class="post-header">
      <div class="post-author">${escapeHtml(data.authorEmail || 'desconhecido')}</div>
      <div class="post-dot">•</div>
      <time class="post-time">${tsStr}</time>
    </header>
    <div class="post-body">
      ${text}
      ${media}
    </div>
    <footer class="post-footer">
      <button class="btn btn-ghost btn-comments" data-post="${id}">Ver comentários</button>
    </footer>
  `;
}

function renderMedia(d) {
  // 1) YouTube URL/ID
  if (d.youtubeId) {
    return `
      <div class="ratio">
        <iframe src="https://www.youtube.com/embed/${d.youtubeId}" title="YouTube" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
      </div>`;
  }
  // 2) Vídeo direto (mp4)
  if (d.videoUrl) {
    return `
      <video class="media" controls preload="metadata">
        <source src="${d.videoUrl}" type="video/mp4" />
        Seu navegador não suporta vídeo.
      </video>`;
  }
  // 3) Imagem
  if (d.imageUrl) {
    return `<img class="media" src="${d.imageUrl}" alt="">`;
  }
  return '';
}

function bindPostCard(card, id, data) {
  const btn = card.querySelector('.btn-comments');
  if (btn) btn.addEventListener('click', () => openComments(id));
}

// ---------- Composer (post) ----------

btnPublish?.addEventListener('click', publishPost);

postText?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    publishPost();
  }
});

async function publishPost() {
  if (!isAdmin || !currentUser) return alert('Apenas admins podem publicar.');

  const text = (postText.value || '').trim();
  const url  = (postUrl.value || '').trim();
  const file = postFile.files[0];

  // Monta payload
  const payload = {
    authorUid: currentUser.uid,
    authorEmail: currentUser.email,
    text: text || null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  // YouTube?
  const ytid = extractYouTubeId(url);
  if (ytid) payload.youtubeId = ytid;

  // MP4 direto?
  if (!ytid && isMp4(url)) {
    payload.videoUrl = url;
  }

  // Upload de arquivo (imagem/vídeo)
  if (file) {
    const path = `uploads/${currentUser.uid}/${Date.now()}_${file.name}`;
    const ref  = firebase.storage().ref().child(path);
    await ref.put(file);
    const downloadURL = await ref.getDownloadURL();
    if (file.type.startsWith('image/')) payload.imageUrl = downloadURL;
    if (file.type.startsWith('video/')) payload.videoUrl = downloadURL;
  }

  // Pelo menos uma coisa precisa existir
  if (!payload.text && !payload.youtubeId && !payload.videoUrl && !payload.imageUrl) {
    return alert('Escreva algo, forneça uma URL válida ou selecione um arquivo.');
  }

  await firebase.firestore().collection('posts').add(payload);

  // Limpa campos
  postText.value = '';
  postUrl.value  = '';
  postFile.value = '';
}

// ---------- Comentários ----------

async function openComments(postId) {
  selectedPostId = postId;
  commentsList.innerHTML = '';
  if (commentsUnsub) { commentsUnsub(); commentsUnsub = null; }

  // Tempo real — ordem decrescente (último no topo)
  commentsUnsub = firebase.firestore()
    .collection('posts').doc(postId)
    .collection('comments')
    .orderBy('createdAt', 'desc')
    .limit(100) // janela
    .onSnapshot((snap) => {
      commentsList.innerHTML = '';
      snap.docs.forEach(doc => {
        commentsList.appendChild(commentItem(doc.data()));
      });
    });
}

// Enviar comentário: Enter envia / Shift+Enter quebra
commentText?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendComment();
  }
});
btnSendComment?.addEventListener('click', sendComment);

async function sendComment() {
  if (!selectedPostId) return alert('Selecione uma publicação.');
  if (!currentUser)   return alert('Faça login para comentar.');
  if (!isAdmin)       return alert('Apenas admins podem comentar.');

  const txt = (commentText.value || '').trim();
  const file = commentFile.files[0];

  const payload = {
    authorUid: currentUser.uid,
    authorEmail: currentUser.email,
    text: txt || null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (file) {
    const path = `comments/${currentUser.uid}/${Date.now()}_${file.name}`;
    const ref  = firebase.storage().ref().child(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    if (file.type.startsWith('image/')) payload.imageUrl = url;
    if (file.type.startsWith('video/')) payload.videoUrl = url;
  }

  if (!payload.text && !payload.imageUrl && !payload.videoUrl) {
    return alert('Escreva algo ou anexe um arquivo.');
  }

  await firebase.firestore()
    .collection('posts').doc(selectedPostId)
    .collection('comments').add(payload);

  commentText.value = '';
  commentFile.value = '';
}

function commentItem(d) {
  const el = document.createElement('div');
  el.className = 'comment';
  const ts = d.createdAt?.toDate ? d.createdAt.toDate() : new Date();
  const tsStr = ts.toLocaleString('pt-BR', { hour12: false });

  const media =
    d.imageUrl ? `<img class="comment-media" src="${d.imageUrl}" />` :
    d.videoUrl ? `<video class="comment-media" controls preload="metadata"><source src="${d.videoUrl}" type="video/mp4"></video>` :
    '';

  el.innerHTML = `
    <header class="comment-head">
      <span class="comment-author">${escapeHtml(d.authorEmail || 'desconhecido')}</span>
      <span class="comment-dot">•</span>
      <time class="comment-time">${tsStr}</time>
    </header>
    ${d.text ? `<p class="comment-text">${escapeHtml(d.text)}</p>` : ''}
    ${media}
  `;
  return el;
}

// ---------- Utils ----------

function extractYouTubeId(input) {
  if (!input) return null;
  // aceita ID puro, youtu.be, youtube.com/watch?v=
  const idOnly = /^[a-zA-Z0-9_-]{11}$/;
  if (idOnly.test(input)) return input;

  try {
    const u = new URL(input);
    if (u.hostname.includes('youtu.be')) {
      return u.pathname.replace('/', '');
    }
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v && v.length === 11) return v;
    }
  } catch (_) {}
  return null;
}

function isMp4(url) {
  return /^https?:\/\/.+\.mp4(\?.*)?$/.test(url);
}

function escapeHtml(s) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
