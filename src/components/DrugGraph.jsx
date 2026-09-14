import { useEffect, useRef, useCallback, useState } from 'react'
import * as d3 from 'd3'

const SEV_REST = { 0:'#debfc2', 1:'#debfc2', 2:'#eee7e3', 3:'#ffdbd0', 4:'#ffdbd0', 5:'#ffdad6' }
const SEV_REST_OPACITY = { 0:0.4, 1:0.5, 2:0.6, 3:0.75, 4:0.8, 5:0.85 }
const SCAN = '#881337'
const FLAGGED = '#ba1a1a'

export default function DrugGraph({ graphData, analysisResult }) {
  const svgRef = useRef(null)
  const linkEls = useRef(null)
  const nodeEls = useRef(null)
  const timers = useRef([])
  const [counts, setCounts] = useState({ major: 0, moderate: 0 })

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }
  const label = (d) => d.local_name || d.name

  const build = useCallback(() => {
    if (!svgRef.current || !graphData.nodes.length) return
    clearTimers()
    const container = svgRef.current.parentElement
    const W = container.clientWidth || 900
    const H = container.clientHeight || 480
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    svg.attr('width', W).attr('height', H)

    const defs = svg.append('defs')
    const f = defs.append('filter').attr('id', 'glow')
    f.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'blur')
    const fm = f.append('feMerge')
    fm.append('feMergeNode').attr('in', 'blur')
    fm.append('feMergeNode').attr('in', 'SourceGraphic')

    const nodes = graphData.nodes.map(d => ({ ...d }))
    const links = graphData.links.map(d => ({ ...d }))
    const deg = {}
    nodes.forEach(n => { deg[n.id] = 0 })
    links.forEach(l => { deg[l.source] = (deg[l.source]||0)+1; deg[l.target] = (deg[l.target]||0)+1 })

    const g = svg.append('g')
    svg.call(d3.zoom().scaleExtent([0.2,4]).on('zoom', e => g.attr('transform', e.transform)))

    const link = g.append('g').selectAll('line').data(links).join('line')
      .attr('stroke', d => SEV_REST[d.severity]||SEV_REST[0])
      .attr('stroke-opacity', d => SEV_REST_OPACITY[d.severity]||0.5)
      .attr('stroke-width', d => Math.max(1, d.severity * 0.8))
      .style('cursor', 'pointer')

    const node = g.append('g').selectAll('circle').data(nodes).join('circle')
      .attr('r', d => 4 + (deg[d.id]||0) * 1.4)
      .attr('fill', '#ffffff')
      .attr('stroke', '#881337')
      .attr('stroke-width', 1.5)
      .style('cursor', 'grab')
      .call(d3.drag()
        .on('start', (e,d) => { if(!e.active) sim.alphaTarget(0.3).restart(); d.fx=d.x; d.fy=d.y })
        .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y })
        .on('end',   (e,d) => { if(!e.active) sim.alphaTarget(0); d.fx=null; d.fy=null })
      )

    const labels = g.append('g').selectAll('text').data(nodes).join('text')
      .text(d => label(d))
      .attr('font-size', '7.5px')
      .attr('font-family', "'JetBrains Mono', monospace")
      .attr('fill', '#574144')
      .attr('text-anchor', 'middle')
      .attr('dy', d => -(5+(deg[d.id]||0)*1.4)-3)
      .style('pointer-events','none').style('user-select','none')

    const tip = d3.select('body').selectAll('#pg-node-tip').data([1]).join('div')
      .attr('id','pg-node-tip')
      .style('position','fixed').style('background','#ffffff')
      .style('border','1px solid #debfc2').style('border-radius','8px')
      .style('padding','8px 12px').style('font-size','0.72rem').style('color','#1e1b19')
      .style('pointer-events','none').style('display','none').style('z-index','1000')
      .style('max-width','220px').style('line-height','1.55')
      .style('box-shadow', '0 4px 16px rgba(100,0,35,0.12)')
      .style('font-family',"'Inter', system-ui, sans-serif")

    const etip = d3.select('body').selectAll('#pg-edge-tip').data([1]).join('div')
      .attr('id','pg-edge-tip')
      .style('position','fixed').style('background','#ffffff')
      .style('border','1px solid #ba1a1a').style('border-radius','8px')
      .style('padding','8px 12px').style('font-size','0.72rem').style('color','#1e1b19')
      .style('pointer-events','none').style('display','none').style('z-index','1000')
      .style('max-width','260px').style('line-height','1.55')
      .style('box-shadow', '0 4px 16px rgba(186,26,26,0.15)')
      .style('font-family',"'Inter', system-ui, sans-serif")

    node
      .on('mouseover', (ev, d) => tip.style('display','block')
        .html(`<strong>${label(d)}</strong> <span style="color:#8a7174">(${d.name})</span><br/>
          <span style="color:#8a7174">Class:</span> ${d.drug_class}<br/>
          <span style="color:#8a7174">CYP:</span> ${d.cyp_pathway?.join(', ')||'—'}<br/>
          <span style="color:#8a7174">t½:</span> ${d.half_life_hours}h`))
      .on('mousemove', ev => tip.style('left',ev.clientX+14+'px').style('top',ev.clientY-10+'px'))
      .on('mouseout', () => tip.style('display','none'))

    const findLabel = (n) => { const m = nodes.find(x => x.name === n || x.id === n); return m ? label(m) : n }

    link.on('click', (ev, d) => {
      if (!d._flagged) return
      const src = findLabel(d.source.name || d.source)
      const tgt = findLabel(d.target.name || d.target)
      etip.style('display','block').style('left',ev.clientX+14+'px').style('top',ev.clientY-10+'px')
        .html(`<strong>${src} + ${tgt}</strong><br/>
          <span style="color:#8a7174">Severity:</span> ${d.severity}/5<br/>
          <span style="color:#8a7174">Mechanism:</span> ${d.mechanism}<br/>
          <span style="color:#ba1a1a">Effect:</span> ${d.clinical_effect}<br/>
          <span style="color:#8a7174">Evidence:</span> ${d.evidence_level}`)
    })
    svg.on('click', () => etip.style('display','none'))

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d=>d.id).distance(90))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W/2, H/2))
      .force('collision', d3.forceCollide().radius(d=>9+(deg[d.id]||0)*1.4))
      .on('tick', () => {
        link.attr('x1',d=>d.source.x).attr('y1',d=>d.source.y).attr('x2',d=>d.target.x).attr('y2',d=>d.target.y)
        node.attr('cx',d=>d.x).attr('cy',d=>d.y)
        labels.attr('x',d=>d.x).attr('y',d=>d.y)
      })

    linkEls.current = link
    nodeEls.current = node
  }, [graphData])

  useEffect(() => { build() }, [build])

  useEffect(() => {
    if (!analysisResult || !linkEls.current) return
    clearTimers()

    const SEV_NUM = { minor: 2, moderate: 3, major: 4, contraindicated: 5 }
    const interactions = analysisResult.interactions || []
    const matched = new Set([...(analysisResult.matched_drugs || []), ...(analysisResult.matched_herbs || [])])
    const flagged = new Map(interactions.map(p => [[p.drug_a, p.drug_b].sort().join('|'), p]))

    let major = 0, moderate = 0
    interactions.forEach(p => { if (SEV_NUM[p.severity] >= 4) major++; else moderate++ })
    setCounts({ major, moderate })

    linkEls.current
      .attr('stroke', d => SEV_REST[d.severity]||SEV_REST[0])
      .attr('stroke-opacity', d => SEV_REST_OPACITY[d.severity]||0.5)
      .attr('stroke-width', d => Math.max(1,d.severity*0.8))
      .attr('filter', null).each(d => { d._flagged=false })

    nodeEls.current
      .attr('fill', d => matched.has(d.name) ? '#ffd9dd' : '#ffffff')
      .attr('stroke', '#881337')
      .attr('stroke-width', d => matched.has(d.name) ? 2.5 : 1.5)
      .attr('r', d => matched.has(d.name) ? 7+(Math.random()*2) : 4+((linkEls.current.data().filter(l=>(l.source.name||l.source)===d.name||(l.target.name||l.target)===d.name).length)*1.4))

    // Highlight edges that already exist in the static graph AND were flagged live
    linkEls.current.each(function(d) {
      const s = (d.source.name || String(d.source)).toLowerCase()
      const t = (d.target.name || String(d.target)).toLowerCase()
      const key = [s, t].sort().join('|')
      if (flagged.has(key)) {
        const isMajor = SEV_NUM[flagged.get(key).severity] >= 4
        d3.select(this)
          .attr('stroke', isMajor ? FLAGGED : SCAN)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 3.5)
          .attr('filter', 'url(#glow)')
        d._flagged = true
      }
    })
  }, [analysisResult])

  return (
    <div style={{ width:'100%', height:'100%', flex: 1, minHeight:620, position:'relative',
      background: 'radial-gradient(circle, #eee7e3 1px, transparent 1px), #fff8f5', backgroundSize: '22px 22px, 100% 100%' }}>
      <div style={{ position:'absolute', top:12, left:14, right:14, zIndex:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p className="panel-title" style={{ marginBottom: 0 }}>Interaction Network Map</p>
        <div style={{ display:'flex', gap:12 }}>
          <LegendDot color="#ba1a1a" label={`Major (${counts.major})`} />
          <LegendDot color="#812500" label={`Moderate (${counts.moderate})`} />
          <LegendDot color="#006c4e" label="Compatible" />
        </div>
      </div>
      {!graphData.nodes.length && (
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#debfc2', fontSize:'0.85rem' }}>
          Connecting to graph...
        </div>
      )}
      <svg ref={svgRef} style={{ width:'100%', height:'100%', display:'block' }} />
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5 }}>
      <span style={{ width:7, height:7, borderRadius:999, background:color, flexShrink:0 }} />
      <span style={{ fontSize:'0.64rem', color:'#574144', fontFamily:"'JetBrains Mono', monospace" }}>{label}</span>
    </div>
  )
}
