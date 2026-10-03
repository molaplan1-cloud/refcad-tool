'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Edges, Html, Line, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  claddingOf,
  fixtureTemplate,
  materialOf,
  planBounds,
  pointInPolygon,
  resolveFaceMaterial,
  roomForWallSide,
  roofFaces,
  roofModel,
  roofOutline,
  segmentLength,
  thicknessOf,
  visibleRooms,
  wallCladdingPieces,
  wallPieces,
  zoneCovering,
} from '@/lib/floorplan'
import Services3D from './Services3D'
import YardScene from './YardScene'
import { hasYard, sceneBounds } from '@/lib/yard'
import { layerVisible } from '@/lib/services'
import { layoutRoomLabels, normalizeDisplay } from '@/lib/display'
import { chimneyKind, chimneyTop, drawingOf } from '@/lib/chimney'

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
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  textureCache.set(key, tex)
  return tex
}

function claddingTexture(id) {
  const item = claddingOf(id)
  const key = `clad:${item.id}`
  if (textureCache.has(key)) return textureCache.get(key)
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = item.color
  ctx.fillRect(0, 0, 128, 128)
  ctx.strokeStyle = 'rgba(40,24,16,0.45)'
  ctx.lineWidth = 2
  if (item.pattern === 'brick') {
    const course = 16
    for (let y = 0; y <= 128; y += course) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(128, y)
      ctx.stroke()
      const shift = Math.round(y / course) % 2 ? 16 : 0
      for (let x = -32 + shift; x < 128; x += 32) {
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x, y + course)
        ctx.stroke()
      }
    }
  } else if (item.pattern === 'boards-h') {
    for (let y = 10; y < 128; y += 10) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(128, y)
      ctx.stroke()
    }
  } else if (item.pattern === 'boards-v' || item.pattern === 'batten') {
    const step = item.pattern === 'batten' ? 28 : 12
    for (let x = step; x < 128; x += step) {
      ctx.lineWidth = item.pattern === 'batten' && Math.round(x / step) % 2 === 0 ? 4 : 2
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, 128)
      ctx.stroke()
    }
  } else if (item.pattern === 'stone') {
    ctx.strokeRect(4, 4, 36, 24)
    ctx.strokeRect(44, 6, 40, 22)
    ctx.strokeRect(88, 4, 32, 26)
    ctx.strokeRect(8, 36, 48, 28)
    ctx.strokeRect(60, 38, 56, 24)
    ctx.strokeRect(6, 72, 40, 30)
    ctx.strokeRect(52, 74, 34, 28)
    ctx.strokeRect(92, 70, 28, 34)
  } else if (item.pattern === 'board') {
    ctx.strokeRect(2, 2, 60, 60)
    ctx.strokeRect(66, 2, 60, 60)
    ctx.strokeRect(2, 66, 60, 60)
    ctx.strokeRect(66, 66, 60, 60)
  } else {
    ctx.fillStyle = 'rgba(80,60,40,0.16)'
    for (let i = 0; i < 40; i += 1) ctx.fillRect((i * 37) % 128, (i * 19) % 128, 2, 2)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  textureCache.set(key, tex)
  return tex
}

function repeatedCladding(id, span, height) {
  const item = claddingOf(id)
  const unitX = item.pattern === 'brick' ? 0.48 : item.pattern === 'boards-v' || item.pattern === 'batten' ? 0.24 : 0.6
  const unitY = item.pattern === 'brick' ? 0.26 : item.pattern === 'boards-h' ? 0.16 : 0.4
  const rx = Math.max(1, Math.round((span / unitX) * 2) / 2)
  const ry = Math.max(1, Math.round((height / unitY) * 2) / 2)
  const key = `clad-repeat:${item.id}:${rx}:${ry}`
  if (textureCache.has(key)) return textureCache.get(key)
  const tex = claddingTexture(item.id).clone()
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(rx, ry)
  tex.needsUpdate = true
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

function Solid({ args, position, rotation, color, map, opacity = 1, edges = true, pick, mark }) {
  const transparent = opacity < 0.98
  const face = mark === 'selected' ? '#5eead4' : mark === 'hover' ? '#ccfbf1' : color
  const edge = mark === 'selected' ? '#0f766e' : mark === 'hover' ? '#14b8a6' : '#1e293b'
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={false}
      receiveShadow={false}
      userData={pick ? { pick } : undefined}
      raycast={opacity < 0.5 ? noopRaycast : undefined}
    >
      <boxGeometry args={args} />
      <meshLambertMaterial
        color={face}
        emissive={mark === 'selected' ? '#115e59' : '#000000'}
        emissiveIntensity={mark === 'selected' ? 0.55 : 0}
        map={mark || transparent ? null : map || null}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
      {edges && !transparent && <Edges threshold={20} color={edge} />}
      {mark && (
        <mesh scale={outlineScale(args, mark)} raycast={noopRaycast}>
          <boxGeometry args={args} />
          <meshBasicMaterial color={edge} side={THREE.BackSide} />
        </mesh>
      )}
    </mesh>
  )
}

