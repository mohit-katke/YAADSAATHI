import Dexie from 'dexie'

export const DEMO_IDS = {
  patient: 'user_demo_patient',
  caregiver: 'user_demo_caregiver',
  doctor: 'user_demo_doctor',
}

export const db = new Dexie('YaadSaathiDB')

db.version(1).stores({
  users: 'id, email, mobile, role',
  sessions: 'id, userId, type, gameType, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  syncQueue: 'id, status, createdAt',
})

db.version(2).stores({
  users: 'id, email, mobile, role',
  sessions: 'id, userId, type, gameType, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  familiarPeople: 'id, patientId, createdAt',
  familiarPlaces: 'id, patientId, createdAt',
  syncQueue: 'id, status, createdAt',
})

db.version(3).stores({
  users: 'id, email, mobile, role',
  sessions: 'id, userId, type, gameType, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  familiarPeople: 'id, patientId, createdAt',
  familiarPlaces: 'id, patientId, createdAt',
  familiarThings: 'id, patientId, createdAt',
  syncQueue: 'id, status, createdAt',
})

db.version(4).stores({
  users: 'id, email, mobile, role',
  sessions: 'id, userId, type, gameType, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  familiarPeople: 'id, patientId, createdAt',
  familiarPlaces: 'id, patientId, createdAt',
  familiarThings: 'id, patientId, createdAt',
  recognitionItems: 'id, patientId, category, difficulty, createdAt',
  syncQueue: 'id, status, createdAt',
})

db.version(5).stores({
  users: 'id, email, mobile, role',
  sessions: 'id, userId, type, gameType, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  familiarPeople: 'id, patientId, createdAt',
  familiarPlaces: 'id, patientId, createdAt',
  familiarThings: 'id, patientId, createdAt',
  recognitionItems: 'id, patientId, category, difficulty, createdAt',
  syncQueue: 'id, status, createdAt',
  audioCache: 'cacheKey, language, textHash, createdAt, lastUsedAt',
})

db.version(6).stores({
  users: 'id, firebaseUid, email, mobile, role',
  sessions: 'id, userId, type, gameType, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  familiarPeople: 'id, patientId, createdAt',
  familiarPlaces: 'id, patientId, createdAt',
  familiarThings: 'id, patientId, createdAt',
  recognitionItems: 'id, patientId, category, difficulty, createdAt',
  relationships: 'id, patientId, caregiverId, doctorId, status, createdAt',
  dailyTasks: 'id, patientId, date, completed, createdAt',
  syncQueue: 'id, status, createdAt',
  audioCache: 'cacheKey, language, textHash, createdAt, lastUsedAt',
})
