/**
 * checklist.js — Framework "Filtro Día 1" APTKI
 * Checklist interactivo con scoring 0-100 y persistencia localStorage.
 */

const CHECKLIST_DATA = [
  {
    id: 'tecnica',
    title: 'Precisión Técnica Contable',
    weight: 20,
    icon: '📐',
    color: 'var(--cyan)',
    items: [
      { id: 'tc1', label: '¿El Debe = Haber en todos los meses?', auto: true, autoKey: 'descuadres' },
      { id: 'tc2', label: '¿Se detectaron y documentaron errores/inconsistencias?' },
      { id: 'tc3', label: '¿Amortizaciones registradas de forma consistente?', auto: true, autoKey: 'amortizaciones' },
      { id: 'tc4', label: '¿Periodificaciones correctas (gastos anuales prorrateados)?', auto: true, autoKey: 'accruals' },
      { id: 'tc5', label: '¿El Cash Flow reconcilia con la variación de tesorería?' }
    ]
  },
  {
    id: 'analitica',
    title: 'Capacidad Analítica',
    weight: 20,
    icon: '🔬',
    color: 'var(--purple)',
    items: [
      { id: 'an1', label: '¿KPIs universales calculados? (Liquidez, Solvencia, Runway)', auto: true },
      { id: 'an2', label: '¿KPIs del perfil de negocio calculados?', auto: true },
      { id: 'an3', label: '¿Insights accionables documentados (no genéricos)?' },
      { id: 'an4', label: '¿Burn Rate y Runway con sistema de alertas?', auto: true },
      { id: 'an5', label: '¿EBITDA, Margen Bruto y Resultado Neto calculados?', auto: true }
    ]
  },
  {
    id: 'forecast',
    title: 'Calidad del Forecast',
    weight: 20,
    icon: '📈',
    color: 'var(--amber)',
    items: [
      { id: 'fc1', label: '¿Hipótesis documentadas y justificadas?' },
      { id: 'fc2', label: '¿Crecimiento razonable (basado en datos históricos, no hockey-stick)?' },
      { id: 'fc3', label: '¿OPEX coherente con el crecimiento proyectado?' },
      { id: 'fc4', label: '¿Escenarios múltiples (base, optimista, pesimista)?' },
      { id: 'fc5', label: '¿Runway proyectado a 12 meses con alertas visuales?' }
    ]
  },
  {
    id: 'presentacion',
    title: 'Presentación y Claridad',
    weight: 20,
    icon: '💼',
    color: 'var(--green)',
    items: [
      { id: 'pr1', label: '¿Estructura clara por pestañas/secciones temáticas?' },
      { id: 'pr2', label: '¿Dashboard resumen ejecutivo en 1 pantalla?' },
      { id: 'pr3', label: '¿Inputs diferenciados de fórmulas (color-coding)?' },
      { id: 'pr4', label: '¿Legible para un founder no financiero?' },
      { id: 'pr5', label: '¿Errores detectados documentados en pestaña de ajustes?' }
    ]
  },
  {
    id: 'negocio',
    title: 'Sentido de Negocio',
    weight: 20,
    icon: '🧠',
    color: '#f472b6',
    items: [
      { id: 'nb1', label: '¿Estrategia de liquidez/financiación propuesta?' },
      { id: 'nb2', label: '¿Medidas operativas de choque si el runway es crítico?' },
      { id: 'nb3', label: '¿Recomendaciones adaptadas al perfil y momento de la empresa?' },
      { id: 'nb4', label: '¿Propuesta de valor CFO as a Service articulada?' },
      { id: 'nb5', label: '¿Mezcla inteligente Equity + Deuda pública planteada?' }
    ]
  }
];

// ---- Estado ----
function loadChecklistState() {
  try {
    return JSON.parse(localStorage.getItem('aptki_checklist') || '{}');
  } catch { return {}; }
}

function saveChecklistState(state) {
  localStorage.setItem('aptki_checklist', JSON.stringify(state));
}

function computeScore(state) {
  let total = 0;
  let checked = 0;
  for (const category of CHECKLIST_DATA) {
    for (const item of category.items) {
      total++;
      if (state[item.id]) checked++;
    }
  }
  return total > 0 ? Math.round((checked / total) * 100) : 0;
}

// ---- Auto-checks desde el análisis ----
function applyAutoChecks(checkState) {
  if (!STATE.analysisResult) return checkState;
  const anomalies = STATE.parsedLedger?.anomalies || [];

  // tc1: descuadres
  const hasDescuadre = anomalies.some(a => a.message.toLowerCase().includes('descuadre'));
  checkState['tc1'] = !hasDescuadre;

  // tc3: amortizaciones
  const hasAmortIssue = anomalies.some(a => a.message.toLowerCase().includes('amortizaci'));
  checkState['tc3'] = !hasAmortIssue;
  
  // tc4: periodificaciones
  // Si el usuario revisó y pasó el "Paso 3" de accruals, se considera checkeado.
  if (STATE.accrualsReviewed) {
    checkState['tc4'] = true;
  }

  // an1, an2, an4, an5: Calculados por defecto al generar el Dashboard
  checkState['an1'] = true;
  checkState['an2'] = true;
  checkState['an4'] = true;
  checkState['an5'] = true;

  // nb5: Mezcla inteligente Equity + Deuda pública — si el scoring de algún programa >= 60
  if (STATE.scoringResult) {
    const { enisa, cdti } = STATE.scoringResult;
    checkState['nb5'] = enisa.score >= 60 || cdti.score >= 60;
  }

  // fc5: Runway proyectado a 12 meses — si el forecast ha sido calculado
  if (STATE.forecastResult) {
    checkState['fc5'] = true;
  }

  return checkState;
}

