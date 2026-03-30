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

  const handleOpenInfo = useCallback(() => {
    if (!artifact) return
    setMode('INFO_OPEN')
  }, [artifact])

  const handleCloseInfo = useCallback(() => {
    setMode('VIEWING_3D')
  }, [])

  const handleExit = useCallback(() => {
    if (mode === 'INFO_OPEN') {
      handleCloseInfo()
      return
    }
    setArtifact(null)
    setMode('SCANNING')
  }, [handleCloseInfo, mode])

  const show3D = mode === 'VIEWING_3D' || mode === 'INFO_OPEN'
  const showInfo = mode === 'INFO_OPEN'

  return (
    <div className="fixed inset-0 z-50 bg-transparent">
      {/* Live camera feed (always visible for AR feel). */}
      <div className="absolute inset-0 z-0">
        <ARCamera onDetection={handleDetection} showControls={mode === 'SCANNING'} />
      </div>

      {show3D && (
        <div className="absolute inset-0 z-20">
          <ModelViewer
            artifactLabel={artifact?.label ?? 'Artifact'}
            dimmed={showInfo}
            onTap={showInfo ? handleCloseInfo : handleOpenInfo}
          />
        </div>
      )}

      {showInfo && (
        <>
          {/* Tap anywhere outside the info sheet to close. */}
          <div className="absolute inset-0 z-40 bg-transparent" onClick={handleCloseInfo} />
          <InfoSheet artifact={artifact} onClose={handleCloseInfo} />
        </>
      )}

      {(show3D || showInfo) && <ExitButton onExit={handleExit} />}
    </div>
  )
}

