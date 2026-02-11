import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Upload, FileText, Image as ImageIcon, Maximize, 
  Minimize, ZoomIn, ZoomOut, Trash2, Loader2,
  ExternalLink, Download, AlertCircle, CheckCircle2
} from 'lucide-react';
import { db, storage } from '../config/firebase';
import { collection, addDoc, query, where, onSnapshot, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';

const PacientesPortafolio = ({ onClose, pacienteId, pacienteNombre }) => {
  const [documentos, setDocumentos] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [notification, setNotification] = useState({ show: false, msg: '', type: 'error' });
  
  const fileInputRef = useRef();

  const showStatus = (msg, type = 'error') => {
    setNotification({ show: true, msg, type });
    setTimeout(() => setNotification({ show: false, msg: '', type: 'error' }), 5000);
  };

  useEffect(() => {
    if (!pacienteId) return;
    const q = query(collection(db, "documentos_pacientes"), where("pacienteId", "==", pacienteId));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
      setDocumentos(docs);
      if (docs.length > 0 && !selectedDoc) setSelectedDoc(docs[0]);
    }, () => showStatus("Error al conectar con la base de datos."));
    return () => unsub();
  }, [pacienteId]);

  const processUpload = async (file) => {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return showStatus("El archivo supera el límite de 50MB.");
    setUploading(true);
    setProgress(0);
    const storageRef = ref(storage, `pacientes/${pacienteId}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed', 
      (snap) => setProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      (error) => { setUploading(false); showStatus("Error de conexión con el servidor."); },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        await addDoc(collection(db, "documentos_pacientes"), {
          pacienteId, nombre: file.name, url, tipo: file.type,
          fecha: serverTimestamp(), storagePath: uploadTask.snapshot.ref.fullPath
        });
        setUploading(false);
        showStatus("¡Archivo guardado con éxito!", "success");
      }
    );
  };

  const handleDrag = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(e.type === "dragover"); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files?.[0]) processUpload(e.dataTransfer.files[0]); };

  const handleEliminar = async (docObj) => {
    if (!window.confirm(`¿Eliminar "${docObj.nombre}"?`)) return;
    try {
      await deleteObject(ref(storage, docObj.storagePath));
      await deleteDoc(doc(db, "documentos_pacientes", docObj.id));
      if (selectedDoc?.id === docObj.id) setSelectedDoc(null);
      showStatus("Documento eliminado.", "success");
    } catch (e) { showStatus("No se pudo eliminar el archivo."); }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 transition-all" onDragOver={handleDrag} onDragLeave={handleDrag} onDrop={handleDrop}>
      <div className="bg-white w-full max-w-7xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden relative border border-white/20">
        
        {/* NOTIFICACIÓN */}
        {notification.show && (
          <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-6 py-3 rounded-2xl shadow-2xl border animate-in slide-in-from-top duration-300 ${notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
            {notification.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
            <span className="font-bold text-sm">{notification.msg}</span>
          </div>
        )}

        {/* OVERLAY DRAG */}
        {isDragging && (
          <div className="absolute inset-0 z-[250] bg-cyan-600/20 backdrop-blur-sm border-4 border-cyan-500 border-dashed m-4 rounded-[2rem] flex flex-col items-center justify-center pointer-events-none animate-pulse">
            <div className="bg-white p-8 rounded-full shadow-xl mb-4"><Upload size={60} className="text-cyan-600" /></div>
            <h2 className="text-3xl font-black text-white drop-shadow-md">¡Suelta para subir!</h2>
          </div>
        )}

        {/* HEADER */}
        <div className="px-8 py-5 border-b flex justify-between items-center bg-white">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-cyan-400 to-blue-600 p-2.5 rounded-2xl text-white shadow-lg"><ImageIcon size={24}/></div>
            <div>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Portafolio Clínico</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">{pacienteNombre}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all active:scale-90"><X size={28}/></button>
        </div>

        {/* ACCIONES / PROGRESO */}
        <div className="bg-slate-50/50 px-8 py-4 border-b flex items-center gap-6">
          <input type="file" className="hidden" ref={fileInputRef} onChange={(e) => processUpload(e.target.files[0])}/>
          <button onClick={() => fileInputRef.current.click()} disabled={uploading} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all disabled:opacity-50">
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18}/>}
            {uploading ? 'Procesando...' : 'Nuevo Documento'}
          </button>
          {uploading && (
            <div className="flex-1 flex items-center gap-4 animate-in fade-in">
              <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.5)]" style={{width: `${progress}%`}} />
              </div>
              <span className="text-xs font-black text-cyan-600">{Math.round(progress)}%</span>
            </div>
          )}
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 flex overflow-hidden">
          {/* SIDEBAR */}
          <div className="w-80 border-r bg-white flex flex-col">
            <div className="p-4 bg-slate-50/50 border-b"><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Archivos ({documentos.length})</span></div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {documentos.map((d) => (
                <div key={d.id} onClick={() => { setSelectedDoc(d); setZoom(1); setFit(true); }} className={`group flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border-2 ${selectedDoc?.id === d.id ? 'bg-cyan-50 border-cyan-200 shadow-sm' : 'border-transparent hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className={`p-2.5 rounded-xl ${selectedDoc?.id === d.id ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {d.tipo.includes('image') ? <ImageIcon size={18}/> : <FileText size={18}/>}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <span className={`text-sm font-bold truncate ${selectedDoc?.id === d.id ? 'text-cyan-900' : 'text-slate-700'}`}>{d.nombre}</span>
                      <span className="text-[10px] font-bold text-slate-400">{d.fecha ? new Date(d.fecha.seconds * 1000).toLocaleDateString() : 'Subiendo...'}</span>
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); handleEliminar(d); }} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-100 text-red-500 rounded-xl transition-all"><Trash2 size={16}/></button>
                </div>
              ))}
            </div>
          </div>

          {/* VISOR ACTUALIZADO */}
          <div className="flex-1 flex flex-col bg-slate-50 relative">
            {selectedDoc ? (
              <>
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[50] flex items-center gap-2 bg-slate-900/90 backdrop-blur text-white px-4 py-2 rounded-2xl shadow-2xl border border-white/10">
                  <ToolBtn icon={<Maximize size={18}/>} onClick={() => {setFit(true); setZoom(1);}} active={fit} />
                  <div className="w-px h-4 bg-white/20 mx-1" />
                  <ToolBtn icon={<ZoomOut size={18}/>} onClick={() => {setFit(false); setZoom(z => Math.max(0.2, z - 0.2));}} />
                  <span className="text-[10px] font-black w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <ToolBtn icon={<ZoomIn size={18}/>} onClick={() => {setFit(false); setZoom(z => Math.min(3, z + 0.2));}} />
                  <div className="w-px h-4 bg-white/20 mx-1" />
                  <a href={selectedDoc.url} target="_blank" rel="noreferrer" className="p-2 hover:text-cyan-400 transition-colors"><ExternalLink size={18}/></a>
                </div>

                <div className="flex-1 overflow-auto flex items-center justify-center p-8">
                  {selectedDoc.tipo.includes('image') ? (
                    <img 
                      src={selectedDoc.url} 
                      className={`shadow-2xl bg-white transition-all duration-300 rounded-lg ${fit ? 'max-w-full max-h-full object-contain' : ''}`}
                      style={{ transform: fit ? 'none' : `scale(${zoom})`, cursor: fit ? 'zoom-in' : 'grab' }}
                      alt="Vista previa"
                    />
                  ) : selectedDoc.tipo.includes('pdf') ? (
                    // PREVISUALIZACIÓN DE PDF
                    <iframe
                      src={`${selectedDoc.url}#toolbar=0&navpanes=0`}
                      className="w-full h-full rounded-2xl shadow-2xl bg-white border-none"
                      title="PDF Preview"
                    />
                  ) : (
                    // Otros documentos (Word, Excel, etc.)
                    <div className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-slate-100 flex flex-col items-center gap-6 max-w-sm text-center">
                      <div className="w-24 h-24 bg-cyan-50 text-cyan-500 rounded-3xl flex items-center justify-center"><FileText size={48}/></div>
                      <h3 className="text-xl font-black text-slate-800">{selectedDoc.nombre}</h3>
                      <p className="text-slate-400 text-sm font-medium">Este formato requiere descarga para ser visto.</p>
                      <a href={selectedDoc.url} target="_blank" rel="noreferrer" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                        ABRIR ARCHIVO <ExternalLink size={18}/>
                      </a>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
                <div className="p-8 bg-white rounded-full shadow-inner"><ImageIcon size={64} className="opacity-20"/></div>
                <p className="font-black tracking-widest uppercase text-xs opacity-40">Selecciona un archivo</p>
              </div>
            )}
            
            {/* FOOTER INFO */}
            {selectedDoc && (
              <div className="bg-white px-8 py-3 border-t flex justify-between items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <div className="flex gap-4"><span>FORMATO: {selectedDoc.tipo.split('/')[1]}</span><span>ID: {selectedDoc.id.slice(0,8)}</span></div>
                <a href={selectedDoc.url} download className="flex items-center gap-2 hover:text-cyan-500 transition-colors"><Download size={14}/> DESCARGAR ORIGINAL</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ToolBtn = ({ icon, onClick, active }) => (
  <button onClick={onClick} className={`p-2 rounded-xl transition-all active:scale-90 ${active ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30' : 'hover:bg-white/10 text-white/70 hover:text-white'}`}>{icon}</button>
);

export default PacientesPortafolio;