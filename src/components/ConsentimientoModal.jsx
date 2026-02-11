import React, { useState, useRef } from 'react';
import { X, FileSignature, Save, Upload, Loader2, FileText, History } from 'lucide-react';
import { db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { saveAs } from 'file-saver';
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

const ConsentimientoModal = ({ onClose, pacienteNombre, pacienteId, doctor }) => {
  const [loading, setLoading] = useState(false);
  const [templateFile, setTemplateFile] = useState(null);
  const fileInputRef = useRef();

  // ESTADO BASADO EXACTAMENTE EN LA IMAGEN PROPORCIONADA
  const [formData, setFormData] = useState({
    institucion: 'CENTRO MEDICO SANTA CRUZ',
    establecimiento: 'CENTRO MEDICO SANTA CRUZ',
    tituloDoc: '',
    lugar: 'SANTA CATARINA',
    fechaHora: new Date().toISOString().slice(0, 16),
    actoAutorizado: '',
    descripcion: '',
    riesgos: '',
    beneficios: ''
  });

  const rrellenarPlantilla = async () => {
    if (!templateFile) return alert("Por favor, sube primero la plantilla .docx legal.");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target.result;
        const zip = new PizZip(content);
        const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

        const fechaObj = new Date(formData.fechaHora);

        // MAPEO DE DATOS PARA EL DOCUMENTO
        doc.render({
          INSTITUCION: formData.institucion.toUpperCase(),
          ESTABLECIMIENTO: formData.establecimiento.toUpperCase(),
          TITULO_DOC: formData.tituloDoc.toUpperCase(),
          LUGAR: formData.lugar.toUpperCase(),
          FECHA: fechaObj.toLocaleDateString('es-MX'),
          PACIENTE: pacienteNombre.toUpperCase(),
          ACTO_AUTORIZADO: formData.actoAutorizado.toUpperCase(),
          HORA: fechaObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }),
          DESCRIPCION: formData.descripcion,
          RIESGOS: formData.riesgos,
          BENEFICIOS: formData.beneficios,
          MEDICO_INFO: doctor.nombre.toUpperCase()
        });

        const out = doc.getZip().generate({
          type: "blob",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });

        saveAs(out, `Consentimiento_${pacienteNombre.replace(/ /g, '_')}.docx`);
      } catch (error) {
        console.error("Error procesando plantilla:", error);
        alert("La plantilla tiene errores en las etiquetas { }.");
      }
    };
    reader.readAsArrayBuffer(templateFile);
  };

  const handleGuardar = async () => {
    if (!formData.actoAutorizado || !templateFile) {
        return alert("Complete el acto autorizado y suba la plantilla.");
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "consentimientos_informados"), {
        ...formData,
        pacienteId,
        pacienteNombre,
        medicoNombre: doctor.nombre,
        fechaCreacion: serverTimestamp()
      });

      await rrellenarPlantilla();
      onClose();
    } catch (error) {
      console.error(error);
    }
    setLoading(false);
  };

  // ESTILOS UI (Basados en image_48b084.jpg)
  const labelStyle = "block text-sm font-bold text-cyan-700 mb-1";
  const inputStyle = "w-full p-2 border border-slate-200 rounded-md text-sm outline-none focus:border-cyan-500 transition-all bg-white";
  const textAreaStyle = "w-full p-2 border border-slate-200 rounded-md text-sm outline-none focus:border-cyan-500 h-24 resize-none bg-white";

  return (
    <div className="fixed inset-0 z-[130] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="bg-white w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 border border-slate-200">
        
        {/* HEADER */}
        <div className="bg-white px-6 py-3 border-b flex justify-between items-center">
            <div className="flex items-center gap-2 text-cyan-800 font-bold">
                <FileSignature size={20} className="text-cyan-600"/> 
                Carta de consentimiento informado
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-red-500"><X size={24}/></button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto max-h-[85vh]">
            <div className="flex gap-2 text-sm items-center mb-2">
                <span className="text-cyan-800 font-bold">Paciente:</span>
                <span className="text-slate-800 font-black text-lg">{pacienteNombre}</span>
            </div>

            {/* SUBIR PLANTILLA (Sección de soporte) */}
            <div onClick={() => fileInputRef.current.click()} className={`border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-all ${templateFile ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="file" hidden ref={fileInputRef} accept=".docx" onChange={(e) => setTemplateFile(e.target.files[0])} />
                {templateFile ? (
                    <span className="text-emerald-700 font-bold flex items-center gap-2"><FileText size={18}/> Plantilla lista: {templateFile.name}</span>
                ) : (
                    <span className="text-slate-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2"><Upload size={16}/> Click para subir plantilla .docx</span>
                )}
            </div>

            {/* CAMPOS SUPERIORES - REPLICADOS DE LA IMAGEN */}
            <div className="space-y-3">
                <div>
                    <label className={labelStyle}>Nombre de la institución:</label>
                    <input className={inputStyle} value={formData.institucion} onChange={e => setFormData({...formData, institucion: e.target.value})} />
                </div>
                <div>
                    <label className={labelStyle}>* Nombre, razón o denominación social del establecimiento:</label>
                    <input className={inputStyle} value={formData.establecimiento} onChange={e => setFormData({...formData, establecimiento: e.target.value})} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>* Título del documento:</label>
                        <input className={inputStyle} placeholder="Ej. PARA ACTOS GINECOLÓGICOS" value={formData.tituloDoc} onChange={e => setFormData({...formData, tituloDoc: e.target.value})} />
                    </div>
                    <div>
                        <label className={labelStyle}>* Lugar</label>
                        <input className={inputStyle} value={formData.lugar} onChange={e => setFormData({...formData, lugar: e.target.value})} />
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelStyle}>* Fecha y hora</label>
                        <input type="datetime-local" className={inputStyle} value={formData.fechaHora} onChange={e => setFormData({...formData, fechaHora: e.target.value})} />
                    </div>
                    <div>
                        <label className={labelStyle}>* Acto autorizado</label>
                        <input className={inputStyle} value={formData.actoAutorizado} onChange={e => setFormData({...formData, actoAutorizado: e.target.value})} />
                    </div>
                </div>
            </div>

            {/* SECCIÓN DE TEXTAREAS EN GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className={labelStyle}>Descripción del acto autorizado</label>
                    <textarea className={textAreaStyle} placeholder="Descripción del acto autorizado" value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
                </div>
                <div>
                    <label className={labelStyle}>Riesgos/complicaciones del acto médico</label>
                    <textarea className={textAreaStyle} placeholder="Riesgos/complicaciones del acto médico" value={formData.riesgos} onChange={e => setFormData({...formData, riesgos: e.target.value})} />
                </div>
            </div>

            <div>
                <label className={labelStyle}>Beneficios del acto médico</label>
                <textarea className={`${textAreaStyle} h-20`} placeholder="Beneficios del acto médico" value={formData.beneficios} onChange={e => setFormData({...formData, beneficios: e.target.value})} />
            </div>

            {/* FOOTER BUTTONS */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                <button className="bg-cyan-400 hover:bg-cyan-500 text-white px-4 py-2 rounded-md font-bold text-xs flex items-center gap-2 transition-all shadow-sm">
                    <History size={14}/> Elegir uno generado anteriormente
                </button>
                <div className="flex gap-3">
                    <button 
                        onClick={handleGuardar}
                        disabled={loading}
                        className="bg-cyan-400 hover:bg-cyan-500 text-white px-6 py-2 rounded-md font-bold text-sm shadow-md transition-all flex items-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16}/> : 'Generar'}
                    </button>
                    <button onClick={onClose} className="bg-cyan-400 hover:bg-cyan-500 text-white px-6 py-2 rounded-md font-bold text-sm shadow-md transition-all">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ConsentimientoModal;