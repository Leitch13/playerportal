// ════════════════════════════════════════════════════════════════════
// Product mockups — inline JSX components that mimic real product UI.
// Not screenshots (yet): stylised HTML/CSS representations of actual
// dashboards, styled with the same brand tokens (#0a0a0a bg, #4ecde6
// accent, Inter). These can be swapped for real screenshot images once
// captured. For now they hold the visual language and the page ships.
// ════════════════════════════════════════════════════════════════════

export function ParentHubMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] overflow-hidden shadow-2xl shadow-black/40">
      {/* Window chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5 bg-[#0a0a0a]">
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
        <div className="ml-4 text-[11px] text-white/40 font-mono">theplayerportal.net / dashboard</div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[#4ecde6] font-semibold">MEMBERSHIP</p>
            <p className="text-lg font-bold text-white mt-1">Soccer Tots Membership</p>
            <p className="text-xs text-white/50 mt-0.5">Renews 1 Aug · £42/mo</p>
          </div>
          <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-1 rounded-full">Active</span>
        </div>

        {/* Next class card */}
        <div className="rounded-xl border border-white/10 bg-[#141414] p-4">
          <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold mb-2">NEXT CLASS</p>
          <p className="text-sm font-semibold text-white">Mini Ballers · Saturday 9:00 AM</p>
          <p className="text-xs text-white/50 mt-0.5">Coach James · Millfield Pitches</p>
          <div className="mt-3 flex gap-2">
            <button className="text-[11px] px-3 py-1.5 rounded-full bg-[#4ecde6] text-black font-semibold">RSVP</button>
            <button className="text-[11px] px-3 py-1.5 rounded-full border border-white/15 text-white/70">Details</button>
          </div>
        </div>

        {/* Children row */}
        <div className="grid grid-cols-2 gap-3">
          <MiniPlayerCard name="Damon" initial="D" active />
          <MiniPlayerCard name="Add child" initial="+" muted />
        </div>
      </div>
    </div>
  )
}

function MiniPlayerCard({ name, initial, active, muted }: { name: string; initial: string; active?: boolean; muted?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 flex items-center gap-3 ${muted ? 'border-dashed border-white/10 bg-transparent' : 'border-white/10 bg-[#141414]'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${muted ? 'bg-white/5 text-white/30' : 'bg-[#4ecde6]/15 text-[#4ecde6]'}`}>
        {initial}
      </div>
      <div className="text-left flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${muted ? 'text-white/40' : 'text-white'}`}>{name}</p>
        {active && <p className="text-[10px] text-white/40">Age 4 · Mini Ballers</p>}
      </div>
    </div>
  )
}

