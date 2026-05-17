/**
 * App.jsx — root React shell for Sulyap Lasalyano.
 *
 * Flow: splash (brand intro) → in-app navigation between onboarding, live camera, and browse list.
 * State is intentionally simple (no router yet): `phase` gates splash vs app; `screen` picks the active full-page view.
 * Browser history uses rich `history.state` so Back/Forward restores artifact / president / tag context (no blank detail).
 */

import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import Onboarding from './pages/Onboarding'
import HomePage from './pages/HomePage'
import KnowledgeGraphPage from './pages/KnowledgeGraphPage'

import ArtifactDetail from './pages/ArtifactDetail'

import BrowseMode from './pages/BrowseMode'

import PresidentArtifacts from './pages/PresidentArtifacts'

import RelatedArtifacts from './pages/RelatedArtifacts'

import SplashScreen from './pages/SplashScreen'
import { preloadRdScanner } from './lib/rdClassifier'
import { emptySnapshot, mergeSnapshot, sanitizeSnapshot } from './lib/navigationHistory'
import { findMockArtifactById } from './data/artifactBrowseMocks'
import { findPresidentById } from './data/presidentBrowseMocks'
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
  const initialScreen = resolveBootScreen()

  /** Last pushed / popped navigation snapshot (aligned with `history.state`). */
  const navRef = useRef(emptySnapshot(initialScreen))

  const [screen, setScreenRaw] = useState(initialScreen)
  const isPageRefresh = screen === 'home'

  const [showSplash, setShowSplash] = useState(isPageRefresh)
  const [showApp, setShowApp] = useState(!isPageRefresh)
  const [language, setLanguage] = useState('English')
  const [darkMode, setDarkMode] = useState(false)
  const toggleDarkMode = useCallback(() => setDarkMode((d) => !d), [])

  useEffect(() => {
    const applyFavicon = () => {
      const osDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const useDarkAsset = darkMode || osDark
      const logo = useDarkAsset ? darkModeLogo : lightModeLogo
      document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach((link) => {
        link.setAttribute('href', logo)
        if (link.getAttribute('rel') === 'icon') {
          link.setAttribute('type', 'image/png')
        }
      })
    }
    applyFavicon()
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', applyFavicon)
    return () => mq.removeEventListener('change', applyFavicon)
  }, [darkMode])

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

  const hydrateFromSnapshot = useCallback((candidate) => {
    const s = sanitizeSnapshot(candidate)
    navRef.current = s
    setScreenRaw(s.screen)
    setBrowseArtifact(s.screen === 'artifact-detail' && s.artifactId != null ? findMockArtifactById(s.artifactId) : null)
    setSelectedPresident(s.presidentId != null ? findPresidentById(s.presidentId) : null)
    setRelatedArtifactsTag(s.relatedArtifactsTag || '')
    setArtifactDetailReturn(s.artifactDetailReturn)
    setRelatedArtifactsReturn(s.relatedArtifactsReturn || 'artifact-detail')
    setKgReturnScreen(s.kgReturnScreen || 'home')
    setBrowseReturnScreen(s.browseReturnScreen || 'home')
    try {
      sessionStorage.setItem('sl_screen', s.screen)
    } catch {
      /* ignore */
    }
  }, [])

  const setScreen = useCallback(
    (next, patch = {}) => {
      const merged = mergeSnapshot(navRef.current, next, patch)
      hydrateFromSnapshot(merged)
      if (!isPopstate.current) {
        window.history.pushState(navRef.current, '', null)
      }
      isPopstate.current = false
    },
    [hydrateFromSnapshot],
  )

  useLayoutEffect(() => {
    hydrateFromSnapshot(navRef.current)
    window.history.replaceState(navRef.current, '', null)
  }, [hydrateFromSnapshot])

  useEffect(() => {
    const handlePopState = (e) => {
      if (e.state?.onbPage !== undefined) return
      isPopstate.current = true
      hydrateFromSnapshot(e.state ?? { screen: 'home' })
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [hydrateFromSnapshot])

  const handleSplashDone = useCallback(() => {
    setShowApp(true)
    void preloadRdScanner()
    window.setTimeout(() => {
      setShowSplash(false)
    }, 520)
  }, [])

  /** Keep ONNX / WASM off the splash thread; start after first paint when splash is skipped. */
  useEffect(() => {
    if (showSplash) return undefined
    const id = window.requestIdleCallback
      ? window.requestIdleCallback(() => {
          void preloadRdScanner()
        })
      : window.setTimeout(() => {
          void preloadRdScanner()
        }, 0)
    return () => {
      if (window.requestIdleCallback) window.cancelIdleCallback(id)
      else window.clearTimeout(id)
    }
  }, [showSplash])

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
              setScreen('knowledge-graph', { kgReturnScreen: 'home' })
            }}
            onBrowse={() => {
              setBrowseListView('presidents')
              setScreen('browse', { browseReturnScreen: 'home' })
            }}
          />
        )

      case 'camera':
        return (
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-[#f2efd6]">Loading scanner…</div>}>
            <ARCamera
              onBrowse={() => {
                setScreen('browse', { browseReturnScreen: 'camera' })
              }}
              onHome={() => setScreen('home')}
              darkMode={darkMode}
            />
          </Suspense>
        )

      case 'browse':
        return (
          <BrowseMode
            onBack={() => setScreen(browseReturnScreen)}
            darkMode={darkMode}
            onOpenPresident={(president) => {
              setScreen('president-artifacts', { presidentId: president.id })
            }}
          />
        )

      case 'president-artifacts':
        return (
          <PresidentArtifacts
            president={selectedPresident}
            darkMode={darkMode}
            onBack={() => {
              setBrowseListView('presidents')
              setScreen('browse')
            }}
            onOpenArtifact={(artifact) => {
              setScreen('artifact-detail', {
                artifactId: artifact.id,
                artifactDetailReturn: 'president-artifacts',
                presidentId: selectedPresident?.id ?? undefined,
              })
            }}
          />
        )

      case 'artifact-detail':
        return (
          <ArtifactDetail
            artifact={browseArtifact}
            darkMode={darkMode}
            onBack={() => {
              if (artifactDetailReturn === 'president-artifacts') {
                setScreen('president-artifacts', { artifactId: null })
              } else if (artifactDetailReturn === 'related-artifacts') {
                setScreen('related-artifacts', {})
              } else {
                setBrowseListView('artifacts')
                setScreen('browse')
              }
            }}
            onRelatedTag={(tagLabel) => {
              setScreen('related-artifacts', {
                relatedArtifactsTag: tagLabel,
                relatedArtifactsReturn: 'artifact-detail',
              })
            }}
            onViewKnowledgeGraph={() => {
              setScreen('knowledge-graph', { kgReturnScreen: 'artifact-detail' })
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
              setScreen('artifact-detail', {
                artifactId: artifact.id,
                artifactDetailReturn: 'related-artifacts',
                presidentId: null,
              })
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
              setScreen('knowledge-graph', { kgReturnScreen: 'home' })
            }}
            onBrowse={() => {
              setBrowseListView('presidents')
              setScreen('browse', { browseReturnScreen: 'home' })
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
          {showApp ? renderAppScreen() : null}
        </div>
      </div>
    </div>
  )
}
