import { useState, useEffect, useMemo } from 'react'
import PrescriptionInput from './components/PrescriptionInput'
import DrugGraph from './components/DrugGraph'
import RiskReport from './components/RiskReport'
import { CypPathwaysTab, FormulariesTab, PatientProfileTab, OverridesTab, AdverseEventsTab } from './components/SidebarTabs'
import { getGraphData, analyseRx } from './api'

const NAV_ITEMS = [
  { label: 'Interaction Checker', icon: 'rule' },
  { label: 'Patient Profile', icon: 'prescriptions' },
  { label: 'CYP450 Pathways', icon: 'chips' },
  { label: 'Clinical Overrides', icon: 'gavel' },
  { label: 'Drug Formularies', icon: 'menu_book' },
  { label: 'Adverse Events', icon: 'warning' },
]

export default function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [analysisResult, setAnalysisResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeNav, setActiveNav] = useState('Interaction Checker')

  useEffect(() => {
    getGraphData().then(setGraphData).catch(err => console.error('Graph load failed:', err))
  }, [])

  const handleAnalyse = async (rawText) => {
    setLoading(true)
    setError(null)
    setAnalysisResult(null)
    try {
      const result = await analyseRx(rawText)
      setAnalysisResult(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleClear = () => setAnalysisResult(null)

  const nameMap = Object.fromEntries(graphData.nodes.map(n => [n.name, n.local_name || n.name]))
  const toLocal = (n) => nameMap[n] || nameMap[n?.toLowerCase?.()] || n

  const nodeByName = useMemo(() => Object.fromEntries(graphData.nodes.map(n => [n.name, n])), [graphData])

  const cypBurden = useMemo(() => {
    const matched = analysisResult?.matched_drugs || []
    const tally = {}
    matched.forEach(name => {
      const node = nodeByName[name]
      ;(node?.cyp_pathway || []).forEach(enz => { tally[enz] = (tally[enz] || 0) + 1 })
    })
    return Object.entries(tally).sort((a, b) => b[1] - a[1])
  }, [analysisResult, nodeByName])

  const flaggedCount = analysisResult?.interactions?.length || 0

  return (
    <>
      <aside className="rx-sidebar">
        <div>
          <div className="rx-sidebar-top">
            <div className="mark"><span className="material-symbols-outlined">medication</span></div>
            <div>
              <div className="name">Rx Matrix</div>
              <div className="sub">Hospital Division</div>
            </div>
          </div>
          <div className="rx-nav-label">Clinical Navigation</div>
          <nav className="rx-nav">
            {NAV_ITEMS.map(item => (
              <div
                key={item.label}
                className={`item${activeNav === item.label ? ' active' : ''}`}
                onClick={() => setActiveNav(item.label)}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19 }}>{item.icon}</span>
                {item.label}
              </div>
            ))}
          </nav>
        </div>
        <div className="rx-ehr-widget">
          <div className="row">
            <span className="label"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>sync_saved_locally</span>Live EHR Sync</span>
            <span className="dot" />
          </div>
          <div className="line">Demo mode &middot; no live EHR connected</div>
          <div className="line2">Station: Hackathon Build</div>
        </div>
      </aside>

      <div className="main-col">
        <header className="top-header">
          <div className="top-header-row">
            <div className="brand" style={{ flex: 1 }}>
              <h1>PharmaGuard</h1>
              <span className="ver-pill">Rx Safety v1.0</span>
              <div className="patient-quick">
                <span className="material-symbols-outlined" style={{ color: 'var(--outline)' }}>person_search</span>
                <div>
                  <div className="l1">Walk-in Patient</div>
                  <div className="l2">No chart on file &middot; free-text intake</div>
                </div>
              </div>
            </div>
            <div className="top-header-right">
              <div className="stat-chip">Active Rx: <span className="n">{analysisResult?.matched_drugs?.length || 0}</span></div>
              <div className="stat-chip">Herbs: <span className="n">{analysisResult?.matched_herbs?.length || 0}</span></div>
              <div className="stat-chip flag">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
                Flagged: <span className="n">{flaggedCount}</span>
              </div>
            </div>
          </div>
          <div className="sub-strip">
            <span><strong>Clinical Decision Support</strong> &middot; Real-time multidrug interaction engine</span>
            <span>Backend: <strong>{graphData.nodes.length ? 'Connected' : 'Connecting...'}</strong></span>
          </div>
        </header>

        <main className="content">
          {activeNav === 'Patient Profile' && <PatientProfileTab />}
          {activeNav === 'CYP450 Pathways' && <CypPathwaysTab graphData={graphData} />}
          {activeNav === 'Clinical Overrides' && <OverridesTab />}
          {activeNav === 'Drug Formularies' && <FormulariesTab graphData={graphData} />}
          {activeNav === 'Adverse Events' && <AdverseEventsTab />}

          {activeNav === 'Interaction Checker' && (
          <>
          <div className="patient-context">
            <div className="left">
              <div className="avatar"><span className="material-symbols-outlined">person</span></div>
              <div>
                <h2>Walk-in Patient &middot; Counter Session</h2>
                <div className="meta-line">
                  <span className="meta-pill">No chart on file</span>
                  <span className="meta-pill">Entered via free-text intake</span>
                  <span className="allergy-pill">
                    <span className="material-symbols-outlined" style={{ fontSize: 13 }}>warning</span>
                    No allergies recorded
                  </span>
                </div>
              </div>
            </div>
            <div className="actions">
              <button className="pc-btn primary"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>query_stats</span>Run Interaction Audit</button>
              <button className="pc-btn plain"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span>Export PDF</button>
            </div>
          </div>

          <div className="grid3">
            <div className="card">
              <PrescriptionInput
                onAnalyse={handleAnalyse}
                loading={loading}
                result={analysisResult}
                onClear={handleClear}
                toLocal={toLocal}
                cypBurden={cypBurden}
              />
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative', minHeight: 620, display: 'flex' }}>
              {loading && <div className="graph-loading-overlay" />}
              <DrugGraph graphData={graphData} analysisResult={analysisResult} />
            </div>

            <div className="card">
              <RiskReport result={analysisResult} error={error} toLocal={toLocal} />
            </div>
          </div>
          </>
          )}
        </main>
      </div>
    </>
  )
}
