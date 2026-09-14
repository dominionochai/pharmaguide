const SEV_STYLE = {
  minor: { fg: '#006c4e', bg: '#97f5cc', label: 'Minor' },
  moderate: { fg: '#574144', bg: '#eee7e3', label: 'Moderate' },
  major: { fg: '#390c00', bg: '#ffdbd0', label: 'Major' },
  contraindicated: { fg: '#93000a', bg: '#ffdad6', label: 'Contraindicated' },
}

function Tile({ n, label, color, bg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 10, padding: '8px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: '1.2rem', fontWeight: 800, color, lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: '0.62rem', color, fontWeight: 700 }}>{label}</div>
    </div>
  )
}

function InterCard({ pair, local }) {
  const style = SEV_STYLE[pair.severity] || SEV_STYLE.moderate
  const critical = pair.severity === 'contraindicated'
  const [english, pidgin] = (pair.tell_your_doctor || '').split('\nSimple pidgin: ')

  return (
    <div style={{ background:'var(--surface-container-low)', borderRadius:10, padding:'12px 13px', marginBottom:9 }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:7 }}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
          <span className="material-symbols-outlined" style={{ color: style.fg, fontSize: 21 }}>{critical ? 'dangerous' : 'warning'}</span>
          <div>
            <div style={{ fontWeight:700, fontSize:'0.85rem', color:'#1e1b19' }}>{local(pair.drug_a)} + {local(pair.drug_b)}</div>
            <div style={{ fontSize:'0.68rem', color:style.fg, fontWeight:600 }}>{style.label} &middot; {Math.round(pair.confidence * 100)}% confidence</div>
          </div>
        </div>
        <span style={{ background:style.bg, color:style.fg, fontSize:'0.6rem', fontWeight:800, padding:'2px 8px', borderRadius:6, textTransform:'uppercase' }}>
          {critical ? 'Critical' : 'Caution'}
        </span>
      </div>
      <div style={{ background:'var(--surface-container-high)', padding:'8px 9px', borderRadius:8, fontSize:'0.75rem', color:'#1e1b19', lineHeight:1.5, marginBottom: 6 }}>
        <strong style={{ color: 'var(--primary-container)' }}>Tell your doctor:</strong> {english?.replace('English: ', '')}
      </div>
      {pidgin && (
        <div style={{ fontSize:'0.72rem', color:'var(--on-surface-variant)', fontStyle: 'italic', lineHeight: 1.5 }}>
          {pidgin}
        </div>
      )}
    </div>
  )
}

function HerbFlagCard({ flag, local }) {
  return (
    <div style={{ background:'#97f5cc', borderRadius:9, padding:'9px 12px', marginBottom:8 }}>
      <p style={{ fontSize:'0.78rem', fontWeight:700, color:'#002115', marginBottom:2 }}>
        {local(flag.medication)} <span style={{ fontWeight: 500, fontSize: '0.66rem' }}>&middot; {flag.matched_classes?.join(', ')}</span>
      </p>
      <p style={{ fontSize:'0.7rem', color:'#002115' }}>{flag.note}</p>
    </div>
  )
}

export default function RiskReport({ result, error, toLocal }) {
  const local = toLocal || ((n) => n)

  if (error) return (
    <div>
      <h3><span className="material-symbols-outlined" style={{ color:'var(--error)' }}>gavel</span>Risk Evaluation Report</h3>
      <div style={{ background:'#ffdad6', borderRadius:9, padding:14, fontSize:'0.8rem', color:'#93000a', marginTop:10 }}>Error: {error}</div>
    </div>
  )

  if (!result) return (
    <div>
      <h3><span className="material-symbols-outlined" style={{ color:'var(--error)' }}>gavel</span>Risk Evaluation Report</h3>
      <p style={{ color:'var(--outline)', fontSize:'0.8rem', lineHeight:1.7, marginTop:10 }}>
        Add medications and run the interaction audit. Flagged drug and herb interactions appear here.
      </p>
    </div>
  )

  const interactions = result.interactions || []
  const herbFlags = result.herb_flags || []
  const majorCount = interactions.filter(p => p.severity === 'major' || p.severity === 'contraindicated').length
  const moderateCount = interactions.filter(p => p.severity === 'minor' || p.severity === 'moderate').length
  const compatibleCount = Math.max((result.matched_drugs?.length||0) - interactions.length, 0)

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 2 }}>
        <h3><span className="material-symbols-outlined" style={{ color:'var(--error)' }}>gavel</span>Risk Evaluation Report</h3>
      </div>
      <p style={{ fontSize:'0.66rem', color:'var(--outline)', marginBottom: 12 }}>
        Audit generated: {new Date().toLocaleTimeString()} &middot; via {result.extraction_method === 'featherless' ? 'AI parsing' : 'pattern matching'}
      </p>

      <div style={{ display:'flex', gap:6, marginBottom:14 }}>
        <Tile n={majorCount} label="High Risk" color="#93000a" bg="#ffdad6" />
        <Tile n={moderateCount} label="Moderate" color="#390c00" bg="#ffdbd0" />
        <Tile n={compatibleCount} label="Compatible" color="#002115" bg="#97f5cc" />
      </div>

      {interactions.length > 0 ? (
        <div style={{ marginBottom:14 }}>
          <p className="panel-title">Drug Interactions</p>
          {interactions.map((p,i) => <InterCard key={i} pair={p} local={local} />)}
        </div>
      ) : (
        <div style={{ padding:12, background:'#97f5cc', borderRadius:9, marginBottom:14 }}>
          <span style={{ fontSize:'0.8rem', color:'#002115', fontWeight:700 }}>No significant drug interactions found</span>
        </div>
      )}

      {herbFlags.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <p className="panel-title" style={{ color:'var(--secondary)' }}>Herb Cross-Reference Flags</p>
          {herbFlags.map((f,i) => <HerbFlagCard key={i} flag={f} local={local} />)}
        </div>
      )}

      <div style={{ padding:'9px 11px', background:'var(--surface-container-low)', borderRadius:9, fontSize:'0.66rem', color:'var(--outline)', lineHeight:1.5 }}>
        Always consult a qualified healthcare provider before making any changes to your medication.
      </div>
    </div>
  )
}
