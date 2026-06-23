import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  X, Copy, Download, Loader2, Check, Link, QrCode, Share2
} from 'lucide-react';
import { crearEnlaceCompartido } from '../services/expedienteShareService';

const ShareExpedienteModal = ({
  pdfBlob,
  token,
  shareUrl,
  paciente,
  generadoPor,
  folio,
  onClose
}) => {
  const [estado, setEstado] = useState('generando'); // generando | listo | error
  const [errorMsg, setErrorMsg] = useState('');
  const [copiado, setCopiado] = useState(false);
  const canvasRef = useRef(null);

  const nombrePaciente = [
    paciente?.nombre,
    paciente?.apellidoPaterno,
    paciente?.apellidoMaterno
  ].filter(Boolean).join(' ') || paciente?.nombreCompleto || 'Paciente';

  useEffect(() => {
    if (!pdfBlob || !token || !shareUrl) {
      setEstado('error');
      setErrorMsg('No se pudo generar el PDF para compartir.');
      return;
    }

    let cancelled = false;

    const crear = async () => {
      try {
        setEstado('generando');
        await crearEnlaceCompartido({
          pdfBlob,
          token,
          pacienteId: paciente?.id || '',
          nombrePaciente,
          generadoPor,
          folio
        });

        if (cancelled) return;

        setEstado('listo');
      } catch (err) {
        if (cancelled) return;
        console.error('Error al crear enlace compartido:', err);
        setEstado('error');
        setErrorMsg(err?.message || 'Error al generar el enlace compartido.');
      }
    };

    crear();
    return () => { cancelled = true; };
  }, [pdfBlob, token, shareUrl]);

  // Dibujar QR en canvas cuando el estado sea listo
  useEffect(() => {
    if (estado !== 'listo' || !shareUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const size = Math.min(canvas.parentElement?.clientWidth || 260, 260);

    QRCode.toCanvas(canvas, shareUrl, {
      width: size,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    }).catch(console.error);
  }, [estado, shareUrl]);

  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }
  };

  const descargarQR = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = `QR_Expediente_${nombrePaciente.replace(/\s+/g, '_')}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="fixed inset-0 z-[230] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="border-b border-slate-100 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-slate-500" />
            <h3 className="text-sm font-semibold text-slate-800" style={{ fontFamily: 'Sora, sans-serif' }}>
              Compartir expediente
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {estado === 'generando' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 size={28} className="text-blue-500 animate-spin" />
              <p className="text-xs text-slate-500">Subiendo expediente...</p>
            </div>
          )}

          {estado === 'error' && (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
                <X size={18} className="text-red-500" />
              </div>
              <p className="text-xs text-slate-600 text-center">{errorMsg}</p>
              <button
                onClick={onClose}
                className="mt-1 px-4 py-1.5 text-[11px] font-medium text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cerrar
              </button>
            </div>
          )}

          {estado === 'listo' && (
            <div className="space-y-4">
              {/* QR Code */}
              <div className="flex justify-center">
                <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
                  <canvas ref={canvasRef} className="block" />
                </div>
              </div>

              {/* Info del paciente */}
              <div className="text-center">
                <p className="text-[11px] font-medium text-slate-700 truncate">{nombrePaciente}</p>
                {folio && (
                  <p className="text-[10px] text-slate-400 mt-0.5">Folio: {folio}</p>
                )}
              </div>

              {/* URL */}
              <div className="flex items-center gap-1.5 bg-slate-50 rounded-lg p-2 border border-slate-100">
                <Link size={12} className="text-slate-400 shrink-0 ml-1" />
                <p className="text-[10px] text-slate-600 truncate flex-1 select-all">{shareUrl}</p>
                <button
                  onClick={copiarEnlace}
                  className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
                  title="Copiar enlace"
                >
                  {copiado ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                </button>
              </div>

              {/* Botones de acción */}
              <div className="flex gap-2">
                <button
                  onClick={copiarEnlace}
                  className="flex-1 py-2.5 rounded-lg bg-slate-800 text-white text-[11px] font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-900 transition-colors"
                >
                  <Copy size={12} />
                  {copiado ? 'Copiado' : 'Copiar enlace'}
                </button>
                <button
                  onClick={descargarQR}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-[11px] font-medium inline-flex items-center justify-center gap-1.5 hover:bg-slate-50 transition-colors"
                >
                  <Download size={12} />
                  Descargar QR
                </button>
              </div>

              <p className="text-[9px] text-slate-400 text-center">
                Este enlace expirará en 30 días. Cualquier persona con el enlace podrá ver el expediente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareExpedienteModal;
