import { useCallback, useState } from 'react'
import ARCamera from '../components/ar/ARCamera'
import ExitButton from '../components/ar/ExitButton'
import InfoSheet from '../components/ar/InfoSheet'
import ModelViewer from '../components/ar/ModelViewer'

/**
 * ARExperience — 3-state AR flow controlled by a simple mode state machine.
 *
 * Modes:
 * - SCANNING
 * - VIEWING_3D
 * - INFO_OPEN
 */
export default function ARExperience() {
  const [mode, setMode] = useState('SCANNING') // 'SCANNING' | 'VIEWING_3D' | 'INFO_OPEN'
  const [artifact, setArtifact] = useState(null)

  const handleDetection = useCallback((nextArtifact) => {
    setArtifact(nextArtifact)
    setMode('VIEWING_3D')
  }, [])

  const handleTapModel = useCallback(() => {
    if (!artifact) return
    setMode('INFO_OPEN')
  }, [artifact])

  const handleExit = useCallback(() => {
    setArtifact(null)
    setMode('SCANNING')
  }, [])

  const show3D = mode === 'VIEWING_3D' || mode === 'INFO_OPEN'
  const showInfo = mode === 'INFO_OPEN'

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* SCANNING camera is always mounted to keep it alive; we only hide/show via opacity + pointer-events. */}
      <div className={mode === 'SCANNING' ? 'opacity-100 pointer-events-auto transition-opacity' : 'opacity-0 pointer-events-none transition-opacity'}>
        <ARCamera onDetection={handleDetection} />
      </div>

      {show3D && (
        <ModelViewer
          artifactLabel={artifact?.label ?? 'Artifact'}
          artifact={artifact}
          dimmed={showInfo}
          onTap={handleTapModel}
        />
      )}

      {showInfo && <InfoSheet artifact={artifact} />}

      {(show3D || showInfo) && <ExitButton onExit={handleExit} />}
    </div>
  )
}

