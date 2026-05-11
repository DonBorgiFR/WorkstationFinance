/**
 * knowledge.js — Guía Interactiva de Financiación APTKI
 * Datos en JSON editable. Añade o modifica directamente este archivo.
 */

const KNOWLEDGE_DATA = {
  enisa: {
    title: 'ENISA — Préstamos Participativos',
    icon: '🏛️',
    color: 'var(--cyan)',
    intro: 'ENISA otorga préstamos participativos sin avales ni dilución de capital. Intereses deducibles en IS. Comisión de apertura 0,5%.',
    estructura_interes: 'Tramo 1 (Fijo): Euríbor + 2% a +3,75% · Tramo 2 (Variable): 3% – 8% según rentabilidad',
    lineas: [
      {
        nombre: 'Jóvenes Emprendedores',
        importe: '≤ 75.000 €',
        cofinanciacion: '2:1 (menos capital propio requerido)',
        antiguedad: '< 24 meses',
        requisito_edad: '> 50% capital para menores de 41 años',
        vencimiento: '7 años',
        carencia: '5 años',
        notas: 'Única línea con apalancamiento 2:1. Tick máximo bajo.'
      },
      {
        nombre: 'Emprendedores',
        importe: '≤ 300.000 €',
        cofinanciacion: '1:1',
        antiguedad: '< 24 meses',
        requisito_edad: 'Sin límite de edad',
        vencimiento: '7 años',
        carencia: '5 años',
        notas: 'Línea principal para startups en fase temprana. Sin restricción de edad de founders.'
      },
      {
        nombre: 'Crecimiento',
        importe: '≤ 1.500.000 €',
        cofinanciacion: '1:1',
        antiguedad: '> 2 ejercicios cerrados con evolución positiva de fondos propios',
        requisito_edad: 'Sin límite',
        vencimiento: '9 años',
        carencia: '7 años',
        notas: 'Para > 300.000 € exige cuentas auditadas externamente. Requiere 2 ejercicios cerrados.'
      },
      {
        nombre: 'AgroInnpulso',
        importe: '≤ 1.500.000 €',
        cofinanciacion: '1:1',
        antiguedad: 'Sin restricción específica',
        requisito_edad: 'Sin límite',
        vencimiento: '9 años',
        carencia: '7 años',
        notas: 'Exclusiva para pymes del sector agroalimentario y rural con foco en digitalización.'
      },
      {
        nombre: 'Emprendedoras Digitales',
        importe: '≤ 1.500.000 €',
        cofinanciacion: '1:1',
        antiguedad: 'Sin restricción específica',
        requisito_edad: 'Mujeres en posiciones relevantes del órgano de gobierno',
        vencimiento: '9 años',
        carencia: '7 años',
        notas: 'Proyectos digitales con liderazgo femenino.'
      },
      {
        nombre: 'Audiovisual e ICC',
        importe: '25.000 € – 1.500.000 €',
        cofinanciacion: '1:1',
        antiguedad: 'Sin restricción específica',
        requisito_edad: 'Sin límite',
        vencimiento: '9 años',
        carencia: '7 años',
        notas: 'Videojuegos, audiovisual, industrias culturales y creativas. Cuentas auditadas si > 300.000€.'
      }
    ],
    requisitos_generales: [
      'Pyme según definición UE, domicilio social en España',
      'Modelo de negocio innovador con viabilidad técnica y económica demostrable',
      'Fondos propios ≥ importe solicitado (regla cofinanciación 1:1)',
      'Ampliación de capital dineraria realizada o prevista',
      'Cuentas del último ejercicio depositadas en Registro Mercantil',
      'Cumplir principio DNSH (no daño significativo al medio ambiente)',
      'Sectores excluidos: inmobiliario y financiero'
    ],
    calculadora: true
  },

  cdti: {
    title: 'CDTI — I+D+i',
    icon: '🔬',
    color: 'var(--purple)',
    intro: 'El CDTI financia proyectos de I+D con préstamos reembolsables y subvenciones, especialmente a través de Neotec para startups tecnológicas.',
    lineas: [
      {
        nombre: 'Neotec',
        importe: '≤ 250.000 €',
        tipo: 'Subvención (hasta 70% del presupuesto)',
        antiguedad: '< 3 años · Capital social mínimo 20.000 €',
        notas: 'Concurrencia competitiva. Solo 15-20% de solicitudes aprobadas. Requiere tecnología propia. Alta exigencia en memoria técnica.'
      },
      {
        nombre: 'Proyectos de I+D (PID)',
        importe: 'Min. 175.000 € presupuesto',
        tipo: 'Préstamo reembolsable (hasta 85%) + tramo no reembolsable 20-33%',
        antiguedad: 'Sin restricción específica',
        notas: 'Carencia 2-3 años, amortización 10-15 años. Para proyectos de investigación aplicada.'
      },
      {
        nombre: 'Líneas de Innovación (LIC)',
        importe: 'Variable',
        tipo: 'Préstamo reembolsable',
        antiguedad: 'Sin restricción específica',
        notas: 'Para proyectos de innovación tecnológica. Menos exigente que PID.'
      }
    ]
  },

  incentivos_fiscales: {
    title: 'Incentivos Fiscales I+D+i',
    icon: '💸',
    color: 'var(--green)',
    intro: 'Reducciones directas en cuota del Impuesto de Sociedades y ahorro en Seguridad Social para personal investigador.',
    items: [
      {
        nombre: 'Deducción IS por I+D',
        descripcion: '25% de los gastos en I+D (42% si superan media de últimos 2 años). Acumulable hasta 18 años. Monetizable con peaje del 20%.',
        perfil: 'Empresas con proyectos de I+D certificados'
      },
      {
        nombre: 'Deducción IS por Innovación Tecnológica',
        descripcion: '12% de los gastos en IT (proyectos de innovación no I+D pura). Compatible con la deducción por I+D.',
        perfil: 'Empresas con mejoras tecnológicas en productos/procesos'
      },
      {
        nombre: 'Bonificación SS Personal Investigador',
        descripcion: 'Ahorro del 40% de contingencias comunes (~23,6% salario bruto) para investigadores con 100% dedicación a I+D+i. Compatible con deducciones IS si se tiene sello Pyme Innovadora. Requiere Informe Motivado si aplica a ≥10 trabajadores.',
        perfil: 'Grupos cotización 1-4. Startups tech con developers en proyectos I+D.'
      },
      {
        nombre: 'Torres Quevedo',
        descripcion: 'Subvenciones para contratación de doctores o titulados en I+D. Hasta 3 solicitudes por entidad, máximo 3 años por investigador.',
        perfil: 'Empresas que quieren incorporar investigadores senior'
      }
    ]
  },

  financiacion_privada: {
    title: 'Financiación Privada',
    icon: '💼',
    color: 'var(--amber)',
    intro: 'Capital privado para startups: desde pre-seed hasta growth. APTKI gestiona el deal flow a través de Fork Capital.',
    items: [
      { nombre: 'Venture Capital (VC)', desc: 'Fondos de inversión. Tickets: Seed 100k-2M€, Series A 2-10M€. Requieren pitch deck, one-pager y due diligence completa.' },
      { nombre: 'Business Angels (BA)', desc: 'Inversores individuales. Tickets: 25k-500k€. Más ágiles que VC. Aportan smart money y red de contactos.' },
      { nombre: 'Crowdfunding Equity', desc: 'Plataformas como Crowdcube, Seedrs. Permite rondas pequeñas con muchos inversores minoristas.' },
      { nombre: 'Crowdlending', desc: 'Préstamos colectivos. Rápido pero más caro que bancario. Útil para liquidez puente.' },
      { nombre: 'Venture Debt', desc: 'Deuda de riesgo. Complementa rondas de equity sin dilución adicional. Requiere haber levantado capital previo.' },
      { nombre: 'Notas Convertibles (SAFE)', desc: 'Instrumento pre-inversión. Se convierte en equity en la siguiente ronda. Muy común en pre-seed.' }
    ]
  },

  financiacion_bancaria: {
    title: 'Financiación Bancaria',
    icon: '🏦',
    color: '#94a3b8',
    intro: 'Instrumentos bancarios para liquidez operativa y financiación de circulante.',
    items: [
      { nombre: 'Líneas ICO', desc: 'Préstamos mediados por el ICO. Condiciones ventajosas. Requieren aval o garantías.' },
      { nombre: 'Factoring / Descuento de Facturas', desc: 'Anticipo del cobro de facturas pendientes. Liquidez inmediata sin endeudamiento adicional.' },
      { nombre: 'Confirming', desc: 'Anticipar pagos a proveedores. Mejora la relación con la cadena de suministro.' },
      { nombre: 'Renting / Leasing', desc: 'Financiación de activos (equipos, vehículos) sin desembolso inicial grande.' },
      { nombre: 'Avales SGR', desc: 'Sociedades de Garantía Recíproca. Mejoran el acceso al crédito bancario para pymes sin garantías suficientes.' }
    ]
  }
};

