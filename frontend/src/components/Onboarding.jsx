import { useState } from 'react'

const slides = [
  {
    title: 'Welcome to ARchive',
    body: 'Discover the history behind each artifact in the AEA-IRC Presidents\' Memorabilia Gallery.',
    icon: '🏛️',
  },
  {
    title: 'Point your camera',
    body: 'Aim your camera at any artifact in the gallery. ARchive will recognize it automatically.',
    icon: '📷',
  },
  {
    title: 'Tap to learn more',
    body: 'When an artifact is detected, an info panel appears. Tap it to explore its full history.',
    icon: '✨',
  },
]

export default function Onboarding({ onFinish }) {
  const [current, setCurrent] = useState(0)

  const next = () => {
    if (current < slides.length - 1) setCurrent(current + 1)
    else onFinish()
  }

  const slide = slides[current]

  return (
    <div className="flex flex-col items-center justify-between h-full px-8 py-16">

      {/* Top — logo */}
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight">AR<span className="text-teal-400">chive</span></div>
        <div className="text-xs text-gray-500 mt-1">DLSU-D · AEA-IRC Gallery</div>
      </div>

      {/* Middle — slide content */}
      <div className="flex flex-col items-center gap-6 text-center max-w-xs">
        <div className="text-7xl">{slide.icon}</div>
        <h2 className="text-2xl font-semibold">{slide.title}</h2>
        <p className="text-gray-400 text-sm leading-relaxed">{slide.body}</p>
      </div>

      {/* Dots */}
      <div className="flex flex-col items-center gap-6 w-full">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-teal-400' : 'w-2 bg-gray-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={next}
          className="w-full bg-teal-500 hover:bg-teal-400 text-white font-semibold py-4 rounded-2xl transition-colors"
        >
          {current < slides.length - 1 ? 'Next' : 'Get Started'}
        </button>

        <button
          onClick={onFinish}
          className="text-gray-500 text-sm"
        >
          Skip
        </button>
      </div>

    </div>
  )
}