function buildNarrative(data, forecast, scoring) {
  if (!data) return { financiero: '', estrategico: '' };

  const fmt = v => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(v) + '€';
  const pct = v => (v * 100).toFixed(1) + '%';
  
  const { totales, confidence, pygMensual } = data;
  const meses = Object.keys(pygMensual).sort();
  const nMeses = meses.length;
  
  const margenBrutoP = totales.ingresos > 0 ? (totales.ingresos - totales.cogs) / totales.ingresos : 0;
  const opexOperativo = totales.gastos - totales.cogs - (totales.amortizacion || 0) - (totales.gastosFinancieros || 0);
  const totalPersonal = Object.values(pygMensual).reduce((s, m) => s + m.personal, 0);
  const pesoPersonalReal = opexOperativo > 0 ? totalPersonal / opexOperativo : 0;

  const runwayBase = forecast?.scenarios?.base?.findIndex(r => r.caja < 0);
  const mesesRunwayText = runwayBase !== undefined && runwayBase !== -1 ? `${runwayBase + 1} meses` : '> 12 meses';
  
  // ---- 0. Disclaimer de Confianza (Nuevo) ----
  let txtDisclaimer = "";
  if (confidence?.confidenceLevel !== 'reliable') {
    const labels = { reservations: 'CON RESERVAS', indicative: 'ORIENTATIVO', blocked: 'DIAGNÓSTICO ÚNICAMENTE' };
    txtDisclaimer = `> ⚠️ **ANÁLISIS ${labels[confidence.confidenceLevel]}**: ${confidence.analysisLimitations.join(' ')}\n\n`;
  }

  // ---- 1. Resumen Estrictamente Financiero ----
  let txtFinanciero = txtDisclaimer;
  txtFinanciero += `**SITUACIÓN DE LIQUIDEZ Y RENTABILIDAD**\n`;
  txtFinanciero += `Durante el periodo analizado (${nMeses} meses), la empresa ha registrado unos ingresos totales de ${fmt(totales.ingresos)} frente a unos costes operativos (OPEX) estimados en ${fmt(opexOperativo)}. El Margen Bruto se sitúa en un ${pct(margenBrutoP)}.\n\n`;
  
  if (confidence?.ebitdaSuspect) {
    txtFinanciero += `⚠️ **Aviso de Integridad**: El EBITDA calculado (${fmt(totales.ebitda)}) presenta dudas razonables debido a la concentración de anomalías en el libro diario. Se recomienda no utilizar esta métrica como base única para valoraciones sin una auditoría previa.\n\n`;
  } else {
    txtFinanciero += `El EBITDA acumulado del periodo es de ${fmt(totales.ebitda)}. La estructura de costes fijos está dominada por los gastos de personal, que representan un ${pct(pesoPersonalReal)} del OPEX operativo.\n\n`;
  }

  txtFinanciero += `**POSICIÓN DE CAJA Y RUNWAY**\n`;
  txtFinanciero += `La posición de tesorería a cierre del último mes analizado es de ${fmt(totales.cajaFinal)}. Con un Burn Rate Neto promedio de ${fmt(totales.burnRateNeto)}/mes, la proyección base indica un runway estimado de ${mesesRunwayText}.`;

  // ---- 2. Visión Estratégica y Consultiva ----
  let txtEstrategico = `**DIAGNÓSTICO Y ROADMAP**\n`;
  
  // Diagnóstico de márgenes
  if (margenBrutoP < 0.4) {
    txtEstrategico += `El margen bruto actual (${pct(margenBrutoP)}) es bajo para sostener un escalado acelerado. Antes de inyectar capital en marketing (CAC), es imperativo optimizar el COGS o revisar la política de pricing. `;
  } else if (margenBrutoP > 0.7) {
    txtEstrategico += `Excelente salud de margen bruto (${pct(margenBrutoP)}), típico de modelos altamente escalables. Cada euro de nueva venta fluye casi directamente a cubrir los costes estructurales. `;
  }

  // Diagnóstico de Runway
  if (runwayBase !== undefined && runwayBase !== -1 && runwayBase < 6) {
    txtEstrategico += `\n\n⚠️ **Riesgo Inminente de Caja**: El runway proyectado es inferior a 6 meses. Se requiere una estrategia de contención de OPEX en paralelo a una activación de rondas puente o financiación alternativa.\n\n`;
  } else {
    txtEstrategico += `\n\nEl runway actual proporciona suficiente margen de maniobra (ventana > 6 meses) para ejecutar la hoja de ruta estratégica sin presión de caja crítica.\n\n`;
  }

  // Financiación Pública
  txtEstrategico += `**APALANCAMIENTO PÚBLICO (NON-DILUTIVE)**\n`;
  if (scoring) {
    const enisaOk = scoring.enisa?.elegible;
    const cdtiOk = scoring.cdti?.elegible;
    
    if (enisaOk && cdtiOk) {
      txtEstrategico += `La empresa presenta un perfil idóneo para plantear una estrategia de financiación mixta (ENISA + CDTI Neotec).`;
    } else if (enisaOk) {
      txtEstrategico += `El perfil patrimonial actual habilita a la empresa para solicitar ENISA Emprendedores, representando la opción menos dilutiva para extender el runway.`;
    } else if (cdtiOk) {
      txtEstrategico += `El fuerte componente técnico abre la puerta a subvenciones competitivas como CDTI Neotec, que actuarían como un espaldarazo de caja puro.`;
    } else {
      txtEstrategico += `La estructura financiera actual actúa como barrera para el acceso a instrumentos públicos directos. El paso previo necesario es una ronda de capital (equity) que fortalezca el patrimonio neto.`;
    }
  }

  // ---- 3. Readiness para Financiación (Nuevo) ----
  txtEstrategico += `\n\n**READINESS PARA FINANCIACIÓN**\n`;
  const flags = confidence?.fundingReadinessFlags;
  if (flags?.requiresManualReview) {
    txtEstrategico += `❌ **No apto para presentación inmediata**. El nivel de incidencias en el libro diario requiere una limpieza contable previa antes de presentar el expediente a entidades financieras o inversores para evitar un rechazo por due diligence.`;
  } else if (flags?.scoringDefensible) {
    txtEstrategico += `✅ **Apto para inicio de expedientes**. La calidad del dato es suficiente para defender el business case ante ENISA/CDTI, aunque se recomienda monitorizar las anomalías menores reportadas.`;
  } else {
    txtEstrategico += `La elegibilidad está condicionada a la corrección de los descuadres detectados en el proceso de ingesta.`;
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
