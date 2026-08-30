import { DEMO_IDS, db } from './database'
import { hashPassword, looksLikeEmail, newId, normalizeEmail, normalizeMobile } from './crypto'
import { DEFAULT_REMINDERS, DEFAULT_ROUTINE, SESSION_HISTORY } from '../data/mock'

const AUTH_SESSION_ID = 'auth_current'
const DEVICE_SETTINGS_ID = 'settings_device'

export async function ensureSeeded() {
  const count = await db.users.count()
  if (count > 0) return

  const now = Date.now()
  const patientHash = await hashPassword('Patient12')
  const caregiverHash = await hashPassword('Caregiver1')
  const doctorHash = await hashPassword('Doctor123')

  await db.users.bulkAdd([
    {
      id: DEMO_IDS.patient,
      fullName: 'Mina Devi',
      age: 72,
      mobile: '9876543210',
      email: 'mina@yaadsaathi.app',
      location: 'Guwahati, Assam',
      role: 'patient',
      passwordHash: patientHash,
      textLang: 'en',
      voiceLang: 'as',
      relationship: '',
      specialization: '',
      createdAt: now,
    },
    {
      id: DEMO_IDS.caregiver,
      fullName: 'Rina Devi',
      age: 46,
      mobile: '9876543211',
      email: 'rina@yaadsaathi.app',
      location: 'Guwahati, Assam',
      role: 'caregiver',
      passwordHash: caregiverHash,
      textLang: 'hi',
      voiceLang: 'as',
      relationship: 'Daughter',
      specialization: '',
      linkedPatientId: DEMO_IDS.patient,
      createdAt: now,
    },
    {
      id: DEMO_IDS.doctor,
      fullName: 'Dr. A. Sharma',
      age: 54,
      mobile: '9876543212',
      email: 'doctor@yaadsaathi.app',
      location: 'Guwahati, Assam',
      role: 'doctor',
      passwordHash: doctorHash,
      textLang: 'en',
      voiceLang: 'hi',
      relationship: '',
      specialization: 'Geriatric neurology',
      linkedPatientId: DEMO_IDS.patient,
      createdAt: now,
    },
  ])

  await db.reminders.bulkAdd(
    DEFAULT_REMINDERS.map((item) => ({ ...item, userId: DEMO_IDS.patient })),
  )

  await db.settings.put({
    id: `settings_${DEMO_IDS.patient}`,
    userId: DEMO_IDS.patient,
    routine: DEFAULT_ROUTINE,
    difficultyCap: 'Medium',
    currentDifficulty: 'Medium',
    doctorAuthorized: true,
    createdAt: now,
  })

  await db.sessions.bulkAdd(
    SESSION_HISTORY.map((row, index) => ({
      id: row.id,
      userId: DEMO_IDS.patient,
      type: 'cognitive',
      game: row.game,
      dateLabel: row.date,
      accuracy: row.accuracy,
      avgReactionMs: row.latency,
      difficulty: row.difficulty,
      score: Math.round((row.accuracy / 100) * 30),
      tries: 3,
      matches: 3,
      createdAt: now - (SESSION_HISTORY.length - index) * 86400000,
    })),
  )
}

export async function findUserByEmailOrMobile(identifier) {
  const raw = String(identifier || '').trim()
  if (!raw) return null
  if (looksLikeEmail(raw)) {
    return db.users.where('email').equals(normalizeEmail(raw)).first()
  }
  const mobile = normalizeMobile(raw)
  if (mobile.length < 10) return null
  return db.users.where('mobile').equals(mobile).first()
}

export async function emailOrMobileTaken(email, mobile, exceptId) {
  const byEmail = await db.users.where('email').equals(normalizeEmail(email)).first()
  if (byEmail && byEmail.id !== exceptId) return 'email'
  const byMobile = await db.users.where('mobile').equals(normalizeMobile(mobile)).first()
  if (byMobile && byMobile.id !== exceptId) return 'mobile'
  return null
}

