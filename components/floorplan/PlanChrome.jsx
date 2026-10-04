'use client'

import { useState } from 'react'
import Link from 'next/link'
import { COVER_TYPES } from '@/lib/covers'
import { GROUND_TOOLS } from '@/lib/groundworks'
import { PLACEABLES, SERVICE_SYSTEMS, airflowBalance, ensureServices, layerVisible } from '@/lib/services'
import { WORKSPACES, workspaceSystems } from '@/lib/workspaces'
import { BUILDINGS, OBJECTS, PLANTS, ensureYard } from '@/lib/yard'
import { LanguageSwitch } from '@/components/i18n/Locale'
import { zoomPercent } from '@/lib/zoom'
import { CadToolbar } from './CadTools'
import { DoorHandControls } from './FloorMenus'
import { YARD_DRAW_TOOLS } from './YardLayer'

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

const selectStyle = {
  height: 28,
  borderRadius: 6,
  border: '1px solid #d6d3d1',
  fontSize: 12,
  fontWeight: 650,
  background: '#fff',
  color: '#1c1917',
  flexShrink: 0,
}

function Menu({ id, label, open, setOpen, children }) {
  const shown = open === id
  return (
    <div style={{ position: 'relative', flexShrink: 0 }} onMouseEnter={() => setOpen(id)} onMouseLeave={() => setOpen((current) => (current === id ? null : current))}>
      <button type="button" aria-expanded={shown} onClick={() => setOpen(shown ? null : id)} style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: shown ? '#e7e5e4' : 'transparent', color: '#1c1917', fontSize: 13, fontWeight: 650, cursor: 'pointer' }}>
        {label}
      </button>
      <div style={{ display: shown ? 'flex' : 'none', position: 'absolute', top: '100%', left: 0, zIndex: 50, minWidth: 220, maxHeight: 420, overflowY: 'auto', flexDirection: 'column', gap: 2, padding: 6, background: '#fff', border: '1px solid #d6d3d1', borderRadius: 8, boxShadow: '0 12px 28px rgba(28,25,23,0.16)' }}>
        {children}
      </div>
    </div>
  )
}

function Group({ children }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>{children}</div>
}

