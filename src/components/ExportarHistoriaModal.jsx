import React, { useState } from 'react';
import { 
  X, User, FileText, CheckSquare, Square, 
  Download, Loader2, Calendar, MapPin, 
  ChevronRight, Filter
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { 
  Document, Packer, Paragraph, TextRun, Table, TableRow, 
  TableCell, WidthType, AlignmentType, HeadingLevel 
} from 'docx';

const ExportarHistoriaModal = ({ onClose, pacienteNombre, historial }) => {
  const [seleccionados, setSeleccionados] = useState([]);
  const [exportando, setExportando] = useState(false);
  const [opciones, setOpciones] = useState({
    incluirNotas: true,
    ordenAscendente: false
  });

  const toggleSeleccion = (id) => {
    setSeleccionados(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleTodas = () => {
    setSeleccionados(seleccionados.length === historial.length ? [] : historial.map(h => h.id));
  };

  const handleExportar = async () => {
    if (seleccionados.length === 0) return;
    try {
      setExportando(true);
      const consultasAExportar = historial
        .filter(h => seleccionados.includes(h.id))
        .sort((a, b) => opciones.ordenAscendente 
            ? new Date(a.fechaRaw) - new Date(b.fechaRaw)
            : new Date(b.fechaRaw) - new Date(a.fechaRaw));

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ text: "HISTORIAL CLÍNICO", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
            new Paragraph({
              children: [
                new TextRun({ text: `Paciente: `, bold: true }),
                new TextRun(pacienteNombre.toUpperCase()),
              ],
              spacing: { before: 200, after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: "Fecha", bold: true })] }),
                    new TableCell({ children: [new Paragraph({ text: "Detalles", bold: true })] }),
                  ],
                }),
                ...consultasAExportar.map(item => new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph(item.fechaSolo)] }),
                    new TableCell({ 
                      children: [
                        new Paragraph({ text: item.motivo, bold: true }),
                        ...(opciones.incluirNotas ? [new Paragraph(item.evolucion || "Sin notas")] : [])
                      ] 
                    }),
                  ],
                })),
              ],
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Expediente_${pacienteNombre.replace(/ /g, '_')}.docx`);
      setExportando(false);
      onClose();
    } catch (error) {
      console.error(error);
      setExportando(false);
    }
  };

  const historialVisual = [...historial].sort((a, b) => opciones.ordenAscendente 
      ? new Date(a.fechaRaw) - new Date(b.fechaRaw)
      : new Date(b.fechaRaw) - new Date(a.fechaRaw));

  return (
    <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-xl flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* HEADER: Slim & Professional */}
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="bg-white p-2 rounded-lg shadow-sm border border-slate-200 text-cyan-600">
              <FileText size={18}/>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-none">Exportar Consultas</h2>
              <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wider">Configuración de reporte .docx</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
            <X size={20}/>
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-6">
            
            {/* CONTEXT BAR: Slimmer Patient Info */}
            <div className="flex items-center justify-between mb-6 bg-white border border-slate-100 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center border border-orange-100">
                        <User size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Paciente Seleccionado</p>
                        <h4 className="text-base font-bold text-slate-800">{pacienteNombre}</h4>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Consultas Totales</p>
                    <p className="text-sm font-bold text-cyan-600">{historial.length}</p>
                </div>
            </div>

            {/* TOOLBAR: Controls */}
            <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-5">
                    <button 
                        onClick={toggleTodas}
                        className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-cyan-600 transition-all"
                    >
                        <div className="text-cyan-500">
                            {seleccionados.length === historial.length && historial.length > 0 ? <CheckSquare size={18}/> : <Square size={18}/>}
                        </div>
                        Seleccionar todo
                    </button>

                    <div className="h-4 w-px bg-slate-200"></div>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded accent-cyan-500 border-slate-300"
                            checked={opciones.incluirNotas} 
                            onChange={e => setOpciones({...opciones, incluirNotas: e.target.checked})} 
                        />
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">Detalle de evolución</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4 rounded accent-cyan-500 border-slate-300"
                            checked={opciones.ordenAscendente} 
                            onChange={e => setOpciones({...opciones, ordenAscendente: e.target.checked})} 
                        />
                        <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-700 transition-colors">Más antiguas primero</span>
                    </label>
                </div>
                
                <div className="text-[11px] font-bold text-cyan-700 bg-cyan-50 px-3 py-1 rounded-lg border border-cyan-100">
                    {seleccionados.length} SELECCIONADAS
                </div>
            </div>

            {/* TABLE: Clean & Readable */}
            <div className="flex-1 border border-slate-200 rounded-xl overflow-hidden bg-white flex flex-col shadow-inner">
                <div className="overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                            <tr>
                                <th className="py-3 px-4 w-12 text-center text-[10px] font-bold uppercase tracking-wider">Sel.</th>
                                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider">Fecha y Hora</th>
                                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider">Motivo de Consulta</th>
                                <th className="py-3 px-4 text-[10px] font-bold uppercase tracking-wider text-right">Sucursal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {historialVisual.map((item) => (
                                <tr 
                                    key={item.id} 
                                    onClick={() => toggleSeleccion(item.id)}
                                    className={`group cursor-pointer transition-colors ${seleccionados.includes(item.id) ? 'bg-cyan-50/30' : 'hover:bg-slate-50/80'}`}
                                >
                                    <td className="py-3 px-4 text-center">
                                        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${seleccionados.includes(item.id) ? 'bg-cyan-500 border-cyan-500 text-white' : 'bg-white border-slate-200'}`}>
                                            {seleccionados.includes(item.id) && <CheckSquare size={12}/>}
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700">{item.fechaSolo}</span>
                                            <span className="text-[10px] font-semibold text-slate-400 leading-tight">{item.horaSolo}</span>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4">
                                        <p className="text-xs font-medium text-slate-600 truncate max-w-xs">{item.motivo}</p>
                                    </td>
                                    <td className="py-3 px-4 text-right">
                                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">{item.sucursal || 'Matriz'}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* FOOTER ACTIONS */}
            <div className="mt-6 flex justify-end items-center gap-3">
                <button 
                    onClick={onClose}
                    className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors uppercase tracking-widest"
                >
                    Cancelar
                </button>
                <button 
                    onClick={handleExportar}
                    disabled={seleccionados.length === 0 || exportando}
                    className={`flex items-center gap-2 px-8 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all ${
                        seleccionados.length === 0 || exportando
                        ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                        : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200 active:scale-95'
                    }`}
                >
                    {exportando ? <Loader2 className="animate-spin" size={16}/> : <Download size={16}/>}
                    {exportando ? 'Procesando...' : 'Generar Reporte'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ExportarHistoriaModal;