export async function registerUser(profile) {
  const taken = await emailOrMobileTaken(profile.email, profile.mobile)
  if (taken) {
    const error = new Error('duplicate')
    error.code = taken
    throw error
  }
  const user = {
    id: newId('user'),
    fullName: profile.fullName.trim(),
    age: Number(profile.age),
    mobile: normalizeMobile(profile.mobile),
    email: normalizeEmail(profile.email),
    location: profile.location.trim(),
    role: profile.role,
    passwordHash: await hashPassword(profile.password),
    textLang: profile.textLang,
    voiceLang: profile.voiceLang,
    relationship: profile.relationship || '',
    specialization: profile.specialization || '',
    linkedPatientId: profile.role === 'patient' ? null : DEMO_IDS.patient,
    createdAt: Date.now(),
  }
  await db.users.add(user)
  await db.settings.put({
    id: `settings_${user.id}`,
    userId: user.id,
    routine: DEFAULT_ROUTINE.map((item) => ({ ...item, done: false })),
    difficultyCap: 'Medium',
    currentDifficulty: 'Easy',
    doctorAuthorized: false,
    createdAt: Date.now(),
  })
  if (user.role === 'patient') {
    await db.reminders.bulkAdd(
      DEFAULT_REMINDERS.map((item) => ({
        ...item,
        id: newId('rem'),
        userId: user.id,
        done: false,
      })),
    )
  }
  return user
}

export async function verifyCredentials(identifier, password) {
  const user = await findUserByEmailOrMobile(identifier)
  if (!user) return null
  const hash = await hashPassword(password)
  if (hash !== user.passwordHash) return null
  return user
}

export async function getAuthSession() {
  const session = await db.sessions.get(AUTH_SESSION_ID)
  if (!session?.userId) return null
  const user = await db.users.get(session.userId)
  if (!user) return null
  return { session, user }
}

export async function setAuthSession(user) {
  await db.sessions.put({
    id: AUTH_SESSION_ID,
    type: 'auth',
    userId: user.id,
    role: user.role,
    createdAt: Date.now(),
  })
}

export async function clearAuthSession() {
  await db.sessions.delete(AUTH_SESSION_ID)
}

export async function getUser(id) {
  return db.users.get(id)
}

export async function getLinkedPatient(user) {
  if (!user) return null
  if (user.role === 'patient') return user
  if (user.linkedPatientId) {
    const linked = await db.users.get(user.linkedPatientId)
    if (linked) return linked
  }
  return db.users.get(DEMO_IDS.patient)
}

export async function getSettings(userId) {
  const id = userId ? `settings_${userId}` : DEVICE_SETTINGS_ID
  const existing = await db.settings.get(id)
  if (existing) return existing
  const fallback = {
    id,
    userId: userId || 'device',
    textLang: 'en',
    voiceLang: 'en',
    difficultyCap: 'Medium',
    currentDifficulty: 'Medium',
    doctorAuthorized: true,
    routine: DEFAULT_ROUTINE,
    createdAt: Date.now(),
  }
  await db.settings.put(fallback)
  return fallback
}

export async function saveSettings(userId, patch) {
  const current = await getSettings(userId)
  const next = { ...current, ...patch, updatedAt: Date.now() }
  await db.settings.put(next)
  return next
}

export async function getDeviceLanguage() {
  const row = await db.settings.get(DEVICE_SETTINGS_ID)
  return {
    textLang: row?.textLang || 'en',
    voiceLang: row?.voiceLang || 'en',
  }
}

export async function saveDeviceLanguage(textLang, voiceLang) {
  const current = (await db.settings.get(DEVICE_SETTINGS_ID)) || {
    id: DEVICE_SETTINGS_ID,
    userId: 'device',
    createdAt: Date.now(),
  }
  await db.settings.put({ ...current, textLang, voiceLang, updatedAt: Date.now() })
}

export async function updateUserLanguages(userId, textLang, voiceLang) {
  const user = await db.users.get(userId)
  if (!user) return
  await db.users.update(userId, { textLang, voiceLang })
}

