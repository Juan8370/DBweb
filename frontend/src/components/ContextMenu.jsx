import { useEffect, useRef } from 'react'

/**
 * Reusable context menu (right-click dropdown).
 * 
 * Props:
 *  - x, y: screen coordinates
 *  - items: [{ label, icon?, onClick, danger?, disabled?, divider? }]
 *  - onClose: callback when menu should close
 */
export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  // Adjust position to stay in viewport
  const style = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 9999,
  }

  return (
    <div ref={ref} style={style} className="context-menu animate-fade-in-scale">
      {items.map((item, i) => {
        if (item.divider) {
          return <div key={i} className="border-t border-surface-700/50 my-1" />
        }
        return (
          <button
            key={i}
            className={`context-menu-item ${item.danger ? 'context-menu-item-danger' : ''}`}
            onClick={() => {
              item.onClick?.()
              onClose()
            }}
            disabled={item.disabled}
          >
            {item.icon && <item.icon className="w-3.5 h-3.5 shrink-0" />}
            <span>{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
