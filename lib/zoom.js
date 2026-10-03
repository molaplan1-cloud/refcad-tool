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

export function wheelZoomFactor(deltaY, pinch) {
  const delta = Number(deltaY) || 0
  return Math.exp(-delta * (pinch ? 0.01 : 0.0015))
}

export function zoomPercent(camera) {
  return Math.round((camera?.zoom > 0 ? camera.zoom : 1) * 100)
}

export const FIT_CAMERA = { zoom: 1, x: 0, y: 0 }
