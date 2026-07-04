import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Convierte un PDF (URL de Storage) en imágenes PNG (data URLs) para
 * incrustar en @react-pdf/renderer u otras vistas que no pueden renderizar PDF.
 */
export async function pdfUrlToDataUrls(url, { maxPages = 8, scale = 3 } = {}) {
  const src = String(url || '').trim();
  if (!src) return [];

  const response = await fetch(src);
  const arrayBuffer = await response.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const total = Math.min(pdf.numPages, maxPages);
  const dataUrls = [];

  for (let pageNum = 1; pageNum <= total; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    await page.render({ canvasContext: ctx, viewport }).promise;
    dataUrls.push(canvas.toDataURL('image/jpeg', 0.92));
  }

  return dataUrls;
}

/** Rasteriza archivoPaginas en cada documento/receta con archivoUrl. */
export async function rasterizarDocumentosEnConsultas(consultas = [], docUsaArchivo) {
  const rasterizarDoc = async (doc) => {
    if (!docUsaArchivo(doc)) return doc;
    if (Array.isArray(doc.archivoPaginas) && doc.archivoPaginas.length > 0) return doc;
    try {
      const archivoPaginas = await pdfUrlToDataUrls(doc.archivoUrl);
      return { ...doc, archivoPaginas };
    } catch (err) {
      console.warn('[pdfToImages] No se pudo rasterizar documento archivado:', err);
      return { ...doc, archivoPaginas: [] };
    }
  };

  return Promise.all(
    consultas.map(async (c) => ({
      ...c,
      recetasGeneradas: await Promise.all((c.recetasGeneradas || []).map(rasterizarDoc)),
      documentosGenerados: await Promise.all((c.documentosGenerados || []).map(rasterizarDoc))
    }))
  );
}