export function LayerDock({ plan, open, onToggle, onLayer, t }) {
  return (
    <div data-testid="layer-dock" style={{ marginBottom: 10, border: '1px solid #e7e5e4', borderRadius: 8, background: '#fff' }}>
      <button type="button" data-testid="toggle-layers" onClick={onToggle} style={{ width: '100%', textAlign: 'left', padding: '7px 8px', border: 'none', background: 'transparent', fontSize: 12, fontWeight: 750, letterSpacing: 0.4, color: '#44403c', cursor: 'pointer' }}>
        {open ? '▾' : '▸'} {t('menu.layers')}
      </button>
      <div style={{ display: open ? 'flex' : 'none', flexDirection: 'column', gap: 2, padding: '0 6px 8px' }}>
        {SERVICE_SYSTEMS.map((item) => {
          const on = layerVisible(plan, item.id)
          return (
            <button key={item.id} type="button" data-testid={`layer-${item.id}`} aria-pressed={on} onClick={() => onLayer(item.id, !on)} style={{ ...itemStyle(on), display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 8, background: on ? '#0f766e' : '#d6d3d1' }} />
              {item.name}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function PlanChrome({
  t, plan, locale, setLocale, mode, tool, placing, roomShape, yardTool, partitions, polyReady,
  gridStep, angleStep, camera, display, panel, command, svcSystem, svcKind, svcTool, floorHeating, drawing,
  wallMode, roofMode, showClearances, onName, onMode, onTool, onRoomRect, onRoomPoly,
  onUndo, onRedo, onNew, onOpen, onHouse, onDisplay, onPreset, onExample, onFamily, onPaper,
  onPartitions, onCloseRoom, onYardTool, onNorth, onGrid, onAngle, onZoomOut, onZoomIn, onZoomFit,
  onClearances, onWallMode, onRoofMode, onSceneStyle, onSystem, onKind, onSvcTool, onFloorHeating,
  onFinish, onRoute, onRewire, onSchedule, onDiagram, onRewireWater, onRewireHeat, onHeatTable,
  onHeatSchematic,   onPdf, onServicePdf, onCommand, onSelectType, onCadLayer, repeat = false, onRepeat, onCleanup, onStraighten,
  workspace = 'rakenne', onWorkspace, onPlaceDevice, onSuggest, onAccept, ghostCount = 0,
  doorHand = { swing: 1, inward: false }, onDoorHand,
}) {
  const [open, setOpen] = useState(null)
  const close = () => setOpen(null)
  const services = ensureServices(plan)
  const balance = airflowBalance(services.nodes)
  const hasAir = services.nodes.some((item) => item.system === 'iv' && item.flow)
  const placeables = PLACEABLES.filter((item) => item.system === svcSystem && item.mode === (svcTool === 'run' ? 'run' : 'node'))
  const menuItem = (active) => itemStyle(active)
  const onPlan = mode === 'plan'
  const onSite = mode === 'site'
  const onSheet = onPlan || onSite

  const selectOn = tool === 'select' && !placing && !svcTool && !yardTool
  const drawTools = (style) => (
    <>
      <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={style(selectOn)} onClick={() => { close(); onTool('select') }}>{t('tool.select')}</button>
      <button type="button" data-testid="tool-exterior" aria-pressed={tool === 'exterior'} style={style(tool === 'exterior')} onClick={() => { close(); onTool('exterior') }}>{t('tool.exterior')}</button>
      <button type="button" data-testid="tool-interior" aria-pressed={tool === 'interior'} style={style(tool === 'interior')} onClick={() => { close(); onTool('interior') }}>{t('tool.interior')}</button>
      <button type="button" data-testid="tool-door" aria-pressed={tool === 'door'} style={style(tool === 'door')} onClick={() => { close(); onTool('door') }}>{t('tool.door')}</button>
      <button type="button" data-testid="tool-window" aria-pressed={tool === 'window'} style={style(tool === 'window')} onClick={() => { close(); onTool('window') }}>{t('tool.window')}</button>
      <button type="button" data-testid="tool-room" aria-pressed={tool === 'room' && roomShape === 'rect'} style={style(tool === 'room' && roomShape === 'rect')} onClick={() => { close(); onRoomRect() }}>{t('tool.room')}</button>
      <button type="button" data-testid="tool-room-poly" aria-pressed={tool === 'room' && roomShape === 'poly'} style={style(tool === 'room' && roomShape === 'poly')} onClick={() => { close(); onRoomPoly() }}>{t('tool.polygon')}</button>
      <button type="button" data-testid="tool-detect" aria-pressed={tool === 'detect'} style={style(tool === 'detect')} onClick={() => { close(); onTool('detect') }}>{t('tool.detect')}</button>
      <label style={{ ...style(false), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <input data-testid="room-partitions" type="checkbox" checked={partitions} onChange={(event) => onPartitions(event.target.checked)} />
        {t('partition.create')}
      </label>
      {tool === 'room' && roomShape === 'poly' && polyReady && (
        <button type="button" data-testid="close-room" style={style(false)} onClick={() => { close(); onCloseRoom() }}>{t('room.close')}</button>
      )}
    </>
  )

  const yardTools = (style) => (
    <>
      {YARD_DRAW_TOOLS.map(([id]) => (
        <button key={id} type="button" data-testid={`yard-tool-${id}`} style={style(yardTool === id)} onClick={() => { close(); onYardTool(id) }}>{t(`yard.${id}`)}</button>
      ))}
      <select data-testid="yard-plant-tool" value={yardTool?.startsWith('plant:') ? yardTool : ''} onChange={(event) => { close(); onYardTool(event.target.value || null) }} style={selectStyle}>
        <option value="">{t('yard.plant')}</option>
        {PLANTS.map((item) => <option key={item.id} value={`plant:${item.id}`}>{item.name}</option>)}
      </select>
      <select data-testid="yard-object-tool" value={yardTool?.startsWith('object:') ? yardTool : ''} onChange={(event) => { close(); onYardTool(event.target.value || null) }} style={selectStyle}>
        <option value="">{t('yard.object')}</option>
        {OBJECTS.map((item) => <option key={item.id} value={`object:${item.id}`}>{item.name}</option>)}
      </select>
      <select data-testid="yard-building-tool" value={yardTool?.startsWith('building:') ? yardTool : ''} onChange={(event) => { close(); onYardTool(event.target.value || null) }} style={selectStyle}>
        <option value="">{t('yard.building')}</option>
        {BUILDINGS.map((item) => <option key={item.id} value={`building:${item.id}`}>{item.name}</option>)}
      </select>
      <select data-testid="yard-cover-tool" value={yardTool?.startsWith('cover:') ? yardTool : ''} onChange={(event) => { close(); onYardTool(event.target.value || null) }} style={selectStyle}>
        <option value="">{t('yard.cover')}</option>
        {COVER_TYPES.map((item) => <option key={item.id} value={`cover:${item.id}`}>{t(`cover.${item.id}`)}</option>)}
      </select>
      <select data-testid="yard-ground-tool" value={yardTool?.startsWith('ground:') ? yardTool : ''} onChange={(event) => { close(); onYardTool(event.target.value || null) }} style={selectStyle}>
        <option value="">{t('yard.ground')}</option>
        {GROUND_TOOLS.map((item) => <option key={item.id} value={`ground:${item.id}`}>{t(`ground.tool.${item.id}`)}</option>)}
      </select>
      <button type="button" data-testid="show-clearances" aria-pressed={showClearances} style={style(showClearances)} onClick={() => { close(); onClearances(!showClearances) }}>{t('menu.clearances')}</button>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#1c1917', flexShrink: 0 }}>
        {t('north.label')}
        <input data-testid="north-angle" type="number" value={ensureYard(plan).north || 0} onChange={(event) => onNorth(Number(event.target.value) || 0)} style={{ width: 52, height: 26, borderRadius: 6, border: '1px solid #d6d3d1' }} />
        °
      </label>
    </>
  )

  const snapTools = (
    <>
      <span style={{ fontSize: 11, color: '#78716c', flexShrink: 0 }}>{t('snap.snap')}</span>
      <button type="button" data-testid="snap-100" title="Ruudukko 100 mm" style={rib(gridStep === 0.1)} onClick={() => onGrid(0.1)}>100</button>
      <button type="button" data-testid="snap-50" title="Ruudukko 50 mm" style={rib(gridStep === 0.05)} onClick={() => onGrid(0.05)}>50</button>
      <button type="button" data-testid="snap-10" title="Ruudukko 10 mm" style={rib(gridStep === 0.01)} onClick={() => onGrid(0.01)}>10</button>
      <span style={{ fontSize: 11, color: '#78716c', flexShrink: 0 }}>{t('snap.angle')}</span>
      <button type="button" data-testid="angle-90" data-ortho="true" title="90° (Shift)" aria-pressed={angleStep === 90} style={rib(angleStep === 90)} onClick={() => onAngle(90)}>90°</button>
      <button type="button" data-testid="angle-45" aria-pressed={angleStep === 45} style={rib(angleStep === 45)} onClick={() => onAngle(45)}>45°</button>
      <button type="button" data-testid="angle-15" aria-pressed={angleStep === 15} style={rib(angleStep === 15)} onClick={() => onAngle(15)}>15°</button>
      <button type="button" data-testid="angle-free" aria-pressed={angleStep === 0} style={rib(angleStep === 0)} onClick={() => onAngle(0)}>{t('snap.free')}</button>
    </>
  )

  const zoomTools = (
    <>
      <button type="button" data-testid="zoom-out" title={t('snap.zoomOut')} style={rib(false)} onClick={onZoomOut}>−</button>
      <span data-testid="zoom-percent" style={{ minWidth: 42, textAlign: 'center', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{zoomPercent(camera)}%</span>
      <button type="button" data-testid="zoom-in" title={t('snap.zoomIn')} style={rib(false)} onClick={onZoomIn}>+</button>
      <button type="button" data-testid="zoom-fit" title={t('snap.fitTitle')} style={rib(false)} onClick={onZoomFit}>{t('snap.fit')}</button>
    </>
  )

  return (
    <div data-testid="plan-chrome" style={{ flexShrink: 0 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, height: 40, padding: '0 10px', background: '#14181f', color: '#f5f5f4' }}>
        <Link href="/" style={{ color: '#99f6e4', fontWeight: 800, textDecoration: 'none', fontSize: 14 }}>RefCAD</Link>
        <input aria-label={t('app.drawingName')} value={plan.name} onChange={(event) => onName(event.target.value)} style={{ background: 'transparent', border: 'none', color: '#fff', fontWeight: 650, fontSize: 13, width: 160 }} />
        <span style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 8, background: '#1c212b' }}>
          <button type="button" data-testid="view-floor-2d" style={modeTab(mode === 'plan')} onClick={() => onMode('plan')}>{t('mode.plan')}</button>
          <button type="button" data-testid="view-site" style={modeTab(mode === 'site')} onClick={() => onMode('site')}>{t('view.site')}</button>
          <button type="button" data-testid="view-floor-3d" style={modeTab(mode === '3d')} onClick={() => onMode('3d')}>3D</button>
          <button type="button" data-testid="view-facade" style={modeTab(mode === 'facade')} onClick={() => onMode('facade')}>{t('view.facade')}</button>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <button type="button" style={modeTab(plan.paper !== 'a4')} onClick={() => onPaper('a3')}>A3</button>
          <button type="button" style={modeTab(plan.paper === 'a4')} onClick={() => onPaper('a4')}>A4</button>
        </div>
        <LanguageSwitch value={plan.locale || locale} onChange={setLocale} />
      </header>
      <div data-testid="workspace-tabs" style={{ display: 'flex', alignItems: 'center', gap: 4, height: 36, padding: '0 8px', background: '#14181f' }}>
        {WORKSPACES.map((item) => (
          <button key={item.id} type="button" data-testid={`workspace-${item.id}`} aria-pressed={workspace === item.id} style={workspaceTab(workspace === item.id)} onClick={() => onWorkspace?.(item.id)}>
            {item.name}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 32, padding: '0 6px', background: '#fafaf9', borderBottom: '1px solid #e7e5e4' }}>
        <Menu id="file" label={t('menu.file')} open={open} setOpen={setOpen}>
          <button type="button" data-testid="plan-new" style={menuItem(false)} onClick={() => { close(); onNew() }}>{t('file.new')}</button>
          <button type="button" data-testid="plan-open" style={menuItem(false)} onClick={() => { close(); onOpen() }}>{t('file.open')}</button>
          <button type="button" data-testid="house-settings" style={menuItem(panel === 'house')} onClick={() => { close(); onHouse() }}>{t('file.house')}</button>
          <button type="button" data-testid="example-house" style={menuItem(false)} onClick={() => { close(); onExample() }}>{t('file.example')}</button>
          <button type="button" data-testid="family-house" style={menuItem(false)} onClick={() => { close(); onFamily() }}>{t('file.apartment')}</button>
        </Menu>
        <Menu id="edit" label={t('menu.edit')} open={open} setOpen={setOpen}>
          <button type="button" data-testid="undo" title={t('edit.undo')} style={menuItem(false)} onClick={() => { close(); onUndo() }}>{t('edit.undo')}</button>
          <button type="button" data-testid="redo" title={t('edit.redo')} style={menuItem(false)} onClick={() => { close(); onRedo() }}>{t('edit.redo')}</button>
          <button type="button" data-testid="cleanup-duplicates" style={menuItem(false)} onClick={() => { close(); onCleanup?.() }}>Siivoa päällekkäiset</button>
          <button type="button" data-testid="straighten-walls" style={menuItem(false)} onClick={() => { close(); onStraighten?.() }}>Suorista seinät</button>
        </Menu>
        <Menu id="view" label={t('menu.view')} open={open} setOpen={setOpen}>
          <button type="button" data-testid="open-display" style={menuItem(false)} onClick={() => { close(); onDisplay() }}>{t('file.display')}</button>
          <button type="button" data-testid="toolbar-preset-plain" title={`${t('preset.plain')} (Alt+1)`} style={menuItem(display.preset === 'plain')} onClick={() => { close(); onPreset('plain') }}>{t('preset.plain')}</button>
          <button type="button" data-testid="toolbar-preset-measure" title={`${t('preset.measure')} (Alt+2)`} style={menuItem(display.preset === 'measure')} onClick={() => { close(); onPreset('measure') }}>{t('preset.measure')}</button>
          <button type="button" data-testid="toolbar-preset-all" title={`${t('preset.all')} (Alt+3)`} style={menuItem(display.preset === 'all')} onClick={() => { close(); onPreset('all') }}>{t('preset.all')}</button>
          {!onSheet && snapTools}
          {!onSheet && zoomTools}
        </Menu>
        <Menu id="draw" label={t('menu.draw')} open={open} setOpen={setOpen}>
          {onPlan ? <div style={{ fontSize: 12, color: '#78716c', padding: '4px 8px' }}>{t('menu.onRibbon')}</div> : drawTools(menuItem)}
        </Menu>
        <Menu id="insert" label={t('menu.insert')} open={open} setOpen={setOpen}>
          {onSite ? <div style={{ fontSize: 12, color: '#78716c', padding: '4px 8px' }}>{t('menu.onRibbon')}</div> : yardTools(menuItem)}
        </Menu>
        <Menu id="services" label={t('menu.services')} open={open} setOpen={setOpen}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 4px' }}>
            Järjestelmä
            <select data-testid="service-system" value={svcSystem} onChange={(event) => onSystem(event.target.value)} style={selectStyle}>
              {SERVICE_SYSTEMS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <button type="button" data-testid="service-tool-node" style={menuItem(svcTool === 'node')} onClick={() => { close(); onSvcTool('node') }}>Piste</button>
          <button type="button" data-testid="service-tool-run" style={menuItem(svcTool === 'run')} onClick={() => { close(); onSvcTool('run') }}>Linja</button>
          <select data-testid="service-kind" value={placeables.some((item) => item.id === svcKind) ? svcKind : (placeables[0]?.id || '')} onChange={(event) => onKind(event.target.value)} style={{ ...selectStyle, margin: '2px 4px' }}>
            {placeables.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          {drawing && <button type="button" data-testid="service-finish" style={menuItem(false)} onClick={() => { close(); onFinish() }}>Valmis</button>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 8px' }}>
            <input data-testid="floor-heating" type="checkbox" checked={floorHeating} onChange={(event) => onFloorHeating(event.target.checked)} />
            Lattialämmitys
          </label>
          <button type="button" data-testid="route-services" style={menuItem(false)} onClick={() => { close(); onRoute() }}>Reititä automaattisesti</button>
          {svcSystem === 'electric' && (
            <>
              <button type="button" data-testid="rewire-electric" style={menuItem(false)} onClick={() => { close(); onRewire() }}>Johdota</button>
              <button type="button" data-testid="open-schedule" style={menuItem(false)} onClick={() => { close(); onSchedule() }}>Ryhmäluettelo</button>
              <button type="button" data-testid="open-diagram" style={menuItem(false)} onClick={() => { close(); onDiagram() }}>Pääkaavio</button>
            </>
          )}
          {svcSystem === 'water' && (
            <button type="button" data-testid="rewire-water" style={menuItem(false)} onClick={() => { close(); onRewireWater() }}>Johdota käyttövesi</button>
          )}
          {svcSystem === 'heat' && (
            <>
              <button type="button" data-testid="rewire-heat" style={menuItem(false)} onClick={() => { close(); onRewireHeat() }}>Johdota lämmitys</button>
              <button type="button" data-testid="open-heat-table" style={menuItem(false)} onClick={() => { close(); onHeatTable() }}>Piiritaulukko</button>
              <button type="button" data-testid="open-heat-schematic" style={menuItem(false)} onClick={() => { close(); onHeatSchematic() }}>Periaatekaavio</button>
            </>
          )}
          {hasAir && (
            <span data-testid="service-balance" style={{ fontSize: 12, fontWeight: 700, padding: '4px 8px' }}>
              Tulo {balance.supply} l/s · Poisto {balance.extract} l/s
            </span>
          )}
        </Menu>
        <Menu id="print" label={t('menu.print')} open={open} setOpen={setOpen}>
          <button type="button" data-testid="export-floor-pdf" style={menuItem(false)} onClick={() => { close(); onPdf() }}>PDF</button>
          <button type="button" data-testid="export-site-pdf" style={menuItem(false)} onClick={() => { close(); onServicePdf('site') }}>{t('file.sitePdf')}</button>
          <button type="button" data-testid="export-floor-png" style={menuItem(false)} onClick={() => { close(); onServicePdf('png') }}>PNG</button>
          {SERVICE_SYSTEMS.map((item) => (
            <button key={`pdf-${item.id}`} type="button" data-testid={`service-pdf-${item.id}`} style={menuItem(false)} onClick={() => { close(); onServicePdf(item.id) }}>{item.name} PDF</button>
          ))}
        </Menu>
        <span style={{ flex: 1 }} />
        <button type="button" title={t('edit.undo')} onClick={onUndo} style={rib(false)}>↶</button>
        <button type="button" title={t('edit.redo')} onClick={onRedo} style={rib(false)}>↷</button>
      </div>
      {mode !== 'facade' && (
        <div data-testid="tool-ribbon" style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 40, padding: '4px 8px', background: '#f5f5f4', borderBottom: '1px solid #e7e5e4' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, overflowX: 'auto' }}>
            {workspace === 'rakenne' && (onPlan || mode === '3d') && (
              <Group>
                {drawTools(toolStyle)}
                {tool === 'door' && (
                  <DoorHandControls
                    compact
                    swing={doorHand.swing}
                    inward={doorHand.inward}
                    onSwing={(swing) => onDoorHand?.({ ...doorHand, swing })}
                    onInward={(inward) => onDoorHand?.({ ...doorHand, inward })}
                  />
                )}
              </Group>
            )}
            {workspace === 'kalusteet' && (
              <Group>
                <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={toolStyle(selectOn)} onClick={() => onTool('select')}>{t('tool.select')}</button>
                <button type="button" data-testid="repeat-place" aria-pressed={repeat} style={toolStyle(repeat)} onClick={() => onRepeat?.(!repeat)}>Toista</button>
                <span style={{ fontSize: 12, color: '#57534e', flexShrink: 0 }}>Kalusteet huoneittain sivupalkissa</span>
              </Group>
            )}
            {workspace === 'piha' && <Group>{yardTools(toolStyle)}</Group>}
            {workspaceSystems(workspace).length > 0 && (
              <Group>
                <button type="button" data-testid="tool-select" aria-pressed={selectOn} style={toolStyle(selectOn)} onClick={() => onTool('select')}>{t('tool.select')}</button>
                {PLACEABLES.filter((item) => workspaceSystems(workspace).includes(item.system) && item.mode === 'node').map((item) => (
                  <button key={item.id} type="button" data-testid={`device-${item.id}`} aria-pressed={svcTool === 'node' && svcKind === item.id} style={toolStyle(svcTool === 'node' && svcKind === item.id)} onClick={() => onPlaceDevice?.(item)}>{item.name}</button>
                ))}
                {PLACEABLES.filter((item) => workspaceSystems(workspace).includes(item.system) && item.mode === 'run').map((item) => (
                  <button key={item.id} type="button" data-testid={`run-${item.id}`} aria-pressed={svcTool === 'run' && svcKind === item.id} style={toolStyle(svcTool === 'run' && svcKind === item.id)} onClick={() => onPlaceDevice?.({ ...item, drawing: true })}>{item.name}</button>
                ))}
                <button type="button" data-testid="repeat-place" aria-pressed={repeat} style={toolStyle(repeat)} onClick={() => onRepeat?.(!repeat)}>Toista</button>
                <button type="button" data-testid="route-services" style={toolStyle(false)} onClick={() => { close(); onRoute() }}>Reititä automaattisesti</button>
                <button type="button" data-testid="suggest-equipment" style={toolStyle(ghostCount > 0)} onClick={() => onSuggest?.()}>Ehdota laitteet</button>
                {ghostCount > 0 && <button type="button" data-testid="accept-equipment" style={toolStyle(true)} onClick={() => onAccept?.()}>Hyväksy</button>}
              </Group>
            )}
            {mode === '3d' && (
              <Group>
                <span style={{ fontSize: 11, color: '#78716c' }}>{t('view3d.walls')}</span>
                <button type="button" data-testid="wall-solid" style={rib(wallMode === 'solid')} onClick={() => onWallMode('solid')}>{t('view3d.visible')}</button>
                <button type="button" data-testid="wall-ghost" aria-pressed={wallMode === 'ghost'} style={rib(wallMode === 'ghost')} onClick={() => onWallMode('ghost')}>{t('view3d.ghost')}</button>
                <button type="button" data-testid="wall-hidden" style={rib(wallMode === 'hidden')} onClick={() => onWallMode('hidden')}>{t('view3d.hidden')}</button>
                <span style={{ width: 1, height: 18, background: '#d6d3d1' }} />
                <span style={{ fontSize: 11, color: '#78716c' }}>{t('view3d.roof')}</span>
                <button type="button" data-testid="roof-solid" style={rib(roofMode === 'solid')} onClick={() => onRoofMode('solid')}>{t('view3d.visible')}</button>
                <button type="button" data-testid="roof-ghost" style={rib(roofMode === 'ghost')} onClick={() => onRoofMode('ghost')}>{t('view3d.ghost')}</button>
                <button type="button" data-testid="roof-hidden" aria-pressed={roofMode === 'hidden'} style={rib(roofMode === 'hidden')} onClick={() => onRoofMode('hidden')}>{t('view3d.hidden')}</button>
                <button type="button" data-testid="scene-realistic" style={rib(plan.sceneStyle !== 'technical')} onClick={() => onSceneStyle('realistic')}>{t('finish.realistic')}</button>
                <button type="button" data-testid="scene-technical" style={rib(plan.sceneStyle === 'technical')} onClick={() => onSceneStyle('technical')}>{t('finish.technical')}</button>
              </Group>
            )}
          </div>
          {onSheet && <span style={{ width: 1, alignSelf: 'stretch', background: '#e7e5e4' }} />}
          {onSheet && <Group>{snapTools}</Group>}
          {onSheet && <Group>{zoomTools}</Group>}
        </div>
      )}
      <CadToolbar active={command?.name} onCommand={onCommand} onSelectType={onSelectType} onLayer={onCadLayer} />
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
