import { DEMO_IDS, db } from './database'
import { hashPassword, looksLikeEmail, newId, normalizeEmail, normalizeMobile } from './crypto'
import { normalizeDifficultyLevel } from '../data/mock'
import { uploadFirestoreRecord } from '../firebase/client'

const AUTH_SESSION_ID = 'auth_current'
const DEVICE_SETTINGS_ID = 'settings_device'

export async function ensureSeeded() {
  // Remove records from older prototype installations. New installations stay empty.
  const demoIds = Object.values(DEMO_IDS)
  await db.users.bulkDelete(demoIds)
  for (const table of [db.sessions, db.gameScores, db.telemetry, db.reminders, db.settings]) {
    await table.where('userId').anyOf(demoIds).delete()
  }
  for (const table of [db.familiarPeople, db.familiarPlaces, db.familiarThings, db.recognitionItems, db.dailyTasks]) {
    await table.where('patientId').equals(DEMO_IDS.patient).delete()
  }
  await db.relationships.where('patientId').equals(DEMO_IDS.patient).delete()
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
    id: profile.firebaseUid || newId('user'),
    firebaseUid: profile.firebaseUid || null,
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
    linkedPatientId: null,
    createdAt: Date.now(),
  }
  if (user.role === 'patient') {
    const caregiverId = String(profile.caregiverId || '').trim()
    const caregiver = await db.users.get(caregiverId) || await db.users.where('firebaseUid').equals(caregiverId).first()
    if ((!caregiver || caregiver.role !== 'caregiver') && !profile.caregiverExists) {
      const error = new Error('caregiver-not-found')
      error.code = 'caregiver-not-found'
      throw error
    }
  }
  await db.users.add(user)
  if (user.role === 'patient') {
    await createRelationship({ patientId: user.id, caregiverId: String(profile.caregiverId).trim(), role: 'caregiver' })
  }

  await db.settings.put({
    id: `settings_${user.id}`,
    userId: user.id,
    routine: [],
    difficultyCap: 'Medium',
    currentDifficulty: 'Easy',
    doctorAuthorized: false,
    createdAt: Date.now(),
  })
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
  return null
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
    routine: [],
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
    voiceEnabled: row?.voiceEnabled !== false,
  }
}

export async function saveDeviceLanguage(textLang, voiceLang, voiceEnabled = true) {
  const current = (await db.settings.get(DEVICE_SETTINGS_ID)) || {
    id: DEVICE_SETTINGS_ID,
    userId: 'device',
    createdAt: Date.now(),
  }

  await db.settings.put({ ...current, textLang, voiceLang, voiceEnabled, updatedAt: Date.now() })
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
  return settings.routine || []
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

export async function findUserById(id) {
  return id ? db.users.get(String(id).trim()) : null
}

export async function createRelationship({ patientId, caregiverId, doctorId, role }) {
  const key = role === 'doctor' ? doctorId : caregiverId
  const field = role === 'doctor' ? 'doctorId' : 'caregiverId'
  const existing = await db.relationships.where(field).equals(key).filter((row) => row.patientId === patientId).first()
  if (existing) return existing
  const row = {
    id: `${key}_${patientId}`,
    patientId,
    caregiverId: role === 'caregiver' ? key : null,
    doctorId: role === 'doctor' ? key : null,
    role,
    status: 'pending',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await db.relationships.add(row)
  await enqueueSync({ kind: 'relationship', payload: row })
  return row
}

export async function listRelationshipsForUser(user) {
  if (!user) return []
  return db.relationships.where(user.role === 'patient' ? 'patientId' : user.role === 'caregiver' ? 'caregiverId' : 'doctorId').equals(user.id).toArray()
}

export async function listPendingRelationships(user) {
  return (await listRelationshipsForUser(user)).filter((row) => row.status === 'pending')
}

export async function updateRelationshipStatus(id, status, actor) {
  const row = await db.relationships.get(id)
  if (!row || !actor) return null
  const allowed = actor.role === 'caregiver' ? row.caregiverId === actor.id : actor.role === 'doctor' ? row.doctorId === actor.id : row.patientId === actor.id
  if (!allowed || !['accepted', 'rejected', 'pending'].includes(status)) return null
  const updated = { ...row, status, updatedAt: Date.now() }
  await db.relationships.put(updated)
  await enqueueSync({ kind: 'relationship', payload: updated })
  return updated
}

export async function getAuthorizedPatient(user) {
  if (!user) return null
  if (user.role === 'patient') return user
  const relationships = await listRelationshipsForUser(user)
  const active = relationships.find((row) => row.status === 'accepted')
  return active ? db.users.get(active.patientId) : null
}

export async function addDailyTask(patientId, createdBy, payload) {
  const row = { id: newId('task'), patientId, createdBy, createdByRole: payload.createdByRole, title: String(payload.title || '').trim(), description: String(payload.description || '').trim(), date: payload.date || new Date().toISOString().slice(0, 10), dueTime: payload.dueTime || '', completed: false, createdAt: Date.now(), updatedAt: Date.now() }
  if (!row.title) throw new Error('task-title-required')
  await db.dailyTasks.add(row)
  await enqueueSync({ kind: 'dailyTask', payload: row })
  return row
}

export async function listDailyTasks(patientId, date) {
  const rows = await db.dailyTasks.where('patientId').equals(patientId).toArray()
  return rows.filter((row) => !date || row.date === date).sort((a, b) => a.createdAt - b.createdAt)
}

export async function completeDailyTask(id, patientId, completed) {
  const row = await db.dailyTasks.get(id)
  if (!row || row.patientId !== patientId) return null
  const updated = { ...row, completed: Boolean(completed), completedAt: completed ? Date.now() : null, updatedAt: Date.now() }
  await db.dailyTasks.put(updated)
  await enqueueSync({ kind: 'dailyTask', payload: updated })
  return updated
}
export function rolePath(role) {
  if (role === 'caregiver') return '/caregiver'
  if (role === 'doctor') return '/doctor'
  return '/patient'
}
