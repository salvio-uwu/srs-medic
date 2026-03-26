export const goBackOr = (navigate, fallbackPath, options = {}) => {
  const historyIndex = window.history?.state?.idx;
  const fallbackOptions = {
    replace: options.replaceFallback ?? true,
    state: options.state,
  };

  if (typeof historyIndex === 'number' && historyIndex > 0) {
    navigate(-1);
    return;
  }

  navigate(fallbackPath, fallbackOptions);
};
