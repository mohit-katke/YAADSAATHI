import { DEMO_IDS, db } from './database'
import { hashPassword, looksLikeEmail, newId, normalizeEmail, normalizeMobile } from './crypto'
import {
  DEFAULT_REMINDERS,
  DEFAULT_ROUTINE,
  DEMO_FAMILIAR_PEOPLE,
  DEMO_FAMILIAR_PLACES,
  DEMO_FAMILIAR_THINGS,
  SESSION_HISTORY,
  normalizeDifficultyLevel,
} from '../data/mock'
import { uploadFirestoreRecord } from '../firebase/client'

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

  await db.familiarPeople.bulkAdd(
    DEMO_FAMILIAR_PEOPLE.map((person) => ({ ...person, patientId: DEMO_IDS.patient, imageAsset: null, createdAt: now, updatedAt: now })),
  )
  await db.familiarPlaces.bulkAdd(
    DEMO_FAMILIAR_PLACES.map((place) => ({ ...place, patientId: DEMO_IDS.patient, imageAsset: null, createdAt: now, updatedAt: now })),
  )
  await db.familiarThings.bulkAdd(
    DEMO_FAMILIAR_THINGS.map((thing) => ({ ...thing, patientId: DEMO_IDS.patient, imageAsset: null, createdAt: now, updatedAt: now })),
  )

  await db.sessions.bulkAdd(
    SESSION_HISTORY.map((row, index) => ({
      id: row.id,
      userId: DEMO_IDS.patient,
      type: 'cognitive',
      game: row.game,
      gameType: row.game.toLowerCase().replaceAll(' ', '-'),
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

export async function listFamiliarPeople(patientId) {
  return db.familiarPeople.where('patientId').equals(patientId).toArray()
}

export async function listFamiliarPlaces(patientId) {
  return db.familiarPlaces.where('patientId').equals(patientId).toArray()
}

export async function listFamiliarThings(patientId) {
  return db.familiarThings.where('patientId').equals(patientId).toArray()
}

export async function saveFamiliarPerson(patientId, person) {
  const row = {
    ...person,
    id: person.id || newId('person'),
    patientId,
    kind: 'person',
    createdAt: person.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  await db.familiarPeople.put(row)
  return row
}

export async function saveFamiliarPlace(patientId, place) {
  const row = {
    ...place,
    id: place.id || newId('place'),
    patientId,
    kind: 'place',
    createdAt: place.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  await db.familiarPlaces.put(row)
  return row
}

export async function saveFamiliarThing(patientId, thing) {
  const row = {
    ...thing,
    id: thing.id || newId('thing'),
    patientId,
    kind: 'thing',
    createdAt: thing.createdAt || Date.now(),
    updatedAt: Date.now(),
  }
  await db.familiarThings.put(row)
  return row
}

export async function saveRecognitionItem({ id, patientId, kind, name, relationship = '', description = '', imageDataUrl = '', imageName = '', imageMime = '', createdByRole = 'caregiver' }) {
  const existing = id ? await db.recognitionItems.get(id) : null
  const category = String(kind || arguments[0]?.category || '').trim().toLowerCase()
  const safeCategory = ['person', 'place', 'thing'].includes(category) ? category : 'thing'
  const question = String(arguments[0]?.question || name || '').trim() || (
    safeCategory === 'person' ? 'Who is this?' : safeCategory === 'place' ? 'What place is this?' : 'What is this?'
  )
  const optionList = Array.isArray(arguments[0]?.options)
    ? arguments[0].options.map((option) => String(option || '').trim()).filter(Boolean)
    : []
  const entries = optionList.length >= 4 ? optionList.slice(0, 4) : [
    String(arguments[0]?.option1 || arguments[0]?.options?.[0] || '').trim(),
    String(arguments[0]?.option2 || arguments[0]?.options?.[1] || '').trim(),
    String(arguments[0]?.option3 || arguments[0]?.options?.[2] || '').trim(),
    String(arguments[0]?.option4 || arguments[0]?.options?.[3] || '').trim(),
  ].filter(Boolean)

  while (entries.length < 4) {
    entries.push(`Option ${entries.length + 1}`)
  }

  const correctAnswer = String(arguments[0]?.correctAnswer || relationship || name || entries[0] || '').trim()
  const finalCorrectAnswer = entries.includes(correctAnswer) ? correctAnswer : entries[0]
  const row = {
    id: id || newId('rec'),
    patientId,
    category: safeCategory,
    question,
    options: entries.slice(0, 4),
    correctAnswer: finalCorrectAnswer,
    difficulty: normalizeDifficultyLevel(arguments[0]?.difficulty || 'Level 1', 'Level 1'),
    imageDataUrl: String(imageDataUrl || existing?.imageDataUrl || existing?.imageBlob || '').trim(),
    imageBlob: String(imageDataUrl || existing?.imageBlob || existing?.imageDataUrl || '').trim(),
    imageName: String(imageName || existing?.imageName || '').trim(),
    imageMime: String(imageMime || existing?.imageMime || '').trim(),
    createdBy: existing?.createdBy || createdByRole,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    name: String(name || '').trim(),
    relationship: String(relationship || '').trim(),
    description: String(description || '').trim(),
    kind: safeCategory,
  }

  if (existing && existing.category !== safeCategory) {
    if (existing.category === 'person') await db.familiarPeople.delete(existing.id)
    if (existing.category === 'place') await db.familiarPlaces.delete(existing.id)
    if (existing.category === 'thing') await db.familiarThings.delete(existing.id)
  }

  if (id) await db.recognitionItems.put(row)
  else await db.recognitionItems.add(row)

  if (patientId) {
    const existingLegacy = await db.familiarPeople.get(row.id)
    if (!existingLegacy) {
      // compatibility path maintained for older data format
    }
  }

  if (safeCategory === 'person') {
    await db.familiarPeople.put({
      id: row.id,
      patientId,
      name: String(name || '').trim() || finalCorrectAnswer,
      relationship: String(relationship || '').trim(),
      description: String(description || '').trim(),
      emoji: '👤',
      imageDataUrl: row.imageDataUrl,
      kind: 'person',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  } else if (safeCategory === 'place') {
    await db.familiarPlaces.put({
      id: row.id,
      patientId,
      name: String(name || '').trim() || finalCorrectAnswer,
      description: String(description || '').trim(),
      emoji: '📍',
      imageDataUrl: row.imageDataUrl,
      kind: 'place',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  } else if (safeCategory === 'thing') {
    await db.familiarThings.put({
      id: row.id,
      patientId,
      name: String(name || '').trim() || finalCorrectAnswer,
      description: String(description || '').trim(),
      emoji: '🧩',
      imageDataUrl: row.imageDataUrl,
      kind: 'thing',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }

  return row
}

export async function deleteRecognitionItem(id) {
  const item = await db.recognitionItems.get(id)
  await db.recognitionItems.delete(id)
  if (item?.category === 'person') await db.familiarPeople.delete(id)
  if (item?.category === 'place') await db.familiarPlaces.delete(id)
  if (item?.category === 'thing') await db.familiarThings.delete(id)
}

export async function listRecognitionItems(patientId) {
  const [custom, people, places, things] = await Promise.all([
    db.recognitionItems.where('patientId').equals(patientId).toArray(),
    listFamiliarPeople(patientId),
    listFamiliarPlaces(patientId),
    listFamiliarThings(patientId),
  ])

  const customIds = new Set(custom.map((item) => item.id))
  const legacy = [
    ...people.map((item) => ({ ...item, kind: 'person' })),
    ...places.map((item) => ({ ...item, kind: 'place' })),
    ...things.map((item) => ({ ...item, kind: 'thing' })),
  ].filter((item) => !customIds.has(item.id))

  return [
    ...custom.map((item) => ({
      ...item,
      id: item.id,
      category: item.category || item.kind || 'thing',
      name: item.name || item.correctAnswer || 'Question',
      question: item.question || 'What is this?',
      options: Array.isArray(item.options) && item.options.length >= 4 ? item.options.slice(0, 4) : [item.correctAnswer || 'Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correctAnswer: item.correctAnswer || item.options?.[0] || 'Option 1',
      imageDataUrl: item.imageDataUrl || item.imageBlob || '',
      difficulty: normalizeDifficultyLevel(item.difficulty || 'Level 1', 'Level 1'),
      kind: item.category || item.kind || 'thing',
    })),
    ...legacy.map((item) => {
      const type = item.kind || 'thing'
      const fallbackCorrect = item.name || item.relationship || item.description || 'Item'
      return {
        id: item.id,
        patientId,
        category: type,
        question: type === 'person' ? 'Who is this?' : type === 'place' ? 'What place is this?' : 'What is this?',
        options: [fallbackCorrect, 'Another choice', 'Different option', 'One more choice'],
        correctAnswer: fallbackCorrect,
        difficulty: normalizeDifficultyLevel(item.difficulty || 'Level 1', 'Level 1'),
        imageDataUrl: item.imageDataUrl || item.imageAsset || item.imageBlob || '',
        kind: type,
        name: fallbackCorrect,
      }
    }),
  ].sort((a, b) => String(a.name || a.question || '').localeCompare(String(b.name || b.question || '')))
}

export async function listGameScores(userId) {
  return db.gameScores.where('userId').equals(userId).reverse().sortBy('createdAt')
}

export async function saveActivitySession({ userId, gameType, game, score = 0, accuracy = 0, reactionLatency = 0, difficulty = 'Easy', completed = true, details = {} }) {
  const createdAt = Date.now()
  const scoreRow = {
    id: newId('score'),
    userId,
    game,
    gameType,
    score,
    accuracy,
    avgReactionMs: reactionLatency,
    difficulty,
    createdAt,
  }
  const sessionRow = {
    id: newId('sess'),
    userId,
    type: 'cognitive',
    game,
    gameType,
    dateLabel: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    accuracy,
    avgReactionMs: reactionLatency,
    reactionLatency,
    difficulty,
    score,
    completed,
    details,
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
    data: { score, accuracy, reactionLatency, difficulty, gameType },
  })
  return { scoreRow, sessionRow }
}

export async function saveCompletedGame({ userId, score, matches, tries, avgReactionMs, difficulty, pairCount }) {
  const accuracy = tries ? Math.round((matches / tries) * 100) : 0
  return saveActivitySession({
    userId,
    gameType: 'memory-match',
    game: 'Memory Match',
    score,
    accuracy,
    reactionLatency: avgReactionMs,
    difficulty,
    details: { matches, tries, pairCount },
  })
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
  let processed = 0
  for (const item of queued) {
    try {
      const uploaded = await uploadFirestoreRecord(item)
      if (!uploaded) continue
      await db.syncQueue.update(item.id, { status: 'synced', syncedAt: Date.now(), updatedAt: Date.now() })
      processed += 1
    } catch (error) {
      await db.syncQueue.update(item.id, { lastAttemptAt: Date.now(), error: error.message || 'Upload failed' })
    }
  }
  return { processed, note: processed ? 'synced' : 'queued' }
}

export function rolePath(role) {
  if (role === 'caregiver') return '/caregiver'
  if (role === 'doctor') return '/doctor'
  return '/patient'
}
