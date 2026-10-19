'use client'

/**
 * App.jsx — client shell for Sulyap Lasalyano (Next.js App Router).
 *
 * Flow: splash → in-app screens. Deep links set `initialScreen` from route pages.
 * Browser history uses rich `history.state` so Back/Forward restores context.
 */

import { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

import Onboarding from './screens/Onboarding'
import HomePage from './screens/HomePage'
import KnowledgeGraphPage from './screens/KnowledgeGraphPage'

import ArtifactDetail from './screens/ArtifactDetail'

import BrowseMode from './screens/BrowseMode'

import PresidentArtifacts from './screens/PresidentArtifacts'

import RelatedArtifacts from './screens/RelatedArtifacts'
import CuratorDesk from './screens/CuratorDesk'

import SplashScreen from './screens/SplashScreen'
import { preloadRdScanner } from './lib/rdClassifier'
import { emptySnapshot, mergeSnapshot, sanitizeSnapshot } from './lib/navigationHistory'
import { findMockArtifactById, getAllMockArtifacts } from './data/artifactBrowseMocks'
import { findPresidentById } from './data/presidentBrowseMocks'
import { languageToCode, loadStoredLanguage, persistLanguage, t } from './i18n'
import { getCatalogArtifactByIdCode, isBackendConfigured } from './lib/archiveApi'

const darkModeLogo = '/logo/LOGO_Dark-Mode.png'
const lightModeLogo = '/logo/LOGO_Light-Mode.png'
const DARK_MODE_KEY = 'sl_darkMode'

function loadStoredDarkMode() {
  try {
    const raw = localStorage.getItem(DARK_MODE_KEY)
    if (raw === null) return true
    return raw !== 'false'
  } catch {
    return true
  }
}

function persistDarkMode(value) {
  try {
    localStorage.setItem(DARK_MODE_KEY, value ? 'true' : 'false')
  } catch {
    // ignore quota / private mode
  }
}

const ARCamera = lazy(() => import('./screens/ARCamera'))

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

export default function App({
  initialScreen: routeScreen,
  initialPresidentId = null,
  initialIdCode = null,
  initialRelatedTag = '',
} = {}) {
  const bootScreen = routeScreen || resolveBootScreen()

  /** Last pushed / popped navigation snapshot (aligned with `history.state`). */
  const navRef = useRef(emptySnapshot(bootScreen))

  const [screen, setScreenRaw] = useState(bootScreen)
  const isPageRefresh = !routeScreen && screen === 'home'

  const [showSplash, setShowSplash] = useState(isPageRefresh)
  const [showApp, setShowApp] = useState(!isPageRefresh)
  // SSR + first client paint must match; restore persisted language after mount.
  const [language, setLanguageState] = useState('English')
  const setLanguage = useCallback((next) => {
    setLanguageState(next)
    persistLanguage(next)
  }, [])
  // SSR + first paint default dark; restore preference after mount.
  const [darkMode, setDarkModeState] = useState(true)
  const toggleDarkMode = useCallback(() => {
    setDarkModeState((prev) => {
      const next = !prev
      persistDarkMode(next)
      return next
    })
  }, [])

  useEffect(() => {
    const stored = loadStoredLanguage()
    if (stored && stored !== 'English') setLanguageState(stored)
    setDarkModeState(loadStoredDarkMode())
  }, [])

  useEffect(() => {
    document.documentElement.lang = languageToCode(language)
  }, [language])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    const logo = darkMode ? darkModeLogo : lightModeLogo
    document.querySelectorAll("link[rel='icon'], link[rel='apple-touch-icon']").forEach((link) => {
      link.setAttribute('href', logo)
      if (link.getAttribute('rel') === 'icon') {
        link.setAttribute('type', 'image/png')
      }
    })
  }, [darkMode])

  const [browseArtifact, setBrowseArtifact] = useState(null)

  /** Persists across artifact detail so Back returns to the same browse tab (detail always restores "All Artifacts"). */

  const [browseListView, setBrowseListView] = useState('presidents')

  /** President row from browse (mock) — used by `president-artifacts` screen. */

  const [selectedPresident, setSelectedPresident] = useState(() =>
    initialPresidentId != null ? findPresidentById(initialPresidentId) : null,
  )

  /** Where artifact detail was opened from — controls Back from `ArtifactDetail`. */

  const [artifactDetailReturn, setArtifactDetailReturn] = useState(null)

  /** Where browse was opened from — controls Back from `BrowseMode`. */
  const [browseReturnScreen, setBrowseReturnScreen] = useState('home')

  /** Selected tag for `RelatedArtifacts` (opened from artifact detail tags). */
  const [relatedArtifactsTag, setRelatedArtifactsTag] = useState(initialRelatedTag || '')

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
        return (
          <Onboarding
            language={language}
            onFinish={() => setScreen('camera')}
            onBack={() => setScreen('home')}
            darkMode={darkMode}
          />
        )

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
            onOpenCurator={() => setScreen('curator')}
          />
        )

      case 'curator':
        /* Back navigates to static sulyap-lasalyano home (see goToStaticHome in CuratorDesk). */
        return <CuratorDesk language={language} />

      case 'camera':
        return (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center font-body text-sm text-[var(--aca-muted-fg)]">
                {t(language, 'app.loadingScanner')}
              </div>
            }
          >
            <ARCamera
              language={language}
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
            language={language}
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
            language={language}
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
            language={language}
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
            language={language}
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
            onOpenCurator={() => setScreen('curator')}
          />
        )
    }
  }

  return (
    <div className={`relative w-screen min-h-[100dvh] h-[100dvh] overflow-hidden bg-[var(--aca-bg)] text-[var(--aca-fg)]${darkMode ? ' app-dark' : ' app-light'}`}>
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
