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
  forecastScenario: 'base',
  auditTrail: []
};

/** Registro de evento en Audit Trail */
function logAudit(action, detail = '') {
  STATE.auditTrail.push({
    ts: new Date().toISOString(),
    action,
    detail
  });
}

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
/**
 * navigate(sectionId)
 * @description Transición visual entre secciones de la Single Page Application (SPA).
 * Oculta todas las secciones y muestra la seleccionada, actualizando la barra de navegación.
 * @param {string} sectionId - El ID de la sección a mostrar (ej. 'dashboard', 'scoring').
 * @returns {void}
 */
function navigate(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('section-' + sectionId);
  const nav = document.getElementById('nav-' + sectionId);
  if (sec) sec.classList.add('active');
  if (nav) nav.classList.add('active');

  // Control de botones de exportación superior
  const btnExportPdf = document.getElementById('btn-export-pdf');
  const btnExportExcel = document.getElementById('btn-export-excel');
  const exportSep = document.getElementById('export-sep');
  
  if (STATE.analysisResult && (sectionId === 'dashboard' || sectionId === 'forecast' || sectionId === 'scoring')) {
    if (btnExportPdf) btnExportPdf.style.display = 'block';
    if (btnExportExcel) btnExportExcel.style.display = 'block';
    if (exportSep) exportSep.style.display = 'block';
  } else {
    if (btnExportPdf) btnExportPdf.style.display = 'none';
    if (btnExportExcel) btnExportExcel.style.display = 'none';
    if (exportSep) exportSep.style.display = 'none';
  }

  // Renderizar sección si tiene datos
  if (sectionId === 'dashboard' && STATE.analysisResult) renderDashboard();
  if (sectionId === 'scoring') renderScorer();
  if (sectionId === 'forecast') renderForecast();
  if (sectionId === 'defensa') renderDefensa();
}

document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.section));
});

// Prevent global accidental drops from opening the file
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => e.preventDefault());

// ---- DROP ZONE ---- 
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');

dropzone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropzone.classList.add('drag-over');
});
dropzone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropzone.classList.remove('drag-over');
});
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropzone.classList.remove('drag-over');
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleFile(e.dataTransfer.files[0]);
  }
});
dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fileInput.click();
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleFile(e.target.files[0]);
  }
});

