/**
 * app.js — Controlador principal. Navegación SPA, estado global,
 * orquestación de módulos y renderizado de todas las secciones.
 */

// ---- Estado global ----
const STATE = {
  parsedLedger: null,
  analysisResult: null,
  selectedProfile: null,
  customMapping: null,
  extraInputs: {},
  empresa: { nombre: '', sector: '', empleados: 0 },
  scoringInputs: {},
  scoringResult: null,
  forecastResult: null,
  forecastScenario: 'base'
};

// ---- Toast ----
function showToast(msg, type = 'info', ms = 3500) {
  const container = document.getElementById('toast-container');
  const div = document.createElement('div');
  div.className = `toast ${type}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), ms);
}

// ---- Navegación SPA ----
function navigate(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('section-' + sectionId);
  const nav = document.getElementById('nav-' + sectionId);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');

  // Renderizar sección si tiene datos
  if (sectionId === 'dashboard' && STATE.analysisResult) renderDashboard();
  if (sectionId === 'scoring') renderScorer();
  if (sectionId === 'forecast') renderForecast();
  if (sectionId === 'defensa') renderDefensa();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.section));
});

// ---- DROP ZONE ---- 
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

// ---- Perfil ----
function renderProfileGrid() {
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = BUSINESS_PROFILES.map(p => `
    <div class="profile-card" data-profile="${p.id}" role="button" tabindex="0" aria-label="Perfil ${p.name}">
      <span class="profile-icon">${p.icon}</span>
      <div class="profile-name">${p.name}</div>
      <div class="profile-desc">${p.desc}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.profile-card').forEach(card => {
    card.addEventListener('click', () => selectProfile(card.dataset.profile));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter') selectProfile(card.dataset.profile);
    });
  });
}

function selectProfile(profileId) {
  STATE.selectedProfile = BUSINESS_PROFILES.find(p => p.id === profileId);
  document.querySelectorAll('.profile-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.profile === profileId);
  });
  document.getElementById('empresa-form').style.display = 'flex';
  document.getElementById('btn-analizar').disabled = false;
}

// ---- Manejo de archivo ----
async function handleFile(file) {
  if (!file.name.match(/\.xlsx?$/i)) {
    showToast('Solo se aceptan archivos .xlsx', 'error');
    return;
  }

  // Mostrar selector de perfil
  document.getElementById('profile-selector').style.display = 'block';
  renderProfileGrid();

  // Reset
  document.getElementById('parse-progress').classList.remove('show');
  document.getElementById('parse-summary').classList.remove('show');
  document.getElementById('preview-section').style.display = 'none';
  document.getElementById('anomaly-section').style.display = 'none';
  document.getElementById('goto-mapping-bar').style.display = 'none';
  document.getElementById('mapping-section').style.display = 'none';

  showToast(`Archivo "${file.name}" listo. Selecciona el perfil de empresa.`, 'info');

  // Guardar archivo para cuando el usuario pulse Analizar
  STATE._pendingFile = file;
}

