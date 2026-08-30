export const PATIENT = {
  name: 'Mina Devi',
  age: 72,
  place: 'Guwahati, Assam',
  caregiver: 'Rina Devi (daughter)',
  doctor: 'Dr. A. Sharma',
}

export const TODAY_ACTIVITY = {
  title: 'Morning walk & tea time',
  time: '8:00 AM – 9:00 AM',
  status: 'Completed',
}

export const PATIENT_PROGRESS = {
  gamesToday: 1,
  gamesGoal: 2,
  routineDone: 3,
  routineTotal: 5,
  voiceChecks: 1,
}

export const DEFAULT_REMINDERS = [
  { id: 'r1', time: '8:00 AM', text: 'Morning walk', done: true },
  { id: 'r2', time: '1:00 PM', text: 'Lunch with family', done: false },
  { id: 'r3', time: '6:30 PM', text: 'Evening memory game', done: false },
]

export const DEFAULT_ROUTINE = [
  { id: 'd1', text: 'Drink a glass of water', done: true },
  { id: 'd2', text: 'Take a short walk', done: true },
  { id: 'd3', text: 'Eat lunch', done: true },
  { id: 'd4', text: 'Play Memory Match', done: false },
  { id: 'd5', text: 'Call a family member', done: false },
]

export const CAREGIVER_STATS = {
  activityStatus: 'Active this morning',
  sessionsCompleted: 4,
  avgReactionMs: 860,
  reminderStatus: '2 of 3 reminders done',
}

export const ACTIVITY_TREND = [
  { day: 'Mon', value: 2 },
  { day: 'Tue', value: 3 },
  { day: 'Wed', value: 1 },
  { day: 'Thu', value: 4 },
  { day: 'Fri', value: 3 },
  { day: 'Sat', value: 4 },
  { day: 'Sun', value: 2 },
]

export const DOCTOR_OVERVIEW = {
  accuracy: 82,
  avgLatencyMs: 910,
  difficulty: 'Medium',
  sessionsThisWeek: 9,
}

export const SESSION_HISTORY = [
  { id: 's1', date: '30 Aug', game: 'Memory Match', accuracy: 100, latency: 780, difficulty: 'Easy' },
  { id: 's2', date: '29 Aug', game: 'Memory Match', accuracy: 67, latency: 940, difficulty: 'Medium' },
  { id: 's3', date: '28 Aug', game: 'Memory Match', accuracy: 83, latency: 880, difficulty: 'Medium' },
  { id: 's4', date: '27 Aug', game: 'Memory Match', accuracy: 50, latency: 1120, difficulty: 'Hard' },
  { id: 's5', date: '26 Aug', game: 'Memory Match', accuracy: 83, latency: 860, difficulty: 'Medium' },
]

export const LATENCY_TREND = [
  { day: '26', ms: 860 },
  { day: '27', ms: 1120 },
  { day: '28', ms: 880 },
  { day: '29', ms: 940 },
  { day: '30', ms: 780 },
]

export const GAME_PAIRS = [
  { pairId: 'lotus', emoji: '🪷', label: 'Lotus' },
  { pairId: 'tea', emoji: '🫖', label: 'Tea' },
  { pairId: 'elephant', emoji: '🐘', label: 'Elephant' },
  { pairId: 'river', emoji: '🌊', label: 'River' },
  { pairId: 'lamp', emoji: '🪔', label: 'Lamp' },
  { pairId: 'bird', emoji: '🕊️', label: 'Bird' },
]

export const LEVEL_ORDER = ['Easy', 'Medium', 'Hard']

export function pairsForDifficulty(level) {
  if (level === 'Easy') return GAME_PAIRS.slice(0, 2)
  if (level === 'Hard') return GAME_PAIRS.slice(0, 6)
  return GAME_PAIRS.slice(0, 3)
}
