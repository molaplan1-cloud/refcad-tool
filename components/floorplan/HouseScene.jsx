'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { finishesOf } from '@/lib/finishes'
import {
  fixtureTemplate,
  materialOf,
  openingColour,
  doorLeafPose,
  doorStyleOf,
  facadeCells,
  facadeFlashings,
  facadeWorld,
  mergedFacadeSkins,
  surfaceLook,
  planBounds,
  plinthLook,
  pointInPolygon,
  resolveFaceMaterial,
  roofFaces,
  roofLook,
  roofModel,
  roofOutline,
  roomForWallSide,
  segmentLength,
  thicknessOf,
  visibleRooms,
  wallPieces,
  zoneCovering,
} from '@/lib/floorplan'
import Services3D from './Services3D'
import YardScene, { SiteGround } from './YardScene'
import { hasYard, sceneBounds, sunkenTerraceRings } from '@/lib/yard'
import { yardHasUnderground } from '@/lib/groundworks'
import { layerVisible } from '@/lib/services'
import { labelObstacles, layoutRoomLabels, normalizeDisplay } from '@/lib/display'
import { chimneyKind, chimneyTop, drawingOf } from '@/lib/chimney'
import { faceOffsets } from '@/lib/wall-outline'

const textureCache = new Map()

function finishTexture(group, id) {
  const key = `${group}:${id}`
  if (textureCache.has(key)) return textureCache.get(key)
  const item = materialOf(group, id)
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = item.color
  ctx.fillRect(0, 0, 128, 128)
  ctx.lineWidth = 2
  if (id === 'brick' || (group !== 'roof' && id === 'tile')) {
    const step = id === 'brick' ? 28 : 32
    ctx.strokeStyle = id === 'brick' ? 'rgba(60,16,12,0.35)' : 'rgba(80,70,60,0.28)'
    for (let y = 0; y <= 128; y += step) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(128, y)
      ctx.stroke()
      const shift = id === 'brick' && Math.round(y / step) % 2 ? step / 2 : 0
      for (let x = -step; x <= 128; x += step) {
        ctx.beginPath()
        ctx.moveTo(x + shift, y)
        ctx.lineTo(x + shift, y + step)
        ctx.stroke()
      }
    }
  } else if (id === 'parquet' || id === 'laminate' || id === 'panel' || id === 'cladding') {
    ctx.strokeStyle = 'rgba(70,42,18,0.28)'
    const vertical = id === 'panel'
    const step = id === 'laminate' ? 9 : 16
    for (let i = step; i < 128; i += step) {
      ctx.beginPath()
      if (vertical) {
        ctx.moveTo(i, 0)
        ctx.lineTo(i, 128)
      } else {
        ctx.moveTo(0, i)
        ctx.lineTo(128, i)
      }
      ctx.stroke()
    }
  } else if (id === 'metal') {
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'
    for (let i = 6; i < 128; i += 8) {
      ctx.beginPath()
      ctx.moveTo(0, i)
      ctx.lineTo(128, i)
      ctx.stroke()
    }
  } else if (id === 'wallpaper') {
    ctx.strokeStyle = 'rgba(120,100,70,0.18)'
    for (let y = 8; y < 128; y += 24) {
      for (let x = 8; x < 128; x += 24) {
        ctx.strokeRect(x, y, 10, 14)
      }
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    for (let i = 0; i < 280; i += 1) {
      ctx.fillRect((i * 47) % 128, (i * 29) % 128, 2, 2)
    }
  }
  const tex = new THREE.CanvasTexture(canvas)
  bindTexture(tex, { color: true })
  textureCache.set(key, tex)
  return tex
}

function paintCanvas(look) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = look.color || '#c4a484'
  ctx.fillRect(0, 0, 128, 128)
  const joint = look.painted ? 'rgba(70,55,40,0.28)' : (look.mortar || 'rgba(90,70,50,0.7)')
  ctx.strokeStyle = joint
  ctx.lineWidth = look.painted ? 1.2 : 2
  if (look.pattern === 'brick') {
    ctx.fillStyle = look.mortar || '#c8b8a4'
    ctx.fillRect(0, 0, 128, 128)
    const brickW = 52
    const brickH = 22
    const mortar = 8
    for (let row = 0, y = mortar; y < 128; row += 1, y += brickH + mortar) {
      const shift = row % 2 ? -(brickW + mortar) / 2 : 0
      for (let x = shift; x < 128; x += brickW + mortar) {
        const tone = 1.02 + ((row * 3 + Math.round(x)) % 5) * 0.05
        ctx.fillStyle = shadeHex(look.color || '#9c341f', tone)
        ctx.fillRect(x, y, brickW, brickH)
      }
    }
  } else if (look.pattern === 'boards-h' || look.pattern === 'boards-v' || look.pattern === 'batten') {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'
    if (look.pattern === 'boards-h') ctx.fillRect(0, 116, 128, 12)
    else ctx.fillRect(116, 0, 12, 128)
    if (look.pattern === 'batten') {
      ctx.fillStyle = 'rgba(255,255,255,0.18)'
      ctx.fillRect(108, 0, 6, 128)
    }
    ctx.fillStyle = 'rgba(255,255,255,0.08)'
    ctx.fillRect(0, 0, 128, 8)
  } else if (look.pattern === 'stone') {
    ctx.strokeRect(4, 4, 36, 24)
    ctx.strokeRect(44, 6, 40, 22)
    ctx.strokeRect(88, 4, 32, 26)
    ctx.strokeRect(8, 36, 48, 28)
    ctx.strokeRect(60, 38, 56, 24)
    ctx.strokeRect(6, 72, 40, 30)
    ctx.strokeRect(52, 74, 34, 28)
    ctx.strokeRect(92, 70, 28, 34)
  } else if (look.pattern === 'board') {
    ctx.strokeRect(2, 2, 60, 60)
    ctx.strokeRect(66, 2, 60, 60)
    ctx.strokeRect(2, 66, 60, 60)
    ctx.strokeRect(66, 66, 60, 60)
  } else if (look.pattern === 'concrete') {
    ctx.fillStyle = 'rgba(0,0,0,0.12)'
    for (let i = 0; i < 90; i += 1) ctx.fillRect((i * 47) % 128, (i * 29) % 128, 2, 2)
  } else if (look.pattern === 'seam' || look.pattern === 'corrugated' || look.pattern === 'tile' || look.pattern === 'tile-metal' || look.pattern === 'felt') {
    ctx.strokeStyle = 'rgba(0,0,0,0.28)'
    const step = look.pattern === 'tile' || look.pattern === 'tile-metal' ? 18 : look.pattern === 'felt' ? 0 : 16
    if (look.pattern === 'felt') {
      ctx.fillStyle = 'rgba(0,0,0,0.08)'
      for (let i = 0; i < 70; i += 1) ctx.fillRect((i * 19) % 128, (i * 23) % 128, 3, 2)
    } else if (look.pattern === 'tile' || look.pattern === 'tile-metal') {
      const tileW = look.pattern === 'tile-metal' ? 32 : 28
      const tileH = 22
      for (let row = 0, y = 2; y < 128; row += 1, y += tileH) {
        const shift = row % 2 ? tileW / 2 : 0
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'
        ctx.beginPath()
        ctx.moveTo(0, y + tileH - 2)
        ctx.lineTo(128, y + tileH - 2)
        ctx.stroke()
        for (let x = -tileW + shift; x < 128; x += tileW) {
          ctx.beginPath()
          ctx.moveTo(x, y + 4)
          ctx.quadraticCurveTo(x + tileW / 2, y - 2, x + tileW, y + 4)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(x + tileW, y + 4)
          ctx.lineTo(x + tileW, y + tileH - 2)
          ctx.stroke()
        }
      }
    } else {
      for (let x = step; x < 128; x += step) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, 128)
        ctx.stroke()
      }
    }
  } else {
    ctx.fillStyle = 'rgba(80,60,40,0.12)'
    for (let i = 0; i < 40; i += 1) ctx.fillRect((i * 37) % 128, (i * 19) % 128, 2, 2)
  }
  const tex = bindTexture(new THREE.CanvasTexture(canvas), { color: true })
  return tex
}

function bindTexture(tex, { color = false, anisotropy = 16 } = {}) {
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  if (color) tex.colorSpace = THREE.SRGBColorSpace
  tex.generateMipmaps = true
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.anisotropy = anisotropy
  tex.needsUpdate = true
  return tex
}

function brickMaps(look) {
  const moduleW = 0.285
  const moduleH = 0.085
  const cols = 4
  const rows = 8
  const worldW = cols * moduleW
  const worldH = rows * moduleH
  const width = 1024
  const height = Math.round(width * (worldH / worldW))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#322f2c'
  ctx.fillRect(0, 0, width, height)
  const stepX = width / cols
  const stepY = height / rows
  const brickW = stepX * (275 / 285)
  const brickH = stepY * (70 / 85)
  const ox = (stepX - brickW) / 2
  const oy = (stepY - brickH) / 2
  const bump = document.createElement('canvas')
  bump.width = width
  bump.height = height
  const bctx = bump.getContext('2d')
  bctx.fillStyle = '#2a2a2a'
  bctx.fillRect(0, 0, width, height)
  bctx.fillStyle = '#d8d8d8'
  for (let row = 0; row < rows; row += 1) {
    const shift = row % 2 ? stepX / 2 : 0
    for (let col = -1; col <= cols; col += 1) {
      const tone = 0.93 + ((row * 5 + col * 3) % 7) * 0.018
      ctx.fillStyle = shadeHex(look.color || '#9c341f', tone)
      const x = col * stepX + shift + ox
      const y = row * stepY + oy
      ctx.fillRect(x, y, brickW, brickH)
      bctx.fillRect(x, y, brickW, brickH)
    }
  }
  const map = bindTexture(new THREE.CanvasTexture(canvas), { color: true })
  const bumpMap = bindTexture(new THREE.CanvasTexture(bump))
  map.userData = { bump: bumpMap, worldW, worldH }
  return map
}

function shadeHex(hex, tone) {
  const raw = String(hex || '#9c341f').replace('#', '')
  const full = raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw.padEnd(6, '0')
  const channel = (index) => Math.max(0, Math.min(255, Math.round(parseInt(full.slice(index, index + 2), 16) * tone)))
  return `#${[0, 2, 4].map((index) => channel(index).toString(16).padStart(2, '0')).join('')}`
}

function repeatedCladding(look, span, height) {
  const board = Math.max(0.07, (look.boardWidthMm || 145) / 1000)
  const brick = look.pattern === 'brick'
  const unitX = brick ? 1.14 : look.pattern === 'boards-v' || look.pattern === 'batten' ? board * 4 : look.pattern === 'seam' || look.pattern === 'corrugated' ? 0.8 : look.pattern === 'tile' || look.pattern === 'tile-metal' ? 0.64 : 0.6
  const unitY = brick ? 0.68 : look.pattern === 'boards-h' ? board * 4 : look.pattern === 'tile' || look.pattern === 'tile-metal' ? 0.36 : look.pattern === 'seam' ? 0.8 : 0.4
  const rx = Math.max(0.5, Math.round((span / unitX) * 4) / 4)
  const ry = Math.max(0.5, Math.round((height / unitY) * 4) / 4)
  const key = `clad-repeat:${look.pattern}:${look.color}:${look.mortar}:${look.painted ? 1 : 0}:${look.boardWidthMm}:${rx}:${ry}`
  if (textureCache.has(key)) return textureCache.get(key)
  const tex = brick ? brickMaps(look) : paintCanvas(look)
  tex.repeat.set(rx, ry)
  if (tex.userData?.bump) tex.userData.bump.repeat.set(rx, ry)
  tex.needsUpdate = true
  textureCache.set(key, tex)
  return tex
}

