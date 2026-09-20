import React from 'react';
import { AlertTriangle, Mail, MessageCircle, Phone, X } from 'lucide-react';

const SUPPORT_EMAIL = 'salvioulloa@gmail.com';
const SUPPORT_PHONE_DISPLAY = '813 138 0156';
const SUPPORT_WHATSAPP_URL = 'https://wa.me/528131380156?text=Hola%2C%20necesito%20soporte%20con%20SRS-Medic%20(acceso%20denegado%20por%20reglas%20de%20seguridad).';

export default function FirebasePermissionSupportModal({ onClose, detail = '' }) {
  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="firebase-perm-title"
      aria-describedby="firebase-perm-desc"
    >
      <div
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/20 p-2.5">
                <AlertTriangle size={22} strokeWidth={2.2} />
              </div>
              <div>
                <h2 id="firebase-perm-title" className="text-lg font-bold leading-tight">
                  Acceso restringido
                </h2>
                <p className="text-sm text-white/90 mt-0.5">
                  Reglas de seguridad de Firebase
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1.5 hover:bg-white/15 transition-colors"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p id="firebase-perm-desc" className="text-sm text-slate-600 leading-relaxed">
            El sistema detectó un bloqueo de permisos al acceder a datos clínicos.
            Si eres personal autorizado y ves este aviso, contacta a soporte de inmediato.
          </p>

          {detail ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
                Detalle técnico
              </p>
              <p className="text-xs text-slate-600 font-mono break-all">{detail}</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 hover:bg-emerald-100 transition-colors"
            >
              <MessageCircle size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-bold">WhatsApp — Soporte directo</p>
                <p className="text-sm text-emerald-700">{SUPPORT_PHONE_DISPLAY}</p>
              </div>
            </a>

            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Soporte%20SRS-Medic%20-%20Permisos%20Firebase&body=Describe%20qu%C3%A9%20estabas%20haciendo%20cuando%20apareci%C3%B3%20el%20aviso%3A%0A%0A`}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-800 hover:bg-slate-50 transition-colors"
            >
              <Mail size={20} className="text-slate-500 shrink-0" />
              <div>
                <p className="text-sm font-bold">Correo de soporte</p>
                <p className="text-sm text-slate-600">{SUPPORT_EMAIL}</p>
              </div>
            </a>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-slate-600">
              <Phone size={18} className="text-slate-400 shrink-0" />
              <p className="text-xs leading-relaxed">
                Menciona tu nombre, rol y la pantalla donde ocurrió el error para agilizar la revisión.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-slate-900 text-white text-sm font-bold py-3 hover:bg-slate-800 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
