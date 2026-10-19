import { createContext, useCallback, useContext, useState } from 'react';
import Modal from '../components/Modal';
import Button from '../components/Button';

const ConfirmContext = createContext(() => Promise.resolve(false));

// Promise-based replacement for window.confirm():
//   const confirm = useConfirm();
//   if (await confirm({ title: 'Delete post?', message: '…', confirmLabel: 'Delete', danger: true })) …
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);

  const close = (result) => {
    dialog?.resolve(result);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <Modal title={dialog.title || 'Are you sure?'} onClose={() => close(false)} role="alertdialog">
          {dialog.message && <p className="muted">{dialog.message}</p>}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => close(false)}>{dialog.cancelLabel || 'Cancel'}</Button>
            <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => close(true)}>
              {dialog.confirmLabel || 'Confirm'}
            </Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
