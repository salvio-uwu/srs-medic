import React, { useState, useRef } from 'react';
import { Upload, X, AlertCircle, Check, ChevronRight, Loader } from 'lucide-react';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import * as XLSX from 'xlsx';

const FIELD_MAPPING_SUGGESTIONS = {
  'NOMBRE COMERCIAL': 'nombreComercial',
  'Nombre Comercial': 'nombreComercial',
  'MARCA': 'marca',
  'Marca': 'marca',
  'LABORATORIO': 'laboratorio',
  'Laboratorio': 'laboratorio',
  "SUSTANCIA(S) ACTIVA(S)": 'sustanciasActivas',
  'Sustancia (s) Activa (s)': 'sustanciasActivas',
  'SUSTANCIA ACTIVA': 'sustanciasActivas',
  'PRESENTACIÓN': 'presentacion',
  'Presentación': 'presentacion',
  'PRESENTACION': 'presentacion',
  'DOSIS': 'dosis',
  'Dosis': 'dosis',
  'NÚMERO DE ACOMODO': 'numeroAcomodo',
  'ACOMODO': 'numeroAcomodo',
  'Número de Acomodo': 'numeroAcomodo',
  'INDICACIÓN': 'indicacion',
  'Indicación': 'indicacion',
  'INDICACION': 'indicacion',
  'ADVERTENCIA': 'advertencia',
  'Advertencia': 'advertencia',
  'EMBARAZO': 'embarazo',
  'Embarazo': 'embarazo',
  'NIVEL': 'nivelUtilidad',
  'Nivel': 'nivelUtilidad',
  'COLOR': 'color',
  'Color': 'color',
  'CONTROLADO': 'controlado',
  'Controlado': 'controlado',
  'OPCIÓN 2': 'opcion2',
  'OPCION 2': 'opcion2',
  'Opción 2': 'opcion2'
};

const REQUIRED_FIELDS = ['nombreComercial', 'marca', 'laboratorio', 'sustanciasActivas', 'presentacion', 'dosis', 'numeroAcomodo', 'indicacion', 'advertencia', 'embarazo'];

