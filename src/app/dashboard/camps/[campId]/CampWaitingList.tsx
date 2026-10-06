'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface WaitingPerson {
  id: string
  parentName: string
  childName: string | null
  childAge: number | null
  email: string | null
  phone: string | null
  joined: string
  invited: boolean
}

// Who asked for a place after this camp filled, in the order they joined.
// "Invite to book" emails that parent the ordinary booking link. It does not
// hold a place, so the camp needs a free place first.
export default function CampWaitingList({ campId, people, isFull, canInvite }: {
  campId: string
  people: WaitingPerson[]
  isFull: boolean
  canInvite: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; text: string; bad?: boolean } | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  // Shown at once; the page data catches up on its next load.
  const [justInvited, setJustInvited] = useState<string[]>([])

  async function invite(id: string) {
    setBusy(id); setMsg(null); setConfirmId(null)
    try {
      const res = await fetch(`/api/admin/camps/${campId}/waitlist-invite`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: id }) })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.ok) {
        setJustInvited((v) => [...v, id])
        setMsg({ id, text: data.stillFull ? 'Email sent, but the camp is still full, so they can’t book yet. Free a place or raise the capacity.' : 'Email sent with the booking link.', bad: !!data.stillFull })
        router.refresh()
      } else setMsg({ id, text: data.error || 'That didn’t send. Please try again.', bad: true })
    } catch {
      setMsg({ id, text: 'That didn’t send. Check your connection and try again.', bad: true })
    } finally { setBusy(null) }
  }

  if (people.length === 0) return null
  return (
    <section className="rounded-[15px] border border-[#1d2c42] bg-[#0f1a2b]" data-testid="camp-waiting-list">
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#1d2c42] px-4 py-3.5 sm:px-5">
        <h2 className="text-[15px] font-semibold text-white">Waiting list</h2>
        <p className="text-xs tabular-nums text-[#d8a95a]">{people.length} waiting</p>
      </header>
      {isFull && (
        <p className="border-b border-[#1d2c42] px-4 py-2.5 text-xs leading-relaxed text-[#d8a95a] sm:px-5">
          This camp is full. Before you invite someone, free a place or raise the capacity. Otherwise their link will show “Fully booked”.
        </p>
      )}
      <ol className="divide-y divide-[#1d2c42]">
        {people.map((person, i) => {
          const p = { ...person, invited: person.invited || justInvited.includes(person.id) }
          return (
          <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-5">
            <span className="hidden w-5 shrink-0 text-sm font-semibold tabular-nums text-[#5b6c86] sm:block">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white">{p.childName || 'Child not named'}{p.childAge ? `, ${p.childAge}` : ''}</p>
              <p className="break-words text-xs text-[#93a2ba]">
                {p.parentName}{p.email ? ` · ${p.email}` : ''}{p.phone ? ` · ${p.phone}` : ''} · joined {p.joined}
              </p>
              {msg?.id === p.id && <p className={`mt-1 text-xs ${msg.bad ? 'text-[#d8a95a]' : 'text-[#67c79a]'}`} role="status">{msg.text}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {p.invited && <span className="rounded-full bg-[#67c79a]/[0.12] px-2.5 py-1 text-xs font-semibold text-[#67c79a]">Invited</span>}
              {canInvite && p.email && (
                confirmId === p.id ? (
                  <>
                    <button type="button" onClick={() => invite(p.id)} disabled={busy === p.id} className="rounded-[10px] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a] disabled:opacity-60">{busy === p.id ? 'Sending…' : 'Send the email'}</button>
                    <button type="button" onClick={() => setConfirmId(null)} className="rounded-[10px] border border-[#293b58] px-3 py-1.5 text-xs font-semibold text-[#93a2ba]">Cancel</button>
                  </>
                ) : (
                  <button type="button" onClick={() => setConfirmId(p.id)} disabled={busy === p.id} className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold ${p.invited ? 'border border-[#293b58] text-[#93a2ba] hover:text-white' : 'bg-[#4ecde6] text-[#04141a]'}`}>
                    {p.invited ? 'Invite again' : 'Invite to book'}
                  </button>
                )
              )}
            </div>
          </li>
          )
        })}
      </ol>
    </section>
  )
}
