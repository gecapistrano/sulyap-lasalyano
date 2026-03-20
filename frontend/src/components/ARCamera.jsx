export default function ARCamera({ onBrowse }) {
    return (
      <div className="relative w-full h-full bg-black flex flex-col">
  
        {/* Mock camera view */}
        <div className="flex-1 relative flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 to-transparent z-10" />
  
          {/* Scanning frame */}
          <div className="relative z-20 w-64 h-64">
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-teal-400 rounded-tl-lg" />
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-teal-400 rounded-tr-lg" />
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-teal-400 rounded-bl-lg" />
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-teal-400 rounded-br-lg" />
            <p className="absolute -bottom-8 left-0 right-0 text-center text-teal-400 text-xs">
              Point at an artifact
            </p>
          </div>
        </div>
  
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-6 pt-10 pb-4">
          <div className="text-lg font-bold">AR<span className="text-teal-400">chive</span></div>
          <button
            onClick={onBrowse}
            className="bg-white/10 backdrop-blur-sm text-white text-xs px-4 py-2 rounded-full border border-white/20"
          >
            Browse All
          </button>
        </div>
  
        {/* Bottom hint */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-6 pb-10">
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 text-center">
            <p className="text-white/60 text-xs">No artifact detected yet</p>
            <p className="text-white/40 text-xs mt-1">Move closer or improve lighting</p>
          </div>
        </div>
  
      </div>
    )
  }