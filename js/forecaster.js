/**
 * forecaster.js — Motor de Proyección a 12 Meses
 * Basado en los datos devengados del analysisResult (Fase 1).
 */

// ---- Defaults por perfil ----
const FORECAST_PROFILE_DEFAULTS = {
  saas:       { crecimiento: 5,  churn: 2,   deltaOpex: 1 },
  industrial: { crecimiento: 2,  churn: 0,   deltaOpex: 0.5 },
  servicios:  { crecimiento: 3,  churn: 1,   deltaOpex: 0.8 },
  retail:     { crecimiento: 2,  churn: 0.5, deltaOpex: 1 },
  generico:   { crecimiento: 3,  churn: 1,   deltaOpex: 1 }
};

// ---- Estado de hipótesis (persiste mientras la SPA está abierta) ----
let FORECAST_HYP = null;

function _getDefaultHyp() {
  const profileId = STATE.selectedProfile?.id || 'generico';
  const d = FORECAST_PROFILE_DEFAULTS[profileId] || FORECAST_PROFILE_DEFAULTS.generico;
  return { crecimiento: d.crecimiento, churn: d.churn, deltaOpex: d.deltaOpex, eventos: [] };
}

function _nextMonths(lastMk, n) {
  const [ly, lm] = lastMk.split('-').map(Number);
  const months = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(ly, lm - 1 + i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

// ---- Motor de proyección ----
function buildForecast(data, hyp) {
  const pygMonths = Object.keys(data.pygMensual).sort();
  const n = pygMonths.length;
  const lastN = Math.min(3, n);
  const lastSlice = pygMonths.slice(-lastN);

  const avgIngresos = lastSlice.reduce((s, m) => s + data.pygMensual[m].totalIngresos, 0) / lastN;
  const avgOpex = lastSlice.reduce((s, m) => {
    const mo = data.pygMensual[m];
    return s + mo.personal + mo.marketing + mo.serviciosOperativos + mo.cogs + mo.tributos;
  }, 0) / lastN;

  const cajaInicial = data.totales.cajaFinal;
  const forecastMonths = _nextMonths(pygMonths[pygMonths.length - 1], 12);

  function runScenario(mCrecimiento, mChurn, mOpex) {
    const rows = [];
    let prevIngresos = avgIngresos;
    let prevOpex = avgOpex;
    let caja = cajaInicial;
    for (let i = 0; i < 12; i++) {
      const tCrecimiento = (hyp.crecimiento * mCrecimiento) / 100;
      const tChurn = (hyp.churn * mChurn) / 100;
      const tOpex = (hyp.deltaOpex * mOpex) / 100;
      const ingresos = prevIngresos * (1 + tCrecimiento - tChurn);
      const opex = prevOpex * (1 + tOpex);
      const ebitda = ingresos - opex;
      const evento = (hyp.eventos || []).find(e => e.mes === i + 1);
      const extraCash = evento ? parseFloat(evento.importe) || 0 : 0;
      caja = caja + ebitda + extraCash;
      rows.push({ mes: forecastMonths[i], ingresos, opex, ebitda, caja, eventoDesc: evento?.descripcion || null });
      prevIngresos = ingresos;
      prevOpex = opex;
    }
    return rows;
  }

  const base = runScenario(1, 1, 1);
  const optimista = runScenario(1.5, 0.5, 0.8);
  const pesimista = runScenario(0.5, 1.5, 1.2);

  const breakEvenBase = base.findIndex(r => r.ebitda >= 0);
  const cajaMinBase = base.reduce((min, r) => r.caja < min.caja ? r : min, base[0]);

  const alertas = [];
  if (pesimista.some(r => r.caja < 0)) {
    const mes = pesimista.findIndex(r => r.caja < 0) + 1;
    alertas.push(`⚠ Caja negativa en escenario pesimista a partir del mes ${mes}`);
  }
  if (base.some(r => r.caja < 0)) {
    const mes = base.findIndex(r => r.caja < 0) + 1;
    alertas.push(`🔴 Caja negativa en escenario base a partir del mes ${mes} — acción urgente`);
  }

  return {
    forecastMonths,
    avgIngresos,
    avgOpex,
    cajaInicial,
    scenarios: { base, optimista, pesimista },
    runwayBreakEven: breakEvenBase,
    cajaMinima: { mes: cajaMinBase.mes, valor: cajaMinBase.caja },
    alertas
  };
}

// ---- Renderizador ----
function renderForecast() {
  const root = document.getElementById('forecast-root');
  if (!root) return;

  if (!FORECAST_HYP) FORECAST_HYP = _getDefaultHyp();
  const hyp = FORECAST_HYP;

  if (!STATE.analysisResult) {
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">📈</div>
      <p>Carga y analiza un libro diario para activar el Forecaster.</p></div>`;
    return;
  }

  const fmt = v => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v);

  const result = buildForecast(STATE.analysisResult, hyp);
  STATE.forecastResult = result;
  const { scenarios, forecastMonths, alertas } = result;

  // Escenario activo (persiste con un attr en el DOM)
  const activeScenario = STATE.forecastScenario || 'base';
  const rows = scenarios[activeScenario];
  const scenarioColor = activeScenario === 'base' ? 'var(--cyan)' : activeScenario === 'optimista' ? 'var(--green)' : 'var(--red)';

  root.innerHTML = `
    <!-- ALERTAS -->
    ${alertas.length > 0 ? `
    <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-sm);padding:14px;margin-bottom:20px;display:flex;align-items:flex-start;gap:12px;">
      <span style="font-size:1.3rem;flex-shrink:0;">🚨</span>
      <div>${alertas.map(a => `<div style="font-size:0.85rem;color:var(--red);margin-bottom:4px;">${a}</div>`).join('')}</div>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:300px 1fr;gap:24px;align-items:start;">

      <!-- PANEL IZQUIERDO: Hipótesis -->
      <div class="card">
        <div class="card-title">⚙️ Hipótesis</div>
        <div style="display:flex;flex-direction:column;gap:20px;margin-top:8px;">
          ${_sliderRow('fc-crecimiento', 'Crecimiento mensual ingresos', hyp.crecimiento, 0, 30, 0.5, '%', 'var(--green)')}
          ${_sliderRow('fc-churn', 'Churn / cancelación mensual', hyp.churn, 0, 15, 0.5, '%', 'var(--red)')}
          ${_sliderRow('fc-opex', 'Delta OPEX mensual', hyp.deltaOpex, -5, 10, 0.5, '%', 'var(--amber)')}
        </div>

        <!-- Stats de baseline -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Baseline (media últimos 3 meses)</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="display:flex;justify-content:space-between;font-size:0.82rem;">
              <span style="color:var(--text-secondary);">Ingresos/mes</span>
              <span style="color:var(--cyan);font-weight:600;">${fmt(result.avgIngresos)}€</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.82rem;">
              <span style="color:var(--text-secondary);">OPEX/mes</span>
              <span style="color:var(--red);font-weight:600;">${fmt(result.avgOpex)}€</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.82rem;">
              <span style="color:var(--text-secondary);">Caja inicial</span>
              <span style="color:var(--text-primary);font-weight:600;">${fmt(result.cajaInicial)}€</span>
            </div>
          </div>
        </div>

        <!-- Selector de escenario -->
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);">
          <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:10px;text-transform:uppercase;letter-spacing:0.06em;">Escenario mostrado</div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            ${['base','optimista','pesimista'].map(s => `
              <button data-scenario="${s}" class="btn ${activeScenario===s?'btn-primary':'btn-secondary'} fc-scenario-btn"
                style="width:100%;text-align:left;font-size:0.82rem;padding:8px 12px;">
                ${s==='base'?'📊 Base':s==='optimista'?'🚀 Optimista':'🌧 Pesimista'}
              </button>`).join('')}
          </div>
        </div>

        <button class="btn btn-primary" id="btn-recalcular-forecast" style="width:100%;margin-top:20px;font-size:0.85rem;">
          🔄 Recalcular
        </button>
      </div>

      <!-- PANEL DERECHO: Gráfico + Tabla -->
      <div style="display:flex;flex-direction:column;gap:20px;">

        <!-- Gráfico SVG -->
        <div class="card">
          <div class="card-title">📈 Evolución de Caja — 12 Meses</div>
          ${_buildSVGChart(scenarios, forecastMonths)}
          <div style="display:flex;gap:20px;margin-top:12px;justify-content:center;flex-wrap:wrap;">
            <span style="font-size:0.78rem;color:var(--cyan);display:flex;align-items:center;gap:6px;"><span style="width:20px;height:2px;background:var(--cyan);display:inline-block;"></span>Base</span>
            <span style="font-size:0.78rem;color:var(--green);display:flex;align-items:center;gap:6px;"><span style="width:20px;height:2px;background:var(--green);display:inline-block;border-top:2px dashed var(--green);"></span>Optimista</span>
            <span style="font-size:0.78rem;color:var(--red);display:flex;align-items:center;gap:6px;"><span style="width:20px;height:2px;background:var(--red);display:inline-block;border-top:2px dashed var(--red);"></span>Pesimista</span>
          </div>
        </div>

        <!-- Tabla de proyección -->
        <div class="card">
          <div class="card-title" style="color:${scenarioColor};">
            ${activeScenario==='base'?'📊 Escenario Base':activeScenario==='optimista'?'🚀 Escenario Optimista':'🌧 Escenario Pesimista'} — Proyección mensual
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr>
                <th>Mes</th>
                <th style="text-align:right">Ingresos</th>
                <th style="text-align:right">OPEX</th>
                <th style="text-align:right">EBITDA</th>
                <th style="text-align:right">Caja Acum.</th>
              </tr></thead>
              <tbody>
                ${rows.map(r => {
                  const ebitdaOk = r.ebitda >= 0;
                  const cajaOk   = r.caja >= 0;
                  return `<tr>
                    <td style="font-weight:600;">${r.mes}${r.eventoDesc ? `<br/><span style="font-size:0.68rem;color:var(--amber);">⚡ ${r.eventoDesc}</span>` : ''}</td>
                    <td class="td-num td-credit">${fmt(r.ingresos)}€</td>
                    <td class="td-num td-debit">-${fmt(r.opex)}€</td>
                    <td class="td-num" style="color:${ebitdaOk?'var(--green)':'var(--red)'};">${ebitdaOk?'+':''}${fmt(r.ebitda)}€</td>
                    <td class="td-num" style="font-weight:700;color:${cajaOk?'var(--text-primary)':'var(--red)'};">${cajaOk?'':'-'}${fmt(Math.abs(r.caja))}€</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>`;

  // Event listeners
  root.querySelectorAll('.fc-scenario-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      STATE.forecastScenario = btn.dataset.scenario;
      renderForecast();
    });
  });

  document.getElementById('btn-recalcular-forecast')?.addEventListener('click', () => {
    FORECAST_HYP = {
      crecimiento: parseFloat(document.getElementById('fc-crecimiento')?.value) || 3,
      churn:       parseFloat(document.getElementById('fc-churn')?.value) || 1,
      deltaOpex:   parseFloat(document.getElementById('fc-opex')?.value) || 1,
      eventos: FORECAST_HYP.eventos || []
    };
    STATE.forecastResult = buildForecast(STATE.analysisResult, FORECAST_HYP);
    if (typeof renderChecklist === 'function') renderChecklist();
    renderForecast();
    showToast('Forecast actualizado ✓', 'success');
  });
}

function _sliderRow(id, label, value, min, max, step, unit, color) {
  return `<div>
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <label for="${id}" style="font-size:0.82rem;color:var(--text-secondary);">${label}</label>
      <span id="${id}-val" style="font-size:0.82rem;font-weight:700;color:${color};">${value}${unit}</span>
    </div>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"
      style="width:100%;accent-color:${color};cursor:pointer;"
      oninput="document.getElementById('${id}-val').textContent=this.value+'${unit}'" />
    <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-muted);margin-top:2px;">
      <span>${min}${unit}</span><span>${max}${unit}</span>
    </div>
  </div>`;
}

function _buildSVGChart(scenarios, months) {
  const W = 560, H = 180, PAD = { t: 10, r: 10, b: 30, l: 50 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const allVals = [
    ...scenarios.base.map(r => r.caja),
    ...scenarios.optimista.map(r => r.caja),
    ...scenarios.pesimista.map(r => r.caja)
  ];
  const minV = Math.min(...allVals, 0);
  const maxV = Math.max(...allVals, 1);
  const range = maxV - minV || 1;

  const xScale = i => PAD.l + (i / 11) * iW;
  const yScale = v => PAD.t + iH - ((v - minV) / range) * iH;

  function makePath(data, color, dashed = false) {
    const d = data.map((r, i) => `${i === 0 ? 'M' : 'L'}${xScale(i).toFixed(1)},${yScale(r.caja).toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="none" stroke="${color}" stroke-width="2" ${dashed ? 'stroke-dasharray="5,4"' : ''} stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // Línea de cero
  const y0 = yScale(0);
  const zeroLine = y0 >= PAD.t && y0 <= PAD.t + iH
    ? `<line x1="${PAD.l}" y1="${y0.toFixed(1)}" x2="${W - PAD.r}" y2="${y0.toFixed(1)}" stroke="rgba(255,255,255,0.15)" stroke-width="1" stroke-dasharray="3,3"/>`
    : '';

  // Etiquetas eje Y (3 ticks)
  const fmt = v => {
    const abs = Math.abs(v);
    if (abs >= 1000000) return `${(v / 1000000).toFixed(1)}M€`;
    if (abs >= 1000) return `${(v / 1000).toFixed(0)}k€`;
    return `${v.toFixed(0)}€`;
  };
  const ticks = [minV, (minV + maxV) / 2, maxV];
  const yLabels = ticks.map(v => `
    <text x="${PAD.l - 6}" y="${(yScale(v) + 4).toFixed(1)}" text-anchor="end"
      style="font-size:9px;fill:var(--text-muted);">${fmt(v)}</text>
    <line x1="${PAD.l}" y1="${yScale(v).toFixed(1)}" x2="${W - PAD.r}" y2="${yScale(v).toFixed(1)}"
      stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
  `).join('');

  // Etiquetas eje X (cada 3 meses)
  const xLabels = months
    .filter((_, i) => i % 3 === 0 || i === 11)
    .map((m, _, arr) => {
      const i = months.indexOf(m);
      return `<text x="${xScale(i).toFixed(1)}" y="${(H - 6).toFixed(1)}" text-anchor="middle" style="font-size:9px;fill:var(--text-muted);">${m}</text>`;
    }).join('');

  return `<div style="overflow-x:auto;">
    <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;">
      ${yLabels}
      ${zeroLine}
      ${makePath(scenarios.optimista, 'var(--green)', true)}
      ${makePath(scenarios.pesimista, 'var(--red)', true)}
      ${makePath(scenarios.base, 'var(--cyan)', false)}
      ${xLabels}
    </svg>
  </div>`;
}
