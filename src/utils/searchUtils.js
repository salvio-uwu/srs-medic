const stripAccents = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const normalizeForSearch = (str) =>
  stripAccents(str).toLowerCase().replace(/\s+/g, ' ').trim();

const levenshtein = (a, b) => {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    const tmp = prev;
    prev = curr;
    curr = tmp;
  }

  return prev[n];
};

const tokenScore = (queryToken, candidateToken) => {
  if (candidateToken.startsWith(queryToken)) {
    return 0.9 + 0.1 * (queryToken.length / Math.max(candidateToken.length, 1));
  }

  const dist = levenshtein(queryToken, candidateToken);
  const maxLen = Math.max(queryToken.length, candidateToken.length);

  if (dist === 0) return 1.0;
  if (dist <= 2 && maxLen >= 3) {
    return Math.max(0, (1 - dist / maxLen)) * 0.7;
  }

  return 0;
};

export const fuzzyScore = (query, candidate) => {
  const q = normalizeForSearch(query);
  const c = normalizeForSearch(candidate);

  if (!q || !c) return 0;

  const queryTokens = q.split(' ').filter(Boolean);
  const candidateTokens = c.split(' ').filter(Boolean);

  let totalScore = 0;

  for (const qt of queryTokens) {
    let best = 0;
    for (const ct of candidateTokens) {
      best = Math.max(best, tokenScore(qt, ct));
    }
    totalScore += best;
  }

  return totalScore / queryTokens.length;
};

export const rankResults = (query, results, getNameFn) => {
  const scored = results.map((r) => ({
    ...r,
    _score: fuzzyScore(query, getNameFn(r))
  }));

  scored.sort((a, b) => {
    if (b._score !== a._score) return b._score - a._score;
    const na = normalizeForSearch(getNameFn(a));
    const nb = normalizeForSearch(getNameFn(b));
    return na.localeCompare(nb, 'es', { sensitivity: 'base' });
  });

  return scored;
};

export const getBestMatch = (query, results, getNameFn) => {
  if (!results.length) return null;

  let best = results[0];
  let bestScore = fuzzyScore(query, getNameFn(best));

  for (let i = 1; i < results.length; i++) {
    const score = fuzzyScore(query, getNameFn(results[i]));
    if (score > bestScore) {
      bestScore = score;
      best = results[i];
    }
  }

  return bestScore > 0.7 ? best : null;
};
