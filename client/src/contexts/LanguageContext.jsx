import { createContext, useContext, useState } from 'react'
import { translations } from '../i18n/translations.js'

const LanguageContext = createContext()

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en') // default English

  const t = (key, params = {}) => {
    let text = translations[language][key] || translations.en[key] || key
    
    // Replace dynamic params
    Object.keys(params).forEach(param => {
      const placeholder = `{{${param}}}`
      text = text.replace(new RegExp(placeholder, 'g'), params[param])
    })
    
    return text
  }

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'bg' : 'en')
  }

  const value = {
    language,
    t,
    toggleLanguage,
    languages: ['en', 'bg']
  }

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider')
  }
  return context
}

