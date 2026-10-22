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
import { languageToCode, loadStoredLanguage, persistLanguage, t } from './i18n'
import { getCatalogArtifactByIdCode, isBackendConfigured, listCatalogPresidents } from './lib/archiveApi'

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
  const bootSnap = emptySnapshot(bootScreen)
  if (initialIdCode) bootSnap.idCode = String(initialIdCode)
  if (initialPresidentId != null && initialPresidentId !== '') {
    const pid = Number(initialPresidentId)
    if (!Number.isNaN(pid)) bootSnap.presidentId = pid
  }
  const navRef = useRef(bootSnap)
  const artifactCacheRef = useRef(new Map())
  const presidentCacheRef = useRef(new Map())

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

  const [selectedPresident, setSelectedPresident] = useState(null)
  const [presidentPending, setPresidentPending] = useState(
    () => initialPresidentId != null && initialPresidentId !== '',
  )
  const [artifactPending, setArtifactPending] = useState(() => Boolean(initialIdCode))

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
    if (s.screen === 'artifact-detail') {
      const cached = s.artifactId != null ? artifactCacheRef.current.get(Number(s.artifactId)) : null
      if (cached) {
        setBrowseArtifact(cached)
        setArtifactPending(false)
      } else if (s.idCode && isBackendConfigured()) {
        const code = s.idCode
        setBrowseArtifact(null)
        setArtifactPending(true)
        getCatalogArtifactByIdCode(code)
          .then((row) => {
            if (!row || navRef.current.screen !== 'artifact-detail' || navRef.current.idCode !== code) return
            if (row.id != null) artifactCacheRef.current.set(Number(row.id), row)
            setBrowseArtifact(row)
            setArtifactPending(false)
          })
          .catch(() => {
            if (navRef.current.screen === 'artifact-detail' && navRef.current.idCode === code) {
              setArtifactPending(false)
            }
          })
      } else {
        setBrowseArtifact(null)
        setArtifactPending(false)
      }
    } else {
      setArtifactPending(false)
    }
    if (s.screen === 'president-artifacts' && s.presidentId != null) {
      const pid = Number(s.presidentId)
      const cached = presidentCacheRef.current.get(pid)
      if (cached) {
        setSelectedPresident(cached)
        setPresidentPending(false)
      } else if (isBackendConfigured()) {
        setSelectedPresident(null)
        setPresidentPending(true)
        listCatalogPresidents()
          .then((rows) => {
            if (navRef.current.screen !== 'president-artifacts' || Number(navRef.current.presidentId) !== pid) return
            const match = Array.isArray(rows) ? rows.find((p) => Number(p.id) === pid) : null
            if (match) {
              presidentCacheRef.current.set(pid, match)
              setSelectedPresident(match)
            } else {
              setSelectedPresident(null)
            }
            setPresidentPending(false)
          })
          .catch(() => {
            if (navRef.current.screen === 'president-artifacts' && Number(navRef.current.presidentId) === pid) {
              setPresidentPending(false)
            }
          })
      } else {
        setSelectedPresident(null)
        setPresidentPending(false)
      }
    } else if (s.screen !== 'artifact-detail' && s.screen !== 'related-artifacts' && s.screen !== 'knowledge-graph') {
      setPresidentPending(false)
    }
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
              if (president?.id != null) presidentCacheRef.current.set(Number(president.id), president)
              setScreen('president-artifacts', { presidentId: president.id })
            }}
          />
        )

      case 'president-artifacts':
        return (
          <PresidentArtifacts
            language={language}
            president={selectedPresident}
            pending={presidentPending}
            darkMode={darkMode}
            onBack={() => {
              setBrowseListView('presidents')
              setScreen('browse')
            }}
            onOpenArtifact={(artifact) => {
              if (artifact?.id != null) artifactCacheRef.current.set(Number(artifact.id), artifact)
              setScreen('artifact-detail', {
                artifactId: artifact.id,
                idCode: artifact.idCode || artifact.rdCode || '',
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
            pending={artifactPending}
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
              if (artifact?.id != null) artifactCacheRef.current.set(Number(artifact.id), artifact)
              setScreen('artifact-detail', {
                artifactId: artifact.id,
                idCode: artifact.idCode || artifact.rdCode || '',
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
