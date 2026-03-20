/**
 * Navigation Bar Component
 */

import { Link, useLocation } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext.jsx'
import logoFull from '../assets/logo-full.png'
import { Home, Map, PieChart, Users, Globe } from 'lucide-react'

function Navbar() {
  const location = useLocation()
  const { t, toggleLanguage, language } = useLanguage()

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: Home },
    { path: '/map', label: t('nav.projectMap'), icon: Map },
    { path: '/budget', label: t('nav.budget'), icon: PieChart },
    { path: '/council', label: t('nav.councilVotes'), icon: Users },
  ]

  const isActive = (path) => location.pathname === path

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <img src={logoFull} alt="Open Zagora" className="h-10 w-auto" />
          </Link>

          {/* Nav items — icons only on mobile, icons + labels on desktop */}
          <div className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  title={item.label}
                  className={`flex items-center gap-2 px-2 sm:px-4 py-2 rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden md:inline text-sm">{item.label}</span>
                </Link>
              )
            })}

            {/* Language toggle */}
            <button
              onClick={toggleLanguage}
              title={`Switch to ${language === 'bg' ? 'English' : 'Bulgarian'}`}
              aria-label="Toggle language"
              className="flex items-center gap-1 px-2 sm:px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <Globe className="h-5 w-5 shrink-0" />
              <span className="text-xs font-medium">{language === 'bg' ? 'EN' : 'BG'}</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar
