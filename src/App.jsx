import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import CreateAccount from './pages/CreateAccount'
import RoleSelect from './pages/RoleSelect'
import PatientDashboard from './pages/PatientDashboard'
import MemoryGame from './pages/MemoryGame'
import VoiceAssist from './pages/VoiceAssist'
import StoryRecall from './pages/StoryRecall'
import CaregiverDashboard from './pages/CaregiverDashboard'
import DoctorDashboard from './pages/DoctorDashboard'
import RecognitionGame from './pages/RecognitionGame'
import LanguageSwitcher from './components/LanguageSwitcher'
import { useAuth } from './auth/AuthProvider'

function RequireSession({ children }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center px-6 text-center">
        <p className="text-2xl font-extrabold text-ink">YaadSaathi</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <div className="min-h-svh bg-cream text-ink">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route
          path="/role"
          element={
            <RequireSession>
              <RoleSelect />
            </RequireSession>
          }
        />
        <Route
          path="/patient"
          element={
            <RequireSession>
              <PatientDashboard />
            </RequireSession>
          }
        />
        <Route
          path="/patient/game"
          element={
            <RequireSession>
              <MemoryGame />
            </RequireSession>
          }
        />
        <Route
          path="/patient/story"
          element={
            <RequireSession>
              <StoryRecall />
            </RequireSession>
          }
        />
        <Route path="/patient/recognize/:kind" element={<RequireSession><RecognitionGame /></RequireSession>} />
        <Route
          path="/patient/voice"
          element={
            <RequireSession>
              <VoiceAssist />
            </RequireSession>
          }
        />
        <Route
          path="/caregiver"
          element={
            <RequireSession>
              <CaregiverDashboard />
            </RequireSession>
          }
        />
        <Route
          path="/doctor"
          element={
            <RequireSession>
              <DoctorDashboard />
            </RequireSession>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <LanguageSwitcher />
    </div>
  )
}
