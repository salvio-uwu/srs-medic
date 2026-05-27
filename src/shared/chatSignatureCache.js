const MAX_CACHE_SIZE = 500;

export const getMillis = (v) => {
  if (!v) return 0;
  if (typeof v?.toMillis === 'function') return v.toMillis();
  if (typeof v?.seconds === 'number') {
    const nanos = typeof v?.nanoseconds === 'number' ? v.nanoseconds : 0;
    return (v.seconds * 1000) + Math.floor(nanos / 1e6);
  }
  const p = new Date(v).getTime();
  return isFinite(p) ? p : 0;
};

export const buildLastMessageSignature = (chatDocId, data = {}) => {
  const ts = data?.ultimoMensajeAt;
  const seconds = typeof ts?.seconds === 'number' ? ts.seconds : '';
  const nanos = typeof ts?.nanoseconds === 'number' ? ts.nanoseconds : '';
  return [
    chatDocId,
    data?.ultimoRemitenteId || '',
    getMillis(ts),
    seconds,
    nanos,
    data?.ultimoTexto || ''
  ].join('|');
};

const signatureCache = new Map();

export const isNewSignature = (signature) => {
  if (!signature) return false;
  if (signatureCache.has(signature)) return false;
  signatureCache.set(signature, Date.now());
  if (signatureCache.size > MAX_CACHE_SIZE) {
    const oldest = signatureCache.keys().next().value;
    if (oldest) signatureCache.delete(oldest);
  }
  return true;
};

export const clearSignaturesByChat = (chatDocId) => {
  if (!chatDocId) return;
  for (const key of signatureCache.keys()) {
    if (key.startsWith(chatDocId + '|')) signatureCache.delete(key);
  }
};
