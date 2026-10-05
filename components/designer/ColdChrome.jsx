'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LanguageSwitch } from '@/components/i18n/Locale'
import { CadToolbar } from '../floorplan/CadTools'

const COLD_TABS = ['structure', 'doors', 'cooling', 'pipes', 'electric', 'print']

const rib = (active) => ({
  height: 28,
  padding: '0 8px',
  borderRadius: 6,
  border: `1px solid ${active ? '#0f766e' : '#e7e5e4'}`,
  background: active ? '#134e4a' : '#fff',
  color: active ? '#f0fdfa' : '#1c1917',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
})

const toolStyle = (active) => ({
  height: 28,
  padding: '0 10px',
  borderRadius: 6,
  border: `1px solid ${active ? '#c2410c' : '#e7e5e4'}`,
  background: active ? '#9a3412' : '#fff',
  color: active ? '#fff7ed' : '#1c1917',
  fontSize: 12,
  fontWeight: active ? 800 : 650,
  cursor: 'pointer',
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxShadow: active ? '0 0 0 3px #fdba74' : 'none',
})

const itemStyle = (active) => ({
  height: 28,
  padding: '0 8px',
  textAlign: 'left',
  border: 'none',
  borderRadius: 6,
  background: active ? '#f0fdfa' : 'transparent',
  color: '#1c1917',
  fontSize: 12,
  fontWeight: 650,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
})