// ---- PASO 1: Analizar y Extraer ----
document.getElementById('btn-analizar').addEventListener('click', async () => {
  if (!STATE._pendingFile) return;
  if (!STATE.selectedProfile) {
    showToast('Selecciona un perfil de empresa primero', 'error');
    return;
  }

  // Capturar datos empresa
  STATE.empresa.nombre    = document.getElementById('input-empresa-nombre').value || STATE._pendingFile.name;
  STATE.empresa.sector    = document.getElementById('input-empresa-sector').value || '';
  STATE.empresa.empleados = parseInt(document.getElementById('input-empresa-empleados').value) || 0;

  document.getElementById('btn-analizar').disabled = true;

  const progress = document.getElementById('parse-progress');
  const bar = document.getElementById('progress-bar');
  const pctLabel = document.getElementById('progress-pct');
  const txtLabel = document.getElementById('progress-text');
  const logEl = document.getElementById('parse-log');

  progress.classList.add('show');
  logEl.innerHTML = '';

  try {
    const parsed = await parseLedgerFile(STATE._pendingFile, ({ pct, text, log }) => {
      if (pct !== undefined) {
        bar.style.width = pct + '%';
        pctLabel.textContent = pct + '%';
      }
      if (text) txtLabel.textContent = text;
      if (log) {
        const [type, msg] = log.split('|');
        const span = document.createElement('div');
        span.className = `log-${type === 'ok' ? 'ok' : type === 'warn' ? 'warn' : 'err'}`;
        span.textContent = (type === 'ok' ? '✓ ' : type === 'warn' ? '⚠ ' : '✗ ') + (msg || log);
        logEl.appendChild(span);
        logEl.scrollTop = logEl.scrollHeight;
      }
    });

    STATE.parsedLedger = parsed;

    // Actualizar badge empresa (temporalmente hasta el dashboard)
    const nombre = STATE.empresa.nombre || parsed.meta.fileName;
    document.getElementById('empresa-badge').textContent =
      `${nombre} · ${STATE.selectedProfile.icon} ${STATE.selectedProfile.name}`;

    // Mostrar resumen del parseo
    renderParseSummary(parsed);
    renderAnomalies(parsed.anomalies);
    renderPreviewTable(parsed.entries.slice(0, 50));

    // Mostrar botón para el paso 2
    document.getElementById('goto-mapping-bar').style.display = 'block';
    
    // Auto scroll para que sea evidente
    document.getElementById('goto-mapping-bar').scrollIntoView({ behavior: 'smooth', block: 'center' });

    showToast('Ingesta completada ✓. Pasa al mapeo manual.', 'success');

  } catch (err) {
    console.error(err);
    showToast('Error al procesar el archivo: ' + err.message, 'error', 6000);
    const span = document.createElement('div');
    span.className = 'log-err';
    span.textContent = '✗ Error: ' + err.message;
    logEl.appendChild(span);
  } finally {
    document.getElementById('btn-analizar').disabled = false;
  }
});

// ---- Render: Parse Summary ----
function renderParseSummary(parsed) {
  const s = document.getElementById('parse-summary');
  s.classList.add('show');

  // En el resumen ahora solo enseñamos datos de volumen (aún no se han analizado ingresos/gastos exactos)
  document.getElementById('sum-meses').textContent     = parsed.meta.months.length;
  document.getElementById('sum-asientos').textContent  = parsed.meta.totalEntries.toLocaleString('es-ES');
  document.getElementById('sum-cuentas').textContent   = parsed.meta.totalCuentas;
  document.getElementById('sum-ingresos').textContent  = '—'; // Se calculará en el Dashboard
  document.getElementById('sum-gastos').textContent    = '—'; // Se calculará en el Dashboard
  document.getElementById('sum-anomalias').textContent = parsed.anomalies.length;
}

// ---- Render: Anomalías ----
function renderAnomalies(anomalies) {
  const sec = document.getElementById('anomaly-section');
  const list = document.getElementById('anomaly-list');
  if (!anomalies.length) { sec.style.display = 'none'; return; }
  sec.style.display = 'block';
  list.innerHTML = anomalies.map(a => `
    <div class="anomaly-item sev-${a.severity === 'high' ? 'high' : a.severity === 'medium' ? 'medium' : 'low'}">
      <span class="anomaly-icon">${a.severity === 'high' ? '🔴' : a.severity === 'medium' ? '🟡' : '🟢'}</span>
      <div>
        <strong>${a.message}</strong>
        <div style="opacity:0.8;margin-top:2px;">${a.detail}</div>
      </div>
    </div>
  `).join('');
}

// ---- Render: Preview Table ----
function renderPreviewTable(entries) {
  const sec = document.getElementById('preview-section');
  const tbody = document.getElementById('preview-tbody');
  sec.style.display = 'block';
  tbody.innerHTML = entries.map(e => `
    <tr>
      <td>${e.monthKey}</td>
      <td>${e.fecha || '—'}</td>
      <td>${e.asiento || '—'}</td>
      <td><code style="font-size:0.8em;color:var(--cyan)">${e.cuenta}</code></td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${e.descripcion}">${e.descripcion || '—'}</td>
      <td class="td-num ${e.debe > 0 ? 'td-debit' : ''}">${e.debe > 0 ? e.debe.toLocaleString('es-ES', {minimumFractionDigits:2}) : '—'}</td>
      <td class="td-num ${e.haber > 0 ? 'td-credit' : ''}">${e.haber > 0 ? e.haber.toLocaleString('es-ES', {minimumFractionDigits:2}) : '—'}</td>
    </tr>
  `).join('');
}

