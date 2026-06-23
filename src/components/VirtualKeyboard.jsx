import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Delete } from 'lucide-react';

const isTouchDevice =
  'ontouchstart' in window ||
  (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
  (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

const LAYOUTS = {
  signs: [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '⌫'],
  ],
  bloodpressure: [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['.', '0', '/'],
    ['⌫', 'C'],
  ],
  full: [
    ['1', '2', '3', '4', '5'],
    ['6', '7', '8', '9', '0'],
    ['.', '/', '-', '+', '*'],
    ['$', '%', '&', '⌫', 'C'],
  ],
};

const keyAction = {
  '⌫': 'backspace',
  'C': 'clear',
};

const VirtualKeyboard = ({
  visible,
  onClose,
  layout: layoutKey = 'signs',
  onKeyPress,
  onHeightChange,
}) => {
  const keyboardRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  const layout = LAYOUTS[layoutKey] || LAYOUTS.signs;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!visible || !keyboardRef.current || !onHeightChange) return;
    const el = keyboardRef.current;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onHeightChange(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [visible, onHeightChange]);

  useEffect(() => {
    if (!visible) return;
    const el = keyboardRef.current;
    if (!el) return;

    const preventDefault = (e) => {
      const target = e.target;
      if (el.contains(target) || target.closest('[data-vk-ignore]')) return;
      e.preventDefault();
      e.stopPropagation();
    };

    document.addEventListener('touchmove', preventDefault, { passive: false });
    return () => document.removeEventListener('touchmove', preventDefault);
  }, [visible]);

  const handleKey = useCallback(
    (char) => {
      const action = keyAction[char];
      if (action === 'backspace') {
        onKeyPress?.({ type: 'backspace' });
      } else if (action === 'clear') {
        onKeyPress?.({ type: 'clear' });
      } else {
        onKeyPress?.({ type: 'char', char });
      }
    },
    [onKeyPress]
  );

  if (!visible) return null;
  if (mounted && !isTouchDevice) return null;

  return (
    <div
      ref={keyboardRef}
      className="fixed bottom-0 left-0 right-0 z-[250] bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.12)] rounded-t-2xl px-2 pb-[max(0.75rem,env(safe-area-inset-bottom,12px))] pt-1 animate-[slideUp_0.2s_ease-out] select-none"
      style={{ touchAction: 'manipulation' }}
    >
      {/* Handle bar + close */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex-1 flex justify-center">
          <div className="w-8 h-1 rounded-full bg-slate-200" />
        </div>
        <button
          onClick={onClose}
          className="p-1 -mr-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
        >
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Keys */}
      <div className="flex flex-col gap-1 px-0.5 pb-1">
        {layout.map((row, ri) => (
          <div key={ri} className="flex gap-1 justify-center">
            {row.map((char, ci) => {
              const isSpecial = char === '⌫' || char === 'C';
              const isAction = char === '⌫';
              const isChar = !isSpecial;

              return (
                <button
                  key={ci}
                  type="button"
                  tabIndex={-1}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleKey(char);
                  }}
                  className={`
                    h-10 rounded-xl font-bold text-base
                    transition-all active:scale-95 select-none
                    ${isSpecial
                      ? isAction
                        ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100 flex-[0.7]'
                        : 'bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100 flex-[0.7]'
                      : 'bg-slate-100 text-slate-700 border border-slate-200 flex-1 hover:bg-slate-200 active:bg-slate-300'
                    }
                    flex items-center justify-center
                    touch-manipulation min-w-0
                  `}
                >
                  {isAction ? (
                    <Delete size={16} strokeWidth={2} />
                  ) : (
                    char
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default VirtualKeyboard;

export { LAYOUTS, isTouchDevice };