function GroundShade({ cx, cz, w, h }) {
  const map = useMemo(() => groundShade(), [])
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.008, cz]} raycast={noopRaycast}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={map} transparent depthWrite={false} />
    </mesh>
  )
}

function groundShade() {
  const key = 'ground-shade'
  if (textureCache.has(key)) return textureCache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const fade = ctx.createRadialGradient(128, 128, 36, 128, 128, 124)
  fade.addColorStop(0, 'rgba(55,48,40,0.38)')
  fade.addColorStop(0.62, 'rgba(55,48,40,0.16)')
  fade.addColorStop(1, 'rgba(55,48,40,0)')
  ctx.fillStyle = fade
  ctx.fillRect(0, 0, 256, 256)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  textureCache.set(key, tex)
  return tex
}

function roofSurface(finish) {
  const seam = finish.pattern === 'seam' || finish.pattern === 'corrugated'
  const key = `roof-surface:${finish.pattern}:${finish.color}:${seam ? 'seam' : 'tile'}`
  if (textureCache.has(key)) return textureCache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')
  const base = finish.color || '#7f1d1d'
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 512, 512)
  if (seam) {
    for (let x = 0; x < 512; x += 128) {
      ctx.fillStyle = shadeHex(base, 0.68)
      ctx.fillRect(x, 0, 14, 512)
      ctx.fillStyle = shadeHex(base, 1.16)
      ctx.fillRect(x + 14, 0, 5, 512)
    }
  } else {
    const tileW = 128
    const tileH = 80
    for (let row = 0, y = 0; y < 520; row += 1, y += tileH) {
      const shift = row % 2 ? tileW / 2 : 0
      ctx.fillStyle = shadeHex(base, 0.42)
      ctx.fillRect(0, y + tileH - 16, 512, 16)
      for (let x = -tileW + shift; x < 512; x += tileW) {
        ctx.fillStyle = shadeHex(base, 0.96 + ((row * 3 + x) % 5) * 0.015)
        ctx.fillRect(x + 2, y + 2, tileW - 4, tileH - 18)
        ctx.fillStyle = shadeHex(base, 0.72)
        ctx.fillRect(x + tileW - 3, y + 2, 2, tileH - 18)
      }
    }
  }
  const tex = bindTexture(new THREE.CanvasTexture(canvas), { color: true })
  const world = seam ? 1.6 : 1.28
  tex.repeat.set(1 / world, 1 / world)
  textureCache.set(key, tex)
  return tex
}

function pointAt(wall, distance) {
  const len = segmentLength(wall.a, wall.b) || 1
  const t = distance / len
  return {
    x: wall.a.x + (wall.b.x - wall.a.x) * t,
    z: wall.a.z + (wall.b.z - wall.a.z) * t,
  }
}

function adjacentInterior(plan, wall, piece) {
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const mid = (piece.from + piece.to) / 2
  const x = wall.a.x + dx * mid
  const z = wall.a.z + dz * mid
  const nx = -dz
  const nz = dx
  const room = (plan.rooms || []).find((item) => pointInPolygon(x + nx * 0.28, z + nz * 0.28, item.polygon))
    || (plan.rooms || []).find((item) => pointInPolygon(x - nx * 0.28, z - nz * 0.28, item.polygon))
  return materialOf('interior', room?.interiorId || 'paint')
}

function samePick(item, pick) {
  if (!item || !pick) return false
  if (item.kind === 'service' || pick.kind === 'service') {
    return item.kind === pick.kind && item.service?.target === pick.service?.target && item.service?.id === pick.service?.id
  }
  return item.kind === pick.kind && item.id === pick.id
}

function markOf(selected, hovered, pick) {
  if (samePick(selected, pick)) return 'selected'
  if (samePick(hovered, pick)) return 'hover'
  return null
}

function noopRaycast() {}

function outlineScale(args, mark) {
  const pad = mark === 'selected' ? 0.07 : 0.035
  return args.map((size) => (Math.max(size, 0.02) + pad * 2) / Math.max(size, 0.02))
}

function Solid({ args, position, rotation, color, map, bump = null, opacity = 1, edges = true, pick, mark, realistic = false, roughness = 0.82 }) {
  const transparent = opacity < 0.98
  const face = mark === 'selected' ? '#5eead4' : mark === 'hover' ? '#ccfbf1' : color
  const edge = mark === 'selected' ? '#0f766e' : mark === 'hover' ? '#14b8a6' : '#1e293b'
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={realistic}
      receiveShadow={realistic}
      userData={pick ? { pick } : undefined}
      raycast={opacity < 0.5 ? noopRaycast : undefined}
    >
      <boxGeometry args={args} />
      <meshStandardMaterial
        color={map && !mark ? '#ffffff' : face}
        emissive={mark === 'selected' ? '#115e59' : '#000000'}
        emissiveIntensity={mark === 'selected' ? 0.35 : 0}
        map={mark || transparent ? null : map || null}
        bumpMap={mark || transparent ? null : bump}
        bumpScale={bump ? 0.04 : 0}
        roughness={realistic ? roughness : 1}
        metalness={0.02}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
      {edges && !realistic && !transparent && <Edges threshold={20} color={edge} />}
      {mark && (
        <mesh scale={outlineScale(args, mark)} raycast={noopRaycast}>
          <boxGeometry args={args} />
          <meshBasicMaterial color={edge} side={THREE.BackSide} />
        </mesh>
      )}
    </mesh>
  )
}

function skinMaps(look, u0, y0, span, height, flipU) {
  const board = Math.max(0.07, (look.boardWidthMm || 145) / 1000)
  const brick = look.pattern === 'brick'
  const unitX = brick ? 1.14 : look.pattern === 'boards-v' || look.pattern === 'batten' ? board * 4 : look.pattern === 'seam' || look.pattern === 'corrugated' ? 0.8 : look.pattern === 'tile' || look.pattern === 'tile-metal' ? 0.64 : 0.6
  const unitY = brick ? 0.68 : look.pattern === 'boards-h' ? board * 4 : look.pattern === 'tile' || look.pattern === 'tile-metal' ? 0.36 : look.pattern === 'seam' ? 0.8 : 0.4
  const key = `skin:${look.pattern}:${look.color}:${look.mortar || ''}:${look.painted ? 1 : 0}:${look.boardWidthMm || 0}:${u0.toFixed(3)}:${y0.toFixed(3)}:${span.toFixed(3)}:${height.toFixed(3)}:${flipU ? 1 : 0}`
  if (textureCache.has(key)) return textureCache.get(key)
  const baseKey = `skin-base:${look.pattern}:${look.color}:${look.mortar || ''}:${look.painted ? 1 : 0}:${look.boardWidthMm || 0}`
  if (!textureCache.has(baseKey)) textureCache.set(baseKey, brick ? brickMaps(look) : paintCanvas(look))
  const base = textureCache.get(baseKey)
  const map = base.clone()
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.repeat.set((flipU ? -1 : 1) * Math.max(0.05, span / unitX), Math.max(0.05, height / unitY))
  map.offset.set(flipU ? (u0 + span) / unitX : u0 / unitX, y0 / unitY)
  map.needsUpdate = true
  let bump = null
  if (base.userData?.bump) {
    bump = base.userData.bump.clone()
    bump.wrapS = THREE.RepeatWrapping
    bump.wrapT = THREE.RepeatWrapping
    bump.repeat.copy(map.repeat)
    bump.offset.copy(map.offset)
    bump.needsUpdate = true
    map.userData = { bump }
  }
  const value = { map, bump }
  textureCache.set(key, value)
  return value
}

function facadeFrame(plan, item, offset) {
  const p0 = facadeWorld(plan, item.side, item.u0, item.plane, item.nx, item.nz, offset)
  const p1 = facadeWorld(plan, item.side, item.u1, item.plane, item.nx, item.nz, offset)
  const span = Math.max(0.05, Math.hypot(p1.x - p0.x, p1.z - p0.z))
  const yaw = Math.atan2(item.nx, item.nz)
  const ax = Math.cos(yaw)
  const az = -Math.sin(yaw)
  const alongX = (p1.x - p0.x) / span
  const alongZ = (p1.z - p0.z) / span
  const flipU = ax * alongX + az * alongZ < 0
  return {
    span,
    yaw,
    flipU,
    position: [(p0.x + p1.x) / 2, 0, (p0.z + p1.z) / 2],
  }
}

function CellOutline({ plan, cell, skins }) {
  const skin = skins.find((item) => item.side === cell.side && Math.abs((item.plane || 0) - (cell.plane || 0)) < 0.04 && cell.u0 >= item.u0 - 0.03 && cell.u1 <= item.u1 + 0.03)
  const frame = facadeFrame(plan, { ...cell, plane: skin?.plane ?? cell.plane, nx: skin?.nx ?? cell.nx, nz: skin?.nz ?? cell.nz }, (thicknessOf({ kind: 'exterior' }, plan) / 2) + 0.03)
  const height = Math.max(0.05, cell.y1 - cell.y0)
  const y = (cell.y0 + cell.y1) / 2
  const t = 0.014
  const bars = [
    [frame.span, t, 0, height / 2],
    [frame.span, t, 0, -height / 2],
    [t, height, -frame.span / 2, 0],
    [t, height, frame.span / 2, 0],
  ]
  return (
    <group position={[frame.position[0], y, frame.position[2]]} rotation={[0, frame.yaw, 0]}>
      {bars.map((bar, index) => (
        <mesh key={index} position={[bar[2], bar[3], 0.01]} raycast={noopRaycast}>
          <boxGeometry args={[bar[0], bar[1], 0.008]} />
          <meshBasicMaterial color="#0f766e" />
        </mesh>
      ))}
    </group>
  )
}

