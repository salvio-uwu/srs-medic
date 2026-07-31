// Convierte un PDF (URL o Blob) en imágenes JPEG para incrustar en @react-pdf/renderer
import * as pdfjs from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Renderiza cada página de un PDF como data URL JPEG.
 * @param {string|Blob} source - URL de descarga o Blob del PDF
 * @param {{ scale?: number, maxPages?: number }} options
 * @returns {Promise<string[]>}
 */
export async function fetchPdfPagesAsDataUrls(source, { scale = 2, maxPages = 20 } = {}) {
  if (!source) return [];

  let data;
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`No se pudo descargar el PDF (${response.status})`);
    data = await response.arrayBuffer();
  } else if (source instanceof Blob) {
    data = await source.arrayBuffer();
  } else {
    return [];
  }

  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = Math.min(pdf.numPages, maxPages);
  const images = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.9));
  }

  return images;
}

/**
 * Adjunta `pageImages` a recetas/documentos que tengan `archivoUrl`.
 * @param {Array} consultas
 * @returns {Promise<Array>}
 */
export async function enrichConsultasWithIssuedPdfImages(consultas = []) {
  if (!Array.isArray(consultas) || consultas.length === 0) return consultas;

  const enrichDocs = async (docs) => {
    if (!Array.isArray(docs)) return docs;
    return Promise.all(docs.map(async (doc) => {
      const url = String(doc?.archivoUrl || '').trim();
      if (!url) return doc;
      if (Array.isArray(doc.pageImages) && doc.pageImages.length > 0) return doc;
      try {
        const pageImages = await fetchPdfPagesAsDataUrls(url);
        return pageImages.length > 0 ? { ...doc, pageImages } : doc;
      } catch (error) {
        console.warn('[pdfPageImages] No se pudo renderizar documento expedido:', url, error);
        return doc;
      }
    }));
  };

  return Promise.all(consultas.map(async (consulta) => ({
    ...consulta,
    recetasGeneradas: await enrichDocs(consulta.recetasGeneradas),
    documentosGenerados: await enrichDocs(consulta.documentosGenerados)
  })));
}
