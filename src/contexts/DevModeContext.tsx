import { createContext, useContext, useState, ReactNode } from 'react';

interface DevModeContextType {
  devViewPartnerPrefix: string | null;
  setDevViewPartnerPrefix: (prefix: string | null) => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [devViewPartnerPrefix, setDevViewPartnerPrefix] = useState<string | null>(null);

  return (
    <DevModeContext.Provider value={{ devViewPartnerPrefix, setDevViewPartnerPrefix }}>
      {children}
    </DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}