// ---- PASO 2: Mapeo Humano ----
document.getElementById('btn-goto-mapping').addEventListener('click', () => {
  document.getElementById('goto-mapping-bar').style.display = 'none';
  const mappingSec = document.getElementById('mapping-section');
  mappingSec.style.display = 'block';
  
  renderMappingTable();
  mappingSec.scrollIntoView({ behavior: 'smooth' });
});

function renderMappingTable() {
  const entries = STATE.parsedLedger.entries;
  
  // Extraer cuentas únicas y sus descripciones base
  const accInfo = {};
  for (const e of entries) {
    if (!accInfo[e.cuenta]) {
      accInfo[e.cuenta] = { cuenta: e.cuenta, desc: e.descripcion, saldoNeto: 0, grupo: e.grupo };
    }
    // Ingresos: Haber - Debe. Gastos: Debe - Haber
    const isIngreso = e.grupo === '7';
    accInfo[e.cuenta].saldoNeto += isIngreso ? (e.haber - e.debe) : (e.debe - e.haber);
  }

  const uniqueCuentas = Object.keys(accInfo);
  // Inicializamos el mapeo default
  if (!STATE.customMapping) {
    STATE.customMapping = getDefaultMapping(uniqueCuentas, STATE.selectedProfile.id);
  }

  // Filtrar para mostrar sólo grupos 6 y 7 (PyG) con saldo relevante
  const cuentasPyg = Object.values(accInfo)
    .filter(a => (a.grupo === '6' || a.grupo === '7') && Math.abs(a.saldoNeto) > 10)
    .sort((a, b) => Math.abs(b.saldoNeto) - Math.abs(a.saldoNeto)); // Mayor a menor

  const tbody = document.getElementById('mapping-tbody');
  
  // Opciones del select a partir de CATEGORIAS_ANALITICAS
  const optionsHtml = Object.entries(CATEGORIAS_ANALITICAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

  tbody.innerHTML = cuentasPyg.map(cta => {
    const currCategory = STATE.customMapping[cta.cuenta] || 'ignorar';
    const isIngreso = cta.grupo === '7';
    const colorClass = isIngreso ? 'td-credit' : 'td-debit';
    
    return `
      <tr>
        <td><code style="color:var(--cyan);font-weight:bold;">${cta.cuenta}</code></td>
        <td style="max-width:250px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${cta.desc}">
          ${cta.desc || '—'}
        </td>
        <td class="td-num ${colorClass}" style="font-weight:600;">
          ${cta.saldoNeto.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})}
        </td>
        <td>
          <select data-cuenta="${cta.cuenta}" class="mapping-select" style="width:100%; padding:8px; background:var(--bg-surface); color:var(--text-primary); border:1px solid var(--border); border-radius:4px;">
            ${optionsHtml}
          </select>
        </td>
      </tr>
    `;
  }).join('');

  // Establecer los valores guardados
  document.querySelectorAll('.mapping-select').forEach(sel => {
    const cta = sel.dataset.cuenta;
    sel.value = STATE.customMapping[cta] || 'ignorar';
    
    // Listener para actualizar el diccionario si cambian la opción
    sel.addEventListener('change', (e) => {
      STATE.customMapping[cta] = e.target.value;
    });
  });

  // Mostrar botón para ir al paso 3 (Periodificaciones)
  document.getElementById('goto-accruals-bar').style.display = 'block';
}

// ---- PASO 3: Periodificaciones (Devengo) ----
document.getElementById('btn-goto-accruals').addEventListener('click', () => {
  document.getElementById('goto-accruals-bar').style.display = 'none';
  const accrualSec = document.getElementById('accruals-section');
  accrualSec.style.display = 'block';
  
  renderAccrualsTable();
  accrualSec.scrollIntoView({ behavior: 'smooth' });
});

function renderAccrualsTable() {
  // Detectar candidatos basados en el mapeo personalizado recién aprobado
  const candidates = detectAccrualCandidates(
    STATE.parsedLedger.entries,
    STATE.customMapping,
    STATE.parsedLedger.meta.months
  );

  STATE.accrualCandidates = candidates;
  STATE.approvedAccruals = []; // Limpiamos

  const emptyState = document.getElementById('accruals-empty');
  const contentState = document.getElementById('accruals-content');
  const tbody = document.getElementById('accruals-tbody');

  if (candidates.length === 0) {
    emptyState.style.display = 'block';
    contentState.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    contentState.style.display = 'block';
    
    tbody.innerHTML = candidates.map((c, i) => `
      <tr>
        <td style="text-align:center;">
          <input type="checkbox" class="accrual-checkbox" data-index="${i}" style="width:18px;height:18px;accent-color:var(--cyan);cursor:pointer;" />
        </td>
        <td><code style="color:var(--cyan);font-weight:bold;">${c.cuenta}</code></td>
        <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${c.descripcion}">${c.descripcion}</td>
        <td>${c.mesOrigen}</td>
        <td class="td-num td-debit" style="font-weight:600;">${c.importeTotal.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
        <td class="td-num td-credit" style="font-weight:600;">${c.importeMensual.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
      </tr>
    `).join('');

    // Listeners
    document.querySelectorAll('.accrual-checkbox').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const idx = e.target.dataset.index;
        const cand = STATE.accrualCandidates[idx];
        if (e.target.checked) {
          STATE.approvedAccruals.push(cand);
        } else {
          STATE.approvedAccruals = STATE.approvedAccruals.filter(a => a.cuenta !== cand.cuenta);
        }
      });
    });
  }
}

