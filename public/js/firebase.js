import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile, signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, remove,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjlfYVPkWlbLum9XCNwQpxz6X4JJeG80M",
  authDomain: "vetec-7bad8.firebaseapp.com",
  databaseURL: "https://vetec-7bad8-default-rtdb.firebaseio.com",
  projectId: "vetec-7bad8",
  storageBucket: "vetec-7bad8.firebasestorage.app",
  messagingSenderId: "324419383268",
  appId: "1:324419383268:web:0d35302ada5a2a7bec61f1",
  measurementId: "G-7EJNB5BWV7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);

export async function signUp(email, password, displayName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (displayName) await updateProfile(cred.user, { displayName });
  return cred.user;
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signInAsPlayer() {
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (e) {
    console.warn('Anon auth falhou:', e);
    return null;
  }
}

export function logOut() { return signOut(auth); }
export function onAuth(cb) { return onAuthStateChanged(auth, cb); }

export async function dbGet(path) {
  const snap = await get(ref(db, path));
  return snap.exists() ? snap.val() : null;
}

export async function dbSet(path, value) {
  await set(ref(db, path), value);
}

export async function dbUpdate(path, value) {
  await update(ref(db, path), value);
}

export async function dbRemove(path) {
  await remove(ref(db, path));
}

export function dbListen(path, cb) {
  return onValue(ref(db, path), snap => cb(snap.exists() ? snap.val() : null));
}

export async function getPlayerIndex(nick) {
  const key = String(nick).toLowerCase().trim();
  return dbGet(`player_index/${key}`);
}

export async function setPlayerIndex(nick, data) {
  const key = String(nick).toLowerCase().trim();
  await dbSet(`player_index/${key}`, data);
}

export async function removePlayerIndex(nick) {
  const key = String(nick).toLowerCase().trim();
  await dbRemove(`player_index/${key}`);
}