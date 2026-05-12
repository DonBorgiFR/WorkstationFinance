/**
 * scorer.js — Motor de Elegibilidad para Financiación Pública
 * Evalúa criterios ENISA Emprendedores y CDTI Neotec.
 */

// ---- Helpers ----
function _fmtEur(v) {
  if (v == null || isNaN(v)) return '—';
  return new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v) + '€';
}

/**
 * ENISA_CRITERIOS
 * @constant {Array<Object>}
 * @description Define los pesos, umbrales y lógicas de validación para el programa ENISA Emprendedores.
 * Se evalúan los Fondos Propios, años de antigüedad, capital social y apalancamiento.
 */
const ENISA_CRITERIOS = [
  {
    id: 'E1', peso: 20, critico: true,
    label: 'Fondos Propios positivos',
    desc: 'El patrimonio neto debe ser > 0€.',
    compute(data, inp) {
      const pn = data.balance.patrimonioNeto;
      const ok = pn > 0;
      return { ok, valor: _fmtEur(pn), detalle: ok ? 'PN positivo ✓' : 'PN negativo — riesgo de denegación' };
    }
  },
  {
    id: 'E2', peso: 20, critico: true,
    label: 'Empresa menor de 5 años',
    desc: 'ENISA Emprendedores financia empresas < 5 años desde constitución.',
    compute(data, inp) {
      const a = parseFloat(inp.añosEmpresa) || 0;
      const ok = a > 0 && a <= 5;
      return { ok, valor: a ? `${a} año${a !== 1 ? 's' : ''}` : 'No indicado', detalle: ok ? 'Dentro del umbral' : a > 5 ? 'Supera el límite de 5 años' : 'Introduce los años de empresa' };
    }
  },
  {
    id: 'E3', peso: 15, critico: false,
    label: 'Capital aportado ≥ 50% de lo solicitado',
    desc: 'ENISA exige ratio 1:1 recursos propios/préstamo.',
    compute(data, inp) {
      const cs = parseFloat(inp.capitalSocial) || 0;
      const sol = parseFloat(inp.importeSolicitado) || 1;
      const ratio = cs / sol;
      const ok = ratio >= 0.5;
      return { ok, valor: `${(ratio * 100).toFixed(0)}%`, detalle: ok ? `Capital suficiente (${_fmtEur(cs)} vs ${_fmtEur(sol)})` : `Déficit de ${_fmtEur(sol * 0.5 - cs)} en capital propio` };
    }
  },
  {
    id: 'E4', peso: 10, critico: false,
    label: 'Modelo innovador / escalable',
    desc: 'El proyecto debe presentar carácter innovador demostrable.',
    compute(data, inp) {
      const ok = inp.modeloInnovador === true || inp.modeloInnovador === 'true';
      return { ok, valor: ok ? 'Sí' : 'No indicado', detalle: ok ? 'Marcado como innovador' : 'Pendiente de validar' };
    }
  },
  {
    id: 'E5', peso: 10, critico: true,
    label: 'No cotiza en mercados regulados',
    desc: 'Las empresas cotizadas no son elegibles.',
    compute(data, inp) {
      const cotizada = inp.cotizada === true || inp.cotizada === 'true';
      const ok = !cotizada;
      return { ok, valor: cotizada ? 'Sí cotiza' : 'No cotiza', detalle: ok ? 'Elegible' : 'Empresa cotizada — no elegible ENISA' };
    }
  },
  {
    id: 'E6', peso: 15, critico: false,
    label: 'Deuda LP / Patrimonio Neto < 3x',
    desc: 'ENISA es sensible al sobreendeudamiento estructural.',
    compute(data, inp) {
      const pn = Math.max(data.balance.patrimonioNeto, 1);
      const deuda = data.balance.pasivoNoCorriente;
      const ratio = deuda / pn;
      const ok = ratio < 3;
      return { ok, valor: `${ratio.toFixed(2)}x`, detalle: ok ? 'Apalancamiento razonable' : `Deuda excesiva (${ratio.toFixed(2)}x PN)` };
    }
  },
  {
    id: 'E7', peso: 10, critico: false,
    label: 'Tendencia EBITDA positiva (últimos meses)',
    desc: 'Indicador favorable — refuerza la solicitud.',
    compute(data, inp) {
      const months = Object.keys(data.pygMensual).sort();
      if (months.length < 2) return { ok: false, valor: '—', detalle: 'Se necesitan ≥ 2 meses' };
      const last = data.pygMensual[months[months.length - 1]].ebitda;
      const prev = data.pygMensual[months[months.length - 2]].ebitda;
      const ok = last > prev;
      const diff = last - prev;
      return { ok, valor: _fmtEur(last), detalle: `${diff >= 0 ? '+' : ''}${_fmtEur(diff)} vs mes anterior` };
    }
  }
];