// ---- Perfil ----
/**
 * renderProfileGrid()
 * @description Dibuja en el DOM las tarjetas de selección de perfil de negocio (SaaS, Industrial, etc.).
 * @returns {void}
 */
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
/**
 * handleFile(file)
 * @description Punto de entrada principal para el archivo Excel. Valida la extensión, invoca el parser 
 * asíncrono y, si tiene éxito, actualiza la interfaz mostrando el resumen del parseo y las anomalías.
 * @param {File} file - El archivo Excel (.xlsx) arrastrado o seleccionado por el usuario.
 * @returns {Promise<void>}
 */
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
    logAudit('Archivo cargado', `${parsed.meta.fileName} · ${parsed.meta.totalEntries} asientos · ${parsed.meta.months.length} meses · ${parsed.anomalies.length} anomalías parser`);

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
  list.innerHTML = anomalies.map(a => {
    let sevClass = a.severity;
    if (!['critical', 'high', 'medium', 'low'].includes(sevClass)) sevClass = 'low';
    let icon = '🟢';
    if (a.severity === 'critical') icon = '⛔';
    else if (a.severity === 'high') icon = '🔴';
    else if (a.severity === 'medium') icon = '🟡';
    
    return `
    <div class="anomaly-item sev-${sevClass}">
      <span class="anomaly-icon">${icon}</span>
      <div>
        <strong>${a.message}</strong>
        <div style="opacity:0.8;margin-top:2px;">${a.detail}</div>
      </div>
    </div>
  `}).join('');
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
  // Bloquear navegación si hay anomalías críticas
  if (STATE.parsedLedger && STATE.parsedLedger.anomalies) {
    const hasCritical = STATE.parsedLedger.anomalies.some(a => a.severity === 'critical');
    if (hasCritical) {
      showToast('⚠️ Acceso bloqueado: Existen anomalías CRÍTICAS (ej. Asientos desbalanceados) que invalidan el análisis.', 'error', 6000);
      return;
    }
  }

  // Ejecutamos el analysis final con el custom mapping y los devengos aprobados
  STATE.analysisResult = analyzeLedger(
    STATE.parsedLedger, 
    STATE.selectedProfile.id, 
    STATE.customMapping,
    STATE.approvedAccruals || []
  );
  
  // Flag para el checklist
  STATE.accrualsReviewed = true;

  // Audit trail
  const remappedCount = STATE.customMapping ? Object.keys(STATE.customMapping).length : 0;
  const accrualCount = (STATE.approvedAccruals || []).length;
  logAudit('Perfil seleccionado', `${STATE.selectedProfile.name} (${STATE.selectedProfile.id})`);
  if (remappedCount > 0) logAudit('Remapeo manual', `${remappedCount} cuentas reclasificadas`);
  if (accrualCount > 0) logAudit('Devengos aprobados', `${accrualCount} periodificaciones aplicadas`);
  logAudit('Dashboard generado', `Trust Score: ${STATE.analysisResult.meta.trustScore}/100 · EBITDA Suspect: ${STATE.analysisResult.totales.ebitdaSuspect ? 'SÍ' : 'NO'}`);

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

  // Trust Score
  renderTrustScore(data.meta.trustScore || 0);

  // Audit Trail
  renderAuditTrail();

  // Hallazgos Accionables
  renderActionableFindings(STATE.parsedLedger?.anomalies || []);

  // Waterfall y Narrative
  renderWaterfall(data);
  if (typeof renderNarrative === 'function') renderNarrative();

  // KPIs universales
  const kpiUniversalEl = document.getElementById('kpi-universal');
  kpiUniversalEl.innerHTML = UNIVERSAL_KPIS.map(kpi => {
    const value = kpi.compute(data);
    let status = getKpiStatus(kpi, value);
    const formatted = formatKpiValue(value, kpi.format);
    let pulseClass = (kpi.id === 'runway' && value !== null && value < 3) ? 'pulse-danger' : '';
    let desc = kpi.desc;

    // Lógica para EBITDA Sospechoso
    if (kpi.id === 'ebitda' && data.totales.ebitdaSuspect) {
      status = 'danger';
      pulseClass = 'pulse-danger';
      desc = '⚠️ EBITDA Sospechoso: Anomalías graves invalidan la integridad de esta métrica.';
    }

    return `
      <div class="kpi-card status-${status} ${pulseClass}" title="${desc}">
        <div class="kpi-label">${kpi.label}</div>
        <div class="kpi-value">${formatted}</div>
        <div class="kpi-sub" style="${(kpi.id === 'ebitda' && data.totales.ebitdaSuspect) ? 'color: var(--danger)' : ''}">${desc}</div>
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
/**
 * renderDefensa()
 * @description Renderiza la pestaña "Defensa Board", proporcionando al CFO preguntas de entrenamiento 
 * basadas en debilidades comunes de los modelos de negocio.
 * @returns {void}
 */
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

// ---- Render: Waterfall Chart ----
/**
 * renderWaterfall(data)
 * @description Construye y renderiza un gráfico SVG nativo (Waterfall / Cascada) que visualiza la 
 * transformación desde los Ingresos Totales hasta la Caja Final.
 * @param {Object} data - Objeto AnalysisResult completo calculado por analyzer.js.
 * @returns {void}
 */
function renderWaterfall(data) {
  const container = document.getElementById('waterfall-container');
  if (!container) return;

  const t = data.totales;
  const ingresos = t.ingresos;
  const cogs = t.cogs;
  const margenBruto = ingresos - cogs;
  
  // Separar personal del resto del OPEX
  const personalTotal = Object.values(data.pygMensual).reduce((s, m) => s + m.personal, 0);
  const opexOperativo = t.gastos - t.cogs - (t.amortizacion || 0) - (t.gastosFinancieros || 0);
  const restoOpex = opexOperativo - personalTotal;
  const ebitda = t.ebitda;

  const steps = [
    { label: 'Ingresos', val: ingresos, type: 'total', color: 'var(--green)' },
    { label: 'COGS', val: -cogs, type: 'diff', color: 'var(--red)' },
    { label: 'Margen Bruto', val: margenBruto, type: 'subtotal', color: 'var(--cyan)' },
    { label: 'Personal', val: -personalTotal, type: 'diff', color: 'var(--amber)' },
    { label: 'Resto OPEX', val: -restoOpex, type: 'diff', color: 'var(--red)' },
    { label: 'EBITDA', val: ebitda, type: 'final', color: ebitda >= 0 ? 'var(--green)' : 'var(--red)' }
  ];

  const maxVal = Math.max(ingresos, margenBruto, ebitda) * 1.1; // 10% margen superior
  const minVal = Math.min(0, ebitda) * 1.1;
  const range = maxVal - minVal || 1;

  const W = 800, H = 220;
  const PAD = { t: 20, r: 20, b: 30, l: 60 };
  const iW = W - PAD.l - PAD.r;
  const iH = H - PAD.t - PAD.b;

  const yScale = v => PAD.t + iH - ((v - minVal) / range) * iH;
  const y0 = yScale(0); // linea base cero

  const barWidth = (iW / steps.length) * 0.7;
  const gap = (iW / steps.length) * 0.3;

  let currentY = y0;
  let svgContent = '';

  const fmt = v => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v) + '€';

  steps.forEach((s, i) => {
    const x = PAD.l + i * (barWidth + gap) + gap/2;
    let y, h;

    if (s.type === 'total' || s.type === 'subtotal' || s.type === 'final') {
      y = yScale(Math.max(0, s.val));
      h = Math.abs(yScale(s.val) - y0);
      currentY = yScale(s.val); // actualizar base para los diffs
    } else { // diff
      if (s.val < 0) {
        y = currentY; 
        h = yScale(s.val) - yScale(0); // el tamaño del salto hacia abajo
        currentY = y + h; // bajar la base
      } else {
        h = yScale(0) - yScale(s.val);
        y = currentY - h;
        currentY = y;
      }
    }

    svgContent += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${h || 1}" fill="${s.color}" rx="2" />
      <text x="${x + barWidth/2}" y="${y - 6}" text-anchor="middle" style="font-size:10px;fill:var(--text-primary);font-weight:600;">${s.type === 'diff' && s.val > 0 ? '+' : ''}${fmt(s.val)}</text>
      <text x="${x + barWidth/2}" y="${H - 10}" text-anchor="middle" style="font-size:10px;fill:var(--text-muted);">${s.label}</text>
    `;

    // Linea conectora
    if (i < steps.length - 1 && s.type !== 'subtotal' && steps[i+1].type !== 'subtotal' && steps[i+1].type !== 'final') {
      const nextX = x + barWidth;
      svgContent += `<line x1="${nextX}" y1="${currentY}" x2="${nextX + gap}" y2="${currentY}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="2,2"/>`;
    }
  });

  // Zero line
  if (y0 >= PAD.t && y0 <= PAD.t + iH) {
    svgContent += `<line x1="${PAD.l}" y1="${y0}" x2="${W - PAD.r}" y2="${y0}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>`;
  }

  container.innerHTML = `
    <div class="card" style="padding-bottom:12px;">
      <div class="card-title">🌉 Cascada de Rentabilidad (Periodo Acumulado)</div>
      <div style="overflow-x:auto;">
        <svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;display:block;margin:0 auto;">
          ${svgContent}
        </svg>
      </div>
    </div>
  `;
}

