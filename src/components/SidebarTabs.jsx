import { useState, useMemo } from 'react'

// ===== CYP450 Pathways — REAL data, grouped from the actual drug database =====
export function CypPathwaysTab({ graphData }) {
  const grouped = useMemo(() => {
    const map = {}
    graphData.nodes.forEach(n => {
      (n.cyp_pathway || []).forEach(enz => {
        if (!map[enz]) map[enz] = []
        map[enz].push(n)
      })
    })
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length)
  }, [graphData])

  return (
    <div className="card">
      <h3><span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>chips</span>CYP450 Pathways</h3>
      <p className="desc" style={{ marginBottom: 14 }}>
        Real metabolic pathway groupings from the {graphData.nodes.length}-drug database — every drug sharing an enzyme is a
        potential interaction risk when combined.
      </p>
      {grouped.length === 0 ? (
        <p style={{ fontSize: '0.8rem', color: 'var(--outline)' }}>Waiting for graph data...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grouped.map(([enz, drugs]) => (
            <div key={enz} style={{ background: 'var(--surface-container-low)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--on-surface)', fontFamily: "'JetBrains Mono', monospace" }}>{enz}</span>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, color: 'var(--outline)' }}>{drugs.length} drug{drugs.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {drugs.map(d => (
                  <span key={d.name} style={{ fontSize: '0.7rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-container-lowest)', color: 'var(--on-surface)' }}>
                    {d.local_name || d.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Drug Formularies — REAL data, searchable list of the actual 49 drugs =====
export function FormulariesTab({ graphData }) {
  const [q, setQ] = useState('')
  const drugNodes = useMemo(() => graphData.nodes.filter(n => n.node_type !== 'herb'), [graphData])
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return drugNodes
    return drugNodes.filter(n =>
      (n.local_name || '').toLowerCase().includes(query) ||
      n.name.toLowerCase().includes(query) ||
      (n.generic_name || '').toLowerCase().includes(query) ||
      (n.drug_class || '').toLowerCase().includes(query)
    )
  }, [q, drugNodes])

  return (
    <div className="card">
      <h3><span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>menu_book</span>Drug Formularies</h3>
      <p className="desc" style={{ marginBottom: 10 }}>Full database of {drugNodes.length} drugs this engine reasons over.</p>
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: 8, color: 'var(--outline)', fontSize: 18 }}>search</span>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by name, generic, or class..."
          style={{ width: '100%', padding: '8px 10px 8px 34px', borderRadius: 8, border: '1px solid var(--outline-variant)', background: 'var(--bg)', fontSize: '0.8rem', outline: 'none' }}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, maxHeight: 480, overflowY: 'auto' }}>
        {filtered.map(d => (
          <div key={d.name} style={{ background: 'var(--surface-container-low)', borderRadius: 9, padding: 10 }}>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--on-surface)' }}>{d.local_name || d.name}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--outline)', fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>{d.generic_name}</div>
            <div style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)' }}>{d.drug_class}</div>
            <div style={{ fontSize: '0.64rem', color: 'var(--outline)', marginTop: 4 }}>t½ {d.half_life_hours}h &middot; {(d.cyp_pathway || []).join(', ') || 'no CYP data'}</div>
          </div>
        ))}
        {filtered.length === 0 && <p style={{ fontSize: '0.78rem', color: 'var(--outline)' }}>No matches.</p>}
      </div>
    </div>
  )
}

// ===== Patient Profile — demo mock, clearly labeled as such =====
export function PatientProfileTab() {
  return (
    <div className="card">
      <h3><span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>prescriptions</span>Patient Profile</h3>
      <p className="desc" style={{ marginBottom: 14 }}>Demo view — this prototype doesn't persist real patient records. This shows what a full chart would look like.</p>
      <div style={{ background: 'var(--surface-container-low)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--surface-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
            <span className="material-symbols-outlined">person</span>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>Sample Patient <span style={{ fontWeight: 500, color: 'var(--outline)', fontSize: '0.7rem' }}>(example)</span></div>
            <div style={{ fontSize: '0.68rem', color: 'var(--outline)' }}>No chart on file &middot; illustrative only</div>
          </div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-container-high)' }}>Allergies: not on file</span>
          <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: 'var(--surface-container-high)' }}>Vitals: not tracked in this prototype</span>
        </div>
      </div>
      <p className="panel-title">Medication History (example)</p>
      {[['Ciprotab', 'started 3 days ago'], ['Panadol', 'started 1 week ago']].map(([n, t]) => (
        <div key={n} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--surface-container-low)', borderRadius: 8, marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600 }}>{n}</span>
          <span style={{ fontSize: '0.68rem', color: 'var(--outline)' }}>{t}</span>
        </div>
      ))}
    </div>
  )
}

// ===== Clinical Overrides — demo mock =====
export function OverridesTab() {
  return (
    <div className="card">
      <h3><span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>gavel</span>Clinical Overrides</h3>
      <p className="desc" style={{ marginBottom: 14 }}>Demo view — no override workflow is wired up yet in this prototype.</p>
      <div style={{ padding: 14, background: 'var(--surface-container-low)', borderRadius: 10, marginBottom: 10 }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--outline)' }}>No active overrides this session.</span>
      </div>
      <p className="panel-title">Example record</p>
      <div style={{ background: 'var(--surface-container-low)', borderRadius: 10, padding: 12 }}>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 3 }}>Amiodarone + Warfarin <span style={{ fontWeight: 500, color: 'var(--outline)', fontSize: '0.68rem' }}>(example)</span></div>
        <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', marginBottom: 4 }}>Overridden by: Dr. S. Jenkins, PharmD</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)' }}>Justification: dose already reduced 35%, INR monitored every 48h.</div>
      </div>
    </div>
  )
}

// ===== Adverse Events — demo mock with a tiny bit of local interactivity =====
export function AdverseEventsTab() {
  const [note, setNote] = useState('')
  const [reported, setReported] = useState(false)

  return (
    <div className="card">
      <h3><span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>warning</span>Adverse Events</h3>
      <p className="desc" style={{ marginBottom: 14 }}>Demo view — reports aren't sent anywhere in this prototype, just held in this session.</p>
      {!reported ? (
        <div style={{ padding: 14, background: 'var(--surface-container-low)', borderRadius: 10 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--outline)' }}>No adverse events reported this session.</span>
        </div>
      ) : (
        <div style={{ padding: 14, background: 'var(--secondary-fixed)', color: 'var(--on-secondary-fixed)', borderRadius: 10, marginBottom: 12 }}>
          <strong>Recorded locally:</strong> "{note}"
        </div>
      )}
      <p className="panel-title" style={{ marginTop: 14 }}>Report an event</p>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Describe what happened..."
        rows={3}
        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--outline-variant)', fontSize: '0.8rem', marginBottom: 8, fontFamily: 'inherit' }}
      />
      <button
        onClick={() => { if (note.trim()) setReported(true) }}
        style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--primary-container)', color: '#fff', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}
      >
        Submit Report
      </button>
    </div>
  )
}
