const mockArtifacts = [
    { id: 1, name: 'Founding Plaque', president: 'Br. Andrew Gonzalez FSC', year: '1975', class: 'plaque_founding' },
    { id: 2, name: 'Excellence Trophy', president: 'Br. Rolando Dizon FSC', year: '1988', class: 'trophy_excellence' },
    { id: 3, name: 'Presidential Portrait', president: 'Br. Narciso Erguiza FSC', year: '1995', class: 'portrait_erguiza' },
    { id: 4, name: 'Accreditation Medallion', president: 'Dr. Carmelita Quebengco', year: '2003', class: 'medallion_accred' },
    { id: 5, name: 'Charter Document', president: 'Dr. Augusto Lagrama', year: '2010', class: 'document_charter' },
  ]
  
  export default function BrowseMode({ onBack }) {
    return (
      <div className="flex flex-col h-full bg-gray-950">
  
        {/* Header */}
        <div className="flex items-center gap-4 px-6 pt-12 pb-4">
          <button onClick={onBack} className="text-teal-400 text-sm">← Back</button>
          <h1 className="text-lg font-semibold">All Artifacts</h1>
        </div>
  
        {/* Search bar */}
        <div className="px-6 mb-4">
          <input
            type="text"
            placeholder="Search artifacts..."
            className="w-full bg-gray-800 text-white placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none border border-gray-700 focus:border-teal-500 transition-colors"
          />
        </div>
  
        {/* List */}
        <div className="flex-1 overflow-y-auto px-6 pb-8 flex flex-col gap-3">
          {mockArtifacts.map(artifact => (
            <div
              key={artifact.id}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-4 flex items-center gap-4"
            >
              {/* Color tile placeholder for photo */}
              <div className="w-14 h-14 rounded-xl bg-teal-900/50 border border-teal-800/50 flex items-center justify-center flex-shrink-0">
                <span className="text-teal-400 text-xl">🏺</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">{artifact.name}</div>
                <div className="text-gray-400 text-xs mt-0.5 truncate">{artifact.president}</div>
                <div className="text-gray-600 text-xs mt-0.5">{artifact.year}</div>
              </div>
              <div className="text-gray-600 text-lg">›</div>
            </div>
          ))}
        </div>
  
      </div>
    )
  }