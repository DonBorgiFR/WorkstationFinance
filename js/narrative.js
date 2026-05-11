/**
 * narrative.js — Narrative Engine (Auto-Insights)
 * Genera resúmenes ejecutivos en texto a partir del análisis financiero.
 */

function buildNarrative(data, forecast, scoring) {
  if (!data) return { financiero: '', estrategico: '' };

  const fmt = v => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v) + '€';
  const pct = v => (v * 100).toFixed(1) + '%';
  
  const { totales, balance, pygMensual } = data;
  const meses = Object.keys(pygMensual).sort();
  const nMeses = meses.length;
  
  const margenBrutoP = totales.ingresos > 0 ? (totales.ingresos - totales.cogs) / totales.ingresos : 0;
  const opexTotal = totales.gastos; // (excluyendo cogs que ya no está en totales.gastos o sí, veamos. En app.js totalGastos incluia cogs. 
  // Wait, in analyzer.js: totalGastos = cogs + personal + marketing + serviciosOp + tributos + amort + gF.
  // Opex puro = totalGastos - cogs - amort - gF
  const opexOperativo = totales.gastos - totales.cogs - (totales.amortizacion || 0) - (totales.gastosFinancieros || 0);
  const pesoPersonal = opexOperativo > 0 ? (totales.gastosPorGrupo?.['64'] || 0) / opexOperativo : 0; // Aproximación
  // Mejor calcular personal exacto:
  const totalPersonal = Object.values(pygMensual).reduce((s, m) => s + m.personal, 0);
  const pesoPersonalReal = opexOperativo > 0 ? totalPersonal / opexOperativo : 0;

  const runwayBase = forecast?.scenarios?.base?.findIndex(r => r.caja < 0);
  const mesesRunwayText = runwayBase !== undefined && runwayBase !== -1 ? `${runwayBase + 1} meses` : '> 12 meses';
  
  // ---- 1. Resumen Estrictamente Financiero ----
  let txtFinanciero = `**SITUACIÓN DE LIQUIDEZ Y RENTABILIDAD**\n`;
  txtFinanciero += `Durante el periodo analizado (${nMeses} meses), la empresa ha registrado unos ingresos totales de ${fmt(totales.ingresos)} frente a unos costes operativos (OPEX) estimados en ${fmt(opexOperativo)}. El Margen Bruto se sitúa en un ${pct(margenBrutoP)}, reflejando el coste directo de la entrega del servicio/producto.\n\n`;
  txtFinanciero += `El EBITDA acumulado del periodo es de ${fmt(totales.ebitda)}. La estructura de costes fijos está dominada por los gastos de personal, que representan un ${pct(pesoPersonalReal)} del OPEX total.\n\n`;
  txtFinanciero += `**POSICIÓN DE CAJA Y RUNWAY**\n`;
  txtFinanciero += `La posición de tesorería a cierre del último mes analizado es de ${fmt(totales.cajaFinal)}. Con un Burn Rate Neto promedio de ${fmt(totales.burnRateNeto)}/mes, la proyección base indica un runway estimado de ${mesesRunwayText} antes de una posible rotura de caja, asumiendo un crecimiento vegetativo y sin inyecciones de capital externas.`;

  // ---- 2. Visión Estratégica y Consultiva ----
  let txtEstrategico = `**DIAGNÓSTICO Y ROADMAP**\n`;
  
  // Diagnóstico de márgenes
  if (margenBrutoP < 0.4) {
    txtEstrategico += `El margen bruto actual (${pct(margenBrutoP)}) es bajo para sostener un escalado acelerado. Antes de inyectar capital en marketing (CAC), es imperativo optimizar el COGS o revisar la política de pricing para ganar holgura operativa. `;
  } else if (margenBrutoP > 0.7) {
    txtEstrategico += `Excelente salud de margen bruto (${pct(margenBrutoP)}), típico de modelos altamente escalables (ej. SaaS). Cada euro de nueva venta fluye casi directamente a cubrir los costes estructurales, lo que valida la economía unitaria. `;
  }

  // Diagnóstico de Runway
  if (runwayBase !== undefined && runwayBase !== -1 && runwayBase < 6) {
    txtEstrategico += `\n\n⚠️ **Riesgo Inminente de Caja**: El runway proyectado es inferior a 6 meses. Se requiere una estrategia de contención de OPEX (freeze de contrataciones no críticas) en paralelo a una activación inmediata de rondas puente o financiación alternativa a corto plazo.\n\n`;
  } else {
    txtEstrategico += `\n\nEl runway actual proporciona suficiente margen de maniobra (ventana > 6 meses) para ejecutar la hoja de ruta estratégica sin presión de caja crítica a cortísimo plazo, permitiendo negociar financiación desde una posición de mayor fortaleza.\n\n`;
  }

  // Financiación Pública
  txtEstrategico += `**APALANCAMIENTO PÚBLICO (NON-DILUTIVE)**\n`;
  if (scoring) {
    const enisaOk = scoring.enisa?.elegible;
    const cdtiOk = scoring.cdti?.elegible;
    
    if (enisaOk && cdtiOk) {
      txtEstrategico += `La empresa presenta un perfil idóneo para plantear una estrategia de financiación mixta. Se recomienda sincronizar la solicitud de CDTI Neotec (para financiar intensidad de I+D) con ENISA Emprendedores (para complementar el OPEX general y marketing).`;
    } else if (enisaOk) {
      txtEstrategico += `El perfil patrimonial actual habilita a la empresa para solicitar ENISA Emprendedores. Al cumplir el ratio de fondos propios, esta vía representa la opción menos dilutiva para extender el runway entre 4 y 6 meses adicionales.`;
    } else if (cdtiOk) {
      txtEstrategico += `Aunque el perfil patrimonial puede limitar algunas opciones de deuda pública, el fuerte componente técnico y el enfoque I+D abren la puerta a subvenciones competitivas como CDTI Neotec, que actuarían como un espaldarazo de caja puro.`;
    } else {
      txtEstrategico += `Actualmente, la estructura financiera (específicamente la situación de fondos propios o antigüedad) actúa como barrera para el acceso a instrumentos públicos directos como ENISA o CDTI. El paso previo necesario es una ronda de capital (equity) que fortalezca el patrimonio neto antes de intentar apalancar deuda pública.`;
    }
  } else {
    txtEstrategico += `Para determinar la estrategia óptima de financiación pública (ENISA/CDTI), se recomienda completar el 'Scoring Público' en el panel de herramientas.`;
  }

  return { financiero: txtFinanciero, estrategico: txtEstrategico };
}

