// src/components/PlantillaDinamicaModal.jsx
// Extraído de ExpedienteClinico.jsx — Fases 1-5 (split-view, acordeones, table editor, unidades)
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { X, ChevronDown } from 'lucide-react';
import { uploadDocumentoPDF } from '../services/documentStorageService';
import { FIELD_GROUPS, FIELD_LIBRARY } from '../pages/admin/PlantillasDocumentos';

/* ═══════════════════════════════════════════════════════════════════ */
/* TableEditor — edición real de celdas para secciones con <table>    */
/* ═══════════════════════════════════════════════════════════════════ */
const parseTableRows = (html = '') => {
  try {
    const parser = new DOMParser();
    const docEl = parser.parseFromString(html, 'text/html');
    const table = docEl.querySelector('table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).map((tr) =>
      Array.from(tr.querySelectorAll('th, td')).map((cell) => ({
        text: cell.textContent || '',
        isHeader: cell.tagName === 'TH',
      }))
    );
  } catch {
    return [];
  }
};

const buildTableHtml = (rows = []) => {
  if (rows.length === 0) return '';
  const hasHeaderRow = rows[0]?.some((c) => c.isHeader);
  const headerHtml = hasHeaderRow
    ? `<thead><tr>${rows[0]
        .map((c) => `<th style="border:1px solid #cbd5e1;padding:4px 8px;background:#f8fafc;font-weight:700;text-align:left;">${c.text}</th>`)
        .join('')}</tr></thead>`
    : '';
  const bodyRows = hasHeaderRow ? rows.slice(1) : rows;
  const bodyHtml = `<tbody>${bodyRows
    .map(
      (row) =>
        `<tr>${row
          .map((c) => `<td style="border:1px solid #cbd5e1;padding:4px 8px;">${c.text}</td>`)
          .join('')}</tr>`
    )
    .join('')}</tbody>`;
  return `<table style="width:100%;border-collapse:collapse;">${headerHtml}${bodyHtml}</table>`;
};

const TableEditor = ({ html, onCommit }) => {
  const initialRows = useMemo(() => parseTableRows(html), [html]);
  const [rows, setRows] = useState(initialRows);

  const updateCell = (ri, ci, value) =>
    setRows((prev) =>
      prev.map((row, r) =>
        r === ri ? row.map((cell, c) => (c === ci ? { ...cell, text: value } : cell)) : row
      )
    );

  const addRow = () => {
    const colCount = rows[0]?.length || 1;
    setRows((prev) => [
      ...prev,
      Array.from({ length: colCount }, () => ({ text: '', isHeader: false })),
    ]);
  };

  const removeRow = (ri) => setRows((prev) => prev.filter((_, i) => i !== ri));

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-slate-200 p-0">
                    <input
                      value={cell.text}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className={`w-full min-w-[60px] px-2 py-1.5 text-xs bg-transparent focus:bg-blue-50 focus:outline-none ${
                        cell.isHeader ? 'font-bold bg-slate-50' : ''
                      }`}
                    />
                  </td>
                ))}
                <td className="border border-slate-100 px-1.5 text-center">
                  <button
                    onClick={() => removeRow(ri)}
                    className="text-slate-300 hover:text-rose-500 text-base leading-none"
                    title="Eliminar fila"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-slate-100 bg-slate-50">
        <button
          onClick={addRow}
          className="text-xs text-blue-600 font-semibold hover:underline"
        >
          + Agregar fila
        </button>
        <button
          onClick={() => onCommit?.(buildTableHtml(rows))}
          className="ml-auto px-3 py-1 rounded-md bg-blue-600 text-white text-xs font-bold hover:bg-blue-700"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* InlineHtmlEditor                                                    */