// ---- PASO 4: Goto Dashboard ----
document.getElementById('btn-goto-dashboard').addEventListener('click', () => {
  // Ejecutamos el analysis final con el custom mapping y los devengos aprobados
  STATE.analysisResult = analyzeLedger(
    STATE.parsedLedger, 
    STATE.selectedProfile.id, 
    STATE.customMapping,
    STATE.approvedAccruals || []
  );
  
  // Flag para el checklist
  STATE.accrualsReviewed = true;

  // Pre-calcular scoring con defaults (inputs vacíos) para que el tab ya tenga datos
  STATE.scoringResult = scoreFinanciacion(STATE.analysisResult, STATE.scoringInputs || {});

  // Pre-calcular forecast con defaults del perfil seleccionado
  if (typeof buildForecast === 'function') {
    FORECAST_HYP = null; // reset para que _getDefaultHyp() use el perfil actual
    STATE.forecastResult = buildForecast(STATE.analysisResult, _getDefaultHyp());
  }
  
  // Actualizamos sum-ingresos y sum-gastos en el step 1 por completitud (opcional pero queda bien)
  document.getElementById('sum-ingresos').textContent =
    new Intl.NumberFormat('es-ES', {maximumFractionDigits:0}).format(STATE.analysisResult.totales.ingresos) + '€';
  document.getElementById('sum-gastos').textContent =
    new Intl.NumberFormat('es-ES', {maximumFractionDigits:0}).format(STATE.analysisResult.totales.gastos) + '€';

  showToast('Dashboard analítico generado', 'success');
  navigate('dashboard');
});

// ---- Render: Dashboard ----
function renderDashboard() {
  if (!STATE.analysisResult) return;
  const data = STATE.analysisResult;
  const profile = STATE.selectedProfile;

  const title = document.getElementById('dashboard-title');
  const subtitle = document.getElementById('dashboard-subtitle');
  const empresa = STATE.empresa.nombre || data.meta.fileName;

  title.textContent = `Dashboard — ${empresa}`;
  subtitle.textContent = `${profile?.name || 'Genérico'} · Periodo: ${data.meta.months[0]} → ${data.meta.months[data.meta.months.length - 1]}`;

  document.getElementById('dashboard-empty').style.display = 'none';
  document.getElementById('dashboard-content').style.display = 'block';

  // KPIs universales
  const kpiUniversalEl = document.getElementById('kpi-universal');
  kpiUniversalEl.innerHTML = UNIVERSAL_KPIS.map(kpi => {
    const value = kpi.compute(data);
    const status = getKpiStatus(kpi, value);
    const formatted = formatKpiValue(value, kpi.format);
    const pulseClass = (kpi.id === 'runway' && value !== null && value < 3) ? 'pulse-danger' : '';
    return `
      <div class="kpi-card status-${status} ${pulseClass}" title="${kpi.desc}">
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value">${formatted}</div>
        <div class="kpi-sub">${kpi.desc}</div>
        <div class="kpi-status">${getStatusIcon(status)}</div>
      </div>
    `;
  }).join('');

  // KPIs del perfil
  const perfilKpis = profile?.kpis || [];
  const kpiPerfilSection = document.getElementById('kpi-perfil-section');
  if (perfilKpis.length > 0) {
    kpiPerfilSection.style.display = 'block';
    document.getElementById('kpi-perfil-title').textContent = `KPIs ${profile.name}`;
    const kpiPerfilEl = document.getElementById('kpi-perfil');
    const kpiResults = {};

    kpiPerfilEl.innerHTML = perfilKpis.map(kpi => {
      const value = kpi.compute(data, kpiResults, STATE.extraInputs);
      kpiResults[kpi.id] = value;
      const status = getKpiStatus(kpi, value);
      const formatted = formatKpiValue(value, kpi.format);
      return `
        <div class="kpi-card status-${status}" title="${kpi.desc}">
          <div class="kpi-label">${kpi.label}</div>
          <div class="kpi-value">${formatted}</div>
          <div class="kpi-sub">${kpi.desc}</div>
          <div class="kpi-status">${getStatusIcon(status)}</div>
        </div>
      `;
    }).join('');
  } else {
    kpiPerfilSection.style.display = 'none';
  }

  // PyG mensual
  renderPyG(data.pygMensual);
}

