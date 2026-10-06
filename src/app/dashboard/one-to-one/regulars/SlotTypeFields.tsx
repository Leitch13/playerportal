'use client'

import { useEffect, useRef, useState } from 'react'
import { Field, PoundsInput, inputCls } from '../ui'

// Type, price and (for a 2-to-1) the second keeper, for the "Add a regular" form.
// Choosing 2-to-1 switches the price to the academy's 2-to-1 price and offers a
// second child, so a pair is set up in one go instead of two separate saves.
export default function SlotTypeFields({ players, oneToOnePence, twoToOnePence }: {
  players: { id: string; label: string }[]
  oneToOnePence: number
  twoToOnePence: number
}) {
  const [type, setType] = useState<'one_to_one' | 'two_to_one'>('one_to_one')
  const ref = useRef<HTMLSelectElement>(null)
  // The form clears itself after a save; follow it back to 1-to-1.
  useEffect(() => {
    const form = ref.current?.form
    if (!form) return
    const onReset = () => setType('one_to_one')
    form.addEventListener('reset', onReset)
    return () => form.removeEventListener('reset', onReset)
  }, [])
  const pair = type === 'two_to_one'
  return (
    <>
      <Field label="Type">
        <select ref={ref} name="sessionType" className={inputCls} value={type} onChange={(e) => setType(e.target.value === 'two_to_one' ? 'two_to_one' : 'one_to_one')}>
          <option value="one_to_one">1-to-1</option>
          <option value="two_to_one">2-to-1</option>
        </select>
      </Field>
      <Field label={pair ? 'Price per session, each keeper' : 'Price per session'}>
        <PoundsInput key={type} name="pricePence" defaultPence={pair ? twoToOnePence : oneToOnePence} />
      </Field>
      {pair && (
        <Field label="Second keeper in the pair" className="col-span-2" >
          <select name="secondPlayerId" className={inputCls} defaultValue="" data-testid="second-keeper">
            <option value="">Add the second keeper later</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <span className="mt-1 block text-[11px] leading-relaxed text-white/45">Pick both now and they are paired with the same coach, day and time. Each parent gets their own pay link.</span>
        </Field>
      )}
    </>
  )
}
