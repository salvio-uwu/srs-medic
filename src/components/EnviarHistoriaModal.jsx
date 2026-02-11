import React, { useState, useEffect } from 'react';
import { pdf } from '@react-pdf/renderer'; 
import { 
  X, Send, Mail, MessageCircle, Download, 
  CheckCircle2, AlertCircle, Phone, Loader2 
} from 'lucide-react';

// Importación corregida según me indicas
import DocumentoHistoriaPDF from './pdf/DocumentoHistoriaPDF'; 

const EnviarHistoriaModal = ({ onClose, pacienteNombre, pacienteTelefono, pacienteEmail, datosPaciente }) => {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [generando, setGenerando] = useState(true);
  const [emailDestino, setEmailDestino] = useState(pacienteEmail || '');
  const [telefonoDestino, setTelefonoDestino] = useState(pacienteTelefono || '');
  const [status, setStatus] = useState({ show: false, msg: '', type: 'success' });

  useEffect(() => {
    const crearArchivo = async () => {
      // Log para saber que la función arrancó
      console.log("🚀 Iniciando generación de PDF para:", pacienteNombre);
      console.log("📦 Datos recibidos:", datosPaciente);

      if (!datosPaciente || Object.keys(datosPaciente).length === 0) {
        console.error("❌ Error: 'datosPaciente' está vacío o es undefined");
        setGenerando(false);
        setStatus({ show: true, msg: "Faltan datos para generar el PDF", type: 'error' });
        return;
      }

      try {
        setGenerando(true);
        
        // Creamos la instancia del documento
        const MyDoc = <DocumentoHistoriaPDF datos={datosPaciente} />;
        
        console.log("🛠️ Llamando a pdf().toBlob()...");
        const blob = await pdf(MyDoc).toBlob();
        
        console.log("✅ Blob generado con éxito. Tamaño:", blob.size);
        const url = URL.createObjectURL(blob);
        
        setPdfUrl(url);
        setGenerando(false);
      } catch (err) {
        // Aquí atrapamos el error si el componente PDF truena por dentro
        console.error("💥 Error crítico en el motor de PDF:", err);
        setStatus({ 
          show: true, 
          msg: "Error interno al construir el PDF. Revisa la consola.", 
          type: 'error' 
        });
        setGenerando(false);
      }
    };

    crearArchivo();

    // Limpieza de URL al desmontar para no saturar la memoria
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [datosPaciente]);

  // --- Handlers de Envío ---
  const handleDescargar = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `Historia_Clinica_${pacienteNombre.replace(/ /g, '_')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEnviarWhatsApp = () => {
    if (!pdfUrl) return setStatus({show:true, msg:"Espera a que termine de cargar", type:'error'});
    let phone = telefonoDestino.replace(/\D/g, ''); 
    if (phone.length === 10) phone = `52${phone}`;
    const mensaje = `*Historia Clínica: ${pacienteNombre}*\nSu documento está listo.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[150] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200 relative">
        
        {/* NOTIFICACIÓN TIPO TOAST */}
        {status.show && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-xl border animate-in slide-in-from-top ${
            status.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}>
            {status.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
            <span className="font-bold text-sm">{status.msg}</span>
            <button onClick={() => setStatus({show:false})} className="ml-2 opacity-50 hover:opacity-100">×</button>
          </div>
        )}

        {/* HEADER */}
        <div className="px-10 pt-10 pb-6 flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Enviar Expediente</h3>
            <div className="mt-2">
              {generando ? (
                <div className="flex items-center gap-2 text-orange-500">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Generando PDF...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-emerald-500">
                  <CheckCircle2 size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Documento listo para envío</span>
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-all">
            <X size={24}/>
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="px-10 pb-10 space-y-5">
          <div className="space-y-4">
            <div className="flex gap-2">
              <input 
                type="text" value={telefonoDestino} onChange={(e) => setTelefonoDestino(e.target.value)}
                className="flex-1 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-emerald-500 transition-all"
                placeholder="WhatsApp..."
              />
              <button onClick={handleEnviarWhatsApp} disabled={generando} className="bg-emerald-500 hover:bg-emerald-600 text-white p-4 rounded-2xl shadow-lg disabled:opacity-30 transition-all">
                <MessageCircle size={22} />
              </button>
            </div>

            <div className="flex gap-2">
              <input 
                type="email" value={emailDestino} onChange={(e) => setEmailDestino(e.target.value)}
                className="flex-1 px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition-all"
                placeholder="Email..."
              />
              <button onClick={() => window.location.href = `mailto:${emailDestino}?subject=Expediente&body=Adjunto enlace.`} disabled={generando} className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-2xl shadow-lg disabled:opacity-30 transition-all">
                <Send size={22} />
              </button>
            </div>
          </div>

          <div className="h-px bg-slate-100"></div>

          <button 
            onClick={handleDescargar}
            disabled={generando}
            className={`w-full py-5 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all ${
              generando 
                ? 'bg-slate-100 text-slate-400' 
                : 'bg-slate-900 text-white hover:bg-black shadow-xl shadow-slate-200'
            }`}
          >
            {generando ? <Loader2 size={20} className="animate-spin"/> : <Download size={20} />}
            {generando ? 'TRABAJANDO EN EL PDF...' : 'DESCARGAR EXPEDIENTE PDF'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EnviarHistoriaModal;