/**
 * CDTI_CRITERIOS
 * @constant {Array<Object>}
 * @description Define los pesos, umbrales y lógicas de validación para CDTI Neotec.
 * Prioriza empresas < 3 años, presupuesto I+D > 175k€ y masa crítica de personal técnico.
 */
const CDTI_CRITERIOS = [
  {
    id: 'N1', peso: 25, critico: true,
    label: 'Empresa menor de 3 años',
    desc: 'CDTI Neotec financia start-ups de reciente creación (máx. 3 años).',
    compute(data, inp) {
      const a = parseFloat(inp.añosEmpresa) || 0;
      const ok = a > 0 && a <= 3;
      return { ok, valor: a ? `${a} año${a !== 1 ? 's' : ''}` : 'No indicado', detalle: ok ? 'Dentro del umbral Neotec' : a > 3 ? 'Supera el límite de 3 años' : 'Introduce los años de empresa' };
    }
  },
  {
    id: 'N2', peso: 25, critico: true,
    label: 'Proyecto de I+D+i (tech/biotech/deeptech)',
    desc: 'El proyecto debe ser de base tecnológica con resultados propios innovadores.',
    compute(data, inp) {
      const ok = ['tech', 'biotech', 'deeptech'].includes(inp.tipoProyecto);
      return { ok, valor: inp.tipoProyecto || 'No indicado', detalle: ok ? 'Tipología compatible con Neotec' : 'Proyecto no clasificado como I+D elegible' };
    }
  },
  {
    id: 'N3', peso: 20, critico: false,
    label: 'Presupuesto I+D entre 175K€ y 10M€',
    desc: 'CDTI Neotec financia proyectos en ese rango presupuestario.',
    compute(data, inp) {
      const p = parseFloat(inp.presupuestoID) || 0;
      const ok = p >= 175000 && p <= 10000000;
      return { ok, valor: p ? _fmtEur(p) : 'No indicado', detalle: ok ? 'Rango compatible' : p > 0 && p < 175000 ? 'Por debajo del mínimo operativo' : p > 10000000 ? 'Excede el máximo habitual' : 'Introduce el presupuesto' };
    }
  },
  {
    id: 'N4', peso: 10, critico: false,
    label: '≥ 50% del equipo con perfil técnico',
    desc: 'Neotec valora que la empresa sea liderada por perfiles técnicos.',
    compute(data, inp) {
      const pct = parseFloat(inp.pctPersonalTech) || 0;
      const ok = pct >= 50;
      return { ok, valor: pct ? `${pct}%` : 'No indicado', detalle: ok ? 'Equipo técnico suficiente' : 'Reforzar plantilla técnica' };
    }
  },
  {
    id: 'N5', peso: 10, critico: true,
    label: 'No ha recibido CDTI Neotec anteriormente',
    desc: 'Solo se concede una vez por empresa.',
    compute(data, inp) {
      const previo = inp.neotecPrevio === true || inp.neotecPrevio === 'true';
      const ok = !previo;
      return { ok, valor: previo ? 'Sí (ya recibido)' : 'No', detalle: ok ? 'Primera solicitud — elegible' : 'Ya recibido — no elegible' };
    }
  },
  {
    id: 'N6', peso: 10, critico: false,
    label: 'Gasto en Personal ≥ 40% del OPEX total',
    desc: 'Indica que la empresa es genuinamente tech, no un integrador.',
    compute(data, inp) {
      const totalOpex = Math.max(data.totales.gastos, 1);
      const personal = Object.values(data.pygMensual).reduce((s, m) => s + (m.personal || 0), 0);
      const pctReal = personal / totalOpex;
      const ok = pctReal >= 0.4;
      return { ok, valor: `${(pctReal * 100).toFixed(1)}%`, detalle: ok ? 'Personal representa parte mayoritaria del OPEX' : 'Personal por debajo del 40% del OPEX total' };
    }
  }
];

/**
 * scoreFinanciacion(data, inp)
 * @description Ejecuta el motor de reglas sobre los datos contables combinados con los inputs manuales.
 * @param {Object} data - AnalysisResult (Totales, Balance, PyG).
 * @param {Object} inp - Valores manuales del usuario (años de empresa, capital social, etc).
 * @returns {Object} Un objeto con el scoring detallado (`score`, `elegible`, `alertas`) para ENISA y CDTI.
 */