function renderPyG(pygMensual) {
  const months = Object.keys(pygMensual).sort();
  const head = document.getElementById('pyg-head');
  const body = document.getElementById('pyg-body');

  head.innerHTML = '<th>Partida</th>' + months.map(m => `<th style="text-align:right">${m}</th>`).join('') + '<th style="text-align:right">TOTAL</th>';

  const rows = [
    { key: 'ventas',            label: '📥 Ventas / Servicios' },
    { key: 'otrosIngresos',     label: '   Otros ingresos' },
    { key: 'totalIngresos',     label: '▶ Total Ingresos', bold: true, color: 'var(--cyan)' },
    { key: 'cogs',              label: '   (-) COGS', negate: true },
    { key: 'margenBruto',       label: '▶ Margen Bruto', bold: true },
    { key: 'personal',          label: '   (-) Personal', negate: true },
    { key: 'marketing',         label: '   (-) Marketing', negate: true },
    { key: 'serviciosOperativos', label: '   (-) Servicios Op.', negate: true },
    { key: 'tributos',          label: '   (-) Tributos', negate: true },
    { key: 'ebitda',            label: '▶ EBITDA', bold: true, color: 'var(--amber)' },
    { key: 'amortizacion',      label: '   (-) Amortización', negate: true },
    { key: 'ebit',              label: '▶ EBIT', bold: true },
    { key: 'gastosFinancieros', label: '   (-) Gtos. Financieros', negate: true },
    { key: 'resultadoNeto',     label: '▶ Resultado Neto', bold: true, color: 'var(--green)' }
  ];

  const fmt = (v) => v != null
    ? new Intl.NumberFormat('es-ES', {minimumFractionDigits:0, maximumFractionDigits:0}).format(v)
    : '—';

  body.innerHTML = rows.map(row => {
    let vals = months.map(m => pygMensual[m]?.[row.key] ?? 0);
    let total = vals.reduce((s, v) => s + v, 0);
    
    if (row.negate) {
      vals = vals.map(v => -Math.abs(v));
      total = -Math.abs(total);
    }
    
    const style = row.bold
      ? `font-weight:600;color:${row.color || 'var(--text-primary)'};border-top:1px solid var(--border);`
      : 'color:var(--text-secondary);';

    return `<tr>
      <td style="${style}">${row.label}</td>
      ${vals.map(v => `<td class="td-num" style="${style}${v < 0 ? 'color:var(--red)' : ''}">${fmt(v)}</td>`).join('')}
      <td class="td-num" style="${style}font-weight:700;${total < 0 ? 'color:var(--red)' : ''}">${fmt(total)}</td>
    </tr>`;
  }).join('');
}

