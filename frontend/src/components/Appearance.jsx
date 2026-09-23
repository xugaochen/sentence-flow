import { createContext, useContext, useLayoutEffect, useMemo, useState } from 'react'
import { applyAppearance, readAppearance, saveAppearance } from '../utils/appearance'
import { translateUi } from '../utils/uiText'

const AppearanceContext = createContext({ workbench: false, toggleAppearance: () => {} })

export function AppearanceProvider({ children }) {
  const [mode, setMode] = useState(readAppearance)
  useLayoutEffect(() => {
    applyAppearance(mode)
    saveAppearance(mode)
  }, [mode])
  const value = useMemo(() => ({
    workbench: mode === 'workbench',
    toggleAppearance: () => setMode((current) => current === 'workbench' ? 'standard' : 'workbench'),
  }), [mode])
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>
}

export function useAppearance() {
  return useContext(AppearanceContext)
}

export function useUiText() {
  const { workbench } = useAppearance()
  return (text) => translateUi(text, workbench)
}
