/**
 * session.js — Gestor de persistencia de sesiones (.aptki)
 * Permite guardar y cargar el estado completo del análisis.
 */

/**
 * exportSession()
 * @description Empaqueta el estado global de la aplicación (STATE) en un archivo JSON descargable 
 * con la extensión `.aptki`. Esto permite la persistencia de datos 100% local sin necesidad de backend.
 * @returns {void} Inicia la descarga del archivo `.aptki` a través del navegador.
 */
function exportSession() {
  if (!STATE.analysisResult && !STATE.parsedLedger) {
    showToast('No hay datos para guardar', 'error');
    return;
  }

  // Clonamos el estado para limpiarlo de cosas que no queremos guardar (como archivos crudos)
  const sessionData = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    parsedLedger: STATE.parsedLedger,
    selectedProfileId: STATE.selectedProfile?.id,
    customMapping: STATE.customMapping,
    extraInputs: STATE.extraInputs,
    empresa: STATE.empresa,
    scoringInputs: STATE.scoringInputs,
    approvedAccruals: STATE.approvedAccruals,
    forecastScenario: STATE.forecastScenario
  };

  const dataStr = JSON.stringify(sessionData);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  
  const safeName = (STATE.empresa.nombre || 'sesion').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  a.download = `${safeName}_aptki.aptki`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Sesión guardada exitosamente ✓', 'success');
}

/**
 * importSession(file)
 * @description Lee un archivo `.aptki` subido por el usuario, decodifica el JSON y restaura 
 * el estado global de la aplicación (STATE). Si el archivo contiene análisis completos, los re-evalúa 
 * y recarga los módulos de Forecast y Scoring para rehidratar la UI a su estado original.
 * @param {File} file - El objeto File seleccionado por el usuario mediante un input type="file".
 * @returns {void} Muta la variable global `STATE` y navega automáticamente al Dashboard.
 */
function importSession(file) {
  if (!file.name.endsWith('.aptki') && !file.name.endsWith('.json')) {
    showToast('Formato de archivo no válido. Usa .aptki', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Restaurar estado
      STATE.parsedLedger = data.parsedLedger;
      STATE.customMapping = data.customMapping;
      STATE.extraInputs = data.extraInputs || {};
      STATE.empresa = data.empresa || { nombre: '', sector: '', empleados: 0 };
      STATE.scoringInputs = data.scoringInputs || {};
      STATE.approvedAccruals = data.approvedAccruals || [];
      STATE.forecastScenario = data.forecastScenario || 'base';

      // Restaurar perfil
      if (data.selectedProfileId) {
        STATE.selectedProfile = BUSINESS_PROFILES.find(p => p.id === data.selectedProfileId);
      }

      // Actualizar UI básica
      document.getElementById('empresa-badge').textContent =
        `${STATE.empresa.nombre || 'Sesión Recuperada'} · ${STATE.selectedProfile?.icon || ''} ${STATE.selectedProfile?.name || ''}`;

      // Si había un ledger parseado y un mapeo, reconstruir el análisis final directamente
      if (STATE.parsedLedger && STATE.customMapping && STATE.selectedProfile) {
        STATE.analysisResult = analyzeLedger(
          STATE.parsedLedger,
          STATE.selectedProfile.id,
          STATE.customMapping,
          STATE.approvedAccruals
        );
        STATE.accrualsReviewed = true;
        
        // Ejecutar los pre-cálculos de los módulos
        if (typeof scoreFinanciacion === 'function') {
           STATE.scoringResult = scoreFinanciacion(STATE.analysisResult, STATE.scoringInputs);
        }
        
        if (typeof buildForecast === 'function') {
           FORECAST_HYP = null; // forzar recalculo defaults si no hay
           STATE.forecastResult = buildForecast(STATE.analysisResult, typeof _getDefaultHyp === 'function' ? _getDefaultHyp() : {});
        }

        showToast('Sesión cargada. Análisis restaurado.', 'success');
        navigate('dashboard');
      } else {
        showToast('Sesión cargada parcialmente. Faltan datos.', 'warn');
      }

    } catch (err) {
      console.error(err);
      showToast('Error al leer el archivo de sesión', 'error');
    }
  };
  reader.readAsText(file);
}

// Escuchar cambios en un input oculto para cargar sesiones
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('session-upload-input');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) importSession(e.target.files[0]);
    });
  }
});