/* ═══════════════════════════════════════════════════════════════════ */
export const InlineHtmlEditor = ({ value, onCommit, className = '' }) => {
  const editorRef = useRef(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!editorRef.current || isFocusedRef.current) return;
    const nextValue = String(value || '');
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value]);

  return (
    <div
      ref={editorRef}
      contentEditable
      suppressContentEditableWarning
      onFocus={() => {
        isFocusedRef.current = true;
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        onCommit?.(event.currentTarget.innerHTML);
      }}
      className={`w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200 overflow-auto break-words [&_table]:w-full [&_table]:border-collapse [&_table_td]:border [&_table_td]:border-slate-300 [&_table_td]:px-2 [&_table_td]:py-1 [&_table_td]:text-xs [&_table_th]:border [&_table_th]:border-slate-300 [&_table_th]:px-2 [&_table_th]:py-1 [&_table_th]:text-xs [&_table_th]:font-bold [&_table_th]:bg-slate-50 ${className}`}
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* Unit helpers — espejo de appendUnitIfNeeded en ExpedienteClinico   */
/* ═══════════════════════════════════════════════════════════════════ */
const UNIT_BY_FIELD = {
  'exploracion.antropometria.peso': 'kg',
  'exploracion.antropometria.talla': 'm',
  'exploracion.signos.temp': '°C',
  'exploracion.signos.fc': 'lpm',
  'exploracion.signos.fr': 'rpm',
  'exploracion.signos.spo2': '%',
};

const fieldHasValue = (value) =>
  value !== null && value !== undefined && String(value).trim() !== '';

const appendUnit = (fieldPath, value) => {
  const unit = UNIT_BY_FIELD[String(fieldPath || '')];
  if (!unit || !fieldHasValue(value)) return value ?? '';
  const raw = String(value).trim();
  if (raw.toLowerCase().includes(unit.toLowerCase())) return raw;
  return `${raw} ${unit}`;
};

/* ═══════════════════════════════════════════════════════════════════ */
/* Panel de campos — acordeones por grupo con FIELD_GROUPS            */
/* ═══════════════════════════════════════════════════════════════════ */
const FieldsPanel = ({
  detectedFieldKeys,
  fieldOverrides,
  resolverCampo,
  updateFieldOverride,
  onResetAll,
}) => {
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {};
    FIELD_GROUPS.forEach((g) => { init[g.id] = true; });
    return init;
  });

  const toggleGroup = (id) =>
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));

  const hasOverrideKey = (key) =>
    Object.prototype.hasOwnProperty.call(fieldOverrides, key);

  const detectedSet = new Set(detectedFieldKeys);

  // Campos agrupados y "otros" (no en ningún grupo)
  const groupedFieldIds = new Set(FIELD_GROUPS.flatMap((g) => g.fields));
  const ungroupedFields = detectedFieldKeys.filter(
    (fid) => detectedSet.has(fid) && !groupedFieldIds.has(fid)
  );

  const renderField = (fieldId) => {
    const meta = FIELD_LIBRARY.find((f) => f.id === fieldId);
    const baseValue = resolverCampo(fieldId) || '';
    const hasOv = hasOverrideKey(fieldId);
    const currentValue = hasOv ? (fieldOverrides[fieldId] ?? '') : '';
    const isMultiline =
      fieldId.includes('html') ||
      fieldId.includes('texto') ||
      fieldId.includes('indicaciones') ||
      fieldId.includes('diagnostico') ||
      fieldId.includes('padecimiento');

    return (
      <div
        key={fieldId}
        className={`rounded-lg p-2.5 border ${
          hasOv ? 'bg-amber-50 border-amber-200' : 'bg-white border-slate-100'
        }`}
      >
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <span className="text-[11px] font-bold text-slate-600 leading-tight">
            {meta?.label || fieldId}
          </span>
          {hasOv && (
            <button
              onClick={() => updateFieldOverride(fieldId, baseValue)}
              className="shrink-0 text-[10px] text-amber-600 hover:text-amber-800 font-semibold underline"
            >
              Restaurar
            </button>
          )}
        </div>
        {isMultiline ? (
          <textarea
            value={currentValue}
            placeholder={
              baseValue ? String(baseValue).slice(0, 120) : '—'
            }
            onChange={(e) => updateFieldOverride(fieldId, e.target.value)}
            rows={3}
            className={`w-full rounded border text-xs px-2 py-1.5 focus:outline-none focus:ring-1 resize-y ${
              hasOv
                ? 'border-amber-200 focus:ring-amber-300'
                : 'border-slate-200 focus:ring-blue-200'
            } bg-white text-slate-700`}
          />
        ) : (
          <input
            value={currentValue}
            placeholder={baseValue ? String(baseValue).slice(0, 80) : '—'}
            onChange={(e) => updateFieldOverride(fieldId, e.target.value)}
            className={`w-full rounded border text-xs px-2 py-1.5 focus:outline-none focus:ring-1 ${
              hasOv
                ? 'border-amber-200 focus:ring-amber-300'
                : 'border-slate-200 focus:ring-blue-200'
            } bg-white text-slate-700`}
          />
        )}
      </div>
    );
  };

  const totalOverrides = Object.keys(fieldOverrides).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-400">
          {detectedFieldKeys.length} campo{detectedFieldKeys.length !== 1 ? 's' : ''} detectado{detectedFieldKeys.length !== 1 ? 's' : ''}
        </span>
        {totalOverrides > 0 && (
          <button
            onClick={onResetAll}
            className="text-[11px] text-rose-600 font-semibold hover:underline"
          >
            Limpiar todo ({totalOverrides})
          </button>
        )}
      </div>

      {detectedFieldKeys.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-6">
          Esta plantilla no tiene campos dinámicos detectables.
        </p>
      )}

      {FIELD_GROUPS.map((group) => {
        const groupFields = group.fields.filter((fid) => detectedSet.has(fid));
        if (groupFields.length === 0) return null;
        const isOpen = openGroups[group.id] ?? true;
        const groupOverrides = groupFields.filter((fid) => hasOverrideKey(fid));

        return (
          <div
            key={group.id}
            className="border border-slate-200 rounded-xl overflow-hidden"
          >
            <button
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: group.color }}
                />
                <span className="text-xs font-bold text-slate-700 truncate">
                  {group.label}
                </span>
                <span className="text-[10px] text-slate-400">
                  ({groupFields.length})
                </span>
                {groupOverrides.length > 0 && (
                  <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                    {groupOverrides.length} editado{groupOverrides.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-400 shrink-0 transition-transform duration-150 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {isOpen && (
              <div className="p-2.5 space-y-2">
                {groupFields.map(renderField)}
              </div>
            )}
          </div>
        );
      })}

      {ungroupedFields.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => toggleGroup('__otros__')}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-slate-400" />
              <span className="text-xs font-bold text-slate-700">
                Otros
              </span>
              <span className="text-[10px] text-slate-400">
                ({ungroupedFields.length})
              </span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-400 shrink-0 transition-transform duration-150 ${
                openGroups['__otros__'] ? 'rotate-180' : ''
              }`}
            />
          </button>
          {openGroups['__otros__'] && (
            <div className="p-2.5 space-y-2">
              {ungroupedFields.map(renderField)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* Panel de contenido — secciones editables con InlineHtmlEditor      */
/* ═══════════════════════════════════════════════════════════════════ */
const ContentPanel = ({ sections, contentOverrides, getContentHtml, updateContentOverride, onResetAll }) => {
  const hasOverrideKey = (key) =>
    Object.prototype.hasOwnProperty.call(contentOverrides, key);

  const totalOverrides = Object.keys(contentOverrides).length;

  if (sections.length === 0) {
    return (
      <p className="text-xs text-slate-400 text-center py-6">
        Esta plantilla no tiene secciones de texto editables.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {totalOverrides > 0 && (
        <div className="flex justify-end">
          <button
            onClick={onResetAll}
            className="text-[11px] text-rose-600 font-semibold hover:underline"
          >
            Restaurar todo ({totalOverrides})
          </button>
        </div>
      )}

      {sections.map((section) => {
        const currentHtml = getContentHtml(section.key, section.baseHtml);
        const hasOv = hasOverrideKey(section.key);
        const hasTable =
          currentHtml.includes('<table') || currentHtml.includes('<TABLE');

        return (
          <div
            key={section.key}
            className={`rounded-xl border p-3 ${
              hasOv ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide truncate">
                  {section.label}
                </p>
                {section.helper && (
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {section.helper}
                  </p>
                )}
              </div>
              {hasOv && (
                <button
                  onClick={() =>
                    updateContentOverride(section.key, section.baseHtml, section.baseHtml)
                  }
                  className="shrink-0 text-[10px] text-amber-600 font-semibold hover:underline"
                >
                  Restaurar
                </button>
              )}
            </div>

            {section.options?.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {section.options.map((opt) => {
                  const isSelected = getContentHtml(section.key, section.baseHtml) === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => updateContentOverride(section.key, opt, section.baseHtml)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ) : hasTable ? (
              <TableEditor
                html={currentHtml}
                onCommit={(nextHtml) =>
                  updateContentOverride(section.key, nextHtml, section.baseHtml)
                }
              />
            ) : (
              <InlineHtmlEditor
                value={currentHtml}
                onCommit={(nextHtml) =>
                  updateContentOverride(section.key, nextHtml, section.baseHtml)
                }
                className="min-h-[60px]"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════ */
/* PlantillaDinamicaModal — componente principal                       */
/* ═══════════════════════════════════════════════════════════════════ */
const PlantillaDinamicaModal = ({
  plantilla,
  resolverTexto,
  resolverCampo,
  onClose,
  onBackToMenu,
  onNotify,
  onDocumentGenerated,
  pacienteId,
}) => {
  const schema = plantilla?.schema || {};
  const bloques = schema?.bloques || [];
  const campos = schema?.campos || [];
  const elementos = schema?.elements || [];
  const documentHtml = schema?.documentHtml || '';
  const page = schema?.page || { width: 816, height: 1056 };
  const printPageRef = useRef(null);
  const printScrollRef = useRef(null);
  const signatureCanvasRef = useRef(null);
  const isSigningRef = useRef(false);
  const lastPointRef = useRef(null);
  const recipePageOverridesRef = useRef(null);

  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editorTab, setEditorTab] = useState('campos');
  const [isPrinting, setIsPrinting] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState('');
  const [fieldOverrides, setFieldOverrides] = useState({});
  const [contentOverrides, setContentOverrides] = useState({});

  const docMargins = { top: 0, right: 0, bottom: 0, left: 0 };
  const docBaseFontPt = 12;
  const documentFontFamily = schema?.documentFontFamily || 'Trebuchet MS';
  const documentLineHeight = Number(schema?.documentLineHeight || 1.45);
  const normalizedDocumentHtml = String(documentHtml || '').replace(
    /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi,
    (_, num) => `font-size:${num}pt`
  );
  const hasDocumentHtml = Boolean(String(documentHtml || '').trim());
  const isRecipeTemplate = (plantilla?.tipoDocumento || 'general') === 'receta';
  const LETTER_WIDTH = 816;
  const LETTER_HEIGHT = 1056;
  const HALF_LETTER_HEIGHT = LETTER_HEIGHT / 2;
  const PT_TO_CSS_PX = 96 / 72;

  const isNearDimension = (value = 0, target = 0, tolerance = 3) =>
    Math.abs(Number(value || 0) - Number(target || 0)) <= tolerance;

  const isLikelyPointBasedPage = (width = 0, height = 0) => {
    const knownPointSizes = [
      [612, 792],
      [612, 396],
      [595, 842],
      [612, 1008],
      [420, 595],
    ];
    return knownPointSizes.some(
      ([w, h]) => isNearDimension(width, w) && isNearDimension(height, h)
    );
  };

  const normalizedPage = useMemo(() => {
    const rawWidth = Number(page?.width || LETTER_WIDTH);
    const rawHeight = Number(
      page?.height || (isRecipeTemplate ? HALF_LETTER_HEIGHT : LETTER_HEIGHT)
    );
    const safeWidth =
      Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : LETTER_WIDTH;
    const safeHeight =
      Number.isFinite(rawHeight) && rawHeight > 0
        ? rawHeight
        : isRecipeTemplate
        ? HALF_LETTER_HEIGHT
        : LETTER_HEIGHT;

    const looksPointBased = isLikelyPointBasedPage(safeWidth, safeHeight);
    let width = looksPointBased ? safeWidth * PT_TO_CSS_PX : safeWidth;
    let height = looksPointBased ? safeHeight * PT_TO_CSS_PX : safeHeight;

    if (isRecipeTemplate) {
      const looksLegacyFullHeight = height > HALF_LETTER_HEIGHT + 180;
      if (looksLegacyFullHeight && !hasDocumentHtml) {
        const allPositionedItems = [
          ...(Array.isArray(elementos) ? elementos : []),
          ...(Array.isArray(campos) ? campos : []),
          ...(Array.isArray(bloques) ? bloques : []),
        ];
        const maxBottom = allPositionedItems.reduce((acc, item) => {
          const y = Number(item?.y || 0);
          const rawItemHeight = Number(item?.h);
          const fallbackHeight =
            item?.type === 'shape' || item?.tipo === 'forma' ? 2 : 24;
          const itemHeight =
            Number.isFinite(rawItemHeight) && rawItemHeight > 0
              ? rawItemHeight
              : fallbackHeight;
          return Math.max(acc, y + itemHeight);
        }, 0);
        if (maxBottom === 0 || maxBottom <= HALF_LETTER_HEIGHT + 32) {
          height = HALF_LETTER_HEIGHT;
        }
      }
    }

    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
    };
  }, [bloques, campos, elementos, hasDocumentHtml, isRecipeTemplate, page?.height, page?.width]);

  const getElementRenderZ = (el) => {
    if (el?.type === 'image' && el?.isWatermark) return 0;
    return Number(el?.zIndex || 1) + 10;
  };
  const orderedElementos = [...elementos].sort(
    (a, b) => Number(getElementRenderZ(a)) - Number(getElementRenderZ(b))
  );

  const detectedFieldKeys = useMemo(() => {
    const keySet = new Set();
    const collectFromText = (text = '') => {
      const regex = /\{\{\s*([^}]+)\s*\}\}/g;
      let match;
      while ((match = regex.exec(String(text))) !== null) {
        const key = String(match[1] || '').trim();
        if (key) keySet.add(key);
      }
    };
    collectFromText(documentHtml || '');
    (elementos || []).forEach((el) => {
      if (el?.type === 'field') {
        const bind = String(el?.bind || el?.id || '').trim();
        if (bind) keySet.add(bind);
        return;
      }
      collectFromText(el?.contentHtml || el?.content || '');
    });
    (bloques || []).forEach((bloque) => {
      collectFromText(bloque?.contenidoHtml || bloque?.contenido || '');
    });
    return Array.from(keySet).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }, [bloques, documentHtml, elementos]);

  const normalizeTemplateFieldKey = (raw = '') =>
    String(raw || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, '')
      .trim();

  const hasOverrideKey = (source = {}, key = '') =>
    Object.prototype.hasOwnProperty.call(source, String(key || '').trim());

  const normalizeComparableHtml = (value = '') =>
    String(value || '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<div><br><\/div>/gi, '')
      .replace(/<br\s*\/?>/gi, '<br/>')
      .replace(/>\s+</g, '><')
      .trim();

  const hasManualEdits = useMemo(
    () =>
      Object.keys(fieldOverrides).length > 0 ||
      Object.keys(contentOverrides).length > 0,
    [contentOverrides, fieldOverrides]
  );

  // ── Field overrides ────────────────────────────────────────────────
  const updateFieldOverride = (fieldKey = '', value = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    if (!key) return;
    const rawValue = String(value ?? '');
    // Comparar el valor resuelto (con unidad) contra la base para evitar overrides innecesarios
    const resolvedValue = appendUnit(key, rawValue);
    const baseValue = String(resolverCampo(key) || '');
    setFieldOverrides((prev) => {
      const next = { ...prev };
      if (resolvedValue === baseValue) {
        delete next[key];
      } else {
        next[key] = rawValue; // guardar sin unidad para que el usuario no la vea duplicada
      }
      return next;
    });
  };

  // ── Content overrides ──────────────────────────────────────────────
  const updateContentOverride = (sectionKey = '', value = '', baseValue = '') => {
    const key = String(sectionKey || '').trim();
    if (!key) return;
    const normalizedValue = String(value || '');
    setContentOverrides((prev) => {
      const next = { ...prev };
      if (
        normalizeComparableHtml(normalizedValue) ===
        normalizeComparableHtml(baseValue)
      ) {
        delete next[key];
      } else {
        next[key] = normalizedValue;
      }
      return next;
    });
  };

  // ── Campo editable: resuelve override o valor base + unidad ────────
  const resolveCampoEditable = (fieldKey = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    if (!key) return '';
    const pageOv = recipePageOverridesRef.current;
    if (pageOv && Object.prototype.hasOwnProperty.call(pageOv, key)) {
      return String(pageOv[key] ?? '');
    }
    if (hasOverrideKey(fieldOverrides, key)) {
      // Fase 5: aplicar unidad al override para no perderla
      return appendUnit(key, String(fieldOverrides[key] ?? ''));
    }
    return resolverCampo(key) || '';
  };

  // ── Content section ────────────────────────────────────────────────
  const getContentHtml = (sectionKey = '', baseHtml = '') => {
    if (hasOverrideKey(contentOverrides, sectionKey)) {
      return String(contentOverrides[sectionKey] ?? '');
    }
    return String(baseHtml || '');
  };

  // ── Address helpers ────────────────────────────────────────────────
  const shouldHideFieldLabel = (fieldKey = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    return (
      key === 'fecha.hoy' ||
      key === 'fecha.hoy_larga' ||
      key === 'fecha.larga' ||
      key === 'fechaexpedida' ||
      key === 'fecha.expedida'
    );
  };

  const isGuardedAddressField = (fieldKey = '') => {
    const key = normalizeTemplateFieldKey(fieldKey);
    return (
      key === 'sucursal.direccion' ||
      key === 'sucursal.ubicacion' ||
      key === 'sucursal.domicilio' ||
      key === 'consultorio.direccion' ||
      key === 'consultorio.ubicacion' ||
      key === 'consultorio.domicilio'
    );
  };

  const addAddressSoftWrapHints = (value = '') =>
    String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/([,;\/-])/g, '$1\u200B');

  const getAddressGuardStyle = (
    fieldKey = '',
    { fontSize = 12, lineHeight = 1.35, boxHeight = 20 } = {}
  ) => {
    if (!isRecipeTemplate || !isGuardedAddressField(fieldKey)) return null;
    const compactFont = Math.min(Number(fontSize || 12), 9);
    const compactLineHeight = Math.min(Number(lineHeight || 1.35), 1.15);
    const estimatedLines = Math.max(
      2,
      Math.min(
        4,
        Math.floor(
          Number(boxHeight || 20) / Math.max(1, compactFont * compactLineHeight)
        )
      )
    );
    return {
      fontSize: compactFont,
      lineHeight: compactLineHeight,
      overflow: 'hidden',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      whiteSpace: 'normal',
      display: '-webkit-box',
      WebkitBoxOrient: 'vertical',
      WebkitLineClamp: estimatedLines,
      textOverflow: 'ellipsis',
    };
  };

  const buildFieldDisplayText = (fieldKey = '', label = '', value = '') => {
    const safeValue = String(value || '');
    const normalizedValue =
      isRecipeTemplate && isGuardedAddressField(fieldKey)
        ? addAddressSoftWrapHints(safeValue)
        : safeValue;
    if (shouldHideFieldLabel(fieldKey)) return safeValue;
    return `${label ? `${label}: ` : ''}${normalizedValue}`;
  };

  const escapeHtml = (value = '') =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  const toPlainTextHtml = (value = '') =>
    escapeHtml(String(value || '')).replace(/\n/g, '<br/>');

  // ── Template resolution ────────────────────────────────────────────
  const resolveTemplateWithSignature = (raw = '', { allowHtml = false } = {}) => {
    return String(raw).replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, keyRaw) => {
      const key = normalizeTemplateFieldKey(keyRaw);

      if (key === 'firma.medico') {
        if (!signatureDataUrl) return '';
        if (!allowHtml) return '[Firma digital capturada]';
        return `<img src="${signatureDataUrl}" alt="Firma del medico" style="max-width:220px;height:80px;object-fit:contain;display:block;"/>`;
      }

      if (key === 'firma.linea') {
        const nombreMedico =
          resolveCampoEditable('medico.nombre') || 'Firma del medico';
        if (!allowHtml) return '____________________________';
        return `<div style="margin:20px auto 0 auto;width:320px;max-width:100%;border-top:2px solid #334155;padding-top:8px;text-align:center;font-weight:700;">${escapeHtml(
          nombreMedico
        )}</div>`;
      }

      if (key === 'consulta.tratamiento_html') {
        if (!allowHtml)
          return resolveCampoEditable('consulta.tratamiento_texto') || '';
        if (hasOverrideKey(fieldOverrides, 'consulta.tratamiento_html')) {
          return String(fieldOverrides['consulta.tratamiento_html'] || '');
        }
        return resolveCampoEditable('consulta.tratamiento_html') || '';
      }

      const value = resolveCampoEditable(key) || '';
      const normalizedValue =
        isRecipeTemplate && isGuardedAddressField(key)
          ? addAddressSoftWrapHints(value)
          : value;

      if (!allowHtml) return normalizedValue;

      if (isRecipeTemplate && isGuardedAddressField(key)) {
        const safeAddress = escapeHtml(normalizedValue).replace(/\n/g, '<br/>');
        return `<span style="display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;word-break:break-word;overflow-wrap:anywhere;line-height:1.15;max-width:100%;font-size:0.92em;">${safeAddress}</span>`;
      }

      return escapeHtml(normalizedValue).replace(/\n/g, '<br/>');
    });
  };

  const buildElementResolvedHtml = (elemento = {}) => {
    const isField = elemento.type === 'field';
    const bindKey = elemento.bind || elemento.id;
    if (isField && bindKey === 'firma.medico') return null;
    if (isField && bindKey === 'firma.linea') return null;
    if (isField) {
      const value = resolveCampoEditable(bindKey);
      return toPlainTextHtml(buildFieldDisplayText(bindKey, elemento.label, value));
    }
    if (elemento.type === 'select') {
      return elemento.value || elemento.options?.[0] || '';
    }
    return resolveTemplateWithSignature(
      elemento.contentHtml || elemento.content || '',
      { allowHtml: true }
    );
  };

  const buildCampoResolvedHtml = (campo = {}) => {
    const bindKey = campo.bind || campo.id;
    const value = resolveCampoEditable(bindKey);
    return toPlainTextHtml(buildFieldDisplayText(bindKey, campo.label, value));
  };

  const buildBloqueResolvedHtml = (bloque = {}) => {
    if (bloque.contenidoHtml) {
      return resolveTemplateWithSignature(bloque.contenidoHtml, { allowHtml: true });
    }
    return toPlainTextHtml(
      resolveTemplateWithSignature(bloque.contenido || '', { allowHtml: false })
    );
  };

  const editableContentSections = useMemo(() => {
    const sections = [];
    if (documentHtml) {
      sections.push({
        key: 'documentHtml',
        label: 'Documento completo',
        helper: 'Edita el cuerpo principal manteniendo el formato visible.',
        baseHtml: resolveTemplateWithSignature(normalizedDocumentHtml, {
          allowHtml: true,
        }),
      });
    }
    orderedElementos.forEach((elemento, index) => {
      if (elemento.type === 'image' || elemento.type === 'shape') return;
      const bindKey = elemento.bind || elemento.id;
      if (bindKey === 'firma.medico' || bindKey === 'firma.linea') return;
      const baseHtml = buildElementResolvedHtml(elemento);
      if (baseHtml === null) return;
      sections.push({
        key: `element:${elemento.id}`,
        label:
          elemento.type === 'field'
            ? elemento.label || bindKey || `Campo ${index + 1}`
            : elemento.type === 'select'
            ? elemento.label || `Selección ${index + 1}`
            : `Texto ${index + 1}`,
        helper:
          elemento.type === 'field'
            ? 'Sobrescribe el texto final de este campo tal como se imprimirá.'
            : elemento.type === 'select'
            ? `Elige una opción: ${(elemento.options || []).join(', ')}`
            : 'Edita este bloque de texto libre ya resuelto.',
        baseHtml,
        options: elemento.type === 'select' ? (elemento.options || []) : undefined,
      });
    });
    if (!documentHtml) {
      campos
        .filter((campo) => campo.mostrar !== false)
        .forEach((campo, index) => {
          sections.push({
            key: `campo:${campo.id}`,
            label: campo.label || `Campo legacy ${index + 1}`,
            helper: 'Sobrescribe el valor final de este campo.',
            baseHtml: buildCampoResolvedHtml(campo),
          });
        });
      bloques.forEach((bloque, index) => {
        sections.push({
          key: `bloque:${bloque.id}`,
          label: `Bloque ${index + 1}`,
          helper: 'Edita este bloque legacy con el texto ya resuelto.',
          baseHtml: buildBloqueResolvedHtml(bloque),
        });
      });
    }
    return sections;
  }, [
    bloques,
    campos,
    documentHtml,
    normalizedDocumentHtml,
    orderedElementos,
    fieldOverrides,
    signatureDataUrl,
  ]);

  // ── Signature canvas ───────────────────────────────────────────────
  const getCanvasPoint = (evt) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const touch = evt.touches?.[0] || evt.changedTouches?.[0];
    const clientX = touch ? touch.clientX : evt.clientX;
    const clientY = touch ? touch.clientY : evt.clientY;
    if (clientX === undefined || clientY === undefined) return null;
    return {
      x: ((clientX - rect.left) * canvas.width) / rect.width,
      y: ((clientY - rect.top) * canvas.height) / rect.height,
    };
  };

  const drawStroke = (from, to) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas || !from || !to) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
  };

  const startSignature = (evt) => {
    evt.preventDefault();
    const point = getCanvasPoint(evt);
    if (!point) return;
    isSigningRef.current = true;
    lastPointRef.current = point;
  };

  const moveSignature = (evt) => {
    if (!isSigningRef.current) return;
    evt.preventDefault();
    const point = getCanvasPoint(evt);
    if (!point || !lastPointRef.current) return;
    drawStroke(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const endSignature = (evt) => {
    evt?.preventDefault?.();
    isSigningRef.current = false;
    lastPointRef.current = null;
  };

  const clearSignatureCanvas = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const persistSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL('image/png'));
    setShowSignatureModal(false);
    onNotify?.('Firma digital capturada.', 'success');
  };

  useEffect(() => {
    if (!showSignatureModal) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (signatureDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = signatureDataUrl;
    }
  }, [showSignatureModal, signatureDataUrl]);

  // ── Page dimensions ────────────────────────────────────────────────
  const pageWidth = normalizedPage.width;
  const pageHeight = normalizedPage.height;
  const fitToLetterScale = Math.min(
    1,
    LETTER_WIDTH / pageWidth,
    LETTER_HEIGHT / pageHeight
  );
  const printScale = fitToLetterScale;
  const printWidth = Math.round(pageWidth * printScale);
  const printHeight = Math.round(pageHeight * printScale);
  const recipeFitToHalfScale = Math.min(
    1,
    LETTER_WIDTH / pageWidth,
    HALF_LETTER_HEIGHT / pageHeight
  );
  const recipeCopyScale = Number(recipeFitToHalfScale.toFixed(4));
  const finalPrintWidth = isRecipeTemplate ? LETTER_WIDTH : printWidth;
  const finalPrintHeight = isRecipeTemplate ? LETTER_HEIGHT : printHeight;

  const computeDocResolvedHtml = () =>
    getContentHtml(
      'documentHtml',
      resolveTemplateWithSignature(normalizedDocumentHtml, { allowHtml: true })
    );

  // ── Recipe pagination ──────────────────────────────────────────────
  const splitRecipeTextIntoItems = (text) => {
    if (!text || !text.trim()) return [];
    const lines = text.split('\n');
    const items = [];
    let current = [];
    for (const line of lines) {
      const t = line.trimStart();
      const isStart =
        /^\d+\.\s/.test(t) || /^(Paquetes|Notas):\s/i.test(t);
      if (isStart && current.length > 0) {
        items.push(current.join('\n'));
        current = [line];
      } else if (line.trim()) {
        current.push(line);
      }
    }
    if (current.length > 0) items.push(current.join('\n'));
    return items;
  };

  const RECIPE_CHARS_PER_LINE = 80;
  const estimateVisualWeight = (text = '') => {
    if (!text) return 0;
    let weight = 0;
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      weight += Math.max(1, Math.ceil(trimmed.length / RECIPE_CHARS_PER_LINE));
    }
    return weight;
  };

  const recipeContentPages = useMemo(() => {
    if (!isRecipeTemplate) return [null];
    const medsText = resolverCampo('consulta.medicamentos_texto') || '';
    const estText = resolverCampo('consulta.estudios_texto') || '';
    const procText = resolverCampo('consulta.procedimientos_texto') || '';
    const refsText = resolverCampo('consulta.referencias_texto') || '';
    const tratText = resolverCampo('consulta.tratamiento_texto') || '';
    const indicacionesText = resolverCampo('consulta.indicaciones') || '';
    const diagnosticoText = resolverCampo('consulta.diagnostico') || '';

    const tag = (items, src) =>
      items.map((t) => ({
        text: t,
        src,
        lines: t.split('\n').length,
        weight: estimateVisualWeight(t),
      }));
    const medsItems = tag(splitRecipeTextIntoItems(medsText), 'meds');
    const estItems = tag(splitRecipeTextIntoItems(estText), 'est');
    const procItems = tag(splitRecipeTextIntoItems(procText), 'proc');
    const refsItems = tag(splitRecipeTextIntoItems(refsText), 'refs');
    const tratItems = splitRecipeTextIntoItems(tratText);
    const allItems = [...medsItems, ...estItems, ...procItems, ...refsItems];
    const totalWeight = allItems.reduce((s, i) => s + i.weight, 0);

    const BASE_MAX_WEIGHT = 19;
    const indicacionesWeight = estimateVisualWeight(indicacionesText);
    const diagnosticoWeight = estimateVisualWeight(diagnosticoText);
    const reservedWeight = Math.min(3, indicacionesWeight + diagnosticoWeight);
    const MAX_WEIGHT = Math.max(5, BASE_MAX_WEIGHT - reservedWeight);

    if (totalWeight <= MAX_WEIGHT || allItems.length === 0) return [null];

    const pages = [];
    let pg = [];
    let used = 0;
    for (const item of allItems) {
      if (used + item.weight > MAX_WEIGHT && pg.length > 0) {
        pages.push(pg);
        pg = [];
        used = 0;
      }
      pg.push(item);
      used += item.weight;
    }
    if (pg.length > 0) pages.push(pg);

    return pages.map((pageItems) => {
      const pm = pageItems.filter((i) => i.src === 'meds');
      const pe = pageItems.filter((i) => i.src === 'est');
      const pp = pageItems.filter((i) => i.src === 'proc');
      const pr = pageItems.filter((i) => i.src === 'refs');
      const medIndices = pm.map((m) => medsItems.indexOf(m));
      const pageTrat = medIndices
        .map((idx) => tratItems[idx])
        .filter(Boolean)
        .join('\n');
      const seccionesPage = [];
      const medsPage = pm.map((i) => i.text).join('\n');
      const estPage = pe.map((i) => i.text).join('\n');
      const procPage = pp.map((i) => i.text).join('\n');
      const refsPage = pr.map((i) => i.text).join('\n');
      if (medsPage) seccionesPage.push(medsPage);
      if (estPage) {
        seccionesPage.push('');
        seccionesPage.push(estPage);
      }
      if (procPage) {
        seccionesPage.push('');
        seccionesPage.push(procPage);
      }
      if (refsPage) {
        seccionesPage.push('');
        seccionesPage.push(refsPage);
      }
      return {
        'consulta.medicamentos_texto': medsPage,
        'consulta.medicamentos_html':
          pm.length > 0 ? resolverCampo('consulta.medicamentos_html') || '' : '',
        'consulta.estudios_texto': estPage,
        'consulta.estudios_html':
          pe.length > 0 ? resolverCampo('consulta.estudios_html') || '' : '',
        'consulta.procedimientos_texto': procPage,
        'consulta.procedimientos_html':
          pp.length > 0 ? resolverCampo('consulta.procedimientos_html') || '' : '',
        'consulta.referencias_texto': refsPage,
        'consulta.referencias_html':
          pr.length > 0 ? resolverCampo('consulta.referencias_html') || '' : '',
        'consulta.tratamiento_texto': pageTrat,
        'consulta.tratamiento_html': pageTrat
          ? resolverCampo('consulta.tratamiento_html') || ''
          : '',
        'consulta.receta_contenido': seccionesPage.join('\n'),
      };
    });
  }, [isRecipeTemplate, resolverCampo]);

  // ── Canvas rendering ───────────────────────────────────────────────
  const renderTemplateCanvasContent = () => {
    const resolvedDocHtml = documentHtml ? computeDocResolvedHtml() : '';
    return (
      <>
        {documentHtml ? (
          <div
            className="absolute inset-0 text-slate-800"
            style={{
              paddingTop: docMargins.top,
              paddingRight: docMargins.right,
              paddingBottom: docMargins.bottom,
              paddingLeft: docMargins.left,
              fontSize: `${docBaseFontPt}pt`,
              lineHeight: documentLineHeight,
              fontFamily: documentFontFamily,
              overflow: isRecipeTemplate ? 'hidden' : 'visible',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              zIndex: 10,
            }}
            dangerouslySetInnerHTML={{ __html: resolvedDocHtml }}
          />
        ) : null}

        {orderedElementos.length > 0 ? (
          orderedElementos.map((elemento) => {
            const isField = elemento.type === 'field';
            const bindKey = isField ? elemento.bind || elemento.id || '' : '';
            const isImage = elemento.type === 'image';
            const isShape = elemento.type === 'shape';
            const isShapeOrImg = isImage || isShape;
            const isSignatureField =
              isField && (elemento.bind || elemento.id) === 'firma.medico';
            const isSignatureLineField =
              isField && (elemento.bind || elemento.id) === 'firma.linea';
            const shapeKind = elemento.shapeKind || 'line';
            const shapeStrokeWidth = Number(elemento.strokeWidth || 1);
            const shapeOpacity = Number(elemento.opacity ?? 1);
            const addressGuardStyle = isField
              ? getAddressGuardStyle(bindKey, {
                  fontSize: Number(elemento.fontSize || 12),
                  lineHeight: Number(elemento.lineHeight || 1.35),
                  boxHeight: Number(elemento.h || 20),
                })
              : null;
            const texto = getContentHtml(
              `element:${elemento.id}`,
              buildElementResolvedHtml(elemento)
            );

            return (
              <div
                key={elemento.id}
                className="absolute whitespace-pre-wrap leading-relaxed text-slate-800"
                style={{
                  left: isSignatureLineField ? '50%' : Number(elemento.x || 0),
                  top: Number(elemento.y || 0),
                  width: isSignatureLineField ? 320 : Number(elemento.w || 80),
                  height: isShapeOrImg ? Number(elemento.h || 20) : undefined,
                  minHeight: isShapeOrImg ? undefined : Number(elemento.h || 20),
                  fontSize:
                    addressGuardStyle?.fontSize ??
                    Number(elemento.fontSize || 12),
                  fontFamily: elemento.fontFamily || 'Trebuchet MS',
                  lineHeight:
                    addressGuardStyle?.lineHeight ??
                    Number(elemento.lineHeight || 1.35),
                  fontWeight: elemento.bold ? 700 : 500,
                  textAlign: elemento.align || 'left',
                  overflow: addressGuardStyle?.overflow ?? 'visible',
                  wordBreak:
                    addressGuardStyle?.wordBreak ??
                    (isShape ? 'normal' : 'break-word'),
                  overflowWrap:
                    addressGuardStyle?.overflowWrap ??
                    (isShape ? 'normal' : 'anywhere'),
                  whiteSpace: addressGuardStyle?.whiteSpace,
                  display: addressGuardStyle?.display,
                  WebkitBoxOrient: addressGuardStyle?.WebkitBoxOrient,
                  WebkitLineClamp: addressGuardStyle?.WebkitLineClamp,
                  textOverflow: addressGuardStyle?.textOverflow,
                  transform: isSignatureLineField
                    ? 'translateX(-50%)'
                    : undefined,
                  zIndex: getElementRenderZ(elemento),
                  opacity: Number(elemento.opacity ?? 1),
                }}
              >
                {isImage ? (
                  elemento.src ? (
                    <img
                      src={elemento.src}
                      alt=""
                      className="w-full h-full"
                      style={{
                        objectFit: elemento.objectFit || 'contain',
                        opacity: Number(elemento.opacity ?? 1),
                      }}
                    />
                  ) : null
                ) : isShape ? (
                  shapeKind === 'arrow' ? (
                    <svg
                      width={Number(elemento.w || 200)}
                      height={Math.max(Number(elemento.h || 20), 20)}
                      style={{ display: 'block', overflow: 'visible' }}
                    >
                      <defs>
                        <marker
                          id={`shape_arrow_${elemento.id}`}
                          markerWidth="8"
                          markerHeight="6"
                          refX="7"
                          refY="3"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 8 3, 0 6"
                            fill="#000000"
                            opacity={shapeOpacity}
                          />
                        </marker>
                      </defs>
                      <line
                        x1={shapeStrokeWidth}
                        y1={Math.max(Number(elemento.h || 20), 20) / 2}
                        x2={Number(elemento.w || 200) - 8}
                        y2={Math.max(Number(elemento.h || 20), 20) / 2}
                        stroke="#000000"
                        strokeWidth={shapeStrokeWidth}
                        markerEnd={`url(#shape_arrow_${elemento.id})`}
                        opacity={shapeOpacity}
                      />
                    </svg>
                  ) : shapeKind === 'line-vertical' ||
                    shapeKind === 'line-vertical-dashed' ? (
                    <div className="w-full h-full flex justify-center">
                      <div
                        style={{
                          width: shapeStrokeWidth,
                          height: '100%',
                          borderLeft: `${shapeStrokeWidth}px ${
                            shapeKind === 'line-vertical-dashed'
                              ? 'dashed'
                              : 'solid'
                          } #000000`,
                          opacity: shapeOpacity,
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="w-full h-full"
                      style={{
                        borderTop:
                          shapeKind === 'line' || shapeKind === 'line-dashed'
                            ? `${shapeStrokeWidth}px ${
                                shapeKind === 'line-dashed' ? 'dashed' : 'solid'
                              } #000000`
                            : 'none',
                        border:
                          shapeKind === 'rect' || shapeKind === 'circle'
                            ? `${shapeStrokeWidth}px solid #000000`
                            : undefined,
                        backgroundColor: 'transparent',
                        borderRadius:
                          shapeKind === 'circle'
                            ? '999px'
                            : Number(elemento.radius || 0),
                        opacity: shapeOpacity,
                      }}
                    />
                  )
                ) : isField ? (
                  isSignatureField ? (
                    signatureDataUrl ? (
                      <img
                        src={signatureDataUrl}
                        alt="Firma del medico"
                        className="h-20 w-auto max-w-[220px] object-contain"
                      />
                    ) : (
                      <span className="italic text-slate-400">
                        Firma pendiente
                      </span>
                    )
                  ) : isSignatureLineField ? (
                    <div className="mt-5 w-[320px] max-w-full border-t-2 border-slate-700 pt-2 text-center font-bold text-slate-800 mx-auto">
                      {resolveCampoEditable('medico.nombre') ||
                        'Firma del medico'}
                    </div>
                  ) : (
                    <div dangerouslySetInnerHTML={{ __html: texto || '&nbsp;' }} />
                  )
                ) : elemento.type === 'select' ? (
                  <select
                    value={texto || elemento.options?.[0] || ''}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateContentOverride(`element:${elemento.id}`, e.target.value, elemento.value || elemento.options?.[0] || '');
                    }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      appearance: 'none', WebkitAppearance: 'none',
                      background: 'none', border: 'none',
                      borderBottom: '1.5px solid #0891b2',
                      cursor: 'pointer', padding: '0 14px 0 0',
                      fontFamily: elemento.fontFamily || 'Trebuchet MS',
                      fontSize: Number(elemento.fontSize || 12),
                      fontWeight: elemento.bold ? 700 : 500,
                      color: 'inherit',
                      textAlign: elemento.align || 'center',
                      width: '100%',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%230891b2'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 0 center',
                      backgroundSize: '8px',
                    }}
                  >
                    {(elemento.options || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: texto }} />
                )}
              </div>
            );
          })
        ) : !documentHtml ? (
          <>
            {campos
              .filter((campo) => campo.mostrar !== false)
              .map((campo) => {
                const bindKey = campo.bind || campo.id;
                const addressGuardStyle = getAddressGuardStyle(bindKey, {
                  fontSize: Number(campo.fontSize || 12),
                  lineHeight: 1.35,
                  boxHeight: Number(campo.h || 20),
                });
                return (
                  <div
                    key={`campo_${campo.id}`}
                    className="absolute text-slate-800 whitespace-pre-wrap"
                    style={{
                      left: Number(campo.x || 40),
                      top: Number(campo.y || 80),
                      width: Number(campo.w || 510),
                      minHeight: Number(campo.h || 20),
                      fontSize:
                        addressGuardStyle?.fontSize ??
                        Number(campo.fontSize || 12),
                      fontWeight: campo.negrita ? 700 : 500,
                      lineHeight: addressGuardStyle?.lineHeight ?? 1.35,
                      textAlign: campo.align || 'left',
                      overflow: addressGuardStyle?.overflow ?? 'visible',
                      wordBreak: addressGuardStyle?.wordBreak ?? 'break-word',
                      overflowWrap:
                        addressGuardStyle?.overflowWrap ?? 'anywhere',
                      whiteSpace: addressGuardStyle?.whiteSpace,
                      display: addressGuardStyle?.display,
                      WebkitBoxOrient: addressGuardStyle?.WebkitBoxOrient,
                      WebkitLineClamp: addressGuardStyle?.WebkitLineClamp,
                      textOverflow: addressGuardStyle?.textOverflow,
                    }}
                  >
                    <div
                      dangerouslySetInnerHTML={{
                        __html:
                          getContentHtml(
                            `campo:${campo.id}`,
                            buildCampoResolvedHtml(campo)
                          ) || '&nbsp;',
                      }}
                    />
                  </div>
                );
              })}
            {bloques.map((bloque) => (
              <div
                key={bloque.id}
                className="absolute text-slate-800 leading-relaxed whitespace-pre-wrap"
                style={{
                  left: Number(bloque.x || 40),
                  top: Number(bloque.y || 80),
                  width: Number(bloque.w || 510),
                  minHeight: Number(bloque.h || 20),
                  fontSize: Number(bloque.fontSize || 13),
                  fontWeight: bloque.negrita ? 700 : 500,
                  textAlign: bloque.align || 'left',
                  overflow: 'visible',
                  wordBreak: 'break-word',
                  overflowWrap: 'anywhere',
                }}
              >
                <div
                  dangerouslySetInnerHTML={{
                    __html:
                      getContentHtml(
                        `bloque:${bloque.id}`,
                        buildBloqueResolvedHtml(bloque)
                      ) || '&nbsp;',
                  }}
                />
              </div>
            ))}
          </>
        ) : null}
      </>
    );
  };

  // ── PDF / Print helpers ────────────────────────────────────────────
  const waitForPrintableAssets = async () => {
    const container = printPageRef.current;
    if (!container) return;
    const images = Array.from(container.querySelectorAll('img'));
    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise((resolve) => {
          let resolved = false;
          const done = () => {
            if (!resolved) {
              resolved = true;
              img.removeEventListener('load', done);
              img.removeEventListener('error', done);
              resolve();
            }
          };
          img.addEventListener('load', done);
          img.addEventListener('error', done);
          setTimeout(done, 2500);
        });
      })
    );
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Continue even if font API fails.
      }
    }
    await new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'function') {
        setTimeout(resolve, 16);
        return;
      }
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  };

  const captureElementAsCanvas = async (element, scale = 2, options = {}) => {
    if (!element) return null;
    const forcedWidth = Number(options?.width || 0);
    const forcedHeight = Number(options?.height || 0);
    const rect = element.getBoundingClientRect();
    const captureWidth =
      forcedWidth > 0
        ? Math.max(1, Math.ceil(forcedWidth))
        : Math.max(
            1,
            Math.ceil(
              rect.width ||
                element.clientWidth ||
                element.offsetWidth ||
                element.scrollWidth ||
                LETTER_WIDTH
            )
          );
    const captureHeight =
      forcedHeight > 0
        ? Math.max(1, Math.ceil(forcedHeight))
        : Math.max(
            1,
            Math.ceil(
              rect.height ||
                element.clientHeight ||
                element.offsetHeight ||
                element.scrollHeight ||
                LETTER_HEIGHT
            )
          );
    return html2canvas(element, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 0,
      width: captureWidth,
      height: captureHeight,
      windowWidth: captureWidth,
      windowHeight: captureHeight,
      scrollX: 0,
      scrollY: 0,
    });
  };

  const trimCanvasWhitespace = (sourceCanvas, threshold = 248) => {
    if (!sourceCanvas) return sourceCanvas;
    try {
      const width = Number(sourceCanvas.width || 0);
      const height = Number(sourceCanvas.height || 0);
      if (width <= 0 || height <= 0) return sourceCanvas;
      const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      if (!sourceCtx) return sourceCanvas;
      const pixels = sourceCtx.getImageData(0, 0, width, height).data;
      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = (y * width + x) * 4;
          const alpha = pixels[idx + 3];
          if (alpha === 0) continue;
          const r = pixels[idx], g = pixels[idx + 1], b = pixels[idx + 2];
          if (r >= threshold && g >= threshold && b >= threshold) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
      if (maxX < minX || maxY < minY) return sourceCanvas;
      const cropWidth = Math.max(1, maxX - minX + 1);
      const cropHeight = Math.max(1, maxY - minY + 1);
      if (cropWidth / width > 0.985 && cropHeight / height > 0.985)
        return sourceCanvas;
      const trimmedCanvas = document.createElement('canvas');
      trimmedCanvas.width = cropWidth;
      trimmedCanvas.height = cropHeight;
      const trimmedCtx = trimmedCanvas.getContext('2d');
      if (!trimmedCtx) return sourceCanvas;
      trimmedCtx.drawImage(
        sourceCanvas,
        minX, minY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      return trimmedCanvas;
    } catch {
      return sourceCanvas;
    }
  };

  const prepareCanvasForPdf = (canvas) => {
    if (!canvas) return canvas;
    return isRecipeTemplate ? trimCanvasWhitespace(canvas) : canvas;
  };

  const addCanvasToPdfPage = (pdfDoc, canvas) => {
    if (!pdfDoc || !canvas) return;
    const pw = Number(pdfDoc.internal?.pageSize?.getWidth?.() || 612);
    const ph = Number(pdfDoc.internal?.pageSize?.getHeight?.() || 792);
    const scale = Math.min(pw / canvas.width, ph / canvas.height);
    const drawWidth = canvas.width * scale;
    const drawHeight = canvas.height * scale;
    const offsetX = (pw - drawWidth) / 2;
    const offsetY = (ph - drawHeight) / 2;
    const imageData = canvas.toDataURL('image/png', 1.0);
    pdfDoc.addImage(imageData, 'PNG', offsetX, offsetY, drawWidth, drawHeight, undefined, 'FAST');
  };

  const flattenSelectsInEl = (container) => {
    if (!container) return [];
    return Array.from(container.querySelectorAll('select')).map((sel) => {
      const span = document.createElement('span');
      span.textContent = sel.value || '';
      span.style.cssText = `font-family:${sel.style.fontFamily||'inherit'};font-size:${sel.style.fontSize||'inherit'};font-weight:${sel.style.fontWeight||'inherit'};text-align:${sel.style.textAlign||'inherit'};display:inline-block;width:100%;`;
      sel.parentNode?.replaceChild(span, sel);
      return { sel, span };
    });
  };

  const restoreSelectsInEl = (rests) => {
    rests.forEach(({ sel, span }) => { if (span.parentNode) span.parentNode.replaceChild(sel, span); });
  };

  const openPrintWindow = async (mode = 'print') => {
    const originalTitle = document.title;
    if (mode === 'print') setIsPrinting(true);
    try {
      await waitForPrintableAssets();
      const docBaseName =
        plantilla?.nombre || (isRecipeTemplate ? 'Receta medica' : 'Documento medico');
      const docNombre = hasManualEdits
        ? `${docBaseName} (editado)`
        : docBaseName;

      let archivoUrl = '';
      let archivoPath = '';
      if (pacienteId && printPageRef.current) {
        try {
          const _rFb = flattenSelectsInEl(printPageRef.current);
          const rawCanvas = await captureElementAsCanvas(
            printPageRef.current,
            2,
            { width: finalPrintWidth, height: finalPrintHeight }
          );
          restoreSelectsInEl(_rFb);
          const canvas = prepareCanvasForPdf(rawCanvas);
          if (!canvas)
            throw new Error('No fue posible capturar el documento en canvas.');
          const capturePdf = new jsPDF({
            orientation: 'portrait',
            unit: 'pt',
            format: 'letter',
            compress: true,
          });
          addCanvasToPdfPage(capturePdf, canvas);
          const pdfBlob = capturePdf.output('blob');
          const result = await uploadDocumentoPDF({
            pacienteId,
            pdfBlob,
            nombre: docNombre,
            tipo: isRecipeTemplate ? 'receta' : 'documento',
          });
          archivoUrl = result.url;
          archivoPath = result.storagePath;
        } catch (uploadErr) {
          console.warn(
            'No se pudo capturar/subir el PDF al expediente:',
            uploadErr
          );
        }
      }

      onDocumentGenerated?.({
        tipo: isRecipeTemplate ? 'receta' : 'documento',
        nombre: docNombre,
        plantillaId: plantilla?.id || '',
        plantillaNombre: plantilla?.nombre || '',
        formato: mode === 'pdf' ? 'pdf_download' : 'impresion',
        origen: 'plantilla_dinamica',
        editadoManualmente: hasManualEdits,
        archivoUrl,
        archivoPath,
      });

      if (mode === 'pdf') {
        const pageElements = printScrollRef.current
          ? Array.from(
              printScrollRef.current.querySelectorAll('.tpl-print-page')
            )
          : printPageRef.current
          ? [printPageRef.current]
          : [];
        if (pageElements.length === 0) {
          onNotify?.(
            'No se encontró contenido para generar el PDF.',
            'error'
          );
          return;
        }
        onNotify?.('Generando PDF, espera un momento…', 'info');
        const downloadPdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'letter',
          compress: true,
        });
        for (let i = 0; i < pageElements.length; i++) {
          const pageEl = pageElements[i];
          const _rPdf = flattenSelectsInEl(pageEl);
          const rawPageCanvas = await captureElementAsCanvas(pageEl, 2, {
            width: finalPrintWidth,
            height: finalPrintHeight,
          });
          restoreSelectsInEl(_rPdf);
          const pageCanvas = prepareCanvasForPdf(rawPageCanvas);
          if (!pageCanvas) continue;
          if (i > 0) downloadPdf.addPage('letter', 'portrait');
          addCanvasToPdfPage(downloadPdf, pageCanvas);
        }
        const safeFileName = docNombre
          .replace(/[^\w\sáéíóúÁÉÍÓÚñÑ-]/g, '_')
          .trim();
        downloadPdf.save(`${safeFileName}.pdf`);
        onNotify?.('PDF descargado correctamente.', 'success');
        return;
      }

      document.title = docNombre;
      document.documentElement.classList.add('printing-plantilla');
      document.body.classList.add('printing-plantilla');
      const cleanupPrintScope = () => {
        document.body.classList.remove('printing-plantilla');
        document.documentElement.classList.remove('printing-plantilla');
        document.title = originalTitle;
      };
      window.addEventListener('afterprint', cleanupPrintScope, { once: true });
      await new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      });
      setIsPrinting(false);
      window.print();
      setTimeout(cleanupPrintScope, 5000);
    } catch (error) {
      console.error('Error preparando impresion/PDF:', error);
      onNotify?.('Error generando el documento para imprimir.', 'error');
      document.body.classList.remove('printing-plantilla');
      document.documentElement.classList.remove('printing-plantilla');
      document.title = document.title;
      setIsPrinting(false);
    }
  };

  // ── Detected signature field ───────────────────────────────────────
  const hasSignatureField = useMemo(
    () =>
      detectedFieldKeys.includes('firma.medico') ||
      orderedElementos.some(
        (el) => el.type === 'field' && (el.bind || el.id) === 'firma.medico'
      ),
    [detectedFieldKeys, orderedElementos]
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[220] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 print:bg-white print:p-0 tpl-print-overlay">
      <style>{`
        .tpl-print-root {
          position: absolute;
          left: -99999px;
          top: 0;
          width: 0;
          height: 0;
          overflow: hidden;
          pointer-events: none;
        }

        @media print {
          @page { size: letter; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          body.printing-plantilla > *:not(.tpl-print-root) { display: none !important; }
          body.printing-plantilla .tpl-print-root {
            position: static !important;
            left: auto !important;
            top: auto !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            pointer-events: auto !important;
          }
          body.printing-plantilla .tpl-print-page-out {
            display: block !important;
            margin: 0 auto !important;
            padding: 0 !important;
            border: 0 !important;
            box-shadow: none !important;
            overflow: hidden !important;
            page-break-inside: avoid;
            break-inside: avoid;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          body.printing-plantilla .tpl-print-page-out + .tpl-print-page-out {
            page-break-before: always;
            break-before: page;
          }
          body.printing-plantilla .tpl-print-root .tpl-print-canvas {
            transform: scale(var(--tpl-print-scale, 1)) !important;
            transform-origin: top left !important;
          }
          .tpl-print-root select {
            -webkit-appearance: none !important;
            appearance: none !important;
            border: none !important;
            border-bottom: none !important;
            background: none !important;
            background-image: none !important;
            outline: none !important;
            padding: 0 !important;
            pointer-events: none !important;
          }
        }
      `}</style>

      {/* ── Modal shell ── */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl border border-slate-200 flex flex-col print:hidden tpl-print-shell"
        style={{ height: '92vh' }}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h3 className="exp-sora text-lg font-black text-slate-800 truncate">
              {plantilla?.nombre || 'Plantilla'}
            </h3>
            <p className="text-[11px] text-slate-400 leading-tight">
              Vista previa dinámica generada por administración
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <button
              onClick={onBackToMenu}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              Volver
            </button>

            {hasSignatureField && (
              <button
                onClick={() => setShowSignatureModal(true)}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
              >
                Firma
              </button>
            )}

            <button
              onClick={() => openPrintWindow('pdf')}
              className="h-9 px-3.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-all shadow-sm"
            >
              PDF
            </button>

            <button
              onClick={() => openPrintWindow('print')}
              disabled={isPrinting}
              className={`h-9 px-4 rounded-xl text-white text-sm font-semibold transition-all shadow-sm inline-flex items-center gap-2 ${
                isPrinting
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {isPrinting && (
                <svg
                  className="animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {isPrinting ? 'Procesando…' : 'Imprimir'}
            </button>

            {/* Botón Editar — abre/cierra panel derecho */}
            <button
              onClick={() => setShowEditor((prev) => !prev)}
              className={`h-9 px-3.5 rounded-xl border text-sm font-semibold transition-all shadow-sm ${
                showEditor
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
              }`}
            >
              {showEditor
                ? `Editar ${hasManualEdits ? '●' : ''}`
                : `Editar ${hasManualEdits ? '●' : ''}`}
            </button>

            <button
              onClick={onClose}
              className="h-9 w-9 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-slate-300 transition-all inline-flex items-center justify-center shadow-sm"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Split body ── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: document preview */}
          <div
            ref={printScrollRef}
            className="flex-1 overflow-auto bg-slate-50 p-6 print:p-0 print:bg-white tpl-print-scroll"
          >
            {isRecipeTemplate && recipeContentPages.length > 1 ? (
              recipeContentPages.map((pageOverrides, rpIdx) => {
                recipePageOverridesRef.current = pageOverrides;
                const pageCanvas = renderTemplateCanvasContent();
                recipePageOverridesRef.current = null;
                return (
                  <div
                    key={`recipe-page-${rpIdx}`}
                    ref={rpIdx === 0 ? printPageRef : undefined}
                    className={`mx-auto bg-white border border-slate-200 shadow-sm relative overflow-hidden print:shadow-none print:border-0 tpl-print-page ${
                      rpIdx > 0 ? 'mt-6 print:mt-0' : ''
                    }`}
                    style={{
                      width: finalPrintWidth,
                      height: finalPrintHeight,
                      '--tpl-print-scale': String(printScale),
                      '--tpl-print-width': `${finalPrintWidth}px`,
                      '--tpl-print-height': `${finalPrintHeight}px`,
                      breakBefore: rpIdx > 0 ? 'page' : undefined,
                      pageBreakBefore: rpIdx > 0 ? 'always' : undefined,
                    }}
                  >
                    <div className="relative w-full h-full bg-white">
                      {[0, 1].map((copyIndex) => (
                        <div
                          key={`receta_copy_${copyIndex}`}
                          className="absolute left-0 w-full overflow-hidden border-b border-dashed border-slate-300 print:border-0"
                          style={{
                            top: copyIndex * HALF_LETTER_HEIGHT,
                            height: HALF_LETTER_HEIGHT,
                            borderBottomWidth: copyIndex === 0 ? 1 : 0,
                          }}
                        >
                          <div
                            className="absolute top-0 left-0"
                            style={{
                              width: pageWidth,
                              height: pageHeight,
                              transform: `scale(${recipeCopyScale})`,
                              transformOrigin: 'top left',
                            }}
                          >
                            {pageCanvas}
                          </div>
                          {copyIndex === 0 && (
                            <div className="absolute bottom-0 left-3 px-1 text-[10px] text-slate-300 bg-white print:hidden">
                              Corte aquí
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    {recipeContentPages.length > 1 && (
                      <div className="absolute bottom-1 right-3 text-[9px] text-slate-400 font-bold print:text-slate-300">
                        Pág {rpIdx + 1} de {recipeContentPages.length}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div
                ref={printPageRef}
                className="mx-auto bg-white border border-slate-200 shadow-sm relative overflow-hidden print:shadow-none print:border-0 tpl-print-page"
                style={{
                  width: finalPrintWidth,
                  height: finalPrintHeight,
                  '--tpl-print-scale': String(printScale),
                  '--tpl-print-width': `${finalPrintWidth}px`,
                  '--tpl-print-height': `${finalPrintHeight}px`,
                }}
              >
                {isRecipeTemplate ? (
                  <div className="relative w-full h-full bg-white">
                    {[0, 1].map((copyIndex) => (
                      <div
                        key={`receta_copy_${copyIndex}`}
                        className="absolute left-0 w-full overflow-hidden border-b border-dashed border-slate-300 print:border-0"
                        style={{
                          top: copyIndex * HALF_LETTER_HEIGHT,
                          height: HALF_LETTER_HEIGHT,
                          borderBottomWidth: copyIndex === 0 ? 1 : 0,
                        }}
                      >
                        <div
                          className="absolute top-0 left-0"
                          style={{
                            width: pageWidth,
                            height: pageHeight,
                            transform: `scale(${recipeCopyScale})`,
                            transformOrigin: 'top left',
                          }}
                        >
                          {renderTemplateCanvasContent()}
                        </div>
                        {copyIndex === 0 && (
                          <div className="absolute bottom-0 left-3 px-1 text-[10px] text-slate-300 bg-white print:hidden">
                            Corte aquí
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="tpl-print-canvas relative w-full h-full">
                    {renderTemplateCanvasContent()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: editor panel */}
          {showEditor && (
            <div className="w-[380px] shrink-0 border-l border-slate-200 flex flex-col bg-white print:hidden">
              {/* Tabs */}
              <div className="flex border-b border-slate-200 px-3 pt-2.5 gap-0.5 shrink-0 bg-slate-50">
                <button
                  onClick={() => setEditorTab('campos')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg border transition-colors ${
                    editorTab === 'campos'
                      ? 'bg-white border-slate-200 border-b-white text-blue-700 -mb-px'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Campos
                </button>
                <button
                  onClick={() => setEditorTab('contenido')}
                  className={`px-4 py-2 text-xs font-bold rounded-t-lg border transition-colors ${
                    editorTab === 'contenido'
                      ? 'bg-white border-slate-200 border-b-white text-blue-700 -mb-px'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Contenido
                </button>
              </div>

              {/* Panel scrollable */}
              <div className="flex-1 overflow-y-auto p-3">
                {editorTab === 'campos' && (
                  <FieldsPanel
                    detectedFieldKeys={detectedFieldKeys}
                    fieldOverrides={fieldOverrides}
                    resolverCampo={resolverCampo}
                    updateFieldOverride={updateFieldOverride}
                    onResetAll={() => setFieldOverrides({})}
                  />
                )}
                {editorTab === 'contenido' && (
                  <ContentPanel
                    sections={editableContentSections}
                    contentOverrides={contentOverrides}
                    getContentHtml={getContentHtml}
                    updateContentOverride={updateContentOverride}
                    onResetAll={() => setContentOverrides({})}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Signature modal ── */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-[260] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl p-5">
            <h4 className="text-lg font-black text-slate-800">
              Firma digital del médico
            </h4>
            <p className="text-sm text-slate-500 mt-1">
              Dibuja tu firma con mouse o touch. Se insertará en{' '}
              <code>{'{{firma.medico}}'}</code>.
            </p>
            <div className="mt-4 rounded-xl border border-slate-300 overflow-hidden bg-white">
              <canvas
                ref={signatureCanvasRef}
                width={900}
                height={280}
                className="w-full h-56 touch-none cursor-crosshair"
                onMouseDown={startSignature}
                onMouseMove={moveSignature}
                onMouseUp={endSignature}
                onMouseLeave={endSignature}
                onTouchStart={startSignature}
                onTouchMove={moveSignature}
                onTouchEnd={endSignature}
                onTouchCancel={endSignature}
              />
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowSignatureModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={clearSignatureCanvas}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50"
              >
                Limpiar
              </button>
              <button
                onClick={persistSignature}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Guardar firma
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Print portal (solo @media print) ── */}
      {createPortal(
        <div className="tpl-print-root" aria-hidden="true">
          {isRecipeTemplate && recipeContentPages.length > 1 ? (
            recipeContentPages.map((pageOverrides, rpIdx) => {
              recipePageOverridesRef.current = pageOverrides;
              const pageCanvas = renderTemplateCanvasContent();
              recipePageOverridesRef.current = null;
              return (
                <div
                  key={`print-out-${rpIdx}`}
                  className="tpl-print-page-out"
                  style={{
                    width: finalPrintWidth,
                    height: finalPrintHeight,
                    '--tpl-print-scale': String(printScale),
                    '--tpl-print-width': `${finalPrintWidth}px`,
                    '--tpl-print-height': `${finalPrintHeight}px`,
                    background: '#fff',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div className="relative w-full h-full bg-white">
                    {[0, 1].map((copyIndex) => (
                      <div
                        key={`out_copy_${copyIndex}`}
                        className="absolute left-0 w-full overflow-hidden"
                        style={{
                          top: copyIndex * HALF_LETTER_HEIGHT,
                          height: HALF_LETTER_HEIGHT,
                        }}
                      >
                        <div
                          className="absolute top-0 left-0"
                          style={{
                            width: pageWidth,
                            height: pageHeight,
                            transform: `scale(${recipeCopyScale})`,
                            transformOrigin: 'top left',
                          }}
                        >
                          {pageCanvas}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          ) : (
            <div
              className="tpl-print-page-out"
              style={{
                width: finalPrintWidth,
                height: finalPrintHeight,
                '--tpl-print-scale': String(printScale),
                '--tpl-print-width': `${finalPrintWidth}px`,
                '--tpl-print-height': `${finalPrintHeight}px`,
                background: '#fff',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {isRecipeTemplate ? (
                <div className="relative w-full h-full bg-white">
                  {[0, 1].map((copyIndex) => (
                    <div
                      key={`out_copy_single_${copyIndex}`}
                      className="absolute left-0 w-full overflow-hidden"
                      style={{
                        top: copyIndex * HALF_LETTER_HEIGHT,
                        height: HALF_LETTER_HEIGHT,
                      }}
                    >
                      <div
                        className="absolute top-0 left-0"
                        style={{
                          width: pageWidth,
                          height: pageHeight,
                          transform: `scale(${recipeCopyScale})`,
                          transformOrigin: 'top left',
                        }}
                      >
                        {renderTemplateCanvasContent()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="tpl-print-canvas relative w-full h-full">
                  {renderTemplateCanvasContent()}
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default PlantillaDinamicaModal;