function Menu({ id, label, open, setOpen, children, dock = false }) {
  const shown = open === id
  const button = (
    <button type="button" aria-expanded={shown} onClick={() => setOpen(shown ? null : id)} style={{ height: dock ? 44 : 28, minHeight: dock ? 44 : undefined, width: dock ? '100%' : undefined, textAlign: dock ? 'left' : undefined, padding: '0 10px', border: 'none', borderRadius: 6, background: shown ? '#e7e5e4' : 'transparent', color: '#1c1917', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>
      {label}
    </button>
  )
  if (dock) {
    return (
      <div>
        {button}
        <div style={{ display: shown ? 'flex' : 'none', flexDirection: 'column', gap: 2, padding: '0 0 8px 8px' }}>{children}</div>
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onMouseEnter={() => setOpen(id)} onMouseLeave={() => setOpen((current) => (current === id ? null : current))}>
      {button}
      <div style={{ display: shown ? 'flex' : 'none', position: 'absolute', top: '100%', left: 0, zIndex: 50, minWidth: 220, maxHeight: 420, overflowY: 'auto', flexDirection: 'column', gap: 2, padding: 6, background: '#fff', border: '1px solid #d6d3d1', borderRadius: 8, boxShadow: '0 12px 28px rgba(28,25,23,0.16)' }}>
        {children}
      </div>
    </div>
  )
}

function workspaceTab(active) {
  return {
    height: 28,
    padding: '0 14px',
    borderRadius: 7,
    border: `1px solid ${active ? '#5eead4' : 'transparent'}`,
    background: active ? '#0f766e' : 'transparent',
    color: active ? '#f0fdfa' : '#d6d3d1',
    fontSize: 13,
    fontWeight: active ? 800 : 650,
    cursor: 'pointer',
    boxShadow: active ? 'inset 0 -2px 0 #99f6e4' : 'none',
  }
}

function GearButton({ label, onClick, compact = false }) {
  return (
    <button type="button" data-testid="open-project-settings" aria-label={label} title={label} onClick={onClick} style={{ width: compact ? 44 : 28, height: compact ? 44 : 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, border: '1px solid #57534e', background: 'transparent', color: '#e7e5e4', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="8" cy="8" r="2.1" />
        <path d="M8 1.5v1.7M8 12.8v1.7M1.5 8h1.7M12.8 8h1.7M3.3 3.3l1.2 1.2M11.5 11.5l1.2 1.2M12.7 3.3l-1.2 1.2M4.5 11.5l-1.2 1.2" />
      </svg>
    </button>
  )
}

function modeTab(active) {
  return {
    height: 26,
    padding: '0 10px',
    borderRadius: 6,
    border: '1px solid transparent',
    background: active ? '#134e4a' : 'transparent',
    color: active ? '#ccfbf1' : '#e7e5e4',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
  }
}

export default function ColdChrome({
  t,
  locale,
  setLocale,
  name,
  onName,
  projectType,
  view,
  onView,
  tab,
  onTab,
  tool,
  placing,
  onTool,
  onAutoPipe,
  onCleanup,
  repeat,
  onRepeat,
  onUndo,
  onRedo,
  onFit,
  onExample,
  onPdf,
  onDxf,
  onJson,
  onImport,
  onProjectInfo,
  onProjectSettings,
  settingsOpen,
  user,
  cad,
  onCommand,
  onSelectType,
  onLayer,
  compact = false,
  toolsOpen = false,
  onToggleTools,
}) {
  const [open, setOpen] = useState(null)
  const close = () => setOpen(null)
  const menuItem = (active) => itemStyle(active)
  const hit = (active) => ({ ...toolStyle(active), height: 44, minHeight: 44 })
  const selectOn = tool === 'select' && !placing
  const styleFor = (id) => (compact ? hit(id) : toolStyle(id))

  const drawButtons = (style) => (
    <>
      <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={style(selectOn)} onClick={() => { close(); onTool('select') }}>{t('tool.select')}</button>
      <button type="button" data-testid="tool-draw" aria-pressed={tool === 'draw'} style={style(tool === 'draw')} onClick={() => { close(); onTool('draw') }}>{t('designer.room')}</button>
      <button type="button" data-testid="tool-polygon" aria-pressed={tool === 'polygon'} style={style(tool === 'polygon')} onClick={() => { close(); onTool('polygon') }}>{t('tool.polygon')}</button>
      <button type="button" data-testid="tool-partition" aria-pressed={tool === 'partition'} style={style(tool === 'partition')} onClick={() => { close(); onTool('partition') }}>{t('tool.interior')}</button>
    </>
  )

  const ribbon = (style) => (
    <>
      {tab === 'structure' && drawButtons(style)}
      {(tab === 'doors' || tab === 'cooling') && (
        <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={style(selectOn)} onClick={() => { close(); onTool('select') }}>{t('tool.select')}</button>
      )}
      {tab === 'pipes' && (
        <>
          <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={style(selectOn)} onClick={() => { close(); onTool('select') }}>{t('tool.select')}</button>
          <button type="button" data-testid="tool-pipe" aria-pressed={tool === 'pipe'} style={style(tool === 'pipe')} onClick={() => { close(); onTool('pipe') }}>{t('designer.pipe')}</button>
          <button type="button" data-testid="auto-pipe" style={style(false)} onClick={() => { close(); onAutoPipe() }}>{t('designer.autoPipe')}</button>
        </>
      )}
      {tab === 'electric' && (
        <>
          <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={style(selectOn)} onClick={() => { close(); onTool('select') }}>{t('tool.select')}</button>
          <button type="button" data-testid="tool-cable" aria-pressed={tool === 'cable'} style={style(tool === 'cable')} onClick={() => { close(); onTool('cable') }}>{t('designer.cable')}</button>
        </>
      )}
      {tab === 'print' && (
        <>
          <button type="button" data-testid="export-pdf" style={style(false)} onClick={() => { close(); onPdf() }}>{t('designer.pdf')}</button>
          <button type="button" data-testid="export-dxf" style={style(false)} onClick={() => { close(); onDxf() }}>{t('designer.dxf')}</button>
          <button type="button" data-testid="export-json" style={style(false)} onClick={() => { close(); onJson() }}>JSON</button>
        </>
      )}
      {tab !== 'print' && (
        <>
          <button type="button" data-testid="repeat-place" aria-pressed={repeat} style={style(repeat)} onClick={() => onRepeat?.(!repeat)}>{t('designer.repeat')}</button>
          <button type="button" data-testid="cleanup-duplicates" style={style(false)} onClick={() => { close(); onCleanup?.() }}>{t('edit.cleanup')}</button>
        </>
      )}
      <button type="button" data-testid="zoom-fit" style={style(false)} onClick={() => { close(); onFit() }}>{t('snap.fit')}</button>
    </>
  )

  const views = (tabStyle) => (
    <>
      <button type="button" data-testid="view-2d" style={tabStyle(view === '2d')} onClick={() => onView('2d')}>2D</button>
      <button type="button" data-testid="view-3d" style={tabStyle(view === '3d')} onClick={() => onView('3d')}>3D</button>
      <button type="button" data-testid="view-split" style={tabStyle(view === 'split')} onClick={() => onView('split')}>{t('designer.split')}</button>
      <button type="button" data-testid="view-schematic" style={tabStyle(view === 'schematic')} onClick={() => onView('schematic')}>{t('designer.schematic')}</button>
    </>
  )

  const menus = (dock) => (
    <>
      <Menu id="file" label={t('menu.file')} open={open} setOpen={setOpen} dock={dock}>
        <button type="button" data-testid="project-info" style={menuItem(false)} onClick={() => { close(); onProjectInfo?.() }}>{t('file.projectInfo')}</button>
        <button type="button" data-testid="house-settings" style={menuItem(settingsOpen)} onClick={() => { close(); onProjectSettings?.() }}>{t('file.projectSettings')}</button>
        <button type="button" data-testid="example-enquiry" style={menuItem(false)} onClick={() => { close(); onExample?.() }}>{t('designer.example')}</button>
        <button type="button" data-testid="import-json" style={menuItem(false)} onClick={() => { close(); onImport?.() }}>{t('designer.import')}</button>
        {user && (
          <form action="/api/auth/logout" method="POST">
            <button type="submit" style={menuItem(false)}>{t('designer.signOut')}</button>
          </form>
        )}
      </Menu>
      <Menu id="edit" label={t('menu.edit')} open={open} setOpen={setOpen} dock={dock}>
        <button type="button" data-testid="undo" style={menuItem(false)} onClick={() => { close(); onUndo?.() }}>{t('edit.undo')}</button>
        <button type="button" data-testid="redo" style={menuItem(false)} onClick={() => { close(); onRedo?.() }}>{t('edit.redo')}</button>
        <button type="button" data-testid="cleanup-menu" style={menuItem(false)} onClick={() => { close(); onCleanup?.() }}>{t('edit.cleanup')}</button>
      </Menu>
      <Menu id="view" label={t('menu.view')} open={open} setOpen={setOpen} dock={dock}>
        <button type="button" style={menuItem(view === '2d')} onClick={() => { close(); onView('2d') }}>2D</button>
        <button type="button" style={menuItem(view === '3d')} onClick={() => { close(); onView('3d') }}>3D</button>
        <button type="button" style={menuItem(view === 'split')} onClick={() => { close(); onView('split') }}>{t('designer.split')}</button>
        <button type="button" style={menuItem(view === 'schematic')} onClick={() => { close(); onView('schematic') }}>{t('designer.schematic')}</button>
        <button type="button" style={menuItem(false)} onClick={() => { close(); onFit?.() }}>{t('snap.fit')}</button>
      </Menu>
      <Menu id="draw" label={t('menu.draw')} open={open} setOpen={setOpen} dock={dock}>
        {tab === 'structure' && !dock ? <div style={{ fontSize: 12, color: '#78716c', padding: '4px 8px' }}>{t('menu.onRibbon')}</div> : drawButtons(menuItem)}
      </Menu>
      <Menu id="insert" label={t('menu.insert')} open={open} setOpen={setOpen} dock={dock}>
        {COLD_TABS.filter((id) => id !== 'print').map((id) => (
          <button key={id} type="button" style={menuItem(tab === id)} onClick={() => { close(); onTab(id) }}>{t(`cold.tab.${id}`)}</button>
        ))}
        <div style={{ fontSize: 12, color: '#78716c', padding: '4px 8px' }}>{t('cold.inPanel')}</div>
      </Menu>
      <Menu id="print" label={t('menu.print')} open={open} setOpen={setOpen} dock={dock}>
        <button type="button" data-testid="menu-export-pdf" style={menuItem(false)} onClick={() => { close(); onPdf?.() }}>{t('designer.pdf')}</button>
        <button type="button" data-testid="menu-export-dxf" style={menuItem(false)} onClick={() => { close(); onDxf?.() }}>{t('designer.dxf')}</button>
        <button type="button" data-testid="menu-export-json" style={menuItem(false)} onClick={() => { close(); onJson?.() }}>JSON</button>
      </Menu>
    </>
  )

  const tabs = (
    <div className={compact ? 'workspace-scroll' : undefined} data-testid="workspace-tabs" style={compact ? { background: '#1c212b' } : { display: 'flex', alignItems: 'center', gap: 4, height: 36, padding: '0 8px', background: '#14181f' }}>
      {COLD_TABS.map((id) => (
        <button key={id} type="button" data-testid={`workspace-${id}`} aria-pressed={tab === id} style={{ ...workspaceTab(tab === id), minHeight: compact ? 44 : undefined }} onClick={() => onTab(id)}>
          {t(`cold.tab.${id}`)}
        </button>
      ))}
    </div>
  )

  if (compact) {
    return (
      <div data-testid="plan-chrome" className={`plan-chrome${toolsOpen ? ' tools-open' : ''}`} style={{ flexShrink: 0, background: '#14181f', paddingTop: 'env(safe-area-inset-top)' }}>
        <header className="plan-chrome-header" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '4px 8px' }}>
          <Link href="/" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14, flexShrink: 0 }}>RefCAD</Link>
          <input aria-label={t('designer.projectName')} value={name} onChange={(event) => onName(event.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 650, fontSize: 16, flex: 1, minWidth: 0, width: 0 }} />
          <span data-testid="project-type" style={{ fontSize: 12, fontWeight: 650, color: '#d6d3d1', whiteSpace: 'nowrap' }}>{t(`type.${projectType || 'kylmio'}.name`)}</span>
          <GearButton compact label={t('file.projectSettings')} onClick={() => onProjectSettings?.()} />
          <LanguageSwitch className="compact-only" value={locale} onChange={setLocale} />
          <button type="button" data-testid="chrome-menu" aria-expanded={open === 'root'} onClick={() => setOpen(open === 'root' ? null : 'root')} style={{ ...modeTab(open === 'root'), minHeight: 44, minWidth: 44, padding: '0 12px' }}>{t('chrome.menu')}</button>
        </header>
        <div className="workspace-scroll view-tabs" data-testid="view-tabs" style={{ background: '#14181f' }}>
          {views((active) => ({ ...modeTab(active), minHeight: 44 }))}
        </div>
        {tabs}
        {open === 'root' && (
          <div className="compact-menu" data-testid="chrome-menu-panel" style={{ background: '#fff', color: '#1c1917', maxHeight: '46vh', overflow: 'auto', padding: 8 }}>
            {menus(true)}
          </div>
        )}
        {toolsOpen && (
          <div className="tool-sheet" data-testid="tool-sheet">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>{ribbon(hit)}</div>
            <div style={{ marginTop: 8 }}>
              <CadToolbar scope="cold" active={cad?.name} onCommand={onCommand} onSelectType={onSelectType} onLayer={onLayer} />
            </div>
            <button type="button" data-testid="close-tools" onClick={() => onToggleTools?.()} style={{ ...hit(false), marginTop: 8 }}>{t('edit.closeTools')}</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div data-testid="plan-chrome" style={{ flexShrink: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 10px', background: '#14181f', color: '#f5f5f4' }}>
        <Link href="/" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>RefCAD</Link>
        <input aria-label={t('designer.projectName')} value={name} onChange={(event) => onName(event.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 650, fontSize: 13, width: 160 }} />
        <span data-testid="project-type" style={{ fontSize: 12, fontWeight: 650, color: '#d6d3d1', whiteSpace: 'nowrap' }}>{t(`type.${projectType || 'kylmio'}.name`)}</span>
        <span style={{ flex: 1 }} />
        <GearButton label={t('file.projectSettings')} onClick={() => onProjectSettings?.()} />
        <div data-testid="view-tabs" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: '#1c212b' }}>
          {views(modeTab)}
        </div>
        <LanguageSwitch value={locale} onChange={setLocale} />
      </header>
      {tabs}
      <div data-testid="menu-bar" style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, padding: '0 6px', background: '#fafaf9', borderBottom: '1px solid #e7e5e4' }}>
        {menus(false)}
        <span style={{ flex: 1 }} />
        <button type="button" title={t('edit.undo')} onClick={onUndo} style={rib(false)}>↶</button>
        <button type="button" title={t('edit.redo')} onClick={onRedo} style={rib(false)}>↷</button>
      </div>
      <div data-testid="tool-ribbon" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '4px 8px', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4', overflowX: 'auto' }}>
        {ribbon(styleFor)}
      </div>
      <CadToolbar scope="cold" active={cad?.name} onCommand={onCommand} onSelectType={onSelectType} onLayer={onLayer} />
    </div>
  )
}