// ---- Render: Defensa ----
function renderDefensa() {
  const root = document.getElementById('defensa-root');
  const preguntas = [
    {
      pregunta: '¿Por qué recomendáis ENISA Emprendedores y no ENISA Crecimiento?',
      respuesta: 'ENISA Crecimiento exige más de 2 ejercicios fiscales cerrados y evolución positiva de fondos propios en los dos últimos. Una empresa con menos de 24 meses solo tiene un ejercicio cerrado. Además, con burn rate elevado, los fondos propios de 2025 estarán mermados hasta que entre la ronda puente. ENISA Emprendedores financia hasta 300.000€ en proporción 1:1 y es la línea correcta para empresas en primeras fases.'
    },
    {
      pregunta: '¿Cómo calculáis el Runway con un burn rate variable?',
      respuesta: 'Usamos el burn rate neto promedio de los últimos 3 meses (no del total histórico) para reflejar la tendencia reciente. Runway = Caja Disponible / Burn Rate Neto Promedio mensual. Si el burn está acelerándose, lo indicamos con una alerta roja antes de los 6 meses.'
    },
    {
      pregunta: '¿Cómo justificáis las amortizaciones faltantes?',
      respuesta: 'Al detectar meses sin amortización donde otros sí la registran, se documenta como ajuste contable. En el cierre analítico se periodifica la amortización correctamente según el cuadro de inmovilizado (activos × tasa lineal). Esto se anota en la pestaña de "Ajustes y Errores Detectados" del entregable.'
    },
    {
      pregunta: '¿Qué diferencia hay entre el EBITDA operativo y el resultado neto?',
      respuesta: 'El EBITDA excluye amortizaciones (que no son salida de caja) e intereses y impuestos. Mide la rentabilidad operativa pura del negocio. El resultado neto incluye todos esos conceptos. Para una startup con préstamos ENISA, la diferencia entre EBITDA y resultado neto es precisamente los intereses del préstamo participativo.'
    },
    {
      pregunta: '¿Por qué el Burn Multiple es la métrica clave y no solo el Burn Rate?',
      respuesta: 'El Burn Rate solo dice cuánto se gasta. El Burn Multiple (Net Burn / New ARR) dice cuánto cuesta cada euro de nuevo crecimiento. Un Burn Multiple > 2x indica ineficiencia estructural: la empresa gasta más de 2€ para generar 1€ de nuevo ingreso recurrente. Para un inversor o un banco, esta es la métrica que determina si el negocio es escalable o no.'
    },
    {
      pregunta: '¿Qué bonificaciones de SS aplican para una startup tech?',
      respuesta: 'Bonificación del 40% de contingencias comunes (≈23,6% del salario bruto) para personal investigador dedicado al 100% a I+D+i, grupos de cotización 1 a 4. Compatible con deducciones fiscales por I+D si se tiene el sello Pyme Innovadora. Requiere Informe Motivado si aplica a 10 o más trabajadores. Ahorro estimado: 1.500-2.500€/mes para una plantilla tech de 5-8 personas.'
    }
  ];

  const data = STATE.analysisResult;
  const memoriaRapida = data ? `
    <div class="card" style="margin-bottom:24px;">
      <div class="card-title">⚡ Datos de Memoria Rápida — Último Análisis</div>
      <div class="kpi-grid" style="margin-top:0;">
        <div class="kpi-card"><div class="kpi-label">Empresa</div><div class="kpi-value" style="font-size:1rem;">${STATE.empresa.nombre || '—'}</div></div>
        <div class="kpi-card"><div class="kpi-label">Caja Final</div><div class="kpi-value">${new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(data.totales.cajaFinal)}€</div></div>
        <div class="kpi-card"><div class="kpi-label">Burn Rate Neto/mes</div><div class="kpi-value">${new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(data.totales.burnRateNeto)}€</div></div>
        <div class="kpi-card"><div class="kpi-label">EBITDA Total</div><div class="kpi-value">${new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(data.totales.ebitda)}€</div></div>
      </div>
    </div>
  ` : '';

  root.innerHTML = memoriaRapida + `
    <div class="card">
      <div class="card-title">🎯 Preguntas Trampa — Acordeón de Práctica</div>
      <p style="font-size:0.83rem;color:var(--text-muted);margin-bottom:16px;">Haz clic en cada pregunta para ver la respuesta. Practica respondiendo antes de revelarla.</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${preguntas.map((p, i) => `
          <details style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;">
            <summary style="cursor:pointer;font-weight:600;color:var(--text-primary);font-size:0.9rem;list-style:none;display:flex;justify-content:space-between;align-items:center;">
              ${p.pregunta}
              <span style="color:var(--cyan);font-size:0.75rem;flex-shrink:0;margin-left:12px;">ver respuesta ▸</span>
            </summary>
            <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);color:var(--text-secondary);font-size:0.87rem;line-height:1.7;">
              ${p.respuesta}
            </div>
          </details>
        `).join('')}
      </div>
    </div>
  `;
}

// ---- Init ----
renderDefensa();

// Inicializar módulos si existen
if (typeof renderChecklist === 'function') renderChecklist();
if (typeof renderKnowledge === 'function') renderKnowledge();
