/**

 * App.jsx — root React shell for Sulyap Lasalyano.

 *

 * Flow: splash (brand intro) → in-app navigation between onboarding, live camera, and browse list.

 * State is intentionally simple (no router yet): `phase` gates splash vs app; `screen` picks the active full-page view.

 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'

import Onboarding from './pages/Onboarding'
import HomePage from './pages/HomePage'
import KnowledgeGraphPage from './pages/KnowledgeGraphPage'

import ArtifactDetail from './pages/ArtifactDetail'

import BrowseMode from './pages/BrowseMode'

import PresidentArtifacts from './pages/PresidentArtifacts'

import RelatedArtifacts from './pages/RelatedArtifacts'

import SplashScreen from './pages/SplashScreen'
import { preloadRdScanner } from './lib/rdClassifier'
import darkModeLogo from '../images/logo/LOGO_Dark-Mode.png'
import lightModeLogo from '../images/logo/LOGO_Light-Mode.png'

const ARCamera = lazy(() => import('./pages/ARCamera'))

/** Screens that need in-memory state; without it, the view renders blank after a full reload. */
function resolveBootScreen() {
  try {
    const raw = sessionStorage.getItem('sl_screen') || 'home'
    if (raw === 'artifact-detail' || raw === 'president-artifacts') {
      sessionStorage.setItem('sl_screen', 'home')
      return 'home'
    }
    return raw
  } catch {
    return 'home'
  }
}

