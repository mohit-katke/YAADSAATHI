import { initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, deleteUser, getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, getFirestore, query, setDoc, where } from 'firebase/firestore'

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
  try {
    // A patient can only be created after their supplied, UID-based caregiver ID
    // has resolved to an existing caregiver profile.
    if (profile.role === 'patient') {
      const caregiver = await firebaseProfile(profile.caregiverId)
      if (!caregiver || caregiver.role !== 'caregiver') {
        const error = new Error('caregiver-not-found')
        error.code = 'caregiver-not-found'
        throw error
      }
    }
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
    caregiverId: profile.caregiverId || null,
    createdAt: now,
    updatedAt: now,
  })
    return result.user
  } catch (error) {
    // Do not leave an unusable Auth account behind when caregiver validation fails.
    await deleteUser(result.user).catch(() => {})
    throw error
  }
}

export async function firebaseLogout() {
  if (firebaseAuth) await signOut(firebaseAuth)
}

export async function uploadFirestoreRecord(record) {
  if (!firestore) return false
  const payload = record.payload?.payload || record.payload || {}
  const collectionName = record.payload?.kind === 'gameSession'
    ? 'gameSessions'
    : record.payload?.kind === 'dailyTask'
      ? 'dailyTasks'
      : record.payload?.kind === 'reminder'
        ? 'reminders'
      : record.payload?.kind === 'relationship'
        ? 'relationships'
        : record.payload?.kind === 'story_recall'
          ? 'gameSessions'
          : 'telemetry'
  const normalized = {
    ...payload,
    // Older local rows use userId. Cloud patient records use patientId so rules
    // and queries have one consistent ownership field.
    patientId: payload.patientId || (collectionName === 'reminders' ? payload.userId : undefined),
  }
  if (normalized.patientId === undefined) delete normalized.patientId
  await setDoc(doc(firestore, collectionName, payload.id || record.id), normalized, { merge: true })
  return true
}

export async function firebaseRelationships(user) {
  if (!firestore || !user?.id) return []
  const field = user.role === 'patient' ? 'patientId' : user.role === 'caregiver' ? 'caregiverId' : 'doctorId'
  const snapshot = await getDocs(query(collection(firestore, 'relationships'), where(field, '==', user.id)))
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
}

export async function firebasePatientRecords(patientId) {
  if (!firestore || !patientId) return { sessions: [], tasks: [], reminders: [] }
  const read = async (name) => {
    const snapshot = await getDocs(query(collection(firestore, name), where('patientId', '==', patientId)))
    return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
  }
  const [sessions, tasks, reminders] = await Promise.all([read('gameSessions'), read('dailyTasks'), read('reminders')])
  return { sessions, tasks, reminders }
}
