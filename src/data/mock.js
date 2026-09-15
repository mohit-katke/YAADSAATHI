export const GAME_PAIRS = [
  { pairId: 'lotus', emoji: '🪷', label: 'Lotus' },
  { pairId: 'tea', emoji: '🫖', label: 'Tea' },
  { pairId: 'elephant', emoji: '🐘', label: 'Elephant' },
  { pairId: 'river', emoji: '🌊', label: 'River' },
  { pairId: 'lamp', emoji: '🪔', label: 'Lamp' },
  { pairId: 'bird', emoji: '🕊️', label: 'Bird' },
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