export default function App() {
  useEffect(() => {
    void preloadRdScanner()
  }, [])

  useEffect(() => {
    const setFavicon = (isDark) => {
      const logo = isDark ? darkModeLogo : lightModeLogo
      const iconLinks = document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']")
      iconLinks.forEach((link) => {
        link.setAttribute('href', logo)
        if (link.getAttribute('rel') === 'icon') {
          link.setAttribute('type', 'image/png')
        }
      })
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    setFavicon(mq.matches)
    const handler = (e) => setFavicon(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const [screen, setScreenRaw] = useState(resolveBootScreen)
  const isPageRefresh = screen === 'home'

  const [showSplash, setShowSplash] = useState(isPageRefresh)
  const [showApp, setShowApp] = useState(!isPageRefresh)
  const [language, setLanguage] = useState('English')
  const [darkMode, setDarkMode] = useState(false)
  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), [])

  const [browseArtifact, setBrowseArtifact] = useState(null)

  /** Persists across artifact detail so Back returns to the same browse tab (detail always restores "All Artifacts"). */

  const [browseListView, setBrowseListView] = useState('presidents')

  /** President row from browse (mock) — used by `president-artifacts` screen. */

  const [selectedPresident, setSelectedPresident] = useState(null)

  /** Where artifact detail was opened from — controls Back from `ArtifactDetail`. */

  const [artifactDetailReturn, setArtifactDetailReturn] = useState(null)

  /** Where browse was opened from — controls Back from `BrowseMode`. */
  const [browseReturnScreen, setBrowseReturnScreen] = useState('home')

  /** Selected tag for `RelatedArtifacts` (opened from artifact detail tags). */
  const [relatedArtifactsTag, setRelatedArtifactsTag] = useState('')

  /** Back target from RelatedArtifacts (e.g. artifact-detail). */
  const [relatedArtifactsReturn, setRelatedArtifactsReturn] = useState('artifact-detail')

  /** Screen to return to when leaving Knowledge Graph (home or artifact-detail). */
  const [kgReturnScreen, setKgReturnScreen] = useState('home')

  const isPopstate = useRef(false)

  const setScreen = useCallback((nextScreen) => {
    setScreenRaw(nextScreen)
    sessionStorage.setItem('sl_screen', nextScreen)
    if (!isPopstate.current) {
      window.history.pushState({ screen: nextScreen }, '', null)
    }
    isPopstate.current = false
  }, [])

  useEffect(() => {
    const s = sessionStorage.getItem('sl_screen') || 'home'
    window.history.replaceState({ screen: s }, '', null)

    const handlePopState = (e) => {
      if (e.state?.onbPage !== undefined) return
      const target = e.state?.screen ?? 'home'
      isPopstate.current = true
      setScreenRaw(target)
      sessionStorage.setItem('sl_screen', target)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSplashDone = useCallback(() => {
    setShowApp(true)
    window.setTimeout(() => {
      setShowSplash(false)
    }, 520)
  }, [])



  const renderAppScreen = () => {

    switch (screen) {

      case 'onboarding':

        return <Onboarding onFinish={() => setScreen('camera')} onBack={() => setScreen('home')} darkMode={darkMode} />

      case 'home':

        return (
          <HomePage
            language={language}
            onLanguageChange={setLanguage}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onStartCamera={() => setScreen('onboarding')}
            onOpenKnowledgeGraph={() => {
              setKgReturnScreen('home')
              setScreen('knowledge-graph')
            }}
            onBrowse={() => {
              setBrowseListView('presidents')
              setBrowseReturnScreen('home')
              setScreen('browse')
            }}
          />
        )

      case 'camera':

        return (
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-[#f2efd6]">Loading scanner…</div>}>
            <ARCamera onBrowse={() => { setBrowseReturnScreen('camera'); setScreen('browse') }} onHome={() => setScreen('home')} darkMode={darkMode} />
          </Suspense>
        )

      case 'browse':

        return (

          <BrowseMode

            onBack={() => setScreen(browseReturnScreen)}

            darkMode={darkMode}

            onOpenPresident={(president) => {

              setSelectedPresident(president)

              setScreen('president-artifacts')

            }}

          />

        )

      case 'president-artifacts':

        return (

          <PresidentArtifacts

            president={selectedPresident}

            darkMode={darkMode}

            onBack={() => {

              setSelectedPresident(null)

              setBrowseListView('presidents')

              setScreen('browse')

            }}

            onOpenArtifact={(artifact) => {

              setArtifactDetailReturn('president-artifacts')

              setBrowseArtifact(artifact)

              setScreen('artifact-detail')

            }}

          />

        )

      case 'artifact-detail':

        return (

          <ArtifactDetail

            artifact={browseArtifact}

            darkMode={darkMode}

            onBack={() => {

              setBrowseArtifact(null)

              if (artifactDetailReturn === 'president-artifacts') {

                setScreen('president-artifacts')

              } else if (artifactDetailReturn === 'related-artifacts') {

                setScreen('related-artifacts')

              } else {

                setBrowseListView('artifacts')

                setScreen('browse')

              }

              setArtifactDetailReturn(null)

            }}

            onRelatedTag={(tagLabel) => {

              setRelatedArtifactsTag(tagLabel)

              setRelatedArtifactsReturn('artifact-detail')

              setScreen('related-artifacts')

            }}

            onViewKnowledgeGraph={() => {
              setKgReturnScreen('artifact-detail')
              setScreen('knowledge-graph')
            }}

          />

        )
      case 'related-artifacts':
        return (
          <RelatedArtifacts
            tag={relatedArtifactsTag}
            darkMode={darkMode}
            onBack={() => setScreen(relatedArtifactsReturn)}
            onOpenArtifact={(artifact) => {
              setArtifactDetailReturn('related-artifacts')
              setBrowseArtifact(artifact)
              setScreen('artifact-detail')
            }}
          />
        )
      case 'knowledge-graph':
        return (
          <KnowledgeGraphPage
            language={language}
            darkMode={darkMode}
            onBack={() => setScreen(kgReturnScreen)}
          />
        )

      default:

        return (
          <HomePage
            language={language}
            onLanguageChange={setLanguage}
            darkMode={darkMode}
            onToggleDarkMode={toggleDarkMode}
            onStartCamera={() => setScreen('onboarding')}
            onOpenKnowledgeGraph={() => {
              setKgReturnScreen('home')
              setScreen('knowledge-graph')
            }}
            onBrowse={() => {
              setBrowseListView('presidents')
              setBrowseReturnScreen('home')
              setScreen('browse')
            }}
          />
        )

    }

  }



  return (

    <div className={`relative w-screen min-h-[100dvh] h-[100dvh] overflow-hidden bg-[#675642] text-[#f2efd6] ${darkMode ? 'app-dark' : ''}`}>

      <div className="relative z-10 h-full w-full">
        <div
          className={`absolute inset-0 z-20 transition-opacity duration-500 ease-out ${
            showSplash ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          {showSplash ? <SplashScreen onComplete={handleSplashDone} /> : null}
        </div>

        <div className={`h-full w-full transition-opacity duration-500 ease-out ${showApp ? 'opacity-100' : 'opacity-0'}`}>
          {renderAppScreen()}
        </div>
      </div>

    </div>

  )

}


