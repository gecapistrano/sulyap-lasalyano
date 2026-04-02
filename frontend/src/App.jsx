/**

 * App.jsx — root React shell for ARchive.

 *

 * Flow: splash (brand intro) → in-app navigation between onboarding, live camera, and browse list.

 * State is intentionally simple (no router yet): `phase` gates splash vs app; `screen` picks the active full-page view.

 */

import { useCallback, useMemo, useState } from 'react'

import Onboarding from './pages/Onboarding'

import ARCamera from './pages/ARCamera'

import ArtifactDetail from './pages/ArtifactDetail'

import BrowseMode from './pages/BrowseMode'

import PresidentArtifacts from './pages/PresidentArtifacts'

import SplashScreen from './pages/SplashScreen'
import GestureDemo from './features/gesture-demo/GestureDemo'
import { buildKnowledgeGraphGestureSlots } from './features/gesture-demo/gestureArtifactAdapter'



export default function App() {
  if (window.location.pathname === '/gesture-demo') {
    return <GestureDemo />
  }

  const [phase, setPhase] = useState('splash')

  const [screen, setScreen] = useState('onboarding')

  const [browseArtifact, setBrowseArtifact] = useState(null)

  /** Persists across artifact detail so Back returns to the same browse tab (detail always restores "All Artifacts"). */

  const [browseListView, setBrowseListView] = useState('presidents')

  /** President row from browse (mock) — used by `president-artifacts` screen. */

  const [selectedPresident, setSelectedPresident] = useState(null)

  /** Where artifact detail was opened from — controls Back from `ArtifactDetail`. */

  const [artifactDetailReturn, setArtifactDetailReturn] = useState(null)

  /** Four model variations per opened list item; stable reference while `browseArtifact` is unchanged. */
  const knowledgeGraphGestureArtifacts = useMemo(
    () => (browseArtifact ? buildKnowledgeGraphGestureSlots(browseArtifact) : undefined),
    [browseArtifact],
  )

  const handleSplashDone = useCallback(() => {

    setPhase('app')

  }, [])



  const renderAppScreen = () => {

    switch (screen) {

      case 'onboarding':

        return <Onboarding onFinish={() => setScreen('camera')} />

      case 'camera':

        return <ARCamera onBrowse={() => setScreen('browse')} />

      case 'browse':

        return (

          <BrowseMode

            listView={browseListView}

            onListViewChange={setBrowseListView}

            onBack={() => setScreen('camera')}

            onOpenPresident={(president) => {

              setSelectedPresident(president)

              setScreen('president-artifacts')

            }}

            onOpenArtifact={(artifact) => {

              setArtifactDetailReturn('browse')

              setBrowseListView('artifacts')

              setBrowseArtifact(artifact)

              setScreen('artifact-detail')

            }}

          />

        )

      case 'president-artifacts':

        return (

          <PresidentArtifacts

            president={selectedPresident}

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

            onBack={() => {

              setBrowseArtifact(null)

              if (artifactDetailReturn === 'president-artifacts') {

                setScreen('president-artifacts')

              } else {

                setBrowseListView('artifacts')

                setScreen('browse')

              }

              setArtifactDetailReturn(null)

            }}

            onViewKnowledgeGraph={() => {

              setScreen('artifact-gesture')

            }}

          />

        )

      case 'artifact-gesture':

        return (

          <GestureDemo

            artifacts={knowledgeGraphGestureArtifacts}

            onExit={() => setScreen('artifact-detail')}

            exitLabel="← Back to artifact"

          />

        )

      default:

        return null

    }

  }



  return (

    <div className="relative w-screen min-h-[100dvh] h-[100dvh] overflow-hidden bg-[#0a1508] text-white">

      <div className="relative z-10 h-full w-full">

        {phase === 'splash' ? (

          <SplashScreen onComplete={handleSplashDone} />

        ) : (

          renderAppScreen()

        )}

      </div>

    </div>

  )

}