export async function getReminders(userId) {
  const rows = await db.reminders.where('userId').equals(userId).toArray()
  return rows.length ? rows : []
}

export async function saveReminder(reminder) {
  await db.reminders.put(reminder)
}

export async function addReminder(userId, payload) {
  const item = {
    id: newId('rem'),
    userId,
    time: payload.time,
    text: payload.text,
    done: false,
  }
  await db.reminders.add(item)
  return item
}

export async function getRoutine(userId) {
  const settings = await getSettings(userId)
  return settings.routine || DEFAULT_ROUTINE
}

export async function saveRoutine(userId, routine) {
  return saveSettings(userId, { routine })
}

export async function getDifficultyCap(userId) {
  const settings = await getSettings(userId)
  return settings.difficultyCap || 'Medium'
}

export async function saveDifficultyCap(userId, level) {
  return saveSettings(userId, { difficultyCap: level })
}

export async function getCurrentDifficulty(userId) {
  const settings = await getSettings(userId)
  return settings.currentDifficulty || 'Easy'
}

export async function saveCurrentDifficulty(userId, level) {
  return saveSettings(userId, { currentDifficulty: level })
}

export async function getDoctorAuthorized(userId) {
  const settings = await getSettings(userId)
  return Boolean(settings.doctorAuthorized)
}

export async function saveDoctorAuthorized(userId, value) {
  return saveSettings(userId, { doctorAuthorized: value })
}

export async function listCognitiveSessions(userId) {
  const rows = await db.sessions.where('userId').equals(userId).toArray()
  return rows.filter((row) => row.type === 'cognitive').sort((a, b) => b.createdAt - a.createdAt)
}

export async function listGameScores(userId) {
  return db.gameScores.where('userId').equals(userId).reverse().sortBy('createdAt')
}

export async function saveCompletedGame({ userId, score, matches, tries, avgReactionMs, difficulty, pairCount }) {
  const accuracy = tries ? Math.round((matches / tries) * 100) : 0
  const createdAt = Date.now()
  const scoreRow = {
    id: newId('score'),
    userId,
    game: 'Memory Match',
    score,
    matches,
    tries,
    pairCount,
    accuracy,
    avgReactionMs,
    difficulty,
    createdAt,
  }
  const sessionRow = {
    id: newId('sess'),
    userId,
    type: 'cognitive',
    game: 'Memory Match',
    dateLabel: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    accuracy,
    avgReactionMs,
    difficulty,
    score,
    tries,
    matches,
    createdAt,
  }
  await db.gameScores.add(scoreRow)
  await db.sessions.add(sessionRow)
  await enqueueSync({
    kind: 'gameSession',
    payload: sessionRow,
  })
  await addTelemetry({
    userId,
    kind: 'game_complete',
    data: { score, accuracy, avgReactionMs, difficulty },
  })
  return { scoreRow, sessionRow }
}

export async function addTelemetry({ userId, kind, data }) {
  await db.telemetry.add({
    id: newId('tel'),
    userId,
    kind,
    data,
    createdAt: Date.now(),
  })
}

export async function enqueueSync(record) {
  await db.syncQueue.add({
    id: newId('sync'),
    status: 'queued',
    target: 'firestore',
    payload: record,
    createdAt: Date.now(),
  })
}

export async function processSyncQueue() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, note: 'offline' }
  }
  const queued = await db.syncQueue.where('status').equals('queued').toArray()
  for (const item of queued) {
    await db.syncQueue.update(item.id, {
      status: 'ready_for_backend',
      note: 'Queued for future Firebase/Firestore sync. Not uploaded yet.',
      updatedAt: Date.now(),
    })
  }
  return { processed: queued.length, note: 'ready_for_backend' }
}

export function rolePath(role) {
  if (role === 'caregiver') return '/caregiver'
  if (role === 'doctor') return '/doctor'
  return '/patient'
}
