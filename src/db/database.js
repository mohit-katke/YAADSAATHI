import Dexie from 'dexie'

export const DEMO_IDS = {
  patient: 'user_demo_patient',
  caregiver: 'user_demo_caregiver',
  doctor: 'user_demo_doctor',
}

export const db = new Dexie('YaadSaathiDB')

db.version(1).stores({
  users: 'id, email, mobile, role',
  sessions: 'id, userId, type, createdAt',
  gameScores: 'id, userId, createdAt',
  telemetry: 'id, userId, createdAt, kind',
  reminders: 'id, userId',
  settings: 'id, userId',
  syncQueue: 'id, status, createdAt',
})
