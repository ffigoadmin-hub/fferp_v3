import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { AlertPopup, AlertData, registerAlertHandler, dismissCurrentAlert } from '@/components/AlertPopup';
import { useHighPriorityAlerts } from '@/hooks/useHighPriorityAlerts';
import { useSlotReminders } from '@/hooks/useSlotReminders';
import { useSelfieReminders } from '@/hooks/useSelfieReminders';

interface AlertContextType {
  currentAlert: AlertData | null;
}

const AlertContext = createContext<AlertContextType>({ currentAlert: null });

export function useAlertContext() {
  return useContext(AlertContext);
}

interface AlertProviderProps {
  children: ReactNode;
}

export function AlertProvider({ children }: AlertProviderProps) {
  const [currentAlert, setCurrentAlert] = useState<AlertData | null>(null);

  // Initialize high priority alert listeners
  useHighPriorityAlerts();

  // Initialize slot reminders (for hourly report slot openings)
  useSlotReminders();

  // Initialize selfie reminders (10:10, 2:40, 5:40)
  useSelfieReminders();

  // Register the alert handler
  useEffect(() => {
    registerAlertHandler(setCurrentAlert);
  }, []);

  const handleDismiss = () => {
    dismissCurrentAlert();
  };

  return (
    <AlertContext.Provider value={{ currentAlert }}>
      {children}
      <AlertPopup
        alert={currentAlert}
        onDismiss={handleDismiss}
        autoDismissMs={12000}
      />
    </AlertContext.Provider>
  );
}
