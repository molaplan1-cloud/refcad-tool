'use client'

import { useLayoutEffect, useRef, useState } from 'react'

const CAD_CSS = `
.cad-menu {
  background: #fff;
  color: #1c1917;
  border: 1px solid #e7e5e4;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(28, 25, 23, 0.18);
  padding: 6px;
  font-family: inherit;
}
.cad-menu-scroll { overflow-x: hidden; overflow-y: auto; }
.cad-menu-title {
  font-size: 12px;
  font-weight: 750;
  letter-spacing: 0.01em;
  padding: 6px 8px 8px;
  color: #1c1917;
}
.cad-sep { height: 1px; background: #e7e5e4; margin: 4px 6px; }
.cad-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  text-align: left;
  padding: 7px 8px;
  border: none;
  background: transparent;
  color: #1c1917;
  font-size: 13px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
}
.cad-item:hover { background: #f0fdfa; }
.cad-item.danger { color: #b91c1c; }
.cad-item.danger:hover { background: #fef2f2; }
.cad-shortcut { margin-left: auto; color: #a8a29e; font-size: 11px; font-weight: 650; font-variant-numeric: tabular-nums; }
.cad-item.danger .cad-shortcut { color: #fca5a5; }
.cad-label { font-size: 11px; font-weight: 700; color: #78716c; padding: 2px 8px 4px; }
.cad-seg {
  display: flex;
  gap: 2px;
  padding: 2px;
  margin: 0 6px 6px;
  background: #f5f5f4;
  border-radius: 8px;
}
.cad-seg button {
  flex: 1;
  border: none;
  background: transparent;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
  font-weight: 750;
  color: #44403c;
  cursor: pointer;
}
.cad-seg button:hover { background: #fff; }
.cad-seg button[aria-pressed="true"] { background: #134e4a; color: #ccfbf1; }
.cad-seg button[aria-pressed="true"]:hover { background: #115e59; }
.cad-sub {
  position: fixed;
  min-width: 188px;
  max-height: 280px;
  overflow: auto;
  background: #fff;
  border: 1px solid #e7e5e4;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(28, 25, 23, 0.18);
  padding: 6px;
  z-index: 70;
}
`

export function CadStyles() {
  useLayoutEffect(() => {
    const id = 'cad-menu-css'
    if (document.getElementById(id)) return undefined
    const style = document.createElement('style')
    style.id = id
    style.textContent = CAD_CSS
    document.head.appendChild(style)
    return undefined
  }, [])
  return null
}

export function CadMenu({ x, y, testid = 'context-menu', kind, title, children, width = 248 }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return undefined
    const place = () => {
      const margin = 8
      const menuWidth = node.offsetWidth || width
      const scroll = node.querySelector('.cad-menu-scroll')
      const titleEl = node.querySelector('.cad-menu-title')
      const titleH = titleEl ? titleEl.offsetHeight : 32
      const contentH = scroll
        ? Array.from(scroll.children).reduce((sum, el) => {
          const style = window.getComputedStyle(el)
          return sum + el.offsetHeight + (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0)
        }, 0)
        : node.scrollHeight
      const height = titleH + contentH + 14
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = x
      if (left + menuWidth > vw - margin) left = Math.max(margin, x - menuWidth)
      if (left < margin) left = margin
      const shown = Math.min(height, vh - margin * 2)
      let top = y
      if (top + shown > vh - margin) top = Math.max(margin, y - shown)
      if (top < margin) top = margin
      const maxScroll = Math.max(96, vh - top - margin - titleH - 10)
      node.style.left = `${Math.round(left)}px`
      node.style.top = `${Math.round(top)}px`
      if (scroll) scroll.style.maxHeight = `${Math.round(maxScroll)}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(node)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', place)
    }
  }, [x, y, width, title])
  return (
    <div
      ref={ref}
      data-testid={testid}
      data-kind={kind}
      className="cad-menu"
      style={{ position: 'fixed', left: x, top: y, width, zIndex: 60 }}
      onPointerDown={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <CadStyles />
      <div className="cad-menu-title">{title}</div>
      <div className="cad-menu-scroll">{children}</div>
    </div>
  )
}

export function CadItem({ children, onClick, testid, shortcut, danger = false }) {
  return (
    <button type="button" data-testid={testid} className={danger ? 'cad-item danger' : 'cad-item'} onClick={onClick}>
      <span>{children}</span>
      {shortcut && <span className="cad-shortcut">{shortcut}</span>}
    </button>
  )
}

export function CadSep() {
  return <div className="cad-sep" />
}

export function Segmented({ label, options, value, onChange }) {
  return (
    <div>
      {label && <div className="cad-label">{label}</div>}
      <div className="cad-seg" role="group" aria-label={label || 'Valinta'}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            data-testid={option.testid}
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Flyout({ label, testid, children }) {
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const openAt = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    const width = 200
    const openLeft = rect.right + width > window.innerWidth - 8
    setPos({
      top: Math.max(8, Math.min(rect.top, window.innerHeight - 240)),
      left: openLeft ? Math.max(8, rect.left - width - 4) : rect.right - 2,
    })
  }
  return (
    <div ref={ref} onMouseEnter={openAt} onMouseLeave={() => setPos(null)}>
      <button type="button" data-testid={testid} className="cad-item" onClick={() => (pos ? setPos(null) : openAt())}>
        <span>{label}</span>
        <span className="cad-shortcut">▸</span>
      </button>
      {pos && (
        <div className="cad-sub" style={{ top: pos.top, left: pos.left }} onMouseEnter={openAt}>
          {children}
        </div>
      )}
    </div>
  )
}
