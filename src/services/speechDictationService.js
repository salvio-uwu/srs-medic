import { Capacitor } from '@capacitor/core';

const getWebSpeechRecognition = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

const friendlySpeechError = (err) => {
  const raw = String(err?.message || err || '');
  const code = String(err?.code || '');
  if (
    code === 'UNIMPLEMENTED'
    || /not implemented/i.test(raw)
    || /plugin is not implemented/i.test(raw)
  ) {
    return 'El dictado por voz requiere actualizar la app Android. Instala la APK más reciente de SRS-Medic.';
  }
  if (/permission|permiso|denied|RECORD_AUDIO/i.test(raw)) {
    return 'Se necesita permiso de micrófono para dictar. Actívalo en Ajustes del teléfono.';
  }
  if (/not available|unavailable|no está disponible/i.test(raw)) {
    return 'El reconocimiento de voz no está disponible en este dispositivo.';
  }
  return raw || 'No se pudo iniciar el dictado por voz.';
};

/**
 * Dictado por voz: API nativa en Capacitor (Android/iOS) o Web Speech en navegador.
 * En Android WebView webkitSpeechRecognition no existe; hace falta el plugin + APK nueva.
 */
export async function startSpeechDictation({
  language = 'es-MX',
  onResult,
  onStart,
  onEnd,
  onError,
} = {}) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
      const availability = await SpeechRecognition.available();
      if (!availability?.available) {
        throw new Error('El reconocimiento de voz no está disponible en este dispositivo.');
      }

      let perm = await SpeechRecognition.checkPermissions();
      if (perm?.speechRecognition !== 'granted') {
        perm = await SpeechRecognition.requestPermissions();
      }
      if (perm?.speechRecognition !== 'granted') {
        throw new Error('Se necesita permiso de micrófono para dictar. Actívalo en Ajustes del teléfono.');
      }

      onStart?.();
      const result = await SpeechRecognition.start({
        language,
        maxResults: 1,
        prompt: 'Dicta el motivo de consulta',
        partialResults: false,
        popup: true,
      });
      const text = String(result?.matches?.[0] || '').trim();
      if (text) onResult?.(text);
      onEnd?.();
      return { mode: 'native' };
    } catch (err) {
      onEnd?.();
      const mapped = new Error(friendlySpeechError(err));
      mapped.code = err?.code;
      onError?.(mapped);
      throw mapped;
    }
  }

  const SpeechRecognitionCtor = getWebSpeechRecognition();
  if (!SpeechRecognitionCtor) {
    const err = new Error('Este navegador no soporta dictado por voz.');
    onError?.(err);
    throw err;
  }

  return new Promise((resolve, reject) => {
    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => onStart?.();
    recognition.onend = () => {
      onEnd?.();
      resolve({ mode: 'web', recognition });
    };
    recognition.onerror = (event) => {
      const err = new Error(event?.error || 'Error de reconocimiento de voz');
      onError?.(err);
      onEnd?.();
      reject(err);
    };
    recognition.onresult = (event) => {
      const text = String(event?.results?.[0]?.[0]?.transcript || '').trim();
      if (text) onResult?.(text);
    };

    try {
      recognition.start();
    } catch (err) {
      onError?.(err);
      onEnd?.();
      reject(err);
    }
  });
}

export async function stopSpeechDictation() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
    await SpeechRecognition.stop();
  } catch {
    // ignore
  }
}

export function isSpeechDictationSupported() {
  if (Capacitor.isNativePlatform()) return true;
  return Boolean(getWebSpeechRecognition());
}
