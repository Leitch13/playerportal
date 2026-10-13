'use client'

/** The academy's side of welcome packs: add one, see who has opened it, remove it. See src/lib/welcome-pack.ts. */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PACK_BUCKET, packProblem } from '@/lib/welcome-pack'

interface PackView { packId: string; title: string; message: string | null; added: string; forWhom: string; total: number; opened: number; notOpened: string[]; canEmail: number; lastEmailed: { on: string; sent: number } | null }

export default function WelcomePackManager({ packs, classes, canEdit }: { packs: PackView[]; classes: { id: string; label: string }[]; canEdit: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(packs.length === 0)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [everyClass, setEveryClass] = useState(false)
  const [classIds, setClassIds] = useState<string[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [emailNow, setEmailNow] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const toggle = (id: string) => setClassIds((v) => v.includes(id) ? v.filter((x) => x !== id) : [...v, id])

  async function save(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setDone(null)
    const problem = !file ? 'Choose the PDF to upload.' : packProblem({ title, everyClass, classIds, fileName: file.name, fileSize: file.size, fileType: file.type })
    if (problem || !file) { setErr(problem); return }
    try {
      setBusy('Uploading…')
      const start = await fetch('/api/admin/welcome-packs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'upload-url' }) }).then((r) => r.json())
      if (!start.ok) { setErr(start.error || 'Could not start the upload.'); return }
      const up = await createClient().storage.from(PACK_BUCKET).uploadToSignedUrl(start.path, start.token, file, { contentType: 'application/pdf' })
      if (up.error) { setErr('The upload did not finish. Check your connection and try again.'); return }
      setBusy('Saving…')
      const saved = await fetch('/api/admin/welcome-packs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', title, message, path: start.path, everyClass, classIds, emailNow }) }).then((r) => r.json())
      if (!saved.ok) { setErr(saved.error || 'The pack could not be saved.'); return }
      setDone(`"${title.trim()}" is live. ${emailNow ? (saved.emailed > 0 ? `Emailed to ${saved.emailed} parent${saved.emailed === 1 ? '' : 's'}.` : 'There was nobody in those classes to email yet.') : 'Nobody was emailed.'} New families will get it automatically when they join.`)
      setTitle(''); setMessage(''); setClassIds([]); setEveryClass(false); setFile(null); setOpen(false); router.refresh()
    } catch { setErr('No connection. Please try again.') } finally { setBusy(null) }
  }

  // Email the pack to every parent in its classes who has not opened it. Only on this button.
  async function emailParents(p: PackView) {
    if (!window.confirm(`Email "${p.title}" again to ${p.canEmail} parent${p.canEmail === 1 ? '' : 's'} who ${p.canEmail === 1 ? 'has' : 'have'} not opened it yet?`)) return
    setBusy('Emailing…'); setErr(null); setDone(null)
    try {
      const r = await fetch('/api/admin/welcome-packs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'email', packId: p.packId }) }).then((x) => x.json())
      if (!r.ok) setErr(r.error || 'The emails could not be sent.')
      else { setDone(`Emailed "${p.title}" to ${r.sent} parent${r.sent === 1 ? '' : 's'}.${r.notSent ? ` ${r.notSent} could not be sent.` : ''}`); router.refresh() }
    } catch { setErr('No connection. Please try again.') } finally { setBusy(null) }
  }

  async function remove(p: PackView) {
    if (!window.confirm(`Remove "${p.title}"? Parents will no longer be able to open it.`)) return
    setBusy('Removing…'); setErr(null)
    try {
      const r = await fetch(`/api/admin/welcome-packs?pack=${p.packId}`, { method: 'DELETE' }).then((x) => x.json())
      if (!r.ok) setErr(r.error || 'The pack could not be removed.'); else router.refresh()
    } catch { setErr('No connection. Please try again.') } finally { setBusy(null) }
  }

  const field = 'w-full rounded-xl border border-[#243652] bg-[#0b1524] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#4ecde6]/60'
  return (
    <div className="space-y-4" data-testid="welcome-pack-manager">
      {done && <p className="rounded-2xl border border-[#4ecde6]/30 bg-[#4ecde6]/[0.07] px-4 py-3 text-sm text-white/90" data-testid="welcome-pack-saved">{done}</p>}
      {err && <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200" role="alert">{err}</p>}

      {packs.length === 0 && !open && <p className="rounded-3xl border border-[#243652] bg-[#0f1a2b] p-8 text-center text-sm text-white/60">No welcome packs yet.</p>}

      <ul className="space-y-3" data-testid="welcome-pack-list">
        {packs.map((p) => (
          <li key={p.packId} className="relative overflow-hidden rounded-3xl border border-[#243652] bg-gradient-to-b from-[#132238] to-[#0d1726] p-5" data-testid="welcome-pack-row">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[17px] font-bold leading-tight text-white">{p.title}</p>
                <p className="mt-1 text-xs text-white/50">For: {p.forWhom}{p.added ? ` · added ${p.added}` : ''}</p>
              </div>
              <a href={`/api/welcome-pack/${p.packId}`} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-xl border border-[#243652] px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/30 hover:text-white">View</a>
            </div>
            {p.message && <p className="mt-2 text-sm leading-relaxed text-white/65">{p.message}</p>}
            <div className="mt-4 rounded-2xl border border-white/[0.07] bg-[#0b1524]/70 px-3.5 py-3" data-testid="welcome-pack-coverage">
              <p className="text-sm text-white/85"><span className="font-bold text-white">{p.opened} of {p.total}</span> parents have opened it.</p>
              {p.notOpened.length > 0 && <p className="mt-1.5 text-xs leading-relaxed text-white/55"><span className="font-semibold text-[#4ecde6]">Not opened yet:</span> {p.notOpened.join(', ')}</p>}
              {p.total === 0 && <p className="mt-1 text-xs text-white/45">Nobody is in {p.forWhom === 'Every class' ? 'a class' : 'those classes'} yet. New families will get it when they join.</p>}
            </div>
            {canEdit && (
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="welcome-pack-email-row">
                {p.canEmail > 0
                  ? <button type="button" onClick={() => emailParents(p)} disabled={!!busy} className="rounded-xl bg-[#4ecde6] px-4 py-2.5 text-sm font-bold text-[#06121c] hover:opacity-90 disabled:opacity-50" data-testid="welcome-pack-email">{busy === 'Emailing…' ? 'Emailing…' : `${p.lastEmailed ? 'Email again to' : 'Email to'} ${p.canEmail} parent${p.canEmail === 1 ? '' : 's'}`}</button>
                  : <span className="text-xs text-white/45">{p.total === 0 ? 'Nobody to email yet.' : 'Everyone has opened it. Nobody left to email.'}</span>}
                {p.lastEmailed && <span className="text-xs text-white/55" data-testid="welcome-pack-emailed">Last emailed {p.lastEmailed.on} to {p.lastEmailed.sent} parent{p.lastEmailed.sent === 1 ? '' : 's'}.</span>}
              </div>
            )}
            {canEdit && <button type="button" onClick={() => remove(p)} disabled={!!busy} className="mt-3 text-xs font-semibold text-white/40 underline-offset-2 hover:text-rose-300 hover:underline disabled:opacity-50" data-testid="welcome-pack-remove">Remove this pack</button>}
          </li>
        ))}
      </ul>

      {canEdit && !open && <button type="button" onClick={() => { setOpen(true); setDone(null) }} className="rounded-xl bg-[#4ecde6] px-4 py-3 text-sm font-bold text-[#06121c] hover:opacity-90" data-testid="welcome-pack-add">Add a welcome pack</button>}

      {canEdit && open && (
        <form onSubmit={save} className="space-y-4 rounded-3xl border border-[#243652] bg-[#0f1a2b] p-5" data-testid="welcome-pack-form">
          <p className="text-base font-bold text-white">Add a welcome pack</p>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/60">Name parents will see</span>
            <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="Goalscorers welcome pack" data-testid="welcome-pack-title" /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/60">A short message (optional)</span>
            <textarea className={field} rows={2} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} placeholder="Welcome! Have a read before your first session." /></label>
          <label className="block"><span className="mb-1.5 block text-xs font-semibold text-white/60">The pack, as a PDF (up to 30MB)</span>
            <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} data-testid="welcome-pack-file"
              className="block w-full text-sm text-white/70 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/15" /></label>
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-white/60">Who is it for?</legend>
            <label className="mb-2 flex items-center gap-2.5 text-sm text-white"><input type="checkbox" checked={everyClass} onChange={(e) => setEveryClass(e.target.checked)} className="h-4 w-4 accent-[#4ecde6]" data-testid="welcome-pack-every" /> Every class</label>
            {!everyClass && (
              <div className="grid max-h-64 gap-1.5 overflow-y-auto rounded-2xl border border-white/[0.07] bg-[#0b1524]/70 p-3 sm:grid-cols-2" data-testid="welcome-pack-classes">
                {classes.length === 0 && <p className="text-xs text-white/45">You have no classes yet.</p>}
                {classes.map((c) => <label key={c.id} className="flex items-center gap-2.5 text-sm text-white/85"><input type="checkbox" checked={classIds.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 accent-[#4ecde6]" /> <span className="min-w-0 truncate">{c.label}</span></label>)}
              </div>
            )}
          </fieldset>
          <label className="flex items-start gap-2.5 rounded-2xl border border-[#4ecde6]/25 bg-[#4ecde6]/[0.06] px-3.5 py-3 text-sm text-white"><input type="checkbox" checked={emailNow} onChange={(e) => setEmailNow(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#4ecde6]" data-testid="welcome-pack-email-now" /> <span>Email it to the parents in these classes when I save<span className="mt-0.5 block text-xs text-white/50">Families who join later get it automatically the next morning.</span></span></label>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={!!busy} className="rounded-xl bg-[#4ecde6] px-4 py-3 text-sm font-bold text-[#06121c] hover:opacity-90 disabled:opacity-50" data-testid="welcome-pack-save">{busy || (emailNow ? 'Save and email parents' : 'Save pack')}</button>
            {packs.length > 0 && <button type="button" onClick={() => setOpen(false)} disabled={!!busy} className="rounded-xl border border-[#243652] px-4 py-3 text-sm font-semibold text-white/75 hover:text-white">Cancel</button>}
          </div>
          <p className="text-xs text-white/40">Parents also see it on their home page until they open it. Nobody is emailed the same pack twice unless you press “Email again”.</p>
        </form>
      )}
    </div>
  )
}