export default function ImportMedicamentosModal({ onClose, onImportComplete }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'mapping' | 'importing'
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rows.length === 0) {
        setError('El archivo está vacío');
        return;
      }

      const detectedHeaders = Object.keys(rows[0]);
      setRawData(rows);
      setHeaders(detectedHeaders);

      // Auto-mapeo
      const autoMapping = {};
      detectedHeaders.forEach((header) => {
        autoMapping[header] = FIELD_MAPPING_SUGGESTIONS[header] || '';
      });
      setMapping(autoMapping);

      setError('');
      setStep('mapping');
    } catch (err) {
      setError(`Error al leer el archivo: ${err.message}`);
    }
  };

  const canImport = () => {
    return REQUIRED_FIELDS.every((field) =>
      Object.values(mapping).includes(field)
    );
  };

  const handleMappingChange = (header, field) => {
    setMapping((prev) => ({
      ...prev,
      [header]: field
    }));
  };

  const handleImport = async () => {
    if (!canImport()) {
      setError('Todos los campos requeridos deben estar mapeados');
      return;
    }

    setImporting(true);
    setStep('importing');

    try {
      const batch = writeBatch(db);
      const medicamentosRef = collection(db, 'catalogo_medicamentos');
      let imported = 0;

      for (const row of rawData) {
        // Mapear e transformar datos
        const mappedData = {};
        Object.entries(mapping).forEach(([excelCol, dbField]) => {
          if (dbField && row[excelCol] !== undefined) {
            const value = row[excelCol];

            // Transformaciones específicas
            if (dbField === 'nivelUtilidad') {
              mappedData[dbField] = parseInt(value) || 3;
            } else if (dbField === 'controlado') {
              mappedData[dbField] = String(value).toLowerCase() === 'true' || String(value).toLowerCase() === 'sí';
            } else {
              mappedData[dbField] = String(value).trim();
            }
          }
        });

        // Validar campos requeridos
        const hasMissingRequired = REQUIRED_FIELDS.some(
          (field) => !mappedData[field]
        );
        if (hasMissingRequired) continue;

        // Agregar campos de auditoría y defaults
        const finalData = {
          ...mappedData,
          color: mappedData.color || '#0077B6',
          controlado: mappedData.controlado || false,
          activo: true,
          createdAt: serverTimestamp(),
          createdBy: user?.uid || 'sistema',
          createdByName: user?.displayName || 'Sistema'
        };

        // Agregar a batch
        const docRef = doc(medicamentosRef);
        batch.set(docRef, finalData);
        imported++;

        // Actualizar progreso
        setImportProgress(Math.round((imported / rawData.length) * 100));
      }

      await batch.commit();
      setImportProgress(100);

      setTimeout(() => {
        onImportComplete();
      }, 1000);
    } catch (err) {
      setError(`Error al importar: ${err.message}`);
      setImporting(false);
      setStep('mapping');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Importar Medicamentos desde Excel</h2>
            <p className="text-sm text-slate-500 mt-1">
              {step === 'upload' && 'Selecciona un archivo .xlsx'}
              {step === 'mapping' && 'Mapea las columnas de tu archivo'}
              {step === 'importing' && 'Importando medicamentos...'}
            </p>
          </div>
          {step !== 'importing' && (
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X size={20} className="text-slate-600" />
            </button>
          )}
        </div>

        <div className="p-6">
          {/* Error */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3 items-start">
              <AlertCircle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900">{error}</p>
              </div>
            </div>
          )}

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all"
              >
                <Upload size={32} className="mx-auto mb-3 text-slate-400" />
                <p className="font-semibold text-slate-900">Haz clic aquí o arrastra un archivo</p>
                <p className="text-sm text-slate-500 mt-1">Formatos soportados: .xlsx, .xls</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Step: Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Detectados:</strong> {headers.length} columnas, {rawData.length} filas
                </p>
              </div>

              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {headers.map((header, idx) => (
                  <div key={idx} className="grid grid-cols-[200px_40px_200px] gap-2 items-center">
                    <div className="text-sm font-semibold text-slate-700 truncate">{header}</div>
                    <ChevronRight size={16} className="text-slate-400 justify-self-center" />
                    <select
                      value={mapping[header] || ''}
                      onChange={(e) => handleMappingChange(header, e.target.value)}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">-- No mapear --</option>
                      <optgroup label="Requeridos">
                        {REQUIRED_FIELDS.map((field) => (
                          <option key={field} value={field}>
                            {field === 'nombreComercial' && 'Nombre Comercial'}
                            {field === 'marca' && 'Marca'}
                            {field === 'laboratorio' && 'Laboratorio'}
                            {field === 'sustanciasActivas' && 'Sustancia Activa'}
                            {field === 'presentacion' && 'Presentación'}
                            {field === 'dosis' && 'Dosis'}
                            {field === 'numeroAcomodo' && 'Número de Acomodo'}
                            {field === 'indicacion' && 'Indicación'}
                            {field === 'advertencia' && 'Advertencia'}
                            {field === 'embarazo' && 'Embarazo'}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label="Opcionales">
                        <option value="opcion2">Opción 2</option>
                        <option value="nivelUtilidad">Nivel</option>
                        <option value="color">Color</option>
                        <option value="controlado">Controlado</option>
                      </optgroup>
                    </select>
                  </div>
                ))}
              </div>

              {/* Validación */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-slate-700 mb-2">Campos requeridos mapeo:</p>
                <div className="grid grid-cols-2 gap-2">
                  {REQUIRED_FIELDS.map((field) => {
                    const isMapped = Object.values(mapping).includes(field);
                    return (
                      <div key={field} className="flex items-center gap-2 text-sm">
                        {isMapped ? (
                          <Check size={16} className="text-emerald-600" />
                        ) : (
                          <AlertCircle size={16} className="text-red-600" />
                        )}
                        <span className={isMapped ? 'text-slate-700' : 'text-red-600'}>
                          {field === 'nombreComercial' && 'Nombre Comercial'}
                          {field === 'marca' && 'Marca'}
                          {field === 'laboratorio' && 'Laboratorio'}
                          {field === 'sustanciasActivas' && 'Sustancia Activa'}
                          {field === 'presentacion' && 'Presentación'}
                          {field === 'dosis' && 'Dosis'}
                          {field === 'numeroAcomodo' && 'Número de Acomodo'}
                          {field === 'indicacion' && 'Indicación'}
                          {field === 'advertencia' && 'Advertencia'}
                          {field === 'embarazo' && 'Embarazo'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="space-y-4 py-8">
              <div className="text-center">
                <Loader size={40} className="mx-auto text-blue-600 animate-spin mb-3" />
                <p className="font-semibold text-slate-900">Importando medicamentos...</p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${importProgress}%` }}
                />
              </div>

              <p className="text-center text-sm text-slate-600">{importProgress}% completado</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== 'importing' && (
          <div className="sticky bottom-0 bg-white border-t border-slate-200 p-6 flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-semibold hover:bg-slate-100 transition-all"
            >
              Cancelar
            </button>

            {step === 'mapping' && (
              <button
                onClick={handleImport}
                disabled={!canImport()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                <Upload size={16} />
                Importar {rawData.length} medicamentos
              </button>
            )}

            {step === 'upload' && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Upload size={16} />
                Seleccionar archivo
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
