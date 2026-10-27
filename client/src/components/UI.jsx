export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="page-header flex flex-wrap items-end justify-between gap-5">
    <div className="page-header-copy max-w-2xl">{eyebrow && <p className="page-kicker mb-3">{eyebrow}</p>}<h1 className="page-title">{title}</h1>{description && <p className="mt-4 text-[0.9375rem] leading-relaxed text-ink-soft">{description}</p>}</div>
    {actions && <div className="page-header-actions flex flex-wrap items-center gap-2">{actions}</div>}
  </header>
}

const progressSteps = ['Submitted', 'Document scrutiny', 'Records verification', 'Registrar approval', 'Attested']
const progressIndex = { scrutiny: 1, records_verification: 2, registrar_approval: 3, issuing: 3, issued: 5 }

// Where a request is in the attestation process. An objection pauses it at the stage that raised it.
export function ApplicationProgress({ status, objectionStage, className = '' }) {
  const paused = status === 'objection'
  const current = paused ? progressIndex[objectionStage] ?? 1 : progressIndex[status]
  if (current == null) return null
  return <ol aria-label="Request progress" className={`progress-strip ${className}`} style={{ '--steps': progressSteps.length }}>{progressSteps.map((label, index) => {
    const state = index < current ? 'done' : index === current ? paused ? 'paused' : 'current' : 'next'
    return <li key={label} data-state={state} aria-current={state === 'current' || state === 'paused' ? 'step' : undefined}><span>0{index + 1}</span>{label}<span className="sr-only">{state === 'done' ? ' (complete)' : state === 'current' ? ' (current step)' : state === 'paused' ? ' (paused: objection raised)' : ''}</span></li>
  })}</ol>
}

export function SectionHeading({ title, aside, id }) {
  return <h2 id={id} className="rule-heading"><span>{title}</span>{aside && <span className="normal-case tracking-normal text-xs font-normal text-ink-faint">{aside}</span>}</h2>
}
