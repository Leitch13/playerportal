import Link from 'next/link'
import { requireAdmin, getSettings } from '@/lib/one-to-one/db'
import { calendarUrl } from '@/lib/one-to-one/calendar'
import { HOURS_FULL_CREDIT, HOURS_HALF_CREDIT } from '@/lib/one-to-one/policy'
import { ActionForm, Field, inputCls } from '../ui'

export const dynamic = 'force-dynamic'

// Settings — prices and session length are the academy's. How money moves is not.
export default async function OneToOneSettingsPage() {
  const { admin, orgId, userId } = await requireAdmin()
  const s = await getSettings(admin, orgId)
  const cal = calendarUrl(userId, process.env.NEXT_PUBLIC_APP_URL || 'https://www.theplayerportal.net')
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
        <h3 className="text-sm font-semibold text-white">Prices and session length</h3>
        <ActionForm action="settings.save" submitLabel="Save" className="mt-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="1-to-1, pence per session"><input name="oneToOnePence" type="number" defaultValue={s.one_to_one_price_pence} className={inputCls} /></Field>
            <Field label="2-to-1, pence per child"><input name="twoToOnePence" type="number" defaultValue={s.two_to_one_price_pence} className={inputCls} /></Field>
            <Field label="Session length, minutes"><input name="sessionMinutes" type="number" defaultValue={s.session_minutes} className={inputCls} /></Field>
            <label className="flex items-end gap-2 pb-2 text-xs text-white/70"><input type="checkbox" name="cashAllowed" defaultChecked={s.cash_allowed} /> Cash allowed for regulars</label>
          </div>
        </ActionForm>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5">
        <h3 className="text-sm font-semibold text-white">How the month works <span className="ml-1 text-[11px] font-normal text-white/45">the same for every academy</span></h3>
        <ul className="mt-3 space-y-2 text-xs text-white/70">
          <li>Regulars roll forward. Parents get a notice of next month&apos;s dates on the 20th, not a menu.</li>
          <li>Charged on the 1st, per session in the month. Cash regulars are marked by you.</li>
          <li>A parent declining a date: more than {HOURS_FULL_CREDIT / 24} days notice, full credit. {HOURS_FULL_CREDIT / 24} days down to {HOURS_HALF_CREDIT} hours, half. Under {HOURS_HALF_CREDIT} hours, charged.</li>
          <li>A released date goes on sale to the public immediately.</li>
          <li>Coaches can flag a day or add hours. They cannot remove hours or move a regular.</li>
        </ul>
        <p className="mt-3 text-[11px] text-white/40">Nothing on this page charges anyone. Charges come from the 1st-of-month run, and every one shows on the parent&apos;s page and yours.</p>
      </div>
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1a2b] p-5 md:col-span-2">
        <h3 className="text-sm font-semibold text-white">Calendars <span className="ml-1 text-[11px] font-normal text-white/45">every 1-2-1 session, on a phone</span></h3>
        <p className="mt-2 text-xs text-white/70">Subscribe once and the calendar keeps itself up to date: new regulars, one-off bookings, moves and cancellations show within the hour. Each coach has their own feed on their <Link href="/dashboard/my-sessions" className="text-[#4ecde6]">My 1-2-1s</Link> page, and each parent on theirs. This one is the whole academy.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a href={cal.webcal} className="rounded-lg border border-[#4ecde6] bg-[#4ecde6] px-3 py-1.5 text-xs font-semibold text-[#04141a]">Add the academy calendar to this phone</a>
          <code className="max-w-full overflow-x-auto rounded-lg border border-white/[0.1] bg-[#080e18] px-2 py-1 text-[11px] text-white/60">{cal.https}</code>
        </div>
        <p className="mt-2 text-[11px] text-white/40">Google Calendar: Other calendars, From URL, paste the link. The link is private to your login; don&apos;t forward it.</p>
      </div>
    </div>
  )
}