// ---- Render ----
function renderChecklist() {
  const root = document.getElementById('checklist-root');
  if (!root) return;

  let checkState = loadChecklistState();
  if (STATE.analysisResult) {
    checkState = applyAutoChecks(checkState);
    saveChecklistState(checkState);
  }

  const score = computeScore(checkState);

  root.innerHTML = `
    <!-- Score header -->
    <div style="display:flex;align-items:center;gap:24px;margin-bottom:28px;flex-wrap:wrap;">
      <div style="position:relative;width:110px;height:110px;flex-shrink:0;">
        <svg viewBox="0 0 36 36" style="width:110px;height:110px;transform:rotate(-90deg);">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
          <circle cx="18" cy="18" r="15.9" fill="none"
            stroke="${score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)'}"
            stroke-width="3"
            stroke-dasharray="${score} ${100 - score}"
            stroke-linecap="round"
            style="transition:stroke-dasharray 0.5s ease;"
          />
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
          <span style="font-family:var(--font-display);font-size:1.6rem;font-weight:800;color:var(--text-primary);">${score}</span>
          <span style="font-size:0.65rem;color:var(--text-muted);margin-top:-2px;">/ 100</span>
        </div>
      </div>
      <div>
        <div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;">Score Filtro Día 1</div>
        <div style="color:var(--text-secondary);font-size:0.88rem;margin-top:4px;">
          ${score >= 80 ? '✅ Entregable de alta calidad' : score >= 60 ? '🟡 Buen avance, refinar algunos puntos' : '🔴 Atención — revisar criterios clave'}
        </div>
        <div style="color:var(--text-muted);font-size:0.78rem;margin-top:6px;">
          ${STATE.analysisResult ? '✓ Auto-checks aplicados desde el análisis cargado' : 'Carga un libro diario para activar los auto-checks'}
        </div>
      </div>
      <div style="margin-left:auto;">
        <button class="btn btn-secondary" id="btn-reset-checklist" style="font-size:0.8rem;padding:8px 16px;">
          🔄 Reiniciar
        </button>
      </div>
    </div>

    <!-- Categorías -->
    <div style="display:flex;flex-direction:column;gap:20px;">
      ${CHECKLIST_DATA.map(cat => {
        const catChecked = cat.items.filter(i => checkState[i.id]).length;
        const catPct = Math.round((catChecked / cat.items.length) * 100);
        return `
          <div class="card">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
              <span style="font-size:1.4rem;">${cat.icon}</span>
              <div style="flex:1;">
                <div style="font-family:var(--font-display);font-weight:700;font-size:0.95rem;">${cat.title}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">Peso: ${cat.weight}% · ${catChecked}/${cat.items.length} completados</div>
              </div>
              <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:${cat.color};">${catPct}%</div>
            </div>
            <div style="height:4px;background:rgba(255,255,255,0.06);border-radius:2px;margin-bottom:16px;overflow:hidden;">
              <div style="height:100%;width:${catPct}%;background:${cat.color};border-radius:2px;transition:width 0.4s ease;"></div>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              ${cat.items.map(item => `
                <label style="display:flex;align-items:flex-start;gap:12px;cursor:pointer;padding:10px 12px;border-radius:var(--radius-sm);border:1px solid ${checkState[item.id] ? cat.color + '44' : 'var(--border)'};background:${checkState[item.id] ? cat.color + '11' : 'transparent'};transition:all 0.2s;">
                  <input type="checkbox" data-id="${item.id}" ${checkState[item.id] ? 'checked' : ''} ${item.auto && !STATE.analysisResult ? 'disabled title="Auto-check: carga un libro diario"' : ''}
                    style="width:16px;height:16px;flex-shrink:0;margin-top:1px;accent-color:${cat.color};" />
                  <span style="font-size:0.85rem;color:${checkState[item.id] ? 'var(--text-primary)' : 'var(--text-secondary)'};">
                    ${item.label}
                    ${item.auto ? '<span style="font-size:0.68rem;color:var(--cyan);margin-left:6px;padding:1px 6px;border:1px solid var(--cyan);border-radius:8px;">AUTO</span>' : ''}
                  </span>
                </label>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Event listeners checkboxes
  root.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const state = loadChecklistState();
      state[cb.dataset.id] = cb.checked;
      saveChecklistState(state);
      renderChecklist(); // re-render para actualizar score
    });
  });

  // Reset
  document.getElementById('btn-reset-checklist')?.addEventListener('click', () => {
    localStorage.removeItem('aptki_checklist');
    renderChecklist();
  });
}