function FacadeSkins({ plan, mode, selected, hovered }) {
  if (mode === 'hidden') return null
  const realistic = finishesOf(plan).sceneStyle !== 'technical' && mode === 'solid'
  const plinthH = plinthLook(plan).height
  const skins = mergedFacadeSkins(plan).flatMap((skin) => {
    const y0 = Math.max(skin.y0, plinthH)
    if (skin.y1 - y0 < 0.02) return []
    return [{ ...skin, y0 }]
  })
  const cells = ['north', 'east', 'south', 'west'].flatMap((side) => facadeCells(plan, side).map((cell) => {
    const skin = skins.find((item) => item.side === side && cell.u0 >= item.u0 - 0.04 && cell.u1 <= item.u1 + 0.04 && cell.y0 >= item.y0 - 0.04 && cell.y1 <= item.y1 + 0.04)
    return { ...cell, plane: skin?.plane ?? 0, nx: skin?.nx ?? 0, nz: skin?.nz ?? 1 }
  }))
  const half = thicknessOf({ kind: 'exterior' }, plan) / 2
  const flashings = facadeFlashings(plan)
  const active = selected?.kind === 'zone' ? selected : null
  return (
    <group>
      {skins.map((skin) => {
        const look = surfaceLook(plan, skin.materialId, { color: skin.color, colorCode: skin.colorCode })
        const height = Math.max(0.05, skin.y1 - skin.y0)
        const frame = facadeFrame(plan, skin, half + 0.012)
        const maps = realistic ? skinMaps(look, skin.u0, skin.y0, frame.span, height, frame.flipU) : null
        return (
          <mesh key={`skin-${skin.side}-${skin.plane}-${skin.u0}-${skin.y0}-${skin.materialId}`} position={[frame.position[0], (skin.y0 + skin.y1) / 2, frame.position[2]]} rotation={[0, frame.yaw, 0]} raycast={noopRaycast} castShadow={realistic} receiveShadow={realistic}>
            <planeGeometry args={[frame.span, height]} />
            <meshStandardMaterial
              color={maps ? '#ffffff' : look.color}
              map={maps?.map || null}
              bumpMap={maps?.bump || null}
              bumpScale={maps?.bump ? 0.012 : 0}
              roughness={look.pattern === 'brick' ? 0.86 : 0.72}
              metalness={0.02}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      {flashings.filter((joint) => joint.y > plinthH + 0.02).map((joint) => {
        const frame = facadeFrame(plan, { ...joint, u0: joint.u0, u1: joint.u1 }, half + 0.028)
        return (
          <mesh key={`flash-${joint.side}-${joint.y}-${joint.u0}`} position={[frame.position[0], joint.y, frame.position[2]]} rotation={[0, frame.yaw, 0]} raycast={noopRaycast} castShadow>
            <boxGeometry args={[Math.max(0.05, frame.span), 0.028, 0.02]} />
            <meshStandardMaterial color="#6e6862" roughness={0.45} metalness={0.35} />
          </mesh>
        )
      })}
      {cells.map((cell) => {
        const frame = facadeFrame(plan, cell, half + 0.02)
        const height = Math.max(0.05, cell.y1 - cell.y0)
        const pick = { kind: 'zone', id: cell.id, side: cell.side, u0: cell.u0, u1: cell.u1, y0: cell.y0, y1: cell.y1, materialId: cell.materialId, zoneId: cell.zoneId }
        const on = active && (active.id === cell.id || (active.side === cell.side && Math.abs(active.u0 - cell.u0) < 0.03 && Math.abs(active.y0 - cell.y0) < 0.03))
        const hot = hovered?.kind === 'zone' && hovered.id === cell.id
        return (
          <group key={cell.id}>
            <mesh position={[frame.position[0], (cell.y0 + cell.y1) / 2, frame.position[2]]} rotation={[0, frame.yaw, 0]} userData={{ pick }}>
              <planeGeometry args={[frame.span, height]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
            </mesh>
            {(on || hot) && <CellOutline plan={plan} cell={cell} skins={skins} />}
          </group>
        )
      })}
    </group>
  )
}

function WallMesh({ plan, mode, selected, hovered }) {
  if (mode === 'hidden') return null
  const opacity = mode === 'ghost' ? 0.14 : 1
  return (
    <group>
      <FacadeSkins plan={plan} mode={mode} selected={selected} hovered={hovered} />
      {(plan.walls || []).flatMap((wall) => {
        const len = segmentLength(wall.a, wall.b) || 1
        const dx = (wall.b.x - wall.a.x) / len
        const dz = (wall.b.z - wall.a.z) / len
        const yaw = Math.atan2(-dz, dx)
        const thick = thicknessOf(wall, plan)
        const offsets = faceOffsets(wall, thick)
        const nx = -dz
        const nz = dx
        const bodyShift = (offsets.left + offsets.right) / 2
        const shell = wall.kind !== 'interior' && wall.kind !== 'partition'
        const pieces = shell
          ? wallPieces(wall, plan.openings, plan.floorHeight, plan.walls, plan)
          : wallPieces(wall, plan.openings, plan.floorHeight, plan.walls, plan)
        const plinth = plinthLook(plan)
        const realistic = finishesOf(plan).sceneStyle !== 'technical' && mode === 'solid'
        const slices = pieces.flatMap((piece) => {
          if (wall.kind !== 'exterior' || piece.y1 <= plinth.height + 0.001) {
            return [{ ...piece, plinthBand: wall.kind === 'exterior' && piece.y1 <= plinth.height + 0.001 }]
          }
          if (piece.y0 >= plinth.height - 0.001) return [{ ...piece, plinthBand: false }]
          return [
            { ...piece, y1: plinth.height, plinthBand: true },
            { ...piece, y0: plinth.height, plinthBand: false },
          ]
        })
        return slices.map((piece) => {
          const span = piece.to - piece.from
          const mid = pointAt(wall, (piece.from + piece.to) / 2)
          const placeX = mid.x + nx * bodyShift
          const placeZ = mid.z + nz * bodyShift
          const y = (piece.y0 + piece.y1) / 2
          const height = piece.y1 - piece.y0
          const cladding = wall.kind === 'exterior' && !piece.plinthBand
            ? surfaceLook(plan, piece.materialId || plan.exteriorId, { color: piece.color, colorCode: piece.colorCode })
            : null
          const plinthFace = piece.plinthBand ? plinth : null
          const finish = cladding || plinthFace || adjacentInterior(plan, wall, piece)
          const map = shell ? null : realistic && (cladding || plinthFace)
            ? repeatedCladding(cladding || { ...plinthFace, boardWidthMm: 145, painted: false, mortar: plinthFace.color }, span, height)
            : realistic && wall.kind !== 'exterior' ? finishTexture('interior', finish.id) : null
          const zone = !shell ? null : zoneCovering(plan, wall, Math.max(0, (piece.from + piece.to) / 2), y)
          const pick = shell ? null : (zone ? { kind: 'zone', id: zone.id, wallId: wall.id } : { kind: 'wall', id: wall.id })
          const onThisWall = (item) => !shell && item?.kind === 'wall' && item.id === wall.id
          const mark = samePick(selected, pick) || onThisWall(selected)
            ? 'selected'
            : samePick(hovered, pick) || onThisWall(hovered)
              ? 'hover'
              : null
          const faceKey = `${wall.id}-${piece.from}-${piece.to}-${piece.y0}-${piece.y1}-${piece.materialId || 'base'}-${piece.plinthBand ? 'plinth' : 'clad'}`
          const faceColor = realistic ? (wall.kind === 'exterior' ? finish.color : '#d6d3d1') : '#f8fafc'
          return (
            <group key={faceKey}>
              <Solid
                args={[span, height, piece.plinthBand ? thick + 0.02 : thick]}
                position={[placeX, y, placeZ]}
                rotation={[0, yaw, 0]}
                color={faceColor}
                map={realistic && wall.kind === 'exterior' ? map : null}
                bump={realistic && wall.kind === 'exterior' ? map?.userData?.bump || null : null}
                opacity={opacity}
                pick={pick}
                mark={mark}
                realistic={realistic}
                roughness={cladding?.pattern === 'brick' ? 0.86 : 0.72}
                edges={!shell && !realistic}
              />
              {['left', 'right'].map((side) => {
                if (!roomForWallSide(plan, wall, side)) return null
                const matId = resolveFaceMaterial(plan, wall, side)
                const item = materialOf('interior', matId)
                const dist = side === 'left' ? offsets.left + 0.018 : offsets.right - 0.018
                const skin = mode === 'solid' ? finishTexture('interior', item.id) : null
                return (
                  <mesh
                    key={`${faceKey}-${side}`}
                    position={[mid.x + nx * dist, y, mid.z + nz * dist]}
                    rotation={[0, yaw, 0]}
                    raycast={noopRaycast}
                    castShadow={realistic}
                    receiveShadow={realistic}
                  >
                    <boxGeometry args={[Math.max(0.05, span - 0.02), height, 0.036]} />
                    <meshStandardMaterial
                      color={skin ? '#ffffff' : item.color}
                      map={skin}
                      roughness={0.78}
                      metalness={0.02}
                      transparent={opacity < 0.98}
                      opacity={opacity}
                    />
                  </mesh>
                )
              })}
            </group>
          )
        })
      })}
    </group>
  )
}

function DoorFrame({ width, height, depth, jamb, pick, realistic }) {
  const frameD = Math.min(0.16, depth)
  return (
    <>
      <mesh userData={{ pick }} position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, Math.max(0.12, depth)]} />
        <meshStandardMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Solid args={[0.05, height, frameD]} position={[-width / 2, height / 2, 0]} color={jamb} pick={pick} realistic={realistic} edges={!realistic} roughness={0.6} />
      <Solid args={[0.05, height, frameD]} position={[width / 2, height / 2, 0]} color={jamb} pick={pick} realistic={realistic} edges={!realistic} roughness={0.6} />
      <Solid args={[width, 0.05, frameD]} position={[0, height - 0.025, 0]} color={jamb} pick={pick} realistic={realistic} edges={!realistic} roughness={0.6} />
    </>
  )
}

function SwingLeaf({ hingeX, extend, rotY, leafW, leafH, height, color, pick, mark, realistic, glass = false }) {
  return (
    <group position={[hingeX, 0, 0]} rotation={[0, rotY, 0]}>
      {glass ? (
        <>
          <Solid args={[leafW, 0.06, 0.04]} position={[extend * leafW / 2, leafH + 0.01, 0]} color={color} pick={pick} mark={mark} realistic={realistic} edges={!realistic} roughness={0.45} />
          <Solid args={[leafW, 0.06, 0.04]} position={[extend * leafW / 2, 0.05, 0]} color={color} pick={pick} realistic={realistic} edges={!realistic} roughness={0.45} />
          <Solid args={[0.05, leafH, 0.04]} position={[extend * 0.03, leafH / 2, 0]} color={color} pick={pick} realistic={realistic} edges={!realistic} roughness={0.45} />
          <Solid args={[0.05, leafH, 0.04]} position={[extend * (leafW - 0.03), leafH / 2, 0]} color={color} pick={pick} realistic={realistic} edges={!realistic} roughness={0.45} />
          <mesh position={[extend * leafW / 2, leafH / 2, 0]} raycast={noopRaycast}>
            <boxGeometry args={[Math.max(0.08, leafW - 0.1), Math.max(0.2, leafH - 0.14), 0.012]} />
            <meshStandardMaterial color="#b7d4ee" roughness={0.08} metalness={0.2} transparent opacity={0.55} />
          </mesh>
        </>
      ) : (
        <Solid args={[leafW, leafH, 0.045]} position={[extend * leafW / 2, leafH / 2 + 0.02, 0]} color={color} pick={pick} mark={mark} realistic={realistic} edges={!realistic} roughness={0.5} />
      )}
      <mesh position={[extend * (leafW - 0.12), height * 0.48, 0.04]} raycast={noopRaycast} castShadow={realistic}>
        <boxGeometry args={[0.03, 0.16, 0.035]} />
        <meshStandardMaterial color="#1c1917" metalness={0.45} roughness={0.35} />
      </mesh>
    </group>
  )
}

function OpeningMesh({ plan, opening, selected, hovered }) {
  const wall = (plan.walls || []).find((item) => item.id === opening.wallId)
  if (!wall) return null
  const len = segmentLength(wall.a, wall.b) || 1
  const dx = (wall.b.x - wall.a.x) / len
  const dz = (wall.b.z - wall.a.z) / len
  const mid = pointAt(wall, opening.offset)
  const yaw = Math.atan2(-dz, dx)
  const sill = opening.kind === 'window' ? (Number.isFinite(opening.sill) ? opening.sill : 0.9) : 0
  const height = opening.height || (opening.kind === 'window' ? 1.2 : 2.1)
  const pick = { kind: 'opening', id: opening.id }
  const colour = openingColour(plan, opening)
  const realistic = finishesOf(plan).sceneStyle !== 'technical'
  const width = Math.max(0.2, opening.width || 0.9)
  const depth = thicknessOf(wall, plan) + 0.04
  const offsets = faceOffsets(wall, thicknessOf(wall, plan))
  const frameShift = (offsets.left + offsets.right) / 2
  const frameX = mid.x + (-dz) * frameShift
  const frameZ = mid.z + dx * frameShift
  const frame = Math.min(0.07, width * 0.08, height * 0.08)
  const finish = finishesOf(plan)
  const box = planBounds(plan)
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const outward = (-dz) * (mid.x - cx) + dx * (mid.z - cz) >= 0 ? 1 : -1
  const glassH = Math.max(0.08, height - frame * 2)
  if (realistic && opening.kind === 'window') {
    const trim = finish.windowColor || '#f4f1ea'
    const face = outward * (depth / 2 - 0.01)
    const bar = (args, position) => (
      <mesh position={position} castShadow receiveShadow raycast={noopRaycast}>
        <boxGeometry args={args} />
        <meshStandardMaterial color={trim} roughness={0.42} metalness={0.05} />
      </mesh>
    )
    return (
      <group position={[frameX, sill + height / 2, frameZ]} rotation={[0, yaw, 0]}>
        <mesh userData={{ pick }} position={[0, 0, face]}>
          <boxGeometry args={[width, height, 0.04]} />
          <meshStandardMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {bar([width + 0.04, 0.08, 0.07], [0, height / 2 - 0.04, face])}
        {bar([width + 0.04, 0.08, 0.07], [0, -height / 2 + 0.04, face])}
        {bar([0.08, height, 0.07], [-width / 2 + 0.04, 0, face])}
        {bar([0.08, height, 0.07], [width / 2 - 0.04, 0, face])}
        {bar([0.045, glassH, 0.05], [0, 0, face])}
        <mesh position={[0, 0, face + outward * 0.02]} raycast={noopRaycast}>
          <boxGeometry args={[Math.max(0.08, width - 0.18), Math.max(0.08, height - 0.18), 0.02]} />
          <meshStandardMaterial color="#b7d4ee" roughness={0.08} metalness={0.25} transparent opacity={0.78} />
        </mesh>
        <mesh position={[0, -height / 2 - 0.03, outward * (depth / 2 + 0.04)]} raycast={noopRaycast} castShadow>
          <boxGeometry args={[width + 0.1, 0.06, 0.16]} />
          <meshStandardMaterial color={trim} roughness={0.5} metalness={0.04} />
        </mesh>
      </group>
    )
  }
  if (opening.kind === 'door') {
    const mark = markOf(selected, hovered, pick)
    const style = doorStyleOf(opening)
    const face = realistic ? colour.color : '#f8fafc'
    const jamb = realistic ? '#e7e5e4' : '#e2e8f0'
    const leafH = Math.max(0.5, height - 0.08)
    const slide = (opening.swing || 1) >= 0 ? 1 : -1
    const faceZ = (opening.inward ? -outward : outward) * (depth / 2 + 0.04)
    const leafProps = { height, color: face, pick, mark, realistic }
    let body = null
    if (style === 'double') {
      const leafW = Math.max(0.22, width / 2 - 0.06)
      const left = doorLeafPose({ ...opening, swing: 1, width }, outward)
      const right = doorLeafPose({ ...opening, swing: -1, width }, outward)
      body = (
        <>
          <SwingLeaf hingeX={-width / 2} extend={left.extend} rotY={left.rotY} leafW={leafW} leafH={leafH} {...leafProps} />
          <SwingLeaf hingeX={width / 2} extend={right.extend} rotY={right.rotY} leafW={leafW} leafH={leafH} {...leafProps} />
        </>
      )
    } else if (style === 'glass') {
      const pose = doorLeafPose(opening, outward)
      body = <SwingLeaf hingeX={pose.hingeX} extend={pose.extend} rotY={pose.rotY} leafW={Math.max(0.25, width - 0.1)} leafH={leafH} glass {...leafProps} />
    } else if (style === 'folding') {
      const count = 4
      const panelW = width / count
      body = (
        <>
          {Array.from({ length: count }, (_, index) => (
            <group key={index} position={[-width / 2 + panelW * (index + 0.5), 0, faceZ * 0.65]} rotation={[0, (index % 2 === 0 ? 0.7 : -0.7) * slide, 0]}>
              <Solid args={[panelW * 0.9, leafH, 0.03]} position={[0, leafH / 2 + 0.02, 0]} color={face} pick={pick} mark={index === 0 ? mark : undefined} realistic={realistic} edges={!realistic} roughness={0.5} />
            </group>
          ))}
        </>
      )
    } else if (style === 'sliding' || style === 'patio') {
      const panels = style === 'patio' ? 2 : (opening.panels === 2 ? 2 : 1)
      const pocket = style === 'sliding' && opening.slideMount !== 'surface'
      const panelW = panels === 2 ? width / 2 - 0.04 : width * 0.92
      const shift = slide * (panels === 2 ? width * 0.22 : width * 0.38)
      const z = pocket ? outward * 0.02 : faceZ
      const glassPanel = (x, key, moved) => (
        <group key={key} position={[x, 0, z]}>
          <Solid args={[panelW, 0.05, 0.04]} position={[0, leafH + 0.01, 0]} color={style === 'patio' ? '#d6d3d1' : face} pick={pick} realistic={realistic} edges={!realistic} roughness={0.4} />
          <Solid args={[panelW, 0.05, 0.04]} position={[0, 0.05, 0]} color={style === 'patio' ? '#d6d3d1' : face} pick={pick} realistic={realistic} edges={!realistic} roughness={0.4} />
          <mesh position={[0, leafH / 2, 0]} raycast={noopRaycast}>
            <boxGeometry args={[Math.max(0.08, panelW - 0.08), Math.max(0.2, leafH - 0.12), 0.015]} />
            <meshStandardMaterial color={style === 'patio' ? '#c5e4f7' : face} roughness={style === 'patio' ? 0.06 : 0.5} metalness={style === 'patio' ? 0.15 : 0.02} transparent={style === 'patio'} opacity={style === 'patio' ? 0.62 : 1} />
          </mesh>
          {moved && <mesh position={[slide * panelW * 0.28, height * 0.48, 0.03]} raycast={noopRaycast}><boxGeometry args={[0.08, 0.04, 0.03]} /><meshStandardMaterial color="#1c1917" /></mesh>}
        </group>
      )
      body = (
        <>
          <Solid args={[width + (panels === 2 ? width * 0.55 : width * 0.7), 0.025, 0.03]} position={[shift * 0.35, height - 0.02, z]} color="#a8a29e" pick={pick} realistic={realistic} edges={!realistic} roughness={0.45} />
          {panels === 2 ? (
            <>
              {glassPanel(slide > 0 ? -width / 4 : width / 4, 'fixed', false)}
              {glassPanel((slide > 0 ? width / 4 : -width / 4) + shift * 0.35, 'moved', true)}
            </>
          ) : glassPanel(shift, 'panel', true)}
        </>
      )
    } else {
      const pose = doorLeafPose(opening, outward)
      body = <SwingLeaf hingeX={pose.hingeX} extend={pose.extend} rotY={pose.rotY} leafW={Math.max(0.25, width - 0.1)} leafH={leafH} {...leafProps} />
    }
    return (
      <group position={[frameX, 0, frameZ]} rotation={[0, yaw, 0]}>
        <DoorFrame width={width} height={height} depth={depth} jamb={jamb} pick={pick} realistic={realistic} />
        {body}
      </group>
    )
  }
  return (
    <group position={[frameX, sill + height / 2, frameZ]} rotation={[0, yaw, 0]}>
      <Solid
        args={opening.kind === 'window' ? [width, height, 0.06] : [width * 0.96, height, 0.05]}
        position={[0, 0, opening.kind === 'window' ? 0 : outward * 0.02]}
        color={realistic ? colour.color : '#f8fafc'}
        pick={pick}
        mark={markOf(selected, hovered, pick)}
        edges={!realistic && opening.kind !== 'window'}
        realistic={realistic}
        roughness={0.55}
      />
      {opening.kind === 'window' && (
        <mesh position={[0, 0, 0.02]} raycast={noopRaycast}>
          <boxGeometry args={[glassW, glassH, 0.012]} />
          <meshStandardMaterial color="#e2e8f0" roughness={0.2} />
        </mesh>
      )}
    </group>
  )
}

function FloorMesh({ room, translucent, selected, hovered }) {
  const finish = materialOf('floor', room.floorId)
  const map = finishTexture('floor', finish.id)
  const geom = useMemo(() => {
    const shape = new THREE.Shape()
    ;(room.polygon || []).forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, -point.z)
      else shape.lineTo(point.x, -point.z)
    })
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [room])
  if (!room.polygon || room.polygon.length < 3) return null
  const pick = { kind: 'room', id: room.id }
  const mark = markOf(selected, hovered, pick)
  return (
    <mesh geometry={geom} position={[0, 0.012, 0]} receiveShadow={false} userData={{ pick }}>
      <meshLambertMaterial
        color={mark === 'selected' ? '#5eead4' : mark === 'hover' ? '#99f6e4' : finish.color}
        emissive={mark === 'selected' ? '#115e59' : '#000000'}
        emissiveIntensity={mark === 'selected' ? 0.45 : 0}
        map={mark || translucent ? null : map}
        transparent={Boolean(translucent) && !mark}
        opacity={translucent && !mark ? 0.28 : 1}
        depthWrite={!translucent || Boolean(mark)}
        side={THREE.DoubleSide}
      />
      {mark && <Edges threshold={1} color={mark === 'selected' ? '#0f766e' : '#14b8a6'} />}
    </mesh>
  )
}

function roofGeometry(model) {
  const positions = []
  const normals = []
  const uvs = []
  const up = new THREE.Vector3(0, 1, 0)
  roofFaces(model).forEach((face) => {
    const a = new THREE.Vector3(...face[0])
    const b = new THREE.Vector3(...face[1])
    const c = new THREE.Vector3(...face[2])
    const normal = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize()
    // Courses follow the eave: the horizontal axis in the face. The other axis
    // runs up the slope, in metres, so hip ends match the main slopes.
    const along = new THREE.Vector3().crossVectors(normal, up)
    if (along.lengthSq() < 1e-8) along.set(1, 0, 0)
    else along.normalize()
    let rise = new THREE.Vector3().crossVectors(along, normal)
    if (rise.y < 0) {
      along.negate()
      rise = new THREE.Vector3().crossVectors(along, normal)
    }
    rise.normalize()
    ;[a, b, c].forEach((point) => {
      positions.push(point.x, point.y, point.z)
      normals.push(normal.x, normal.y, normal.z)
      uvs.push(point.dot(along), point.dot(rise))
    })
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2))
  return geometry
}

function roofEdgeSpecs(model) {
  return roofOutline(model).map((edge) => {
    const a = new THREE.Vector3(...edge.a)
    const b = new THREE.Vector3(...edge.b)
    const length = Math.max(0.02, a.distanceTo(b))
    const mid = a.clone().add(b).multiplyScalar(0.5)
    const direction = b.clone().sub(a).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return { position: mid.toArray(), quaternion: quaternion.toArray(), length }
  })
}

function framedCamera(plan, aspect) {
  const model = roofModel(plan)
  const box = planBounds(plan)
  const target = new THREE.Vector3((box.minX + box.maxX) / 2, 1.25, (box.minZ + box.maxZ) / 2)
  const points = []
  roofOutline(model).forEach((edge) => {
    points.push(new THREE.Vector3(...edge.a), new THREE.Vector3(...edge.b))
  })
  ;[
    [box.minX, 0, box.minZ],
    [box.maxX, 0, box.minZ],
    [box.maxX, 0, box.maxZ],
    [box.minX, 0, box.maxZ],
  ].forEach((point) => points.push(new THREE.Vector3(...point)))
  const dir = new THREE.Vector3(model.alongX ? 1.05 : 0.78, 0.56, model.alongX ? 0.74 : 1.05).normalize()
  const cam = new THREE.PerspectiveCamera(30, Math.max(0.7, aspect || 1.2), 0.08, 400)
  let lo = 8
  let hi = 96
  for (let i = 0; i < 22; i += 1) {
    const dist = (lo + hi) / 2
    cam.position.copy(target).addScaledVector(dir, dist)
    cam.up.set(0, 1, 0)
    cam.lookAt(target)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()
    const fits = points.every((point) => {
      const projected = point.clone().project(cam)
      return projected.z < 1 && projected.x > -0.82 && projected.x < 0.82 && projected.y > -0.78 && projected.y < 0.78
    })
    if (fits) hi = dist
    else lo = dist
  }
  return {
    position: target.clone().addScaledVector(dir, hi * 1.06).toArray(),
    target: target.toArray(),
  }
}

function RoofMesh({ plan, mode, selected, hovered }) {
  const model = roofModel(plan)
  const finish = roofLook(plan)
  const realistic = finishesOf(plan).sceneStyle !== 'technical' && mode === 'solid'
  const ghost = mode === 'ghost'
  const map = realistic ? roofSurface(finish) : null
  const key = [model.type, model.minX, model.maxX, model.minZ, model.maxZ, model.rise, model.overhang, model.alongX, model.wallHeight].join(':')
  const geom = useMemo(() => roofGeometry(roofModel(plan)), [key])
  const edgeSpecs = useMemo(() => roofEdgeSpecs(roofModel(plan)), [key])
  const box = planBounds(plan)
  const ceiling = useMemo(() => {
    const shape = new THREE.Shape()
    const inset = 0.08
    shape.moveTo(box.minX + inset, -(box.minZ + inset))
    shape.lineTo(box.maxX - inset, -(box.minZ + inset))
    shape.lineTo(box.maxX - inset, -(box.maxZ - inset))
    shape.lineTo(box.minX + inset, -(box.maxZ - inset))
    const geometry = new THREE.ShapeGeometry(shape)
    geometry.rotateX(-Math.PI / 2)
    return geometry
  }, [box.minX, box.maxX, box.minZ, box.maxZ])
  if (mode === 'hidden') return null
  const pick = { kind: 'roof', id: 'roof' }
  const mark = markOf(selected, hovered, pick)
  return (
    <group>
      <mesh geometry={geom} userData={{ pick }} castShadow={realistic} receiveShadow={realistic} raycast={ghost ? noopRaycast : undefined}>
        <meshStandardMaterial
          color={mark === 'selected' ? '#5eead4' : mark === 'hover' ? '#99f6e4' : ghost || !realistic || !map ? (ghost || !realistic ? '#e2e8f0' : finish.color) : '#ffffff'}
          emissive={mark === 'selected' ? '#115e59' : '#000000'}
          emissiveIntensity={mark === 'selected' ? 0.35 : 0}
          map={mark ? null : map}
          roughness={finish.pattern === 'seam' || finish.pattern === 'corrugated' ? 0.38 : 0.72}
          metalness={finish.pattern === 'seam' || finish.pattern === 'corrugated' || finish.pattern === 'tile-metal' ? 0.35 : 0.04}
          side={THREE.DoubleSide}
          transparent={ghost && !mark}
          opacity={ghost && !mark ? 0.15 : 1}
          depthWrite={!ghost || Boolean(mark)}
        />
        {mark && <Edges threshold={15} color={mark === 'selected' ? '#0f766e' : '#14b8a6'} />}
      </mesh>
      {!realistic && edgeSpecs.map((edge, index) => (
        <mesh key={index} position={edge.position} quaternion={edge.quaternion}>
          <boxGeometry args={[0.045, edge.length, 0.045]} />
          <meshBasicMaterial color={realistic ? finishesOf(plan).trimColor : '#1e293b'} />
        </mesh>
      ))}
      {!ghost && (
        <mesh geometry={ceiling} position={[0, model.wallHeight - 0.02, 0]}>
          <meshLambertMaterial color="#f8fafc" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function FixtureBody({ body, w, d, h = 0.8 }) {
  const box = (size, position, color, opacity = 1) => (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} />
      {opacity >= 1 && <Edges threshold={18} color="#334155" />}
    </mesh>
  )
  const cyl = (r, height, position, color) => (
    <mesh position={position}>
      <cylinderGeometry args={[r, r, height, 20]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
  const alias = {
    hob: 'stove',
    'base-cab': 'cabinet',
    appliance: 'dishwasher',
    vanity: 'basin',
    desk: 'table',
    coffee: 'table',
    night: 'cabinet',
    dresser: 'cabinet',
    low: 'cabinet',
    freezer: 'fridge',
    washer: 'dishwasher',
  }
  const type = alias[body] || body || 'box'
  if (type === 'bed') {
    return (
      <group>
        {box([w, 0.28, d * 0.78], [0, 0.22, d * 0.08], '#f8fafc')}
        {box([w * 0.9, 0.12, d * 0.2], [0, 0.4, -d * 0.36], '#e2e8f0')}
      </group>
    )
  }
  if (type === 'sofa') {
    return (
      <group>
        {box([w, 0.32, d * 0.72], [0, 0.28, d * 0.1], '#e7e5e4')}
        {box([w, 0.42, d * 0.22], [0, 0.52, -d * 0.36], '#d6d3d1')}
        {box([w * 0.08, 0.28, d * 0.7], [-w * 0.46, 0.46, d * 0.08], '#d6d3d1')}
        {box([w * 0.08, 0.28, d * 0.7], [w * 0.46, 0.46, d * 0.08], '#d6d3d1')}
      </group>
    )
  }
  if (type === 'table') {
    return (
      <group>
        {box([w, 0.06, d], [0, 0.74, 0], '#d6d3d1')}
        {box([0.06, 0.7, 0.06], [-w * 0.4, 0.36, -d * 0.38], '#a8a29e')}
        {box([0.06, 0.7, 0.06], [w * 0.4, 0.36, -d * 0.38], '#a8a29e')}
        {box([0.06, 0.7, 0.06], [-w * 0.4, 0.36, d * 0.38], '#a8a29e')}
        {box([0.06, 0.7, 0.06], [w * 0.4, 0.36, d * 0.38], '#a8a29e')}
      </group>
    )
  }
  if (type === 'chair') {
    return (
      <group>
        {box([w * 0.86, 0.06, d * 0.86], [0, 0.46, 0], '#e7e5e4')}
        {box([w * 0.86, 0.4, 0.06], [0, 0.7, -d * 0.4], '#d6d3d1')}
        {box([0.04, 0.44, 0.04], [-w * 0.34, 0.22, -d * 0.34], '#a8a29e')}
        {box([0.04, 0.44, 0.04], [w * 0.34, 0.22, -d * 0.34], '#a8a29e')}
        {box([0.04, 0.44, 0.04], [-w * 0.34, 0.22, d * 0.34], '#a8a29e')}
        {box([0.04, 0.44, 0.04], [w * 0.34, 0.22, d * 0.34], '#a8a29e')}
      </group>
    )
  }
  if (type === 'toilet') {
    return (
      <group>
        {box([w * 0.7, 0.4, d * 0.28], [0, 0.4, -d * 0.34], '#f8fafc')}
        {box([w * 0.78, 0.28, d * 0.55], [0, 0.22, d * 0.08], '#f8fafc')}
      </group>
    )
  }
  if (type === 'basin' || type === 'sink') {
    return (
      <group>
        {box([w, 0.08, d], [0, 0.86, 0], '#f8fafc')}
        {box([w, 0.04, 0.028], [0, 0.835, d * 0.48], '#94a3b8')}
        {box([w * 0.55, 0.07, d * 0.42], [0, 0.8, 0.01], '#cbd5e1')}
        {box([0.08, 0.82, d * 0.72], [-w * 0.42, 0.42, 0], '#e7e5e4')}
        {box([0.08, 0.82, d * 0.72], [w * 0.42, 0.42, 0], '#e7e5e4')}
      </group>
    )
  }
  if (type === 'stove') {
    return (
      <group>
        {box([w, 0.9, d], [0, 0.45, 0], '#f5f5f4')}
        {[[-0.14, -0.12], [0.14, -0.12], [-0.14, 0.12], [0.14, 0.12]].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, 0.91, z]}>
            <cylinderGeometry args={[0.08, 0.08, 0.02, 20]} />
            <meshLambertMaterial color="#292524" />
          </mesh>
        ))}
      </group>
    )
  }
  if (type === 'fridge') return box([w, Math.max(h, 1.7), d], [0, Math.max(h, 1.7) / 2, 0], '#f8fafc')
  if (type === 'dishwasher') return box([w, 0.86, d], [0, 0.43, 0], '#e2e8f0')
  if (type === 'cabinet' || type === 'island') {
    return (
      <group>
        {box([w * 0.96, 0.78, d * 0.92], [0, 0.39, 0.02], '#f5f5f4')}
        {box([w, 0.045, d], [0, 0.84, 0], '#e7e5e4')}
        {box([w, 0.028, 0.035], [0, 0.8, d * 0.48], '#a8a29e')}
      </group>
    )
  }
  if (type === 'bath') return box([w, 0.5, d], [0, 0.28, 0], '#f8fafc')
  if (type === 'bench') {
    return (
      <group>
        {[0, 1, 2, 3].map((index) => (
          <group key={index}>
            {box([w, 0.045, d * 0.14], [0, 0.72, -d * 0.36 + index * d * 0.24], '#d6c4a8')}
          </group>
        ))}
        {box([0.06, 0.7, 0.06], [-w * 0.42, 0.35, -d * 0.32], '#a89070')}
        {box([0.06, 0.7, 0.06], [w * 0.42, 0.35, -d * 0.32], '#a89070')}
        {box([0.06, 0.7, 0.06], [-w * 0.42, 0.35, d * 0.32], '#a89070')}
        {box([0.06, 0.7, 0.06], [w * 0.42, 0.35, d * 0.32], '#a89070')}
      </group>
    )
  }
  if (type === 'heater') {
    return (
      <group>
        {box([w, 0.55, d], [0, 0.28, 0], '#44403c')}
        {[[-0.1, -0.08], [0.08, -0.06], [0, 0.08], [0.1, 0.05], [-0.08, 0.07]].map(([x, z], index) => (
          <mesh key={index} position={[x, 0.64, z]}>
            <sphereGeometry args={[0.07, 12, 10]} />
            <meshLambertMaterial color={index % 2 ? '#78716c' : '#57534e'} />
          </mesh>
        ))}
      </group>
    )
  }
  if (type === 'shower' || type === 'shower-cabin' || type === 'shower-corner' || type === 'shower-walk' || type === 'shower-screen') {
    return (
      <group>
        {box([w, 0.08, d], [0, 0.04, 0], '#e2e8f0')}
        {box([w * 0.92, h || 1.9, 0.02], [0, (h || 1.9) / 2, -d * 0.46], '#e0f2fe', 0.35)}
        {type !== 'shower-screen' && box([0.02, h || 1.9, d * 0.9], [-w * 0.46, (h || 1.9) / 2, 0], '#e0f2fe', 0.35)}
        {cyl(0.03, 0.16, [w * 0.2, 1.85, -d * 0.15], '#94a3b8')}
      </group>
    )
  }
  if (type === 'sauna-bench' || type === 'sauna-bench-3') {
    return (
      <group>
        {box([w, 0.04, d * 0.42], [0, 0.45, d * 0.2], '#d6c4a8')}
        {box([w, 0.04, d * 0.42], [0, 0.9, -d * 0.18], '#c4a882')}
        {type === 'sauna-bench-3' && box([w, 0.04, d * 0.28], [0, 1.15, -d * 0.32], '#b08968')}
        {box([0.06, 0.9, 0.06], [-w * 0.42, 0.45, 0], '#a89070')}
        {box([0.06, 0.9, 0.06], [w * 0.42, 0.45, 0], '#a89070')}
      </group>
    )
  }
  if (type === 'wardrobe' || type === 'tall' || type === 'slider') {
    return (
      <group>
        {box([w, h || 2.1, d], [0, (h || 2.1) / 2, 0], '#e7e5e4')}
        {box([0.02, (h || 2.1) * 0.92, 0.015], [0, (h || 2.1) / 2, d * 0.5], '#a8a29e')}
      </group>
    )
  }
  if (type === 'wall-cab') return box([w, h || 0.7, d], [0, 1.55, 0], '#f5f5f4')
  if (type === 'tv') return box([w, h || 0.65, Math.max(d, 0.04)], [0, 1.15, 0], '#1c1917')
  if (type === 'rug') return box([w, 0.02, d], [0, 0.01, 0], '#b08968')
  if (type === 'car') {
    return (
      <group>
        {box([w * 0.92, 0.45, d * 0.55], [0, 0.55, 0], '#334155')}
        {box([w * 0.96, 0.35, d * 0.92], [0, 0.28, 0], '#1e293b')}
        {[[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => (
          <mesh key={`${sx}${sz}`} position={[sx * w * 0.42, 0.18, sz * d * 0.28]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.18, 0.18, 0.14, 16]} />
            <meshLambertMaterial color="#0f172a" />
          </mesh>
        ))}
      </group>
    )
  }
  if (type === 'fireplace') {
    return (
      <group>
        {box([w, h || 1.2, d], [0, (h || 1.2) / 2, 0], '#57534e')}
        {box([w * 0.46, 0.42, 0.08], [0, 0.38, d * 0.42], '#292524')}
      </group>
    )
  }
  if (type === 'armchair' || type === 'sofa-corner' || type === 'divan') {
    return (
      <group>
        {box([w * 0.9, 0.28, d * 0.72], [0, 0.32, d * 0.06], '#d6d3d1')}
        {box([w * 0.9, 0.36, d * 0.22], [0, 0.55, -d * 0.34], '#a8a29e')}
      </group>
    )
  }
  if (type === 'bunk') {
    return (
      <group>
        {box([w, 0.12, d], [0, 0.4, 0], '#f8fafc')}
        {box([w, 0.12, d], [0, 1.15, 0], '#f8fafc')}
        {box([0.05, 1.4, 0.05], [-w * 0.46, 0.7, -d * 0.46], '#a8a29e')}
        {box([0.05, 1.4, 0.05], [w * 0.46, 0.7, -d * 0.46], '#a8a29e')}
        {box([0.05, 1.4, 0.05], [-w * 0.46, 0.7, d * 0.46], '#a8a29e')}
        {box([0.05, 1.4, 0.05], [w * 0.46, 0.7, d * 0.46], '#a8a29e')}
      </group>
    )
  }
  if (type === 'lamp') {
    return (
      <group>
        {cyl(0.025, 1.35, [0, 0.68, 0], '#a8a29e')}
        {cyl(0.16, 0.18, [0, 1.42, 0], '#f8fafc')}
      </group>
    )
  }
  if (type === 'hood') return box([w, 0.12, Math.min(d, 0.45)], [0, 1.55, -d * 0.05], '#e7e5e4')
  if (type === 'towel-rad') {
    return (
      <group>
        {box([0.03, h || 1.1, 0.03], [-w * 0.4, 0.9, 0], '#cbd5e1')}
        {box([0.03, h || 1.1, 0.03], [w * 0.4, 0.9, 0], '#cbd5e1')}
        {[0, 1, 2, 3, 4].map((index) => (
          <group key={index}>{box([w * 0.8, 0.02, 0.02], [0, 0.55 + index * 0.16, 0], '#e2e8f0')}</group>
        ))}
      </group>
    )
  }
  if (type === 'heater-wood') {
    return (
      <group>
        {box([w, 0.7, d], [0, 0.35, 0], '#44403c')}
        {box([w * 0.7, 0.08, d * 0.15], [0, 0.78, d * 0.1], '#292524')}
        {box([w * 0.55, 0.22, 0.04], [0, 0.32, d * 0.48], '#1c1917')}
      </group>
    )
  }
  if (type === 'insert') {
    return (
      <group>
        {box([w, 0.62, 0.08], [0, 0.32, -d * 0.42], '#57534e')}
        {box([0.08, 0.62, d * 0.86], [-w * 0.46, 0.32, 0], '#44403c')}
        {box([0.08, 0.62, d * 0.86], [w * 0.46, 0.32, 0], '#44403c')}
        {box([w * 0.84, 0.06, d * 0.7], [0, 0.04, 0], '#292524')}
        {box([w * 0.22, 0.22, 0.05], [0, 0.2, 0.02], '#f97316')}
      </group>
    )
  }
  if (type === 'kamiina') {
    return (
      <group>
        {cyl(Math.min(w, d) * 0.42, 0.62, [0, 0.46, 0], '#334155')}
        {box([w * 0.38, 0.22, 0.04], [0, 0.42, d * 0.36], '#0f172a')}
        {cyl(0.045, 0.22, [0, 0.88, -d * 0.08], '#1e293b')}
        {cyl(0.03, 0.14, [-w * 0.28, 0.07, d * 0.22], '#1e293b')}
        {cyl(0.03, 0.14, [w * 0.28, 0.07, d * 0.22], '#1e293b')}
        {cyl(0.03, 0.14, [-w * 0.28, 0.07, -d * 0.22], '#1e293b')}
        {cyl(0.03, 0.14, [w * 0.28, 0.07, -d * 0.22], '#1e293b')}
      </group>
    )
  }
  if (type === 'leivinuuni') {
    return (
      <group>
        {box([w, h || 1.4, d], [0, (h || 1.4) / 2, 0], '#e7e5e4')}
        {box([w * 0.4, 0.22, 0.06], [0, 0.55, d * 0.48], '#292524')}
      </group>
    )
  }
  if (type === 'puuhella') {
    return (
      <group>
        {box([w, 0.8, d], [0, 0.4, 0], '#f5f5f4')}
        {[-0.16, 0.16].map((x) => (
          <mesh key={x} position={[x, 0.82, -d * 0.08]}>
            <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
            <meshLambertMaterial color="#1c1917" />
          </mesh>
        ))}
      </group>
    )
  }
  if (type === 'kakluuni') {
    return (
      <group>
        {box([w, h || 1.7, d], [0, (h || 1.7) / 2, 0], '#f8fafc')}
        {[0.3, 0.55, 0.8].map((t) => <group key={t}>{box([w * 1.01, 0.015, d * 1.01], [0, (h || 1.7) * t, 0], '#cbd5e1')}</group>)}
      </group>
    )
  }
  if (type === 'mirror' || type === 'mirror-cab') return box([w, h || 0.7, Math.max(d, 0.04)], [0, 1.45, 0], '#e2e8f0')
  if (type === 'office-chair') {
    return (
      <group>
        {cyl(Math.min(w, d) * 0.32, 0.06, [0, 0.48, 0], '#1c1917')}
        {box([w * 0.7, 0.4, 0.06], [0, 0.78, -d * 0.28], '#334155')}
        {cyl(0.04, 0.4, [0, 0.24, 0], '#64748b')}
      </group>
    )
  }
  return box([w, h || 0.8, d], [0, (h || 0.8) / 2, 0], '#f5f5f4')
}

function penetrationYs(plan, top) {
  const step = plan?.floorHeight || 2.6
  const floors = Math.max(1, plan?.floors || 1)
  const ys = []
  for (let level = 1; level <= floors; level += 1) {
    const y = level * step
    if (y > 0.2 && y < top - 0.15) ys.push(y)
  }
  return ys
}

function ChimneyShaft({ fixture, plan, w, d }) {
  const pose = chimneyTop(plan, fixture)
  const height = Math.max(0.8, pose.top)
  const kind = chimneyKind(fixture)
  const flues = Number(fixture.flues) >= 2 ? 2 : 1
  const color = fixture.color || (kind === 'steel' ? '#64748b' : kind === 'element' ? '#e7e5e4' : '#9c341f')
  const rings = penetrationYs(plan, height)
  if (kind === 'steel') {
    const radius = Math.min(w, d) / (flues === 2 ? 4 : 2)
    const spots = flues === 2 ? [-w * 0.25, w * 0.25] : [0]
    return (
      <group>
        {spots.map((x) => (
          <group key={x}>
            <mesh position={[x, height / 2, 0]}>
              <cylinderGeometry args={[radius * 0.92, radius * 0.92, height, 20]} />
              <meshLambertMaterial color={color} />
            </mesh>
            <mesh position={[x, height + 0.08, 0]}>
              <cylinderGeometry args={[radius * 1.35, radius * 0.55, 0.12, 20]} />
              <meshLambertMaterial color="#334155" />
            </mesh>
          </group>
        ))}
        {rings.map((y) => (
          <mesh key={y} position={[0, y, 0]}>
            <boxGeometry args={[w + 0.08, 0.04, d + 0.08]} />
            <meshLambertMaterial color="#a8a29e" />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[w, height, d]} />
        <meshLambertMaterial color={color} />
      </mesh>
      <mesh position={[0, height + 0.07, 0]}>
        <boxGeometry args={[w + 0.12, 0.12, d + 0.12]} />
        <meshLambertMaterial color="#44403c" />
      </mesh>
      {Array.from({ length: flues }, (_, index) => {
        const x = flues === 2 ? (index === 0 ? -w * 0.2 : w * 0.2) : 0
        const pot = Math.min(w, d) * 0.28
        return (
          <mesh key={index} position={[x, height + 0.22, 0]}>
            <boxGeometry args={[pot, 0.2, pot]} />
            <meshLambertMaterial color="#292524" />
          </mesh>
        )
      })}
      {rings.map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[w + 0.1, 0.05, d + 0.1]} />
          <meshLambertMaterial color="#57534e" />
        </mesh>
      ))}
    </group>
  )
}

function FixtureMesh({ fixture, plan, selected, hovered, dim = false }) {
  const tpl = fixtureTemplate(fixture.type)
  const variant = (tpl.variants || []).find((entry) => entry.id === fixture.variant) || tpl.variants?.[0]
  const w = fixture.w || variant?.w || tpl.w
  const d = fixture.d || variant?.d || tpl.d
  const h = fixture.h || variant?.h || tpl.h || 0.8
  const body = variant?.body || tpl.body || variant?.symbol || tpl.symbol || fixture.type
  const draw = drawingOf(fixture)
  const pick = { kind: 'fixture', id: fixture.id }
  const mark = markOf(selected, hovered, pick)
  const hearth = draw.hearth
  const plateW = hearth ? w + (hearth.side || 0) * 2 : 0
  const plateD = hearth ? d + (hearth.front || 0) : 0
  return (
    <group position={[fixture.x, 0, fixture.z]} rotation={[0, ((fixture.rotation || 0) * Math.PI) / 180, 0]} scale={[fixture.mirror ? -1 : 1, 1, 1]} userData={dim ? undefined : { pick }}>
      {hearth && (
        <mesh position={[0, 0.012, -d / 2 + plateD / 2]}>
          <boxGeometry args={[plateW, 0.02, plateD]} />
          <meshLambertMaterial color="#3f3f46" />
        </mesh>
      )}
      {draw.shield && (
        <mesh position={[0, 0.75, -d / 2 - 0.025]}>
          <boxGeometry args={[w + 0.06, 1.2, 0.025]} />
          <meshLambertMaterial color="#e7e5e4" />
        </mesh>
      )}
      {draw.chimney ? <ChimneyShaft fixture={fixture} plan={plan} w={w} d={d} /> : <FixtureBody body={body} w={w} d={d} h={h} />}
      {mark && (
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[w + (mark === 'selected' ? 0.14 : 0.07), 0.95, d + (mark === 'selected' ? 0.14 : 0.07)]} />
          <meshBasicMaterial color={mark === 'selected' ? '#0f766e' : '#14b8a6'} wireframe />
        </mesh>
      )}
    </group>
  )
}

function RoomLabels({ plan }) {
  const display = normalizeDisplay(plan.display)
  const labels = layoutRoomLabels(visibleRooms(plan), {
    ratio: 100,
    showNames: display.roomNames,
    showAreas: display.areas,
    obstacles: labelObstacles(plan, 22),
  })
  const halo = { textShadow: '0 0 2px #fbfaf7, 0 0 2px #fbfaf7, 0 0 3px #fbfaf7' }
  return labels.map((label) => (
    <Html key={label.id} position={[label.x, 0.12, label.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: '#1c1917', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
        {label.text && <div style={{ fontWeight: 700, fontSize: 12, ...(label.halo ? halo : {}) }}>{label.text}</div>}
        {label.area && <div style={{ fontSize: 10, color: '#44403c', ...(label.halo ? halo : {}) }}>{label.area}</div>}
      </div>
    </Html>
  ))
}

function FrameCamera({ plan, fitToken, controlsRef }) {
  const camera = useThree((state) => state.camera)
  const planRef = useRef(plan)
  planRef.current = plan
  useLayoutEffect(() => {
    const view = framedCamera(planRef.current, camera.aspect || 1.2)
    camera.position.set(...view.position)
    camera.fov = 30
    camera.near = 0.08
    camera.far = 400
    camera.updateProjectionMatrix()
    camera.lookAt(...view.target)
    const controls = controlsRef.current
    if (controls) {
      controls.target.set(...view.target)
      controls.update()
    }
  }, [fitToken, camera, controlsRef])
  return null
}

function pixelsPerMetre(camera, gl, world) {
  const rect = gl.domElement.getBoundingClientRect()
  const origin = world.clone()
  const shifted = world.clone()
  shifted.x += 1
  origin.project(camera)
  shifted.project(camera)
  const dx = (shifted.x - origin.x) * rect.width * 0.5
  const dy = (shifted.y - origin.y) * rect.height * 0.5
  return Math.max(1, Math.hypot(dx, dy))
}

function CursorMode({ drawMode }) {
  const gl = useThree((state) => state.gl)
  useLayoutEffect(() => {
    const el = gl.domElement
    const prev = el.style.cursor
    el.style.cursor = drawMode ? 'crosshair' : ''
    return () => { el.style.cursor = prev }
  }, [drawMode, gl])
  return null
}

function FloorCursor({ point, ppm, kind }) {
  if (!point) return null
  const arm = 18 / Math.max(ppm || 40, 1)
  const mark = 8 / Math.max(ppm || 40, 1)
  return (
    <group position={[point.x, 0.04, point.z]}>
      <mesh renderOrder={20}>
        <boxGeometry args={[arm * 2, 0.02, Math.max(0.01, arm * 0.08)]} />
        <meshBasicMaterial color="#0f766e" depthTest={false} />
      </mesh>
      <mesh renderOrder={20}>
        <boxGeometry args={[Math.max(0.01, arm * 0.08), 0.02, arm * 2]} />
        <meshBasicMaterial color="#0f766e" depthTest={false} />
      </mesh>
      {kind === 'corner' && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={21}>
          <ringGeometry args={[mark, mark * 1.45, 4]} />
          <meshBasicMaterial color="#0f766e" depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {kind === 'midpoint' && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={21}>
          <circleGeometry args={[mark, 3]} />
          <meshBasicMaterial color="#0f766e" depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function EditBridge({ drawMode, controlsRef, onSelect, onContext, onHover, onPreview, onPlace, onFixtureDrag, onOpeningDrag, onYardDrag, onServiceDrag, onDropFixture }) {
  const { camera, gl, scene } = useThree()
  const handlers = useRef({})
  handlers.current = { drawMode, onSelect, onContext, onHover, onPreview, onPlace, onFixtureDrag, onOpeningDrag, onYardDrag, onServiceDrag, onDropFixture }
  useLayoutEffect(() => {
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const hitPoint = new THREE.Vector3()
    let down = null
    let drag = null
    let frame = 0
    const aim = (event) => {
      const rect = gl.domElement.getBoundingClientRect()
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
      pointer.y = -((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
    }
    const floor = () => {
      if (!raycaster.ray.intersectPlane(plane, hitPoint)) return null
      return { x: hitPoint.x, z: hitPoint.z, ppm: pixelsPerMetre(camera, gl, hitPoint) }
    }
    const read = () => {
      const hits = raycaster.intersectObjects(scene.children, true)
      for (const hit of hits) {
        let node = hit.object
        while (node) {
          if (node.userData?.pick) return { ...node.userData.pick, point: { x: hit.point.x, y: hit.point.y, z: hit.point.z } }
          node = node.parent
        }
      }
      return { kind: 'house', id: 'house' }
    }
    const onPointerDown = (event) => {
      if (event.button !== 0) return
      aim(event)
      down = { x: event.clientX, y: event.clientY }
      if (handlers.current.drawMode) return
      const pick = read()
      const serviceDrag = pick?.kind === 'service' && ['vertex', 'segment', 'run', 'node'].includes(pick.service?.target)
      if (pick?.kind === 'fixture' || pick?.kind === 'opening' || (pick?.kind === 'yard' && pick.movable) || serviceDrag) {
        drag = { kind: serviceDrag ? 'service' : pick.kind, id: pick.id, collection: pick.collection, service: pick.service, moved: false }
        if (controlsRef.current) controlsRef.current.enabled = false
        if (serviceDrag) {
          const spot = floor()
          if (spot) handlers.current.onServiceDrag?.(pick.service, spot, 'start')
        }
      }
    }
    const onPointerUp = (event) => {
      if (event.button !== 0 || !down) return
      const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y)
      down = null
      aim(event)
      const spot = floor()
      if (drag) {
        const ended = drag
        drag = null
        if (controlsRef.current) controlsRef.current.enabled = true
        if (ended.moved && spot) {
          if (ended.kind === 'fixture') handlers.current.onFixtureDrag?.(ended.id, spot, 'end')
          else if (ended.kind === 'yard') handlers.current.onYardDrag?.({ kind: 'yard', id: ended.id, collection: ended.collection }, spot, 'end')
          else if (ended.kind === 'service') handlers.current.onServiceDrag?.(ended.service, spot, 'end')
          else handlers.current.onOpeningDrag?.(ended.id, spot, 'end')
        } else if (ended.kind === 'fixture') handlers.current.onSelect?.({ kind: 'fixture', id: ended.id })
        else if (ended.kind === 'yard') handlers.current.onSelect?.({ kind: 'yard', id: ended.id, collection: ended.collection })
        else if (ended.kind === 'service') {
          const target = ended.service?.target
          const service = target === 'vertex' || target === 'segment'
            ? { ...ended.service, target: 'run', segmentIndex: ended.service.index || 0 }
            : ended.service
          handlers.current.onSelect?.({ kind: 'service', service })
        }
        else handlers.current.onSelect?.({ kind: 'opening', id: ended.id })
        return
      }
      if (moved > 6) return
      if (handlers.current.drawMode && spot) {
        handlers.current.onPlace?.({ ...spot, px: event.clientX, py: event.clientY, shift: event.shiftKey, at: Date.now() })
      }
      else handlers.current.onSelect?.(read())
    }
    const onMenu = (event) => {
      event.preventDefault()
      aim(event)
      handlers.current.onContext?.(read(), event, floor())
    }
    const onMove = (event) => {
      aim(event)
      const spot = floor()
      if (drag && spot) {
        const travel = down ? Math.hypot(event.clientX - down.x, event.clientY - down.y) : 0
        if (travel > 3) drag.moved = true
        if (drag.moved) {
          if (drag.kind === 'fixture') handlers.current.onFixtureDrag?.(drag.id, spot, 'move')
          else if (drag.kind === 'yard') handlers.current.onYardDrag?.({ kind: 'yard', id: drag.id, collection: drag.collection }, spot, 'move')
          else if (drag.kind === 'service') handlers.current.onServiceDrag?.(drag.service, spot, 'move')
          else handlers.current.onOpeningDrag?.(drag.id, spot, 'move')
          return
        }
      }
      if (handlers.current.drawMode && spot) handlers.current.onPreview?.(spot)
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!drag) handlers.current.onHover?.(read())
      })
    }
    const onDragOver = (event) => {
      const types = event.dataTransfer ? Array.from(event.dataTransfer.types || []) : []
      if (!types.includes('application/x-fixture') && !types.includes('text/plain')) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }
    const onDrop = (event) => {
      const id = event.dataTransfer?.getData('application/x-fixture') || event.dataTransfer?.getData('text/plain')
      if (!id) return
      event.preventDefault()
      aim(event)
      const spot = floor()
      if (spot) handlers.current.onDropFixture?.(id, spot)
    }
    const el = gl.domElement
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('contextmenu', onMenu)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('dragover', onDragOver)
    el.addEventListener('drop', onDrop)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('contextmenu', onMenu)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('dragover', onDragOver)
      el.removeEventListener('drop', onDrop)
      if (frame) cancelAnimationFrame(frame)
      if (controlsRef.current) controlsRef.current.enabled = true
    }
  }, [camera, gl, scene, controlsRef])
  return null
}

function Dressing({ plan }) {
  const finish = finishesOf(plan)
  const realistic = finish.sceneStyle !== 'technical'
  const trim = realistic ? finish.trimColor : '#e7e5e4'
  const gutter = realistic ? finish.gutterColor : '#cbd5e1'
  const plinth = plinthLook(plan)
  const model = roofModel(plan)
  const box = planBounds(plan)
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const trims = []
  ;(plan.walls || []).forEach((wall) => {
    if (wall.kind === 'interior') return
    const len = segmentLength(wall.a, wall.b) || 1
    const dx = (wall.b.x - wall.a.x) / len
    const dz = (wall.b.z - wall.a.z) / len
    let nx = -dz
    let nz = dx
    const midX = (wall.a.x + wall.b.x) / 2
    const midZ = (wall.a.z + wall.b.z) / 2
    if (nx * (midX - cx) + nz * (midZ - cz) < 0) {
      nx = -nx
      nz = -nz
    }
    const thick = thicknessOf(wall, plan)
    const top = wall.height || plan.floorHeight || 2.6
    const boardH = Math.max(0.2, top - plinth.height)
    const yaw = Math.atan2(-dz, dx)
    ;[wall.a, wall.b].forEach((at, index) => {
      const far = index === 0 ? wall.b : wall.a
      const dirLen = Math.hypot(far.x - at.x, far.z - at.z) || 1
      const dirx = (far.x - at.x) / dirLen
      const dirz = (far.z - at.z) / dirLen
      let angled = false
      let colinear = false
      ;(plan.walls || []).forEach((other) => {
        if (other.id === wall.id || other.kind === 'interior' || other.kind === 'partition') return
        const otherFar = Math.hypot(other.a.x - at.x, other.a.z - at.z) < 0.08 ? other.b : Math.hypot(other.b.x - at.x, other.b.z - at.z) < 0.08 ? other.a : null
        if (!otherFar) return
        const olen = Math.hypot(otherFar.x - at.x, otherFar.z - at.z) || 1
        const dot = dirx * ((otherFar.x - at.x) / olen) + dirz * ((otherFar.z - at.z) / olen)
        if (Math.abs(dot) > 0.96) colinear = true
        else angled = true
      })
      if (colinear && !angled) return
      const key = `${Math.round(at.x * 20)}:${Math.round(at.z * 20)}`
      if (trims.some((item) => item.key === `corner-${key}`)) return
      trims.push({
        key: `corner-${key}`,
        position: [at.x + nx * (thick / 2 + 0.012), plinth.height + boardH / 2, at.z + nz * (thick / 2 + 0.012)],
        rotation: [0, yaw, 0],
        args: [0.045, boardH, 0.02],
      })
    })
    ;(plan.openings || []).filter((opening) => opening.wallId === wall.id).forEach((opening) => {
      const sill = opening.kind === 'window' ? (Number.isFinite(opening.sill) ? opening.sill : 0.9) : 0
      const height = opening.height || (opening.kind === 'window' ? 1.2 : 2.1)
      const width = opening.width || 0.9
      const centre = pointAt(wall, opening.offset)
      const y = sill + height / 2
      const shift = thick / 2 + 0.028
      const bars = [
        [width + 0.12, 0.05, 0, height / 2 + 0.03],
        [width + 0.12, 0.05, 0, -height / 2 - 0.03],
        [0.05, height + 0.08, -(width / 2 + 0.03), 0],
        [0.05, height + 0.08, width / 2 + 0.03, 0],
      ]
      bars.forEach((bar, index) => {
        trims.push({
          key: `${opening.id}-case-${index}`,
          position: [centre.x + nx * shift + dx * bar[2], y + bar[3], centre.z + nz * shift + dz * bar[2]],
          rotation: [0, yaw, 0],
          args: [bar[0], bar[1], 0.02],
        })
      })
    })
  })
  const gutters = roofOutline(model)
    .filter((edge) => Math.abs(edge.a[1] - model.wallHeight) < 0.3 && Math.abs(edge.b[1] - model.wallHeight) < 0.3)
    .map((edge, index) => {
      const length = Math.max(0.2, Math.hypot(edge.b[0] - edge.a[0], edge.b[2] - edge.a[2]))
      const yaw = Math.atan2(-(edge.b[2] - edge.a[2]), edge.b[0] - edge.a[0])
      const mx = (edge.a[0] + edge.b[0]) / 2
      const mz = (edge.a[2] + edge.b[2]) / 2
      return [
        {
          key: `fascia-${index}`,
          position: [mx, model.wallHeight + 0.02, mz],
          rotation: [0, yaw, 0],
          args: [length, 0.18, 0.03],
          color: trim,
        },
        {
          key: `gutter-${index}`,
          position: [mx, model.wallHeight - 0.08, mz],
          rotation: [0, yaw, 0],
          args: [length, 0.07, 0.1],
          color: gutter,
        },
      ]
    })
  const downs = [[box.minX, box.minZ], [box.maxX, box.minZ], [box.minX, box.maxZ], [box.maxX, box.maxZ]].map(([x, z], index) => ({
    key: `down-${index}`,
    position: [x + Math.sign(x - cx || 1) * 0.22, model.wallHeight / 2, z + Math.sign(z - cz || 1) * 0.22],
    rotation: [0, 0, 0],
    args: [0.07, model.wallHeight, 0.07],
    color: gutter,
  }))
  return (
    <group>
      {[...trims.map((item) => ({ ...item, color: trim })), ...gutters.flat(), ...downs].map((item) => (
        <mesh key={item.key} position={item.position} rotation={item.rotation} castShadow receiveShadow raycast={noopRaycast}>
          <boxGeometry args={item.args} />
          <meshStandardMaterial color={item.color} roughness={0.55} metalness={item.key.startsWith('gutter') || item.key.startsWith('down') ? 0.35 : 0.04} />
        </mesh>
      ))}
    </group>
  )
}

export default function HouseScene({
  plan,
  wallMode,
  roofMode,
  fitToken = 0,
  selected = null,
  hovered = null,
  drawMode = false,
  placeGhost = false,
  cursor = null,
  cursorPpm = 40,
  snapKind = null,
  draft = null,
  liveEnd = null,
  liveLabel = '',
  roomDraft = null,
  roomCursor = null,
  onSelect,
  onContext,
  onHover,
  onPreview,
  onPlace,
  onFixtureDrag,
  onOpeningDrag,
  onYardDrag,
  onServiceDrag,
  onDropFixture,
  activeSystems = null,
  dimFixtures = false,
}) {
  const controlsRef = useRef(null)
  const house = planBounds(plan)
  const box = sceneBounds(plan)
  const site = hasYard(plan)
  const cx = (house.minX + house.maxX) / 2
  const cz = (house.minZ + house.maxZ) / 2
  const focusX = site ? (box.minX + box.maxX) / 2 : cx
  const focusZ = site ? (box.minZ + box.maxZ) / 2 : cz
  const span = Math.max(box.maxX - box.minX, box.maxZ - box.minZ, 8)
  const cameraPosition = site
    ? [focusX + span * 0.46, span * 0.58, focusZ + span * 0.62]
    : [cx, span, cz + span]
  return (
    <Canvas
      camera={{ position: cameraPosition, fov: site ? 32 : 34, near: 0.08, far: Math.max(240, span * 8) }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.05
        gl.shadowMap.enabled = true
        gl.shadowMap.type = THREE.PCFSoftShadowMap
        gl.setClearColor('#d9e3ee')
      }}
    >
      <color attach="background" args={['#d9e3ee']} />
      <hemisphereLight args={['#f3eee4', '#b7aa96', 0.32]} />
      <ambientLight intensity={0.1} />
      <directionalLight position={[16, 14, 7]} intensity={1.85} />
      <directionalLight position={[-8, 6, -6]} intensity={0.12} />
      <ContactShadows position={[cx, 0.012, cz]} opacity={0.58} scale={Math.max(22, span * 1.35)} blur={2.4} far={7} />
      <GroundShade cx={cx} cz={cz} w={Math.max(house.maxX - house.minX + 1.4, 8)} h={Math.max(house.maxZ - house.minZ + 1.4, 8)} />
      <SiteGround
        cx={cx}
        cz={cz}
        width={Math.max(24, span * 1.4)}
        depth={Math.max(24, span * 1.4)}
        y={-0.02}
        color="#efe8d8"
        holes={sunkenTerraceRings(plan)}
        basic
        transparent={yardHasUnderground(plan.yard) && layerVisible(plan, 'ground')}
        opacity={yardHasUnderground(plan.yard) && layerVisible(plan, 'ground') ? 0.35 : 1}
        depthWrite={!(yardHasUnderground(plan.yard) && layerVisible(plan, 'ground'))}
      />
      <YardScene plan={plan} selected={selected} />
      <gridHelper args={[Math.max(24, span * 2.2), Math.round(Math.max(24, span * 2.2) / (drawMode ? 0.5 : 1)), '#b7b1a4', '#e4e0d8']} position={[cx, 0, cz]} />
      {visibleRooms(plan).map((room) => {
        const runs = plan.services?.runs || []
        const drainOn = layerVisible(plan, 'drain') && runs.some((run) => run.system === 'drain')
        const heatOn = layerVisible(plan, 'heat') && runs.some((run) => run.system === 'heat' && (run.kind === 'floorheat' || run.kind === 'efloor' || run.kind === 'ceiling' || run.role === 'feeder' || run.role === 'loop'))
        const buried = layerVisible(plan, 'ground') && runs.some((run) => run.kind === 'collector' || String(run.linkedFrom || '').startsWith('yard:waste:') || String(run.linkedFrom || '').startsWith('yard:ground:'))
        return (
          <FloorMesh
            key={room.id}
            room={room}
            selected={selected}
            hovered={hovered}
            translucent={drainOn || heatOn || buried}
          />
        )
      })}
      {roofMode !== 'solid' && <RoomLabels plan={plan} />}
      <WallMesh plan={plan} mode={wallMode} selected={selected} hovered={hovered} />
      {(plan.openings || []).map((opening) => (
        <OpeningMesh key={opening.id} plan={plan} opening={opening} selected={selected} hovered={hovered} />
      ))}
      <RoofMesh plan={plan} mode={roofMode} selected={selected} hovered={hovered} />
      {wallMode !== 'hidden' && <Dressing plan={plan} />}
      {normalizeDisplay(plan.display).fixtures && (plan.fixtures || []).map((fixture) => (
        <FixtureMesh key={fixture.id} plan={plan} fixture={fixture} selected={selected} hovered={hovered} dim={dimFixtures} />
      ))}
      <Services3D plan={plan} selected={selected} hovered={hovered} activeSystems={activeSystems} />
      <CursorMode drawMode={drawMode} />
      {drawMode && cursor && <FloorCursor point={cursor} ppm={cursorPpm} kind={snapKind} />}
      {drawMode && placeGhost && cursor && (
        <mesh position={[cursor.x, 0.06, cursor.z]} rotation={[-Math.PI / 2, 0, 0]} raycast={noopRaycast}>
          <circleGeometry args={[0.18, 24]} />
          <meshBasicMaterial color="#ea580c" transparent opacity={0.45} depthTest={false} side={THREE.DoubleSide} />
        </mesh>
      )}
      {draft && liveEnd && (
        <group>
          <mesh
            position={[(draft.x + liveEnd.x) / 2, 0.07, (draft.z + liveEnd.z) / 2]}
            rotation={[0, Math.atan2(liveEnd.x - draft.x, liveEnd.z - draft.z), 0]}
          >
            <boxGeometry args={[0.08, 0.05, Math.max(0.05, Math.hypot(liveEnd.x - draft.x, liveEnd.z - draft.z))]} />
            <meshBasicMaterial color="#0f766e" depthTest={false} />
          </mesh>
          <Line points={[[draft.x, 0.08, draft.z], [liveEnd.x, 0.08, liveEnd.z]]} color="#0f766e" lineWidth={2} />
          <Html position={[(draft.x + liveEnd.x) / 2, 0.35, (draft.z + liveEnd.z) / 2]} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
            <div data-testid="wall-length-3d" style={{ background: '#042f2e', color: '#ccfbf1', fontWeight: 700, fontSize: 13, padding: '3px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{liveLabel}</div>
          </Html>
        </group>
      )}
      {roomDraft && roomCursor && (
        <Line
          points={[
            [roomDraft.x, 0.08, roomDraft.z],
            [roomCursor.x, 0.08, roomDraft.z],
            [roomCursor.x, 0.08, roomCursor.z],
            [roomDraft.x, 0.08, roomCursor.z],
            [roomDraft.x, 0.08, roomDraft.z],
          ]}
          color="#0f766e"
          lineWidth={2}
        />
      )}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[focusX, site ? 0.4 : 1.25, focusZ]}
        maxPolarAngle={Math.PI / 2.08}
        enableDamping={false}
        mouseButtons={{ LEFT: drawMode ? -1 : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 }}
      />
      <EditBridge
        drawMode={drawMode}
        controlsRef={controlsRef}
        onSelect={onSelect}
        onContext={onContext}
        onHover={onHover}
        onPreview={onPreview}
        onPlace={onPlace}
        onFixtureDrag={onFixtureDrag}
        onOpeningDrag={onOpeningDrag}
        onYardDrag={onYardDrag}
        onServiceDrag={onServiceDrag}
        onDropFixture={onDropFixture}
      />
      <FrameCamera plan={plan} fitToken={fitToken} controlsRef={controlsRef} />
    </Canvas>
  )
}