// ---- Render: Trust Score ----
function renderTrustScore(score) {
  const el = document.getElementById('trust-score-value');
  const statusEl = document.getElementById('trust-score-status');
  if (!el || !statusEl) return;

  el.textContent = score;

  let color, label;
  if (score >= 80) { color = 'var(--green, #22c55e)'; label = 'Alta Fiabilidad'; }
  else if (score >= 50) { color = 'var(--amber, #f59e0b)'; label = 'Fiabilidad Media'; }
  else { color = 'var(--danger, #ef4444)'; label = 'Baja Fiabilidad'; }

  el.style.color = color;
  statusEl.textContent = label;
  statusEl.style.color = color;
}

// ---- Render: Audit Trail ----
function renderAuditTrail() {
  const container = document.getElementById('audit-trail-content');
  if (!container) return;
  if (!STATE.auditTrail.length) {
    container.innerHTML = '<span style="opacity:0.5;">Sin eventos registrados.</span>';
    return;
  }

  container.innerHTML = STATE.auditTrail.map(ev => {
    const time = new Date(ev.ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `<div style="margin-bottom:4px;">
      <span style="color:var(--cyan, #06b6d4); font-family:var(--font-mono, monospace); font-size:0.78rem;">${time}</span>
      <strong style="color:var(--text-primary); margin:0 6px;">${ev.action}</strong>
      <span>${ev.detail}</span>
    </div>`;
  }).join('');
}

// ---- Render: Hallazgos Accionables ----
const FINDING_RECOMMENDATIONS = {
  'cifras_redondas':      { impacto: 'Posible estimación contable o facturación ficticia.', rec: 'Solicitar desglose de facturas con importes múltiplos de 500/1000€.', accion: 'Revisión documental' },
  'facturas_domingo':     { impacto: 'Irregularidad temporal en registros contables.', rec: 'Verificar si el software contable auto-fecha o si hay manipulación manual.', accion: 'Entrevista con contable' },
  'duplicados_exactos':   { impacto: 'Doble contabilización infla gastos o ingresos reales.', rec: 'Cruzar con extractos bancarios para confirmar unicidad del pago.', accion: 'Conciliación bancaria' },
  'margen_bruto_negativo':{ impacto: 'La empresa vende por debajo de su coste directo.', rec: 'Revisar política de precios y estructura de costes de aprovisionamiento.', accion: 'Análisis de pricing' },
  'cliente_unico':        { impacto: 'Dependencia comercial extrema. Riesgo de colapso si se pierde el cliente.', rec: 'Exigir plan de diversificación de cartera como condición de financiación.', accion: 'Plan de diversificación' },
  'cuota_personal_critica':{ impacto: 'El modelo de negocio no escala; cada euro de ingreso se consume en nóminas.', rec: 'Evaluar automatización, externalización o renegociación salarial.', accion: 'Optimización OpEx' },
  'asiento_descuadrado':  { impacto: 'Invalida la integridad del libro mayor completo.', rec: 'No proceder con análisis hasta corregir descuadres. Devolver al contable.', accion: 'Bloqueo y corrección' },
  'ebitda_suspect':       { impacto: 'Las métricas de rentabilidad no son fiables para decisiones de inversión.', rec: 'Presentar EBITDA con disclaimer de sospecha en informes a terceros.', accion: 'Disclaimer en reporting' }
};

function renderActionableFindings(anomalies) {
  const section = document.getElementById('actionable-findings-section');
  const content = document.getElementById('actionable-findings-content');
  if (!section || !content) return;

  // Filtrar solo high y critical
  const actionable = anomalies.filter(a => a.severity === 'high' || a.severity === 'critical');
  if (!actionable.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  // Añadir hallazgo de EBITDA suspect si aplica
  if (STATE.analysisResult?.totales?.ebitdaSuspect) {
    const alreadyHas = actionable.some(a => a.message.includes('EBITDA'));
    if (!alreadyHas) {
      actionable.push({ severity: 'high', message: 'EBITDA marcado como sospechoso', detail: 'Demasiadas anomalías graves invalidan la fiabilidad del EBITDA calculado.' });
    }
  }

  content.innerHTML = `
    <div class="table-wrap">
      <table style="font-size:0.82rem;">
        <thead>
          <tr>
            <th style="width:28px;"></th>
            <th>Hallazgo</th>
            <th>Impacto</th>
            <th>Severidad</th>
            <th>Recomendación</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          ${actionable.map((a, i) => {
            // Intentar asociar a una regla conocida
            const ruleId = matchFindingToRule(a.message);
            const rec = FINDING_RECOMMENDATIONS[ruleId] || { impacto: a.detail, rec: 'Revisar manualmente.', accion: 'Investigar' };
            const sevIcon = a.severity === 'critical' ? '⛔' : '🔴';
            const sevLabel = a.severity === 'critical' ? 'Crítica' : 'Alta';
            return `<tr>
              <td>${sevIcon}</td>
              <td><strong>${a.message}</strong><br><span style="opacity:0.7;font-size:0.78rem;">${a.detail}</span></td>
              <td style="font-size:0.78rem;">${rec.impacto}</td>
              <td><span style="font-weight:700;color:${a.severity === 'critical' ? 'var(--danger)' : '#fca5a5'}">${sevLabel}</span></td>
              <td style="font-size:0.78rem;">${rec.rec}</td>
              <td><span style="background:rgba(255,255,255,0.08);padding:3px 8px;border-radius:4px;font-size:0.75rem;white-space:nowrap;">${rec.accion}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function matchFindingToRule(message) {
  const msg = message.toLowerCase();
  if (msg.includes('redonda'))      return 'cifras_redondas';
  if (msg.includes('domingo'))      return 'facturas_domingo';
  if (msg.includes('duplicado'))    return 'duplicados_exactos';
  if (msg.includes('margen bruto')) return 'margen_bruto_negativo';
  if (msg.includes('concentración'))return 'cliente_unico';
  if (msg.includes('personal'))     return 'cuota_personal_critica';
  if (msg.includes('desbalanceado') || msg.includes('descuadra')) return 'asiento_descuadrado';
  if (msg.includes('ebitda'))       return 'ebitda_suspect';
  return '';
}

// ---- Init ----
renderDefensa();

// Inicializar módulos si existen
if (typeof renderChecklist === 'function') renderChecklist();
if (typeof renderKnowledge === 'function') renderKnowledge();
