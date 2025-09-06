// firebase-init.js — Emuladores + Produção

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, onAuthStateChanged, connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import {
  getFirestore, collection, addDoc, onSnapshot, serverTimestamp,
  query, orderBy, limit, startAfter, doc, getDoc, getDocs, where,
  connectFirestoreEmulator, updateDoc, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL, connectStorageEmulator
} from "https://www.gstatic.com/firebasejs/10.12.1/firebase-storage.js";

// Usa window.firebaseConfig (do seu firebase-config.js)
let cfg = (typeof window !== "undefined" && window.firebaseConfig) ? window.firebaseConfig : {};
const app = initializeApp(cfg);

// Serviços
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

// Local x Produção (aceita localhost e 127.0.0.1)
const isLocal = ["localhost", "127.0.0.1"].includes(location.hostname);
if (isLocal) {
  console.log("🔌 Emuladores ON");
  try { connectAuthEmulator(auth, "http://127.0.0.1:9099"); } catch(e){ console.warn(e); }
  try { connectFirestoreEmulator(db, "127.0.0.1", 8080); } catch(e){ console.warn(e); }
  try { connectStorageEmulator(storage, "127.0.0.1", 9199); } catch(e){ console.warn(e); }
} else {
  console.log("☁️ Produção ON");
}

// Exports usados por index.js e feed.js
export {
  app, auth, db, storage, googleProvider,
  signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
  collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, limit, startAfter, doc, getDoc, getDocs, where, updateDoc, setDoc,
  ref, uploadBytes, getDownloadURL
};