function scoreFinanciacion(data, inp = {}) {
  function computePrograma(criterios) {
    const results = criterios.map(c => ({ ...c, ...c.compute(data, inp) }));
    const totalPeso = criterios.reduce((s, c) => s + c.peso, 0);
    const pesoOk   = results.filter(r => r.ok).reduce((s, r) => s + r.peso, 0);
    const score    = Math.round((pesoOk / totalPeso) * 100);
    const criticoFailed = results.filter(r => r.critico && !r.ok);
    const elegible = score >= 60 && criticoFailed.length === 0;

    const alertas = [];
    criticoFailed.forEach(r => alertas.push(`⛔ Criterio crítico no cumplido: ${r.label}`));
    results.filter(r => !r.ok && !r.critico).forEach(r => alertas.push(`⚠ ${r.label}: ${r.detalle}`));

    return { score, elegible, criterios: results, alertas };
  }
  return {
    enisa: computePrograma(ENISA_CRITERIOS),
    cdti:  computePrograma(CDTI_CRITERIOS)
  };
}

// ---- Render principal ----
function renderScorer() {
  const root = document.getElementById('scoring-root');
  if (!root) return;
  const inp = STATE.scoringInputs || {};

  root.innerHTML = `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">⚙️ Parámetros de Elegibilidad</div>
      <p style="font-size:0.83rem;color:var(--text-muted);margin-bottom:18px;">Introduce los datos que no se pueden deducir del libro contable. El scoring se recalculará automáticamente.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;">
        <div class="form-group"><label for="sc-años">Años desde constitución</label>
          <input type="number" id="sc-años" value="${inp.añosEmpresa||''}" placeholder="Ej: 2" style="width:100%;padding:10px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);"/></div>
        <div class="form-group"><label for="sc-capital">Capital Social aportado (€)</label>
          <input type="number" id="sc-capital" value="${inp.capitalSocial||''}" placeholder="Ej: 50000" style="width:100%;padding:10px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);"/></div>
        <div class="form-group"><label for="sc-solicitado">Importe a solicitar ENISA (€)</label>
          <input type="number" id="sc-solicitado" value="${inp.importeSolicitado||''}" placeholder="Ej: 150000" style="width:100%;padding:10px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);"/></div>
        <div class="form-group"><label for="sc-presupuesto">Presupuesto I+D (€)</label>
          <input type="number" id="sc-presupuesto" value="${inp.presupuestoID||''}" placeholder="Ej: 200000" style="width:100%;padding:10px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);"/></div>
        <div class="form-group"><label for="sc-pct-tech">% Personal técnico</label>
          <input type="number" id="sc-pct-tech" value="${inp.pctPersonalTech||''}" placeholder="Ej: 65" style="width:100%;padding:10px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);"/></div>
        <div class="form-group"><label for="sc-tipo">Tipo de proyecto</label>
          <select id="sc-tipo" style="width:100%;padding:10px;background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border);border-radius:var(--radius-sm);">
            <option value="">— Seleccionar —</option>
            <option value="tech" ${inp.tipoProyecto==='tech'?'selected':''}>Software / Tech</option>
            <option value="biotech" ${inp.tipoProyecto==='biotech'?'selected':''}>Biotech / Medtech</option>
            <option value="deeptech" ${inp.tipoProyecto==='deeptech'?'selected':''}>Deep Tech / Hardware</option>
            <option value="other" ${inp.tipoProyecto==='other'?'selected':''}>Otro</option>
          </select></div>
      </div>
      <div style="display:flex;gap:28px;margin-top:16px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.87rem;color:var(--text-secondary);">
          <input type="checkbox" id="sc-innovador" ${inp.modeloInnovador?'checked':''} style="width:16px;height:16px;accent-color:var(--cyan);"/> Modelo innovador / escalable</label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.87rem;color:var(--text-secondary);">
          <input type="checkbox" id="sc-cotizada" ${inp.cotizada?'checked':''} style="width:16px;height:16px;accent-color:var(--cyan);"/> Empresa cotizada en mercados regulados</label>
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:0.87rem;color:var(--text-secondary);">
          <input type="checkbox" id="sc-neotec-previo" ${inp.neotecPrevio?'checked':''} style="width:16px;height:16px;accent-color:var(--cyan);"/> Ya recibió CDTI Neotec anteriormente</label>
      </div>
      <div style="margin-top:18px;">
        <button class="btn btn-primary" id="btn-recalcular-scoring" style="font-size:0.9rem;padding:10px 24px;">🔄 Recalcular Scoring</button>
      </div>
    </div>

    <div id="scoring-results">
      ${STATE.analysisResult ? _buildScoringHTML() : `
        <div class="empty-state"><div class="empty-icon">🏅</div>
          <p>Carga y analiza un libro diario para activar el scoring automático.</p></div>`}
    </div>`;

  document.getElementById('btn-recalcular-scoring')?.addEventListener('click', () => {
    _collectScoringInputs();
    if (!STATE.analysisResult) { showToast('Carga un libro diario primero', 'error'); return; }
    STATE.scoringResult = scoreFinanciacion(STATE.analysisResult, STATE.scoringInputs);
    document.getElementById('scoring-results').innerHTML = _buildScoringHTML();
    if (typeof renderChecklist === 'function') renderChecklist();
    showToast('Scoring actualizado ✓', 'success');
  });
}

