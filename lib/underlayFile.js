import { analyzeUnderlay, fittedSize, scaleForBudget, UNDERLAY_MAX_BYTES, warpRaster, worldToImage } from './underlay.js'

function resample(canvas, width, height) {
  const next = document.createElement('canvas')
  next.width = width
  next.height = height
  next.getContext('2d').drawImage(canvas, 0, 0, width, height)
  return next
}

function byteSize(dataUrl) {
  return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75)
}

function looksLikeLineArt(canvas) {
  const { width, height } = canvas
  const sample = canvas.getContext('2d').getImageData(0, 0, width, height).data
  let ink = 0
  let seen = 0
  const stride = Math.max(4, Math.floor(sample.length / 4 / 8000)) * 4
  for (let i = 0; i < sample.length; i += stride) {
    const gray = sample[i] * 0.299 + sample[i + 1] * 0.587 + sample[i + 2] * 0.114
    seen += 1
    if (gray < 200) ink += 1
  }
  return seen > 0 && ink / seen < 0.18
}

export function compressCanvas(canvas) {
  let source = canvas
  let { width, height } = fittedSize(canvas.width, canvas.height)
  if (width !== canvas.width || height !== canvas.height) source = resample(canvas, width, height)
  if (looksLikeLineArt(source)) {
    const png = source.toDataURL('image/png')
    const pngBytes = byteSize(png)
    if (pngBytes <= UNDERLAY_MAX_BYTES) {
      return { image: png, pixelWidth: width, pixelHeight: height, bytes: pngBytes, shrunk: source !== canvas }
    }
  }
  let quality = 0.82
  let url = source.toDataURL('image/jpeg', quality)
  let bytes = byteSize(url)
  let shrunk = bytes > UNDERLAY_MAX_BYTES || source !== canvas
  while (bytes > UNDERLAY_MAX_BYTES && (quality > 0.42 || Math.max(width, height) > 720)) {
    shrunk = true
    if (quality > 0.42) quality = Math.round((quality - 0.08) * 100) / 100
    else {
      const next = scaleForBudget(width, height, bytes)
      source = resample(source, next.width, next.height)
      width = source.width
      height = source.height
      quality = 0.72
    }
    url = source.toDataURL('image/jpeg', quality)
    bytes = byteSize(url)
  }
  return { image: url, pixelWidth: width, pixelHeight: height, bytes, shrunk }
}

function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image'))
    }
    image.src = url
  })
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
  return pdfjs
}

export async function readUnderlayFile(file) {
  const name = file?.name || 'pohjakuva'
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf') || file?.type === 'application/pdf') {
    const bytes = new Uint8Array(await file.arrayBuffer())
    const pdfjs = await loadPdfjs()
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
    const pageCount = doc.numPages
    await doc.destroy()
    return { kind: 'pdf', name, bytes, pageCount }
  }
  let blob = file
  let source = 'png'
  if (lower.endsWith('.heic') || lower.endsWith('.heif') || /heic|heif/i.test(file?.type || '')) {
    const heic2any = (await import('heic2any')).default
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.85 })
    blob = Array.isArray(converted) ? converted[0] : converted
    source = 'heic'
  } else if (/jpe?g/.test(lower) || /jpe?g/.test(file?.type || '')) source = 'jpeg'
  const image = await blobToImage(blob)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth || image.width
  canvas.height = image.naturalHeight || image.height
  canvas.getContext('2d').drawImage(image, 0, 0)
  return { kind: 'image', name, source, ...compressCanvas(canvas) }
}

export async function renderPdfPage(bytes, pageNumber) {
  const pdfjs = await loadPdfjs()
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const pageCount = doc.numPages
  const page = await doc.getPage(Math.min(Math.max(1, pageNumber), pageCount))
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2.4, 1400 / Math.max(base.width, base.height))
  const viewport = page.getViewport({ scale: Math.max(scale, 1) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  const stored = compressCanvas(canvas)
  await doc.destroy()
  return { ...stored, dpi: Math.round(72 * viewport.scale), page: pageNumber, pageCount, source: 'pdf' }
}

export function rasterizeStored(imageUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || image.width
      canvas.height = image.naturalHeight || image.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(image, 0, 0)
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height)
      resolve({ width: canvas.width, height: canvas.height, data: frame.data })
    }
    image.onerror = () => reject(new Error('image'))
    image.src = imageUrl
  })
}

export async function traceStored(underlay, suggest) {
  const raster = await rasterizeStored(underlay.image)
  return analyzeUnderlay(underlay, raster, { suggest })
}

export async function deskewStored(underlay, worldPoints) {
  const raster = await rasterizeStored(underlay.image)
  const corners = worldPoints.map((point) => {
    const uv = worldToImage(underlay, point)
    return { x: uv.u * raster.width, y: uv.v * raster.height }
  })
  const warped = warpRaster(raster.data, raster.width, raster.height, corners)
  if (!warped) return null
  const canvas = document.createElement('canvas')
  canvas.width = warped.width
  canvas.height = warped.height
  canvas.getContext('2d').putImageData(new ImageData(warped.rgba, warped.width, warped.height), 0, 0)
  const stored = compressCanvas(canvas)
  const metresX = underlay.widthM / raster.width
  const metresZ = underlay.heightM / raster.height
  return {
    ...stored,
    widthM: Math.round(warped.width * metresX * 1000) / 1000,
    heightM: Math.round(warped.height * metresZ * 1000) / 1000,
    rotation: 0,
    suggestions: [],
    lines: [],
  }
}
