import { db } from '../db/database'

async function hashText(text) {
  const value = String(text || '')
  if (globalThis.crypto?.subtle) {
    const bytes = new TextEncoder().encode(value)
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return `fallback-${(hash >>> 0).toString(16)}`
}

export async function createAudioCacheKey(text, language, voice = 'default', gender = 'default') {
  const textHash = await hashText(text)
  return { cacheKey: `${language}:${voice}:${gender}:${textHash}`, textHash }
}

export async function getCachedAudio(cacheKey) {
  const record = await db.audioCache.get(cacheKey)
  if (!record?.audioBlob) return null
  await db.audioCache.update(cacheKey, { lastUsedAt: Date.now() })
  return record
}

export async function cacheAudio({ cacheKey, language, textHash, audioBlob }) {
  const now = Date.now()
  await db.audioCache.put({
    cacheKey,
    language,
    textHash,
    audioBlob,
    createdAt: now,
    lastUsedAt: now,
  })
}

export async function hasCachedAudio(cacheKey) {
  return Boolean(await db.audioCache.get(cacheKey))
}

export async function getCachedAudioStatus(language) {
  const count = await db.audioCache.where('language').equals(language).count()
  return { available: count > 0, count }
}

export async function playCachedAudio(record, { onStart, onEnd, onError } = {}) {
  if (typeof Audio === 'undefined') {
    onError?.({ error: 'audio-element-unavailable' })
    return { ok: false, cancel: () => {} }
  }
  const url = URL.createObjectURL(record.audioBlob)
  const audio = new Audio(url)
  let settled = false
  const finish = (callback) => {
    if (settled) return
    settled = true
    URL.revokeObjectURL(url)
    callback?.()
  }
  audio.onplay = () => onStart?.()
  audio.onended = () => finish(onEnd)
  audio.onerror = (event) => finish(() => onError?.(event))
  try {
    await audio.play()
  } catch (error) {
    finish(() => onError?.(error))
    return { ok: false, cancel: () => audio.pause() }
  }
  return { ok: true, cached: true, cancel: () => { audio.pause(); finish(onEnd) } }
}