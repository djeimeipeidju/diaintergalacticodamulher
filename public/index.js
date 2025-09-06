// public/index.js — login da área administrativa [corrigido v3]
import {
  auth, googleProvider, signInWithPopup,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  onAuthStateChanged
} from "./firebase-init.js";

// Lista padrão de administradores (pode ser sobrescrita por window.ADMIN_EMAILS no HTML)
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

const emailEl = document.getElementById("email");
const passEl  = document.getElementById("password");

function ensureAdmin(uEmail) {
  const ok = ADMIN_SET.has(norm(uEmail));
  if (!ok) {
    // Usuário autenticado mas não-admin segue para o feed (leitura pública)
    location.href = "feed.html";
    return false;
  }
  return true;
}

// Google
document.getElementById("btnGoogle")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const cred = await signInWithPopup(auth, new googleProvider.constructor());
    const mail = cred.user?.email || "";
    ensureAdmin(mail);
    location.href = "feed.html";
  } catch (err) {
    alert("Erro no login Google: " + err.message);
  }
});

// E-mail/senha — entrar
document.getElementById("btnLogin")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const mail = emailEl.value.trim();
    const pass = passEl.value.trim();
    const cred = await signInWithEmailAndPassword(auth, mail, pass);
    ensureAdmin(cred.user?.email || "");
    location.href = "feed.html";
  } catch (err) {
    alert("Erro no login: " + err.message);
  }
});

// E-mail/senha — cadastrar
document.getElementById("btnSignup")?.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    const mail = emailEl.value.trim();
    const pass = passEl.value.trim();
    const cred = await createUserWithEmailAndPassword(auth, mail, pass);
    ensureAdmin(cred.user?.email || "");
    location.href = "feed.html";
  } catch (err) {
    alert("Erro no cadastro: " + err.message);
  }
});

// Já logado? redireciona
onAuthStateChanged(auth, (u) => {
  if (u) {
    ensureAdmin(u.email || "");
    location.href = "feed.html";
  }
});
