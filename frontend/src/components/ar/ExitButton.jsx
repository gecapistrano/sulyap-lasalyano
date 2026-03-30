/**
 * ExitButton — fixed "X" close button for exiting AR 3D / info states.
 *
 * Props:
 * - onExit(): called when the user clicks/taps the button
 */
export default function ExitButton({ onExit }) {
  return (
    <button
      type="button"
      onClick={onExit}
      className="fixed top-6 right-6 z-50 w-11 h-11 flex items-center justify-center bg-black/70 backdrop-blur-sm border border-white/20 rounded-full text-white
        active:scale-90 transition-transform"
      aria-label="Exit"
    >
      ✕
    </button>
  )
}