function renderNarrative() {
  const container = document.getElementById('narrative-container');
  if (!container) return;

  if (!STATE.analysisResult) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const { financiero, estrategico } = buildNarrative(STATE.analysisResult, STATE.forecastResult, STATE.scoringResult);

  // Parser simple de markdown a HTML para negritas y saltos de linea
  const parseMd = text => text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  container.innerHTML = `
    <div class="card" style="margin-top:24px; border-left: 4px solid var(--purple);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 16px;">
        <div class="card-title" style="margin-bottom:0;">🤖 Resumen Ejecutivo (Auto-Generado)</div>
        <button class="btn btn-secondary" onclick="copyNarrative()" style="font-size:0.75rem; padding:6px 12px;">📋 Copiar Informe</button>
      </div>
      
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        <!-- Bloque Financiero -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); padding: 16px; border-radius: var(--radius-sm);">
          <div style="font-size: 0.75rem; color: var(--cyan); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 12px;">
            📊 Análisis Estrictamente Financiero
          </div>
          <div id="narrative-fin" style="font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary);">
            <p>${parseMd(financiero)}</p>
          </div>
        </div>

        <!-- Bloque Estratégico -->
        <div style="background: rgba(168,85,247,0.05); border: 1px solid rgba(168,85,247,0.2); padding: 16px; border-radius: var(--radius-sm);">
          <div style="font-size: 0.75rem; color: var(--purple); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; margin-bottom: 12px;">
            ♟️ Visión Estratégica y Roadmap
          </div>
          <div id="narrative-est" style="font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary);">
            <p>${parseMd(estrategico)}</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Expuesto globalmente para el botón
window.copyNarrative = function() {
  const fin = document.getElementById('narrative-fin')?.innerText || '';
  const est = document.getElementById('narrative-est')?.innerText || '';
  const textToCopy = `=== ANÁLISIS FINANCIERO ===\n${fin}\n\n=== VISIÓN ESTRATÉGICA ===\n${est}`;
  
  navigator.clipboard.writeText(textToCopy).then(() => {
    showToast('Informe copiado al portapapeles', 'success');
  }).catch(() => {
    showToast('Error al copiar el informe', 'error');
  });
};
