import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MoreVertical } from 'lucide-react'

const MENU_WIDTH = 208

/**
 * Row actions dropdown. Rendered in a fixed-position portal so table wrappers with
 * overflow scrolling cannot clip it. `items`: [{ label, icon, onClick }] (falsy entries skipped).
 */
export default function ActionsMenu({ items = [], label = 'Actions' }) {
  const [position, setPosition] = useState(null)
  const buttonRef = useRef(null)
  const menuRef = useRef(null)
  const visible = items.filter(Boolean)

  const close = useCallback(() => setPosition(null), [])

  const toggle = () => {
    if (position) {
      close()
      return
    }
    const rect = buttonRef.current.getBoundingClientRect()
    const estimatedHeight = visible.length * 40 + 12
    const openUp = rect.bottom + estimatedHeight > window.innerHeight - 8 && rect.top > estimatedHeight
    setPosition({
      top: openUp ? rect.top - estimatedHeight - 4 : rect.bottom + 4,
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    })
  }

  useEffect(() => {
    if (!position) return undefined
    const onPointer = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return
      close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        close()
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [position, close])

  if (!visible.length) return null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="btn-secondary !px-2.5 !py-1.5"
        aria-haspopup="menu"
        aria-expanded={Boolean(position)}
        aria-label={label}
        title={label}
        onClick={toggle}
      >
        <MoreVertical size={16} />
      </button>
      {position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
            className="fixed z-[80] rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            {visible.map(({ label: itemLabel, icon: Icon, onClick }) => (
              <button
                key={itemLabel}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  close()
                  onClick()
                }}
              >
                {Icon ? <Icon size={16} className="text-slate-400" /> : null}
                {itemLabel}
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  )
}
