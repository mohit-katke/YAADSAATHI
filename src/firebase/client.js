import { initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, getFirestore, setDoc } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every(Boolean)
const app = firebaseConfigured ? initializeApp(config) : null
export const firebaseAuth = app ? getAuth(app) : null
export const firestore = app ? getFirestore(app) : null

export async function firebaseLogin(email, password) {
  if (!firebaseAuth) return null
  const result = await signInWithEmailAndPassword(firebaseAuth, email, password)
  return result.user
}

export async function firebaseProfile(uid) {
  if (!firestore) return null
  const snapshot = await getDoc(doc(firestore, 'users', uid))
  return snapshot.exists() ? snapshot.data() : null
}

export async function firebaseRegister(profile) {
  if (!firebaseAuth || !firestore) return null
  const result = await createUserWithEmailAndPassword(firebaseAuth, profile.email, profile.password)
  const now = new Date().toISOString()
  await setDoc(doc(firestore, 'users', result.user.uid), {
    uid: result.user.uid,
    name: profile.fullName,
    age: Number(profile.age),
    phone: profile.mobile,
    email: profile.email,
    location: profile.location,
    role: profile.role,
    relationship: profile.relationship || '',
    specialization: profile.specialization || '',
    textLanguage: profile.textLang,
    voiceLanguage: profile.voiceLang,
    createdAt: now,
    updatedAt: now,
  })
  return result.user
}

export async function firebaseLogout() {
  if (firebaseAuth) await signOut(firebaseAuth)
}

export async function uploadFirestoreRecord(record) {
  if (!firestore) return false
  await setDoc(doc(firestore, 'syncQueue', record.id), record.payload)
  return true
}
