import { useState, useRef } from 'react'
import { detectHerbFromImage } from '../api'

const DEMOS = [
  { label: "Warfarin + Aspirin + Garlic", icon: 'bloodtype', color: "#ba1a1a", text: "I dey take Warfarin for my heart, doctor add Aspirin too, and I dey chop garlic regularly for my health" },
  { label: "Metformin + Bitter Leaf", icon: 'vaccines', color: "#812500", text: "I have diabetes and take Metformin. I also drink bitter leaf soup every week to help my sugar" },
  { label: "Simvastatin + Grapefruit", icon: 'ecg_heart', color: "#812500", text: "I take Simvastatin for cholesterol every night and I like eating grapefruit for breakfast" },
  { label: "Sildenafil + Nitroglycerin", icon: 'warning', color: "#ba1a1a", text: "I take Sildenafil sometimes and I also carry Nitroglycerin tablets for my chest pain" },
]

const FILTER_TABS = ['All', 'Rx Only', 'OTC', 'Herb/Supp']

export default function PrescriptionInput({ onAnalyse, loading, result, onClear, toLocal, cypBurden = [] }) {
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [filter, setFilter] = useState('All')
  const [herbResult, setHerbResult] = useState(null)
  const [herbBusy, setHerbBusy] = useState(false)
  const [herbError, setHerbError] = useState(null)
  const timerRef = useRef(null)
  const fileRef = useRef(null)
  const local = toLocal || ((n) => n)
  const matched = result?.matched_drugs || []
  const matchedHerbs = result?.matched_herbs || []

  const typeText = (fullText) => {
    if (timerRef.current) clearInterval(timerRef.current)
    setText('')
    setTyping(true)
    let i = 0
    timerRef.current = setInterval(() => {
      i++
      setText(fullText.slice(0, i))
      if (i >= fullText.length) { clearInterval(timerRef.current); setTyping(false) }
    }, 18)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (text.trim()) onAnalyse(text.trim())
  }

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setHerbBusy(true)
    setHerbError(null)
    setHerbResult(null)
    try {
      const res = await detectHerbFromImage(file, matched)
      setHerbResult(res)
    } catch (err) {
      setHerbError(err.message)
    } finally {
      setHerbBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h3><span className="material-symbols-outlined" style={{ color: 'var(--primary-container)' }}>medication</span>Active Regimen</h3>
        <span style={{ fontSize: '0.66rem', fontWeight: 700, padding: '2px 9px', borderRadius: 999, background: 'var(--primary-fixed)', color: 'var(--on-primary-fixed)' }}>
          {matched.length} Medication{matched.length !== 1 ? 's' : ''}
        </span>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: 10 }}>
        <div style={{ position: 'relative', marginBottom: 7 }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: 9, color: 'var(--outline)', fontSize: 18, pointerEvents: 'none' }}>search</span>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Describe your medications in plain English or Pidgin..."
            disabled={loading || typing}
            rows={3}
            style={{
              width: '100%', background: 'var(--bg)', border: `1px solid ${typing ? 'var(--primary-container)' : 'var(--outline-variant)'}`,
              borderRadius: 9, color: 'var(--on-surface)', padding: '9px 11px 9px 34px', fontSize: '0.8rem', resize: 'none',
              outline: 'none', lineHeight: 1.6, fontFamily: 'inherit', transition: 'border-color 0.2s',
            }}
          />
        </div>
        <button
          type="submit"
          disabled={loading || typing || !text.trim()}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '9px 0',
            background: (loading || typing || !text.trim()) ? 'var(--surface-container-high)' : 'var(--primary-container)',
            color: (loading || typing || !text.trim()) ? 'var(--outline)' : '#fff',
            border: 'none', borderRadius: 9, fontWeight: 700, fontSize: '0.8rem',
            cursor: (loading || typing || !text.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>add_circle</span>
          {loading ? 'Running Audit...' : 'Add to Active Regimen'}
        </button>
      </form>

      <div style={{ display: 'flex', gap: 2, background: 'var(--surface-container-low)', padding: 3, borderRadius: 9, marginBottom: 10 }}>
        {FILTER_TABS.map(t => (
          <button key={t} onClick={() => setFilter(t)} style={{
            flex: 1, padding: '5px 0', borderRadius: 6, fontSize: '0.66rem', fontWeight: 700, border: 'none', cursor: 'pointer',
            background: filter === t ? 'var(--surface-container-lowest)' : 'transparent',
            color: filter === t ? 'var(--on-surface)' : 'var(--on-surface-variant)',
            boxShadow: filter === t ? '0 1px 3px rgba(28,25,23,0.08)' : 'none',
          }}>{t}</button>
        ))}
      </div>

      <div style={{ background: 'var(--surface-container-low)', borderRadius: 9, padding: 9, marginBottom: 12 }}>
        <p style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Clinical Presets</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {DEMOS.map(d => (
            <button
              key={d.label}
              onClick={() => typeText(d.text)}
              disabled={loading || typing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left', padding: '6px 8px', borderRadius: 6,
                background: 'transparent', border: 'none', color: 'var(--on-surface-variant)',
                cursor: (loading || typing) ? 'not-allowed' : 'pointer', fontSize: '0.72rem', fontWeight: 500,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-container-lowest)'; e.currentTarget.style.color = 'var(--on-surface)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--on-surface-variant)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: d.color }}>{d.icon}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label}</span>
            </button>
          ))}
        </div>
      </div>

      {(matched.length > 0 || matchedHerbs.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
          {matched.map(name => (
            <div key={name} style={{ padding: '9px 10px', borderRadius: 9, background: 'var(--surface-container-low)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--error-container)', color: 'var(--on-error-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>bloodtype</span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--on-surface)' }}>{local(name)}</div>
            </div>
          ))}
          {matchedHerbs.map(name => (
            <div key={name} style={{ padding: '9px 10px', borderRadius: 9, background: 'var(--secondary-fixed)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: '#ffffff', color: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>eco</span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--on-secondary-fixed)' }}>{local(name)} <span style={{ fontWeight: 500, fontSize: '0.66rem' }}>(herb)</span></div>
            </div>
          ))}
        </div>
      )}

      {result && !loading && (
        <button type="button" onClick={onClear} style={{ width: '100%', padding: '7px 0', background: 'var(--surface-container-high)', color: 'var(--on-surface-variant)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.74rem', fontWeight: 600, marginBottom: 14 }}>
          Clear Regimen
        </button>
      )}

      {/* Photo-based herb identification */}
      <div className="card" style={{ margin: '0 0 14px', padding: 11, background: 'var(--surface-container-low)', boxShadow: 'none' }}>
        <p style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--secondary)' }}>photo_camera</span>
          Identify a Herb by Photo
        </p>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={herbBusy}
          style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: '1px dashed var(--outline-variant)', background: 'var(--surface-container-lowest)', color: 'var(--on-surface-variant)', fontSize: '0.76rem', fontWeight: 600, cursor: herbBusy ? 'not-allowed' : 'pointer' }}
        >
          {herbBusy ? 'Identifying...' : 'Upload photo of a herb / plant / pack'}
        </button>
        {herbError && <p style={{ fontSize: '0.7rem', color: 'var(--error)', marginTop: 6 }}>{herbError}</p>}
        {herbResult && (
          herbResult.identified ? (
            <div style={{ marginTop: 8, padding: 9, borderRadius: 8, background: 'var(--secondary-fixed)', color: 'var(--on-secondary-fixed)' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>{herbResult.herb.common_name} <span style={{ fontWeight: 500, fontSize: '0.66rem' }}>({Math.round(herbResult.herb.confidence * 100)}% &middot; {herbResult.method})</span></div>
              <div style={{ fontSize: '0.72rem', marginTop: 3 }}>{herbResult.herb.interaction_notes}</div>
            </div>
          ) : (
            <p style={{ fontSize: '0.72rem', color: 'var(--outline)', marginTop: 6 }}>{herbResult.message}</p>
          )
        )}
      </div>

      {/* Real CYP450 burden — computed from actual pathway data on matched drugs */}
      <div className="card" style={{ margin: 0, padding: 11, background: 'var(--surface-container-low)', boxShadow: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary-container)' }}>chips</span>
            CYP450 Enzyme Burden
          </span>
          {cypBurden.some(([, c]) => c > 1) && <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--error)', animation: 'pulse2 1.4s infinite' }} />}
        </div>
        {cypBurden.length === 0 ? (
          <p style={{ fontSize: '0.72rem', color: 'var(--outline)' }}>Add medications to see shared metabolic pathways.</p>
        ) : (
          <>
            <p style={{ fontSize: '0.72rem', color: 'var(--on-surface-variant)', marginBottom: 6 }}>
              Computed from real pathway data on this regimen{cypBurden[0][1] > 1 && <> &mdash; <strong>{cypBurden[0][0]}</strong> is shared by {cypBurden[0][1]} drugs, a potential bottleneck</>}.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {cypBurden.map(([enz, count]) => (
                <span key={enz} style={{
                  fontSize: '0.66rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                  background: count > 1 ? 'var(--error-container)' : 'var(--surface-container-high)',
                  color: count > 1 ? 'var(--on-error-container)' : 'var(--on-surface)',
                }}>{enz}{count > 1 ? ` \u00d7${count}` : ''}</span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
