import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Bunny from '../../components/Bunny'
import CompanionChat from '../../components/CompanionChat'
import { useApp } from '../../lib/app'
import { PageHeader, Panel } from './shared'
import { Badge, Select } from '../../ui'
import type { Language } from '../../lib/types'

const STARTERS = [
  { label: 'A hard bedtime', text: 'Bedtime has become a battle every night. What gentle routines could help?' },
  { label: 'Big feelings', text: 'My child had a huge meltdown today. How can I respond calmly in the moment?' },
  { label: 'Screen time', text: 'How much screen time is reasonable, and how do I set limits without a fight?' },
  { label: 'I feel drained', text: 'I am exhausted and snapping at my child. How do I look after myself too?' },
]

export default function Companion() {
  const { children, boot } = useApp()
  const [params] = useSearchParams()
  const [scope, setScope] = useState<string>(() => params.get('child') ?? '')
  useEffect(() => {
    const wanted = params.get('child')
    if (wanted && children.some((c) => String(c.id) === wanted)) setScope(wanted)
  }, [params, children])
  const childId = scope ? Number(scope) : null
  const child = children.find((c) => c.id === childId)
  const languages = (boot?.languages?.length ? boot.languages : ['English']) as Language[]
  const language = languages[0]

  return (
    <div>
      <PageHeader
        title="Your companion"
        sub="A private, judgement-free space for the grown-up. Talk or type about everyday parenting, big feelings, or the small wins."
        art={<div className="hidden sm:block"><Bunny size={96} pose="sit" mood="calm" accessory="scarf" shadow={false} /></div>}
        right={<Badge tone="mint">🔒 Private to you</Badge>}
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_18rem]">
        <Panel title="Talk with Mallow" hint="Mallow listens, reflects, and offers practical ideas. It never diagnoses.">
          <CompanionChat
            key={scope || 'self'}
            audience="parent"
            childId={childId}
            title={child ? `Talking about ${child.nickname}` : 'Just for you'}
            subtitle={child ? 'Mallow can keep this child\'s age and activities in mind. Nothing is shared with the child.' : 'No child selected. You can add context any time.'}
            greeting={child
              ? `Hi. I'm here to think alongside you about ${child.nickname}. What's on your mind today?`
              : "Hi, I'm Mallow. This space is just for you. What's been on your mind lately?"}
            starters={STARTERS}
            languages={languages}
            language={language}
            safetyNote="Mallow offers general guidance, not medical or legal advice. If you are in crisis or worried about someone's safety, contact your local emergency services or a helpline right away."
          />
        </Panel>

        <div className="space-y-5">
          <Panel title="Add context" hint="Optional. Choose a child so advice fits their age.">
            <label className="mb-2 block text-sm font-bold text-ink-soft" htmlFor="companion-scope">Who is this about?</label>
            <Select id="companion-scope" value={scope} onChange={(e) => setScope(e.target.value)} data-testid="companion-scope">
              <option value="">Just me / general</option>
              {children.map((c) => <option key={c.id} value={c.id}>{c.nickname} · {c.is_infant ? 'Baby' : `Ages ${c.age_band}`}</option>)}
            </Select>
            <p className="mt-2 text-xs leading-relaxed text-ink-faint">Mallow only reads this child's age and interests. Your conversation stays separate from the child's chat and from other children.</p>
          </Panel>

          <Panel title="A gentle reminder">
            <ul className="space-y-2 text-sm leading-relaxed text-ink-soft">
              <li>💛 You do not have to have it all figured out.</li>
              <li>🌱 Small, repeatable routines often work better than perfect ones.</li>
              <li>🫂 If things feel unsafe, reach out to a real person you trust.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