function _collectScoringInputs() {
  STATE.scoringInputs = {
    añosEmpresa:      document.getElementById('sc-años')?.value,
    capitalSocial:    document.getElementById('sc-capital')?.value,
    importeSolicitado:document.getElementById('sc-solicitado')?.value,
    presupuestoID:    document.getElementById('sc-presupuesto')?.value,
    pctPersonalTech:  document.getElementById('sc-pct-tech')?.value,
    tipoProyecto:     document.getElementById('sc-tipo')?.value,
    modeloInnovador:  document.getElementById('sc-innovador')?.checked,
    cotizada:         document.getElementById('sc-cotizada')?.checked,
    neotecPrevio:     document.getElementById('sc-neotec-previo')?.checked,
  };
}

function _buildScoringHTML() {
  const scoring = STATE.scoringResult || scoreFinanciacion(STATE.analysisResult, STATE.scoringInputs || {});
  STATE.scoringResult = scoring;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(460px,1fr));gap:24px;">
    ${_renderProgramaCard('ENISA Emprendedores', '🏦', scoring.enisa, 'var(--cyan)', 'Préstamo participativo hasta 300K€ · Ratio 1:1 capital propio')}
    ${_renderProgramaCard('CDTI Neotec', '🔬', scoring.cdti, 'var(--purple)', 'Subvención + préstamo hasta 250K€ · Proyectos I+D de base tecnológica')}
  </div>`;
}

function _renderProgramaCard(nombre, icon, result, color, desc) {
  const { score, elegible, criterios, alertas } = result;
  const statusColor = elegible ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--red)';
  const statusLabel = elegible ? '✅ ELEGIBLE' : score >= 40 ? '🟡 PARCIAL' : '🔴 NO ELEGIBLE';
  const circ = 2 * Math.PI * 15.9;
  const dash = `${(score / 100) * circ} ${circ}`;

  return `<div class="card">
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;">
      <span style="font-size:2rem;">${icon}</span>
      <div style="flex:1;">
        <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;">${nombre}</div>
        <div style="font-size:0.77rem;color:var(--text-muted);margin-top:3px;">${desc}</div>
      </div>
      <div style="text-align:center;flex-shrink:0;">
        <div style="position:relative;width:72px;height:72px;">
          <svg viewBox="0 0 36 36" style="width:72px;height:72px;transform:rotate(-90deg);">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="${statusColor}" stroke-width="3"
              stroke-dasharray="${dash}" stroke-linecap="round" style="transition:stroke-dasharray 0.6s ease;"/>
          </svg>
          <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <span style="font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:${statusColor};">${score}</span>
          </div>
        </div>
        <div style="font-size:0.7rem;font-weight:700;color:${statusColor};margin-top:4px;">${statusLabel}</div>
      </div>
    </div>
    <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:20px;overflow:hidden;">
      <div style="height:100%;width:${score}%;background:${statusColor};border-radius:2px;transition:width 0.6s ease;"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
      ${criterios.map(c => `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);
          background:${c.ok ? color + '11' : 'rgba(255,255,255,0.02)'};
          border:1px solid ${c.ok ? color + '44' : 'var(--border)'};">
          <span style="font-size:1rem;flex-shrink:0;">${c.ok ? '✅' : c.critico ? '⛔' : '⚠️'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.84rem;font-weight:600;color:${c.ok ? 'var(--text-primary)' : 'var(--text-secondary)'};">
              ${c.label}
              ${c.critico ? '<span style="font-size:0.64rem;color:var(--red);margin-left:6px;padding:1px 5px;border:1px solid var(--red);border-radius:6px;">CRÍTICO</span>' : ''}
            </div>
            <div style="font-size:0.74rem;color:var(--text-muted);margin-top:2px;">${c.detalle}</div>
          </div>
          <div style="font-size:0.8rem;font-weight:700;color:${c.ok ? color : 'var(--text-muted)'};white-space:nowrap;">${c.valor}</div>
        </div>`).join('')}
    </div>
    ${alertas.length > 0 ? `
      <div style="background:rgba(251,191,36,0.08);border:1px solid rgba(251,191,36,0.25);border-radius:var(--radius-sm);padding:12px;">
        <div style="font-size:0.8rem;font-weight:700;color:var(--amber);margin-bottom:8px;">Acciones para mejorar la elegibilidad</div>
        ${alertas.map(a => `<div style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">${a}</div>`).join('')}
      </div>` :
    `<div style="background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.25);border-radius:var(--radius-sm);padding:12px;text-align:center;">
        <span style="font-size:0.85rem;color:var(--green);">🎯 Todos los criterios cumplen los umbrales mínimos</span>
      </div>`}
  </div>`;
}
