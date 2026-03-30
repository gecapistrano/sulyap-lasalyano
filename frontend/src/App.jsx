/**
 * App.jsx — root React shell for ARchive.
 *
 * Flow: splash (brand intro) → in-app navigation between onboarding, live camera, and browse list.
 * State is intentionally simple (no router yet): `phase` gates splash vs app; `screen` picks the active full-page view.
 */
import { useCallback, useState } from 'react'
import Onboarding from './pages/Onboarding'
import ARCamera from './pages/ARCamera'
import BrowseMode from './pages/BrowseMode'
import SplashScreen from './pages/SplashScreen'
import ARExperience from './pages/ARExperience'

export default function App() {
  const [phase, setPhase] = useState('splash')
  const initialScreen =
    typeof window !== 'undefined' && (window.location.pathname === '/ar' || window.location.pathname === '/ar/')
      ? 'ar'
      : 'onboarding'
  const [screen, setScreen] = useState(initialScreen)

  const handleSplashDone = useCallback(() => {
    setPhase('app')
  }, [])

  return (
    <div className="relative w-screen min-h-[100dvh] h-[100dvh] overflow-hidden bg-[#0a1508] text-white">
      <div className="relative z-10 h-full w-full">
        {phase === 'splash' ? (
          <SplashScreen onComplete={handleSplashDone} />
        ) : (
          renderScreen(screen, setScreen)
        )}
      </div>
    </div>
  )
}

/** Maps logical screen name to the corresponding page component (see `src/pages/`). */
function renderScreen(screen, setScreen) {
  switch (screen) {
    case 'onboarding':
      return <Onboarding onFinish={() => setScreen('camera')} />
    case 'camera':
      return <ARCamera onBrowse={() => setScreen('browse')} />
    case 'browse':
      return <BrowseMode onBack={() => setScreen('camera')} />
    case 'ar':
      return <ARExperience />
    default:
      return null
  }
}