function WallMesh({ plan, mode, selected, hovered }) {
  if (mode === 'hidden') return null
  const opacity = mode === 'ghost' ? 0.14 : 1
  return (
    <group>
      {(plan.walls || []).flatMap((wall) => {
        const len = segmentLength(wall.a, wall.b) || 1
        const dx = (wall.b.x - wall.a.x) / len
        const dz = (wall.b.z - wall.a.z) / len
        const yaw = Math.atan2(-dz, dx)
        const thick = thicknessOf(wall, plan)
        const pieces = wall.kind === 'exterior'
          ? wallCladdingPieces(wall, plan)
          : wallPieces(wall, plan.openings, plan.floorHeight, plan.walls)
        return pieces.map((piece) => {
          const span = piece.to - piece.from
          const mid = pointAt(wall, (piece.from + piece.to) / 2)
          const y = (piece.y0 + piece.y1) / 2
          const height = piece.y1 - piece.y0
          const cladding = wall.kind === 'exterior' ? claddingOf(piece.materialId || plan.exteriorId) : null
          const finish = cladding || adjacentInterior(plan, wall, piece)
          const map = mode !== 'solid' ? null : cladding ? repeatedCladding(cladding.id, span, height) : finishTexture('interior', finish.id)
          const zone = wall.kind === 'exterior' ? zoneCovering(plan, wall, (piece.from + piece.to) / 2, y) : null
          const pick = zone ? { kind: 'zone', id: zone.id, wallId: wall.id } : { kind: 'wall', id: wall.id }
          const onThisWall = (item) => item?.kind === 'wall' && item.id === wall.id
          const mark = samePick(selected, pick) || onThisWall(selected)
            ? 'selected'
            : samePick(hovered, pick) || onThisWall(hovered)
              ? 'hover'
              : null
          const faceKey = `${wall.id}-${piece.from}-${piece.to}-${piece.y0}-${piece.y1}-${piece.materialId || 'base'}`
          return (
            <group key={faceKey}>
              <Solid
                args={[span, height, thick]}
                position={[mid.x, y, mid.z]}
                rotation={[0, yaw, 0]}
                color={wall.kind === 'exterior' ? finish.color : '#d6d3d1'}
                map={wall.kind === 'exterior' ? map : null}
                opacity={opacity}
                pick={pick}
                mark={mark}
              />
              {['left', 'right'].map((side) => {
                if (!roomForWallSide(plan, wall, side)) return null
                const matId = resolveFaceMaterial(plan, wall, side)
                const item = materialOf('interior', matId)
                const sign = side === 'left' ? 1 : -1
                const shift = thick / 2 + 0.012
                return (
                  <mesh
                    key={`${faceKey}-${side}`}
                    position={[mid.x + (-dz * sign) * shift, y, mid.z + (dx * sign) * shift]}
                    rotation={[0, yaw, 0]}
                    raycast={noopRaycast}
                  >
                    <boxGeometry args={[Math.max(0.05, span - 0.02), height, 0.02]} />
                    <meshLambertMaterial
                      color={item.color}
                      map={mode === 'solid' ? finishTexture('interior', item.id) : null}
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
  return (
    <Solid
      args={[Math.max(0.2, opening.width || 0.9), height, thicknessOf(wall, plan) + 0.03]}
      position={[mid.x, sill + height / 2, mid.z]}
      rotation={[0, yaw, 0]}
      color={opening.kind === 'window' ? '#dbeafe' : '#f8fafc'}
      pick={pick}
      mark={markOf(selected, hovered, pick)}
    />
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
  roofFaces(model).forEach((face) => {
    face.forEach((point) => positions.push(point[0], point[1], point[2]))
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  geometry.computeVertexNormals()
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
  const finish = materialOf('roof', plan.roofId)
  const ghost = mode === 'ghost'
  const map = ghost ? null : finishTexture('roof', finish.id)
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
      <mesh geometry={geom} userData={{ pick }} raycast={ghost ? noopRaycast : undefined}>
        <meshLambertMaterial
          color={mark === 'selected' ? '#5eead4' : mark === 'hover' ? '#99f6e4' : ghost ? '#94a3b8' : finish.color}
          emissive={mark === 'selected' ? '#115e59' : '#000000'}
          emissiveIntensity={mark === 'selected' ? 0.45 : 0}
          map={mark ? null : map}
          side={THREE.DoubleSide}
          transparent={ghost && !mark}
          opacity={ghost && !mark ? 0.15 : 1}
          depthWrite={!ghost || Boolean(mark)}
        />
        {mark && <Edges threshold={15} color={mark === 'selected' ? '#0f766e' : '#14b8a6'} />}
      </mesh>
      {edgeSpecs.map((edge, index) => (
        <mesh key={index} position={edge.position} quaternion={edge.quaternion}>
          <boxGeometry args={[0.045, edge.length, 0.045]} />
          <meshBasicMaterial color="#1e293b" />
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
        {box([w, 0.55, d], [0, 0.28, 0], '#44403c')}
        {box([w * 0.7, 0.28, 0.05], [0, 0.32, d * 0.46], '#111827')}
      </group>
    )
  }
  if (type === 'kamiina') {
    return (
      <group>
        {cyl(Math.min(w, d) * 0.42, 0.72, [0, 0.4, 0], '#334155')}
        {cyl(0.05, 0.16, [0, 0.84, -d * 0.1], '#1e293b')}
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

function FixtureMesh({ fixture, plan, selected, hovered }) {
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
    <group position={[fixture.x, 0, fixture.z]} rotation={[0, ((fixture.rotation || 0) * Math.PI) / 180, 0]} scale={[fixture.mirror ? -1 : 1, 1, 1]} userData={{ pick }}>
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
  })
  return labels.map((label) => (
    <Html key={label.id} position={[label.x, 0.12, label.z]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{ textAlign: 'center', color: '#1c1917', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}>
        {label.text && <div style={{ fontWeight: 700, fontSize: 12 }}>{label.text}</div>}
        {label.area && <div style={{ fontSize: 10, color: '#44403c' }}>{label.area}</div>}
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
          if (node.userData?.pick) return node.userData.pick
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
      if (handlers.current.drawMode && spot) handlers.current.onPlace?.(spot)
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

export default function HouseScene({
  plan,
  wallMode,
  roofMode,
  fitToken = 0,
  selected = null,
  hovered = null,
  drawMode = false,
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
        gl.toneMapping = THREE.NoToneMapping
        gl.shadowMap.enabled = false
        gl.setClearColor('#e7e5e4')
      }}
    >
      <color attach="background" args={['#e7e5e4']} />
      <ambientLight intensity={0.94} />
      <directionalLight position={[8, 22, 10]} intensity={0.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.02, cz]} raycast={noopRaycast}>
        <planeGeometry args={[Math.max(24, span * 1.4), Math.max(24, span * 1.4)]} />
        <meshBasicMaterial color="#efe8d8" />
      </mesh>
      <YardScene plan={plan} selected={selected} />
      <gridHelper args={[Math.max(24, span * 2.2), Math.round(Math.max(24, span * 2.2) / (drawMode ? 0.5 : 1)), '#b7b1a4', '#e4e0d8']} position={[cx, 0, cz]} />
      {visibleRooms(plan).map((room) => {
        const runs = plan.services?.runs || []
        const drainOn = layerVisible(plan, 'drain') && runs.some((run) => run.system === 'drain')
        const heatOn = layerVisible(plan, 'heat') && runs.some((run) => run.system === 'heat' && (run.kind === 'floorheat' || run.kind === 'efloor' || run.kind === 'ceiling' || run.role === 'feeder' || run.role === 'loop'))
        return (
          <FloorMesh
            key={room.id}
            room={room}
            selected={selected}
            hovered={hovered}
            translucent={drainOn || heatOn}
          />
        )
      })}
      {roofMode !== 'solid' && <RoomLabels plan={plan} />}
      <WallMesh plan={plan} mode={wallMode} selected={selected} hovered={hovered} />
      {(plan.openings || []).map((opening) => (
        <OpeningMesh key={opening.id} plan={plan} opening={opening} selected={selected} hovered={hovered} />
      ))}
      <RoofMesh plan={plan} mode={roofMode} selected={selected} hovered={hovered} />
      {normalizeDisplay(plan.display).fixtures && (plan.fixtures || []).map((fixture) => (
        <FixtureMesh key={fixture.id} plan={plan} fixture={fixture} selected={selected} hovered={hovered} />
      ))}
      <Services3D plan={plan} selected={selected} hovered={hovered} />
      {drawMode && cursor && <FloorCursor point={cursor} ppm={cursorPpm} kind={snapKind} />}
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
