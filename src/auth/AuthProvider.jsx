import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { clearAuthSession, ensureSeeded, getAuthSession, processSyncQueue, registerUser, rolePath, setAuthSession, verifyCredentials } from '../db/repo'
import { firebaseConfigured, firebaseLogin, firebaseLogout, firebaseProfile, firebaseRegister } from '../firebase/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function boot() {
      try {
        await ensureSeeded()
        const auth = await getAuthSession()
        if (!cancelled) setUser(auth?.user || null)
        processSyncQueue().catch(() => {})
      } catch {
        if (!cancelled) setUser(null)
      } finally {
        if (!cancelled) setReady(true)
      }
    }
    boot()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onOnline = () => processSyncQueue().catch(() => {})
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const login = useCallback(async (identifier, password) => {
    // Development demo accounts live in IndexedDB and must remain usable even
    // when a local .env file also enables Firebase authentication.
    if (import.meta.env.DEV) {
      const localDemo = await verifyCredentials(identifier, password)
      if (localDemo) {
        await setAuthSession(localDemo)
        setUser(localDemo)
        return { ok: true, user: localDemo, path: rolePath(localDemo.role) }
      }
    }
    if (firebaseConfigured) {
      const account = await firebaseLogin(identifier, password)
      if (!account) return { ok: false }
      const profile = await firebaseProfile(account.uid)
      if (!profile?.role) return { ok: false }
      const user = {
        id: account.uid,
        fullName: profile.name,
        age: profile.age,
        mobile: profile.phone,
        email: profile.email,
        location: profile.location,
        role: profile.role,
        textLang: profile.textLanguage || 'en',
        voiceLang: profile.voiceLanguage || 'en',
        relationship: profile.relationship || '',
        specialization: profile.specialization || '',
        linkedPatientId: profile.linkedPatientId || null,
      }
      await setAuthSession(user)
      setUser(user)
      return { ok: true, user, path: rolePath(user.role) }
    }
    const found = await verifyCredentials(identifier, password)
    if (!found) return { ok: false }
    await setAuthSession(found)
    setUser(found)
    return { ok: true, user: found, path: rolePath(found.role) }
  }, [])

  const register = useCallback(async (profile) => {
    if (firebaseConfigured) {
      const account = await firebaseRegister(profile)
      if (!account) return { ok: false }
    }
    const created = await registerUser(profile)
    await setAuthSession(created)
    setUser(created)
    return { ok: true, user: created, path: rolePath(created.role) }
  }, [])

  const logout = useCallback(async () => {
    if (firebaseConfigured) await firebaseLogout()
    await clearAuthSession()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const auth = await getAuthSession()
    setUser(auth?.user || null)
    return auth?.user || null
  }, [])

  const value = useMemo(
    () => ({ user, ready, login, register, logout, refreshUser }),
    [user, ready, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
