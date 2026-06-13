import CancelBookingButton from '@/app/dashboard/schedule/CancelBookingButton'
import { relativeLabel, type ScheduleSlot } from '@/lib/schedule-v2'

// Parent Schedule 2.0 — Phase 1A "top" (child-first). Pure presentational
// (server component). Three stacked sections: Next Session hero, This Week,
// My Schedule. Built entirely from already-loaded enrolment/group data; the
// per-session manage action reuses the existing CancelBookingButton unchanged.

type Slot = ScheduleSlot & { whenMs?: number }

function MetaRow({ slot, brand }: { slot: Slot; brand: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/55">
      {slot.dayOfWeek && <span className="font-semibold text-white/70">{slot.dayOfWeek}</span>}
      {slot.timeSlot && <span style={{ color: brand }} className="font-bold">{slot.timeSlot}</span>}
      {slot.location && (
        <span className="inline-flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="3" /></svg>
          {slot.location}
        </span>
      )}
      {slot.coachName && (
        <span className="inline-flex items-center gap-1 min-w-0 max-w-[160px]">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /></svg>
          <span className="truncate">{slot.coachName}</span>
        </span>
      )}
    </div>
  )
}

export default function ScheduleTopV2({
  hero, thisWeek, mySchedule, brandColor, parentFirstName, nowMs,
  retentionEnabled, retentionPercent, retentionMonths,
}: {
  hero: (ScheduleSlot & { whenMs: number }) | null
  thisWeek: (ScheduleSlot & { whenMs: number })[]
  mySchedule: ScheduleSlot[]
  brandColor: string
  parentFirstName: string
  nowMs: number
  retentionEnabled: boolean
  retentionPercent: number
  retentionMonths: number | null
}) {
  // Empty state: parent has no booked sessions → point them to the catalogue below.
  if (mySchedule.length === 0) {
    return (
      <div className="rounded-3xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-5 sm:p-6 text-center">
        <p className="text-sm font-semibold text-white">No sessions booked yet</p>
        <p className="text-xs text-white/50 mt-1">Browse the classes below and book your child in — your week will appear here.</p>
      </div>
    )
  }

  const rel = hero ? relativeLabel(hero.whenMs, nowMs) : null

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ── NEXT SESSION HERO ── */}
      {hero && (
        <div
          className="relative overflow-hidden rounded-3xl border p-5 sm:p-6"
          style={{ borderColor: `${brandColor}40`, background: `linear-gradient(135deg, ${brandColor}1f 0%, ${brandColor}08 45%, #0a0a0a 100%)` }}
        >
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-[70px] pointer-events-none" style={{ background: `${brandColor}25` }} />
          <div className="relative">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest" style={{ color: brandColor }}>Next session</p>
              {rel && (
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ background: `${brandColor}1f`, color: brandColor, border: `1px solid ${brandColor}40` }}>
                  {rel === 'Today' && <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse mr-1 align-middle" style={{ background: brandColor }} />}
                  {rel}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1.5 leading-tight">
              {hero.playerName}&rsquo;s {hero.groupName}
            </h2>
            <div className="mt-2.5">
              <MetaRow slot={hero} brand={brandColor} />
            </div>
            <div className="mt-4">
              <a href="/dashboard/messages" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.86 9.86 0 01-4-.8L3 20l1.3-3.9A7.96 7.96 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                Can&rsquo;t make it? Message your coach
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── THIS WEEK ── */}
      <div className="space-y-2.5">
        <div className="flex items-end justify-between">
          <h3 className="text-base sm:text-lg font-extrabold text-white">This week</h3>
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/40">
            {thisWeek.length} session{thisWeek.length !== 1 ? 's' : ''}
          </span>
        </div>
        {thisWeek.length === 0 ? (
          <div className="rounded-2xl border border-[#1e1e1e] bg-white/[0.02] p-4 text-center">
            <p className="text-xs text-white/45">No more sessions booked this week.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {thisWeek.map((s) => (
              <div key={`${s.enrolmentId}:${s.whenMs}`} className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3">
                <div className="shrink-0 w-1 self-stretch rounded-full" style={{ background: brandColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-white truncate">{s.playerName}</span>
                    <span className="text-white/30">·</span>
                    <span className="text-xs text-white/60 truncate">{s.groupName}</span>
                  </div>
                  <div className="mt-1"><MetaRow slot={s} brand={brandColor} /></div>
                </div>
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold text-white/70 bg-white/[0.06]">{relativeLabel(s.whenMs, nowMs)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MY SCHEDULE ── */}
      <div className="space-y-2.5">
        <div className="flex items-end justify-between">
          <h3 className="text-base sm:text-lg font-extrabold text-white">My schedule</h3>
          <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/40">
            {mySchedule.length} booked
          </span>
        </div>
        <div className="space-y-2">
          {mySchedule.map((s) => (
            <div key={s.enrolmentId} className="flex items-center gap-3 rounded-2xl border border-[#1e1e1e] bg-gradient-to-br from-[#141414] to-[#0a0a0a] p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-bold text-white truncate">{s.playerName}</span>
                  <span className="text-white/30">·</span>
                  <span className="text-xs text-white/60 truncate">{s.groupName}</span>
                </div>
                <div className="mt-1"><MetaRow slot={s} brand={brandColor} /></div>
              </div>
              <div className="shrink-0">
                <CancelBookingButton
                  enrolmentId={s.enrolmentId}
                  playerId={s.playerId}
                  className={s.groupName}
                  retentionEnabled={retentionEnabled}
                  retentionPercent={retentionPercent}
                  retentionMonths={retentionMonths}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
