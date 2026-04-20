import { Palette, Check } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const themes = [
  { id: 'default', label: 'Deep Ocean',    color: '#6366f1', bg: '#020617' },
  { id: 'purple',  label: 'Night Purple',  color: '#8b5cf6', bg: '#09090b' },
  { id: 'neon',    label: 'Neon City',     color: '#f43f5e', bg: '#000000' },
]

export default function ThemeSwitcher({ current, onChange }) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="btn-ghost !py-1 !px-2 text-xs flex items-center gap-1.5"
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
      >
        <Palette className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-[100] w-48 context-menu animate-fade-in-scale">
          <div className="px-3 py-2 text-[10px] font-bold text-surface-500 uppercase tracking-tighter">
            Select Theme
          </div>
          {themes.map((t) => (
            <button
              key={t.id}
              className={`
                flex items-center gap-2.5 w-full px-3 py-2.5 text-xs
                transition-colors hover:bg-surface-800/80
                ${current === t.id ? 'text-primary-400' : 'text-surface-300'}
              `}
              onClick={() => {
                onChange(t.id)
                setIsOpen(false)
              }}
            >
              <div 
                className="w-3 h-3 rounded-full border border-white/10" 
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 text-left">{t.label}</span>
              {current === t.id && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
