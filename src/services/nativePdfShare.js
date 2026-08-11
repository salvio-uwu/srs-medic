// src/services/nativePdfShare.js
// Entrega de PDF en Capacitor (Android/iOS): escribe en caché y abre el sheet nativo.
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isCapacitorNative = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el PDF.'));
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.readAsDataURL(blob);
  });

const safeFileName = (nombre = 'documento') =>
  String(nombre || 'documento')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '_')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 80) || 'documento';

/**
 * Guarda el blob PDF y abre el menú nativo (Imprimir / Guardar / Compartir).
 * En Android WebView esto es más fiable que window.print() o about:blank.
 */
export async function sharePdfBlobNative(pdfBlob, nombre = 'documento') {
  if (!pdfBlob) throw new Error('PDF vacío.');
  if (!isCapacitorNative()) {
    throw new Error('sharePdfBlobNative solo aplica en app nativa.');
  }

  const fileName = `${safeFileName(nombre)}_${Date.now()}.pdf`;
  const path = `srs_docs/${fileName}`;
  const data = await blobToBase64(pdfBlob);

  await Filesystem.writeFile({
    path,
    data,
    directory: Directory.Cache,
    recursive: true,
  });

  const { uri } = await Filesystem.getUri({
    path,
    directory: Directory.Cache,
  });

  await Share.share({
    title: nombre,
    text: nombre,
    url: uri,
    dialogTitle: 'Imprimir o compartir documento',
  });

  return { uri, path };
}