// ---- Calculadora ENISA ----
function calcularMaxENISA(fondosPropios, lineaId) {
  const limites = {
    jovenes: 75000,
    emprendedores: 300000,
    crecimiento: 1500000,
    agroinnpulso: 1500000,
    emprendedoras: 1500000,
    audiovisual: 1500000
  };
  const ratios = { jovenes: 2, emprendedores: 1, crecimiento: 1 };
  const ratio = ratios[lineaId] || 1;
  const limite = limites[lineaId] || 300000;
  return Math.min(fondosPropios * ratio, limite);
}

// ---- Render ----
function renderKnowledge() {
  const root = document.getElementById('financiacion-root');
  if (!root) return;

  root.innerHTML = `
    <!-- Tabs de categoría -->
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;" id="know-tabs">
      <button class="btn btn-primary know-tab active" data-cat="enisa">🏛️ ENISA</button>
      <button class="btn btn-secondary know-tab" data-cat="cdti">🔬 CDTI</button>
      <button class="btn btn-secondary know-tab" data-cat="incentivos_fiscales">💸 Incentivos Fiscales</button>
      <button class="btn btn-secondary know-tab" data-cat="financiacion_privada">💼 Capital Privado</button>
      <button class="btn btn-secondary know-tab" data-cat="financiacion_bancaria">🏦 Bancaria</button>
    </div>

    <!-- Contenido dinámico -->
    <div id="know-content"></div>
  `;

  function renderCategory(catId) {
    const cat = KNOWLEDGE_DATA[catId];
    if (!cat) return;
    const content = document.getElementById('know-content');

    if (catId === 'enisa') {
      content.innerHTML = `
        <div class="card" style="margin-bottom:20px;border-color:rgba(0,212,255,0.2);">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:1.8rem;">${cat.icon}</span>
            <div>
              <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;">${cat.title}</div>
              <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">${cat.estructura_interes}</div>
            </div>
          </div>
          <p style="font-size:0.87rem;color:var(--text-secondary);margin-bottom:16px;">${cat.intro}</p>

          <!-- Requisitos generales -->
          <details style="margin-bottom:16px;">
            <summary style="cursor:pointer;font-weight:600;color:var(--cyan);font-size:0.88rem;margin-bottom:8px;">
              📋 Requisitos Generales (aplican a todas las líneas)
            </summary>
            <ul style="margin-top:10px;padding-left:16px;display:flex;flex-direction:column;gap:6px;">
              ${cat.requisitos_generales.map(r => `<li style="font-size:0.83rem;color:var(--text-secondary);">${r}</li>`).join('')}
            </ul>
          </details>

          <!-- Tabla de líneas -->
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Línea</th>
                  <th style="text-align:right">Importe máx.</th>
                  <th>Cofinanciación</th>
                  <th>Antigüedad</th>
                  <th>Vencimiento</th>
                  <th>Carencia</th>
                </tr>
              </thead>
              <tbody>
                ${cat.lineas.map(l => `
                  <tr title="${l.notas}">
                    <td style="font-weight:600;color:var(--text-primary);">${l.nombre}</td>
                    <td class="td-num" style="color:var(--cyan);font-weight:700;">${l.importe}</td>
                    <td style="color:var(--text-secondary);">${l.cofinanciacion}</td>
                    <td style="color:var(--text-muted);font-size:0.8rem;">${l.antiguedad}</td>
                    <td style="color:var(--text-secondary);">${l.vencimiento}</td>
                    <td style="color:var(--green);">${l.carencia}</td>
                  </tr>
                  <tr><td colspan="6" style="font-size:0.75rem;color:var(--text-muted);padding:4px 14px 12px;border-bottom:1px solid var(--border);">💡 ${l.notas}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Calculadora ENISA -->
        <div class="card" style="border-color:rgba(0,212,255,0.2);">
          <div class="card-title">🧮 Calculadora ENISA</div>
          <p style="font-size:0.83rem;color:var(--text-secondary);margin-bottom:16px;">Estima el préstamo máximo que puede solicitar tu cliente según sus fondos propios.</p>
          <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;">
            <div class="form-group" style="min-width:200px;">
              <label for="calc-fondos">Fondos Propios (€)</label>
              <input type="number" id="calc-fondos" placeholder="Ej: 300000" min="0" />
            </div>
            <div class="form-group" style="min-width:200px;">
              <label for="calc-linea">Línea ENISA</label>
              <select id="calc-linea">
                <option value="jovenes">Jóvenes Emprendedores (2:1)</option>
                <option value="emprendedores" selected>Emprendedores (1:1)</option>
                <option value="crecimiento">Crecimiento (1:1)</option>
              </select>
            </div>
            <button class="btn btn-primary" id="btn-calcular-enisa">Calcular</button>
          </div>
          <div id="calc-result" style="margin-top:16px;display:none;padding:16px;background:var(--cyan-dim);border:1px solid var(--border-accent);border-radius:var(--radius-sm);">
            <span style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;color:var(--cyan);" id="calc-result-val"></span>
            <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px;" id="calc-result-desc"></div>
          </div>
        </div>
      `;

      document.getElementById('btn-calcular-enisa')?.addEventListener('click', () => {
        const fondos = parseFloat(document.getElementById('calc-fondos').value) || 0;
        const linea = document.getElementById('calc-linea').value;
        const max = calcularMaxENISA(fondos, linea);
        const resultEl = document.getElementById('calc-result');
        const valEl = document.getElementById('calc-result-val');
        const descEl = document.getElementById('calc-result-desc');
        resultEl.style.display = 'block';
        valEl.textContent = new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(max) + ' €';
        descEl.textContent = `Con ${new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(fondos)}€ de fondos propios, el máximo de ENISA ${linea} es ${new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(max)}€.`;
      });

    } else if (catId === 'cdti') {
      content.innerHTML = `
        <div class="card" style="margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:1.8rem;">${cat.icon}</span>
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;">${cat.title}</div>
          </div>
          <p style="font-size:0.87rem;color:var(--text-secondary);margin-bottom:20px;">${cat.intro}</p>
          <div style="display:flex;flex-direction:column;gap:14px;">
            ${cat.lineas.map(l => `
              <div style="padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-card);">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
                  <div style="font-weight:700;color:var(--text-primary);">${l.nombre}</div>
                  <div style="font-weight:700;color:var(--purple);">${l.importe}</div>
                </div>
                <div style="font-size:0.82rem;color:var(--cyan);margin-bottom:6px;">${l.tipo}</div>
                <div style="font-size:0.8rem;color:var(--text-muted);">Antigüedad: ${l.antiguedad}</div>
                <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:6px;">💡 ${l.notas}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (catId === 'incentivos_fiscales') {
      content.innerHTML = `
        <div class="card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:1.8rem;">${cat.icon}</span>
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;">${cat.title}</div>
          </div>
          <p style="font-size:0.87rem;color:var(--text-secondary);margin-bottom:20px;">${cat.intro}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
            ${cat.items.map(i => `
              <div style="padding:18px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-card);">
                <div style="font-weight:700;color:var(--green);margin-bottom:8px;">${i.nombre}</div>
                <div style="font-size:0.83rem;color:var(--text-secondary);margin-bottom:8px;line-height:1.6;">${i.descripcion}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);padding-top:8px;border-top:1px solid var(--border);">👤 ${i.perfil}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else {
      content.innerHTML = `
        <div class="card">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <span style="font-size:1.8rem;">${cat.icon}</span>
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;">${cat.title}</div>
          </div>
          <p style="font-size:0.87rem;color:var(--text-secondary);margin-bottom:20px;">${cat.intro}</p>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">
            ${cat.items.map(i => `
              <div style="padding:16px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--bg-card);">
                <div style="font-weight:700;color:${cat.color};margin-bottom:6px;">${i.nombre}</div>
                <div style="font-size:0.82rem;color:var(--text-secondary);line-height:1.6;">${i.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  // Tabs
  document.querySelectorAll('.know-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.know-tab').forEach(b => {
        b.className = 'btn btn-secondary know-tab';
      });
      btn.className = 'btn btn-primary know-tab active';
      renderCategory(btn.dataset.cat);
    });
  });

  // Render inicial
  renderCategory('enisa');
}
