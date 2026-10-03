import { PLACEABLES, serviceMenuSpec } from './services.js'

export const BUILDING_MENUS = {
  wall: ['kind', 'thickness', 'height', 'cladding', 'length', 'split', 'door', 'window', 'delete'],
  door: ['width', 'height', 'swing', 'flip', 'delete'],
  window: ['width', 'height', 'sill', 'delete'],
  room: ['name', 'type', 'floor', 'interior', 'delete'],
  fixture: ['width', 'depth', 'rotate', 'mirror', 'color', 'duplicate', 'delete'],
  zone: ['material', 'delete'],
  roof: ['type', 'pitch', 'material', 'overhang'],
  house: ['name', 'height', 'thickness', 'roof'],
}

export function elementMenu(target) {
  if (!target) return []
  if (target.kind === 'opening') return BUILDING_MENUS[target.openingKind === 'window' ? 'window' : 'door']
  if (target.kind === 'service') {
    return serviceMenuSpec({
      kind: target.serviceKind,
      system: target.system,
      points: target.mode === 'run' ? [{ x: 0, z: 0 }] : undefined,
    })
  }
  return BUILDING_MENUS[target.kind] || []
}

export function everyElementTarget() {
  const building = [
    { kind: 'wall', label: 'seinä' },
    { kind: 'door', label: 'ovi' },
    { kind: 'window', label: 'ikkuna' },
    { kind: 'opening', openingKind: 'door', label: 'ovi' },
    { kind: 'opening', openingKind: 'window', label: 'ikkuna' },
    { kind: 'room', label: 'huone' },
    { kind: 'fixture', label: 'kaluste' },
    { kind: 'zone', label: 'julkisivuvyöhyke' },
    { kind: 'roof', label: 'katto' },
    { kind: 'house', label: 'talo' },
  ]
  const services = PLACEABLES.map((item) => ({
    kind: 'service',
    serviceKind: item.kind,
    system: item.system,
    mode: item.mode,
    label: item.name,
  }))
  return [...building, ...services]
}
