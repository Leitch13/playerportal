'use client'

interface Plan {
  id: string
  title: string
  session_date: string | null
  duration_minutes: number
  objectives: string | null
  warm_up: string | null
  main_activity: string | null
  cool_down: string | null
  equipment: string | null
  notes: string | null
  status: string
  diagram_url?: string | null
  pdf_url?: string | null
  group?: { name: string } | null
}

interface Drill {
  id: string
  name: string
  category: string | null
  description: string | null
  duration_minutes: number
  difficulty: string
}

const categoryLabels: Record<string, string> = {
  warm_up: 'Warm Up',
  technical: 'Technical',
  tactical: 'Tactical',
  physical: 'Physical',
  game: 'Game',
  cool_down: 'Cool Down',
}

const categoryColors: Record<string, string> = {
  warm_up: 'bg-orange-500/20 text-orange-400',
  technical: 'bg-[#4ecde6]/20 text-[#4ecde6]',
  tactical: 'bg-purple-500/20 text-purple-400',
  physical: 'bg-rose-500/20 text-rose-400',
  game: 'bg-emerald-500/20 text-emerald-400',
  cool_down: 'bg-blue-500/20 text-blue-400',
}

export default function SessionPlanView({ plan, orgName, orgLogo, suggestedDrills = [] }: { plan: Plan; orgName: string; orgLogo: string; suggestedDrills?: Drill[] }) {
  const groupName = (plan.group as { name: string } | null)?.name || 'No class assigned'
  const dateStr = plan.session_date
    ? new Date(plan.session_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'No date set'

  function handlePrint() {
    window.print()
  }

  async function handleShare() {
    const text = `Session Plan: ${plan.title}\n${dateStr}\n${groupName}\n\nObjectives: ${plan.objectives || 'None'}\n\nWarm Up:\n${plan.warm_up || '-'}\n\nMain Activity:\n${plan.main_activity || '-'}\n\nCool Down:\n${plan.cool_down || '-'}\n\nEquipment: ${plan.equipment || 'None'}\n\nNotes: ${plan.notes || 'None'}`

    if (navigator.share) {
      try {
        await navigator.share({ title: plan.title, text })
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      alert('Session plan copied to clipboard!')
    }
  }

  return (
    <>
      {/* Action buttons - hidden when printing */}
      <div className="no-print flex flex-wrap gap-3 mb-6">
        <button onClick={handlePrint} className="px-5 py-2.5 bg-[#4ecde6] text-[#0a0a0a] rounded-xl text-sm font-semibold hover:bg-[#6dd8ee] transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5z" /></svg>
          Print / Save PDF
        </button>
        <button onClick={handleShare} className="px-5 py-2.5 bg-white/[0.06] text-white rounded-xl text-sm font-semibold hover:bg-white/[0.1] transition-colors flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" /></svg>
          Share
        </button>
        {plan.pdf_url && (
          <a href={plan.pdf_url} target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-white/[0.06] text-white rounded-xl text-sm font-semibold hover:bg-white/[0.1] transition-colors flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Download PDF
          </a>
        )}
      </div>

      {/* Printable session plan card */}
      <div className="bg-[#141414] border border-[#1e1e1e] rounded-2xl overflow-hidden print:bg-white print:text-black print:border-gray-200 max-w-3xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#4ecde6]/20 to-transparent p-6 border-b border-[#1e1e1e] print:bg-gray-50 print:border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              {orgLogo && <img src={orgLogo} alt="" className="h-8 mb-2 print:h-10" />}
              <h1 className="text-2xl font-bold text-white print:text-black">{plan.title}</h1>
              <div className="flex flex-wrap gap-3 mt-2 text-sm text-white/60 print:text-gray-600">
                <span>{dateStr}</span>
                <span>•</span>
                <span>{groupName}</span>
                <span>•</span>
                <span>{plan.duration_minutes} mins</span>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase no-print ${
              plan.status === 'ready' ? 'bg-[#4ecde6]/20 text-[#4ecde6]' :
              plan.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
              'bg-white/10 text-white/50'
            }`}>
              {plan.status}
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Objectives */}
          {plan.objectives && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#4ecde6] mb-2 print:text-blue-600">Objectives</h2>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line print:text-gray-800">{plan.objectives}</p>
            </div>
          )}

          {/* Session phases */}
          <div className="grid grid-cols-1 gap-4">
            {plan.warm_up && (
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 print:bg-amber-50 print:border-amber-200">
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-2 print:text-amber-700">
                  <span className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] print:bg-amber-100">1</span>
                  Warm Up
                </h2>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line print:text-gray-800">{plan.warm_up}</p>
              </div>
            )}

            {plan.main_activity && (
              <div className="bg-[#4ecde6]/5 border border-[#4ecde6]/10 rounded-xl p-4 print:bg-blue-50 print:border-blue-200">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#4ecde6] mb-2 flex items-center gap-2 print:text-blue-700">
                  <span className="w-6 h-6 rounded-full bg-[#4ecde6]/20 flex items-center justify-center text-[10px] print:bg-blue-100">2</span>
                  Main Activity
                </h2>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line print:text-gray-800">{plan.main_activity}</p>
              </div>
            )}

            {plan.cool_down && (
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 print:bg-green-50 print:border-green-200">
                <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center gap-2 print:text-green-700">
                  <span className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] print:bg-green-100">3</span>
                  Cool Down
                </h2>
                <p className="text-white/80 text-sm leading-relaxed whitespace-pre-line print:text-gray-800">{plan.cool_down}</p>
              </div>
            )}
          </div>

          {/* Equipment */}
          {plan.equipment && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 print:text-gray-500">Equipment Needed</h2>
              <p className="text-white/60 text-sm print:text-gray-600">{plan.equipment}</p>
            </div>
          )}

          {/* Diagram */}
          {plan.diagram_url && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 print:text-gray-500">Pitch Diagram</h2>
              <img src={plan.diagram_url} alt="Pitch diagram" className="max-w-full rounded-xl border border-[#1e1e1e] print:border-gray-200" />
            </div>
          )}

          {/* Notes */}
          {plan.notes && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-2 print:text-gray-500">Coach Notes</h2>
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line print:text-gray-600">{plan.notes}</p>
            </div>
          )}

          {/* Suggested Drills */}
          {suggestedDrills.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#4ecde6] mb-3 print:text-blue-600">Suggested Drills</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestedDrills.map((drill) => (
                  <div key={drill.id} className="bg-white/[0.03] border border-[#1e1e1e] rounded-lg p-3 print:bg-gray-50 print:border-gray-200">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-white print:text-black">{drill.name}</span>
                      {drill.category && (
                        <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full font-medium ${categoryColors[drill.category] || 'bg-white/10 text-white/50'}`}>
                          {categoryLabels[drill.category] || drill.category}
                        </span>
                      )}
                    </div>
                    {drill.description && (
                      <p className="text-xs text-white/40 line-clamp-2 print:text-gray-500">{drill.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-white/30 print:text-gray-400">
                      <span>{drill.duration_minutes} min</span>
                      <span className="capitalize">{drill.difficulty}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#1e1e1e] text-xs text-white/30 print:border-gray-200 print:text-gray-400">
          {orgName} • Session Plan • Generated by Player Portal
        </div>
      </div>
    </>
  )
}
