export function clampZoom(zoom, min = 0.2, max = 12) {
  return Math.max(min, Math.min(max, zoom))
}

export function zoomAt(camera, px, py, factor, limits) {
  const current = camera?.zoom > 0 ? camera.zoom : 1
  const zoom = clampZoom(current * factor, limits?.min, limits?.max)
  const worldX = (px - (camera?.x || 0)) / current
  const worldY = (py - (camera?.y || 0)) / current
  return {
    zoom,
    x: px - worldX * zoom,
    y: py - worldY * zoom,
  }
}

export function panBy(camera, dx, dy) {
  return {
    zoom: camera?.zoom > 0 ? camera.zoom : 1,
    x: (camera?.x || 0) + dx,
    y: (camera?.y || 0) + dy,
  }
}

function pair(points) {
  const a = points?.a || { x: 0, y: 0 }
  const b = points?.b || { x: 0, y: 0 }
  return {
    a,
    b,
    midX: (a.x + b.x) / 2,
    midY: (a.y + b.y) / 2,
    dist: Math.hypot(b.x - a.x, b.y - a.y) || 1,
  }
}

export function pinchZoom(camera, start, next) {
  const from = pair(start)
  const to = pair(next)
  const zoomed = zoomAt(camera, from.midX, from.midY, to.dist / from.dist)
  return panBy(zoomed, to.midX - from.midX, to.midY - from.midY)
}

export function pinchScale(view, start, next, limits = {}) {
  const from = pair(start)
  const to = pair(next)
  const current = view?.scale > 0 ? view.scale : 1
  const scale = Math.max(limits.min || 6, Math.min(limits.max || 220, current * (to.dist / from.dist)))
  const worldX = (from.midX - (view?.offsetX || 0)) / current
  const worldY = (from.midY - (view?.offsetY || 0)) / current
  return {
    scale,
    offsetX: to.midX - worldX * scale,
    offsetY: to.midY - worldY * scale,
  }
}

export function wheelZoomFactor(deltaY, pinch) {
  const delta = Number(deltaY) || 0
  return Math.exp(-delta * (pinch ? 0.01 : 0.0015))
}

export function zoomPercent(camera) {
  return Math.round((camera?.zoom > 0 ? camera.zoom : 1) * 100)
}

export const FIT_CAMERA = { zoom: 1, x: 0, y: 0 }

// Keep the same sheet scale and the same world point at the viewport centre
// when the canvas grows or shrinks around it.
export function holdSheetView(camera, prev, next) {
  const zoom0 = camera?.zoom > 0 ? camera.zoom : 1
  const k0 = prev?.k > 0 ? prev.k : 1
  const k1 = next?.k > 0 ? next.k : 1
  const zoom = zoom0 * (k0 / k1)
  const paperX = ((prev.w / 2 - (camera?.x || 0)) / zoom0 - (prev.sheetX || 0)) / k0
  const paperY = ((prev.h / 2 - (camera?.y || 0)) / zoom0 - (prev.sheetY || 0)) / k0
  return {
    zoom,
    x: next.w / 2 - ((next.sheetX || 0) + paperX * k1) * zoom,
    y: next.h / 2 - ((next.sheetY || 0) + paperY * k1) * zoom,
  }
}

export function fitRect(rect, viewport, pad = 36) {
  const width = Math.max(1, (rect?.right || 0) - (rect?.left || 0))
  const height = Math.max(1, (rect?.bottom || 0) - (rect?.top || 0))
  const viewW = Math.max(80, viewport?.w || 0)
  const viewH = Math.max(80, viewport?.h || 0)
  const zoom = clampZoom(Math.min((viewW - pad * 2) / width, (viewH - pad * 2) / height))
  const cx = ((rect?.left || 0) + (rect?.right || 0)) / 2
  const cy = ((rect?.top || 0) + (rect?.bottom || 0)) / 2
  return {
    zoom,
    x: viewW / 2 - cx * zoom,
    y: viewH / 2 - cy * zoom,
  }
}
