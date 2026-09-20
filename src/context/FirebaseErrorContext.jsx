import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import FirebasePermissionSupportModal from '../components/FirebasePermissionSupportModal';
import {
  FIREBASE_PERMISSION_EVENT,
  reportFirebasePermissionError,
} from '../utils/firebaseErrors';

const FirebaseErrorContext = createContext(null);

export const useFirebaseErrorReporter = () => {
  const ctx = useContext(FirebaseErrorContext);
  return ctx?.report || (() => false);
};

export function FirebaseErrorProvider({ children }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState('');

  const showModal = useCallback((message = '') => {
    setDetail(message);
    setOpen(true);
  }, []);

  const report = useCallback((error, options = {}) => {
    return reportFirebasePermissionError(error, options);
  }, []);

  useEffect(() => {
    const onPermissionEvent = (event) => {
      const message = event?.detail?.message || '';
      showModal(message);
    };

    const onUnhandledRejection = (event) => {
      reportFirebasePermissionError(event?.reason, { source: 'unhandledrejection' });
    };

    window.addEventListener(FIREBASE_PERMISSION_EVENT, onPermissionEvent);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener(FIREBASE_PERMISSION_EVENT, onPermissionEvent);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, [showModal]);

  return (
    <FirebaseErrorContext.Provider value={{ report, showModal }}>
      {children}
      {open ? (
        <FirebasePermissionSupportModal
          detail={detail}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </FirebaseErrorContext.Provider>
  );
}
