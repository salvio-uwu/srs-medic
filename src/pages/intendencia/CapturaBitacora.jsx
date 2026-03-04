import React, { useState, useRef } from "react";
import { Camera, UploadCloud, CheckCircle, AlertCircle, X } from "lucide-react";
import { collection, addDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, functions, storage } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

export default function CapturaBitacora() {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState(null);
  const fileInputRef = useRef(null);

  const triggerCamera = () => fileInputRef.current.click();

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setStatus(null);
  };

  const fileToBase64 = (f) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(f);
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const base64Image = await fileToBase64(file);
      const mimeType = file.type;

      const analizarBitacora = httpsCallable(functions, 'analizarBitacora');
      const response = await analizarBitacora({
        base64Image,
        mimeType,
        tipoBitacora: "limpieza_general"
      });

      let datosExtraidos = [];
      try {
        const textResult = response.data.result.replace(/```json/g, "").replace(/```/g, "").trim();
        datosExtraidos = JSON.parse(textResult);
      } catch (e) {
        console.error("Error parseando JSON de IA:", e);
      }

      const storageRef = ref(storage, `bitacoras_limpieza/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db, "bitacorasLimpieza"), {
        uidIntendencia: user.uid,
        fechaSubida: new Date().toISOString(),
        imagenUrl: downloadURL,
        datosEstructurados: datosExtraidos
      });

      setStatus('success');
      setPreview(null);
      setFile(null);
    } catch (error) {
      console.error("Fallo de subida/procesamiento:", error);
      setStatus('error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-6 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-slate-800 mb-1 text-center">Registro de Limpieza</h1>
        <p className="text-sm text-slate-500 mb-8 text-center">Captura fotográfica de bitácora</p>

        {status === 'success' && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-xl flex items-center gap-3 w-full border border-emerald-200">
            <CheckCircle className="shrink-0" size={20} />
            <span className="text-sm font-semibold">Bitácora procesada y guardada.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 w-full border border-red-200">
            <AlertCircle className="shrink-0" size={20} />
            <span className="text-sm font-semibold">Fallo en el servidor. Reintente.</span>
          </div>
        )}

        {!preview ? (
          <button
            onClick={triggerCamera}
            className="w-48 h-48 bg-blue-50 text-blue-600 rounded-full flex flex-col items-center justify-center gap-3 hover:bg-blue-100 active:scale-95 transition-transform mb-6 shadow-inner"
          >
            <Camera size={56} strokeWidth={1.5} />
            <span className="font-bold text-lg">Abrir Cámara</span>
          </button>
        ) : (
          <div className="relative w-full aspect-[3/4] mb-6 rounded-2xl overflow-hidden bg-slate-900 shadow-inner">
            <img src={preview} alt="Vista previa" className="w-full h-full object-contain" />
            <button 
              onClick={() => { setPreview(null); setFile(null); }}
              className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full backdrop-blur-md active:scale-95"
              disabled={isProcessing}
            >
              <X size={24} />
            </button>
          </div>
        )}

        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileSelect}
          ref={fileInputRef}
          className="hidden"
        />

        {preview && (
          <button
            onClick={handleUpload}
            disabled={isProcessing}
            className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 text-lg active:scale-95 transition-all ${
              isProcessing ? "bg-slate-400" : "bg-blue-600 shadow-md shadow-blue-500/30"
            }`}
          >
            {isProcessing ? (
              <>
                <svg className="animate-spin h-6 w-6 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Procesando IA...
              </>
            ) : (
              <>
                <UploadCloud size={24} />
                Enviar Documento
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}