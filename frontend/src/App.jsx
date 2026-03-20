import { useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import Onboarding from './components/Onboarding'
import ARCamera from './components/ARCamera'
import BrowseMode from './components/BrowseMode'

export default function App() {
  const [screen, setScreen] = useState('onboarding')

  return (
    <div className="w-screen h-screen bg-gray-950 text-white overflow-hidden">
      {screen === 'onboarding' && (
        <Onboarding onFinish={() => setScreen('camera')} />
      )}
      {screen === 'camera' && (
        <ARCamera onBrowse={() => setScreen('browse')} />
      )}
      {screen === 'browse' && (
        <BrowseMode onBack={() => setScreen('camera')} />
      )}
      <Analytics />
    </div>
  )
}