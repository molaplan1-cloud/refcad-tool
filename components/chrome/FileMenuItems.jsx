'use client'

export function FileMenuItems({
  t,
  itemStyle,
  close,
  onNew,
  onOpen,
  onSave,
  onSaveAs,
  recent = [],
  onRecent,
  onImportUnderlay,
  onExport,
  onProjectInfo,
  onProjectSettings,
  settingsOpen = false,
  onPrint,
  extra = null,
}) {
  const item = (active) => itemStyle(active)
  const go = (fn) => () => { close?.(); fn?.() }
  return (
    <>
      <button type="button" data-testid="plan-new" style={item(false)} onClick={go(onNew)}>{t('file.new')}</button>
      <button type="button" data-testid="plan-open" style={item(false)} onClick={go(onOpen)}>{t('file.openItem')}</button>
      <button type="button" data-testid="plan-save" style={item(false)} onClick={go(onSave)}>{t('file.save')}</button>
      <button type="button" data-testid="plan-save-as" style={item(false)} onClick={go(onSaveAs)}>{t('file.saveAs')}</button>
      <div data-testid="plan-recent" style={{ padding: '4px 8px 2px' }}>
        <div style={{ fontSize: 11, fontWeight: 750, color: '#78716c', marginBottom: 2 }}>{t('file.recent')}</div>
        {recent.length === 0 && <div style={{ fontSize: 12, color: '#a8a29e' }}>{t('file.recentEmpty')}</div>}
        {recent.slice(0, 6).map((entry) => (
          <button key={entry.id} type="button" data-testid={`recent-${entry.id}`} style={{ ...item(false), display: 'block', width: '100%' }} onClick={() => { close?.(); onRecent?.(entry.id) }}>
            {entry.name}
          </button>
        ))}
      </div>
      <button type="button" data-testid="import-underlay" style={item(false)} onClick={go(onImportUnderlay)}>{t('underlay.import')}</button>
      <button type="button" data-testid="export-cad" style={item(false)} onClick={go(onExport)}>{t('file.exportCad')}</button>
      <button type="button" data-testid="project-info" style={item(false)} onClick={go(onProjectInfo)}>{t('file.projectInfo')}</button>
      <button type="button" data-testid="house-settings" style={item(settingsOpen)} onClick={go(onProjectSettings)}>{t('file.projectSettings')}</button>
      {extra}
      <button type="button" data-testid="file-print" style={item(false)} onClick={go(onPrint)}>{t('file.print')}</button>
    </>
  )
}
