// index.js — login da área administrativa [v2]
import {
  auth, googleProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, onAuthStateChanged
} from "./firebase-init.js";

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
const passEl = document.getElementById("password");

function ensureAdmin(uEmail){
  const ok = ADMIN_SET.has(norm(uEmail));
  if (!ok) {
    alert("Login permitido apenas para administradores/associados.");
    location.href = "feed.html";
    return false;
  }
  return true;
}

document.getElementById("btnGoogle")?.addEventListener("click", async () => {
  const cred = await signInWithPopup(auth, googleProvider);
  const mail = cred.user?.email || "";
  if (ensureAdmin(mail)) location.href = "feed.html";
});

document.getElementById("btnLogin")?.addEventListener("click", async () => {
  const mail = emailEl.value.trim();
  const pass = passEl.value.trim();
  const cred = await signInWithEmailAndPassword(auth, mail, pass);
  if (ensureAdmin(cred.user?.email || "")) location.href = "feed.html";
});

document.getElementById("btnSignup")?.addEventListener("click", async () => {
  const mail = emailEl.value.trim();
  const pass = passEl.value.trim();
  const cred = await createUserWithEmailAndPassword(auth, mail, pass);
  if (ensureAdmin(cred.user?.email || "")) location.href = "feed.html";
});

onAuthStateChanged(auth, (u) => {
  if (u && ensureAdmin(u.email || "")) {
    location.href = "feed.html";
  }
});
