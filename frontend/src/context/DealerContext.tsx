import { createContext, useContext, useState, ReactNode } from 'react'

interface DealerContextValue {
  dealerId: string | null
  setDealerId: (id: string | null) => void
}

const DealerContext = createContext<DealerContextValue | null>(null)

export function DealerProvider({ children }: { children: ReactNode }) {
  const [dealerId, setDealerId] = useState<string | null>(null)

  return (
    <DealerContext.Provider value={{ dealerId, setDealerId }}>
      {children}
    </DealerContext.Provider>
  )
}

export function useDealer(): DealerContextValue {
  const ctx = useContext(DealerContext)
  if (!ctx) throw new Error('useDealer must be used within DealerProvider')
  return ctx
}