// ─── Attendance mock ────────────────────────────────────────────────
export function AttendanceMock() {
  const players = [
    { name: 'Damon Walker', status: 'here' },
    { name: 'Enrique Moreno', status: 'here' },
    { name: 'Lochlan Wilson', status: 'here' },
    { name: 'Harry Watson', status: 'late' },
    { name: 'Lily Crawford', status: null },
  ]
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#4ecde6] font-semibold">SATURDAY 9AM</p>
          <p className="text-sm font-bold text-white mt-0.5">Mini Ballers · 12 players</p>
        </div>
        <span className="text-[10px] font-mono text-white/40">0:28</span>
      </div>
      <div className="space-y-1.5">
        {players.map((p) => (
          <div key={p.name} className="flex items-center gap-2 rounded-lg bg-[#141414] border border-white/5 px-3 py-2">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/60">
              {p.name.split(' ').map(n => n[0]).join('')}
            </div>
            <p className="text-xs text-white flex-1">{p.name}</p>
            {p.status === 'here' && (
              <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">Here</span>
            )}
            {p.status === 'late' && (
              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/25 px-2 py-0.5 rounded-full">Late</span>
            )}
            {!p.status && <span className="text-[10px] text-white/30">Tap to mark</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Payments mock ──────────────────────────────────────────────────
export function PaymentsMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-semibold">COLLECTED TODAY</p>
        <p className="text-[10px] text-emerald-400 font-semibold">+£1,311</p>
      </div>
      <p className="text-4xl font-black text-white mt-1 tracking-tight tabular-nums">£1,311<span className="text-white/30 font-normal">.75</span></p>
      <div className="mt-4 h-16 flex items-end gap-1">
        {[45, 60, 30, 80, 55, 70, 90, 40, 65, 75, 85, 95].map((h, i) => (
          <div key={i} className="flex-1 rounded-t bg-[#4ecde6]" style={{ height: `${h}%`, opacity: h / 100 }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Paid</p>
          <p className="text-sm font-bold text-white tabular-nums">45</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Failed</p>
          <p className="text-sm font-bold text-amber-300 tabular-nums">5</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Pending</p>
          <p className="text-sm font-bold text-white/70 tabular-nums">2</p>
        </div>
      </div>
    </div>
  )
}

// ─── Migration wizard mock ──────────────────────────────────────────
export function MigrationMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#4ecde6] font-semibold">STEP 3 OF 4 · REVIEW</p>
        <p className="text-lg font-bold text-white mt-1">Ready to import</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <MigStat label="Parents" value="48" />
        <MigStat label="Confirmed" value="47" accent />
        <MigStat label="Recurring / mo" value="£3.7k" />
      </div>
      <div className="space-y-1.5">
        {['Colleen O\'Neil', 'Jenna Bruce', 'Lauren Wisely', 'Ritchie Hutchison'].map((n) => (
          <div key={n} className="flex items-center gap-2 rounded-lg bg-[#141414] border border-white/5 px-3 py-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <p className="text-xs text-white flex-1">{n}</p>
            <span className="text-[10px] text-white/40">Soccer Tots · £42</span>
          </div>
        ))}
      </div>
      <button className="w-full rounded-full bg-[#4ecde6] text-black text-sm font-semibold py-2.5">
        Send invitations →
      </button>
    </div>
  )
}
function MigStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-[#4ecde6]/30 bg-[#4ecde6]/5' : 'border-white/10 bg-[#141414]'}`}>
      <p className="text-[10px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`text-xl font-black tabular-nums mt-0.5 ${accent ? 'text-[#4ecde6]' : 'text-white'}`}>{value}</p>
    </div>
  )
}

// ─── Camps mock ─────────────────────────────────────────────────────
export function CampsMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#4ecde6] font-semibold">SUMMER CAMP · GLENROTHES</p>
        <p className="text-sm font-bold text-white mt-1">Week 1 · 21–25 July</p>
      </div>
      <div className="rounded-xl bg-[#141414] border border-white/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-white/70">Capacity</p>
          <p className="text-xs font-bold text-white tabular-nums">44 / 50</p>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div className="h-full rounded-full bg-[#4ecde6]" style={{ width: '88%' }} />
        </div>
        <p className="text-[10px] text-white/40 mt-2">6 spots left</p>
      </div>
      <div className="text-xs text-white/60">
        <p className="font-semibold text-white">£2,200 collected this week</p>
        <p className="text-white/40 mt-0.5">Auto-billing · zero chase</p>
      </div>
    </div>
  )
}

// ─── Messaging mock ─────────────────────────────────────────────────
export function MessagesMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 space-y-3">
      <p className="text-[10px] uppercase tracking-widest text-[#4ecde6] font-semibold">TODAY · 3 MESSAGES</p>
      <div className="space-y-2">
        {[
          { from: 'Jamie (Coach)', msg: 'Great session yesterday — Damon really stepped up.', time: '2h' },
          { from: 'Rachael', msg: 'Lily won\'t make Saturday — dentist appointment.', time: '5h' },
          { from: 'Academy', msg: 'Summer camp registration opens Monday.', time: 'Yesterday' },
        ].map((m) => (
          <div key={m.from} className="rounded-xl bg-[#141414] border border-white/5 p-3">
            <div className="flex justify-between items-baseline mb-1">
              <p className="text-xs font-semibold text-white">{m.from}</p>
              <p className="text-[10px] text-white/40">{m.time}</p>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">{m.msg}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Reports mock ───────────────────────────────────────────────────
export function ReportsMock() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f0f0f] p-5 space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-[#4ecde6] font-semibold">MRR · LAST 6 MONTHS</p>
        <div className="flex items-baseline gap-3 mt-1">
          <p className="text-3xl font-black text-white tabular-nums">£4,412</p>
          <p className="text-xs font-semibold text-emerald-400">+18%</p>
        </div>
      </div>
      <div className="h-20 relative">
        <svg className="w-full h-full" viewBox="0 0 200 60" preserveAspectRatio="none">
          <defs>
            <linearGradient id="mrrGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4ecde6" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#4ecde6" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 0 45 L 33 40 L 66 42 L 100 30 L 133 22 L 166 15 L 200 10 L 200 60 L 0 60 Z" fill="url(#mrrGrad)" />
          <path d="M 0 45 L 33 40 L 66 42 L 100 30 L 133 22 L 166 15 L 200 10" fill="none" stroke="#4ecde6" strokeWidth="1.5" />
        </svg>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div><p className="text-[10px] text-white/40 uppercase">Active</p><p className="text-sm font-bold text-white tabular-nums">104</p></div>
        <div><p className="text-[10px] text-white/40 uppercase">Trial</p><p className="text-sm font-bold text-white tabular-nums">12</p></div>
        <div><p className="text-[10px] text-white/40 uppercase">Churn</p><p className="text-sm font-bold text-white tabular-nums">1.4%</p></div>
      </div>
    </div>
  )
}
