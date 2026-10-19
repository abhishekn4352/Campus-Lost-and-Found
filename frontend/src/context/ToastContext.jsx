import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext({ showToast: () => {}, dismissToast: () => {} });
let idCounter = 0;

const ICONS = { success: CheckCircle2, error: AlertTriangle, warning: AlertTriangle, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    clearTimeout(timers.current[id]);
    delete timers.current[id];
  }, []);

  // type: 'success' | 'error' | 'warning' | 'info'
  const showToast = useCallback((message, type = 'info', duration = 4500) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]);
    timers.current[id] = setTimeout(() => dismissToast(id), duration);
    return id;
  }, [dismissToast]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast t-${t.type}`} role={t.type === 'error' ? 'alert' : undefined}>
              <Icon size={20} aria-hidden="true" />
              <span style={{ flex: 1 }}>{t.message}</span>
              <button type="button" onClick={() => dismissToast(t.id)} aria-label="Dismiss notification">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
