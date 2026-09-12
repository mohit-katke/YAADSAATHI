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

export const DEMO_FAMILIAR_PEOPLE = [
  { id: 'person-anita', name: 'Anita', relationship: 'Daughter', emoji: '👩🏽' },
  { id: 'person-raj', name: 'Raj', relationship: 'Son', emoji: '👨🏽' },
  { id: 'person-mina', name: 'Mina', relationship: 'Caregiver', emoji: '👩🏾' },
  { id: 'person-sharma', name: 'Dr. Sharma', relationship: 'Doctor', emoji: '🧑🏽‍⚕️' },
]

export const DEMO_FAMILIAR_PLACES = [
  { id: 'place-home', name: 'Home', description: 'A comfortable place to rest', emoji: '🏠' },
  { id: 'place-market', name: 'Local Market', description: 'The nearby market', emoji: '🛍️' },
  { id: 'place-clinic', name: "Doctor's Clinic", description: 'A place for appointments', emoji: '🏥' },
  { id: 'place-park', name: 'Park', description: 'A peaceful place for a walk', emoji: '🌳' },
]

export const DEMO_FAMILIAR_THINGS = [
  { id: 'thing-cup', name: 'Tea Cup', description: 'Everyday object in the kitchen', emoji: '☕' },
  { id: 'thing-keys', name: 'Keys', description: 'Used for home and travel', emoji: '🔑' },
  { id: 'thing-phone', name: 'Phone', description: 'A common communication device', emoji: '📱' },
  { id: 'thing-clock', name: 'Clock', description: 'Used to check the time', emoji: '🕰️' },
  { id: 'thing-medicine', name: 'Medicine Box', description: 'Daily health reminder', emoji: '💊' },
  { id: 'thing-stick', name: 'Walking Stick', description: 'Helpful each day', emoji: '🦯' },
]

export const DEMO_EVERYDAY_OBJECTS = [
  { id: 'object-cup', name: 'Cup', emoji: '☕' },
  { id: 'object-keys', name: 'Keys', emoji: '🔑' },
  { id: 'object-phone', name: 'Phone', emoji: '📱' },
  { id: 'object-clock', name: 'Clock', emoji: '🕰️' },
  { id: 'object-medicine', name: 'Medicine organizer', emoji: '💊' },
  { id: 'object-stick', name: 'Walking stick', emoji: '🦯' },
]

export const LEVEL_ORDER = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5']

export function normalizeDifficultyLevel(level, fallback = 'Level 1') {
  const value = String(level || '').trim()
  if (LEVEL_ORDER.includes(value)) return value
  const normalized = value.toLowerCase()
  const aliases = {
    easy: 'Level 1',
    medium: 'Level 3',
    hard: 'Level 5',
    'level 1': 'Level 1',
    'level 2': 'Level 2',
    'level 3': 'Level 3',
    'level 4': 'Level 4',
    'level 5': 'Level 5',
  }
  return aliases[normalized] || fallback
}

export function levelNumber(level) {
  return Math.max(1, Math.min(5, LEVEL_ORDER.indexOf(normalizeDifficultyLevel(level, 'Level 1')) + 1))
}

export function levelLabel(level) {
  return normalizeDifficultyLevel(level, 'Level 1')
}

export function pairsForDifficulty(level) {
  const n = levelNumber(level)
  return GAME_PAIRS.slice(0, Math.min(2 + n - 1, GAME_PAIRS.length))
}

export function recognitionChoicesForLevel(level) {
  return [2, 3, 4, 5, 6][Math.max(0, Math.min(4, levelNumber(level) - 1))]
}

export function storyRecallPlan(level) {
  const n = levelNumber(level)
  const prompts = [
    {
      body: 'Mina walked to the tea stall near the river. She bought two cups of tea and sat under the old banyan tree with her daughter.',
      questions: ['Where did Mina walk?', 'Who sat with Mina?'],
    },
    {
      body: 'Mina walked to the tea stall near the river after breakfast. She bought two cups of tea and sat under the old banyan tree with her daughter while the evening breeze moved softly around them.',
      questions: ['Where did Mina walk?', 'What did she buy?', 'Who sat with Mina?'],
    },
    {
      body: 'Mina walked to the tea stall near the river after breakfast. She bought two cups of tea and a small snack, then sat under the old banyan tree with her daughter and spoke about the family garden.',
      questions: ['Where did Mina walk?', 'What did she buy?', 'Where did she sit?', 'Who sat with Mina?'],
    },
    {
      body: 'Early in the evening, Mina walked to the tea stall near the river after breakfast. She bought two cups of tea and a snack, sat under the old banyan tree with her daughter, and talked about the family garden before returning home.',
      questions: ['Where did Mina walk?', 'What did she buy?', 'Where did she sit?', 'Who sat with Mina?', 'What did they talk about?'],
    },
    {
      body: 'Early in the evening, Mina walked carefully to the tea stall near the river after breakfast. She bought two cups of tea and a small snack, then sat under the old banyan tree with her daughter, talked about the family garden, and returned home happy before sunset.',
      questions: ['Where did Mina walk?', 'What did she buy?', 'Where did she sit?', 'Who sat with Mina?', 'What happened before sunset?'],
    },
  ]
  const index = Math.min(Math.max(n - 1, 0), prompts.length - 1)
  return prompts[index]
}

export function routineChecklistForLevel(level) {
  const levelNo = levelNumber(level)
  const extras = [
    'Drink a glass of water',
    'Take a short walk',
    'Eat lunch',
    'Play a memory game',
    'Call a family member',
    'Take medicine on time',
    'Sit in the garden',
    'Review the daily plan',
  ]
  const count = [3, 4, 5, 6, 7][levelNo - 1]
  return extras.slice(0, count).map((text, idx) => ({ id: `routine-${levelNo}-${idx + 1}`, text, done: idx < 2 }))
}

export function getRecognitionFallbackByKind(kind) {
  const map = {
    person: DEMO_FAMILIAR_PEOPLE,
    place: DEMO_FAMILIAR_PLACES,
    thing: DEMO_FAMILIAR_THINGS,
  }
  return map[kind] || DEMO_FAMILIAR_PEOPLE
}
