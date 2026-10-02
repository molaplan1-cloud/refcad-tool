'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, Grid, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { insetOrthogonal, outlineOf } from '@/lib/cadDraw'
import { fanCountForWidth, isRefrigerated } from '@/lib/catalog'
import { equipmentPorts, internalCeiling, pointInOutline, resolvedElevation } from '@/lib/placement'

const SceneTheme = createContext(null)

const PALETTES = {
  dark: {
    id: 'dark', bg: '#1a1c1f', gridCell: '#2c3138', gridSection: '#3c4450',
    wall: '#d5dde6', wallOpacity: 0.22, edge: '#f4f7fb', floor: '#c5c8cc', floorOpacity: 1,
    ceilingOpacity: 0.08, equip: '#e8eef3', hintBg: 'rgba(22,24,28,0.9)', hintFg: '#c8cdd3', hintBorder: '#2c3138',
    tick: '#d5dde6',
  },
  light: {
    id: 'light', bg: '#e7ebf0', gridCell: '#c5ccd6', gridSection: '#8b95a3',
    wall: '#f7f9fb', wallOpacity: 0.4, edge: '#64748b', floor: '#d5d8dc', floorOpacity: 1,
    ceilingOpacity: 0.2, equip: '#f8fafc', hintBg: 'rgba(255,255,255,0.92)', hintFg: '#44403c', hintBorder: '#e7e5e4',
    tick: '#64748b',
  },
}

function usePalette() {
  return useContext(SceneTheme) || PALETTES.dark
}

function footprintGeometry(points, height) {
  const shape = new THREE.Shape()
  shape.moveTo(points[0].x, -points[0].z)
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i].x, -points[i].z)
  shape.closePath()
  const geom = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false })
  geom.rotateX(-Math.PI / 2)
  geom.computeVertexNormals()
  return geom
}

function loopArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const next = points[(i + 1) % points.length]
    sum += current.x * next.y - next.x * current.y
  }
  return sum
}

function shellGeometry(room) {
  const outer = outlineOf(room).map((point) => ({ x: point.x, y: -point.z }))
  const shape = new THREE.Shape()
  shape.moveTo(outer[0].x, outer[0].y)
  for (let i = 1; i < outer.length; i += 1) shape.lineTo(outer[i].x, outer[i].y)
  shape.closePath()
  const rawInner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness))
  if (rawInner && rawInner.length >= 3) {
    let inner = rawInner.map((point) => ({ x: point.x, y: -point.z }))
    if (Math.sign(loopArea(inner)) === Math.sign(loopArea(outer))) inner = [...inner].reverse()
    const hole = new THREE.Path()
    hole.moveTo(inner[0].x, inner[0].y)
    for (let i = 1; i < inner.length; i += 1) hole.lineTo(inner[i].x, inner[i].y)
    hole.closePath()
    shape.holes.push(hole)
  }
  const geom = new THREE.ExtrudeGeometry(shape, { depth: room.height, bevelEnabled: false })
  geom.rotateX(-Math.PI / 2)
  geom.computeVertexNormals()
  return geom
}

function seamList(room) {
  const pts = outlineOf(room)
  const thick = Math.max(0.08, room.wallThickness || 0.1)
  const seams = []
  const pitch = 1.15
  pts.forEach((a, index) => {
    const b = pts[(index + 1) % pts.length]
    const dx = b.x - a.x
    const dz = b.z - a.z
    const len = Math.hypot(dx, dz)
    if (len < 0.5) return
    const count = Math.max(1, Math.round(len / pitch))
    let px = -dz / len
    let pz = dx / len
    const mx = (a.x + b.x) / 2
    const mz = (a.z + b.z) / 2
    const away = (mx + px - room.x) * (mx - room.x) + (mz + pz - room.z) * (mz - room.z)
    if (away < 0) {
      px = -px
      pz = -pz
    }
    for (let step = 1; step < count; step += 1) {
      const t = step / count
      seams.push({
        x: a.x + dx * t + px * (thick / 2 + 0.008),
        z: a.z + dz * t + pz * (thick / 2 + 0.008),
        yaw: Math.atan2(px, pz),
        depth: Math.max(0.05, thick * 0.55),
      })
    }
  })
  return seams
}

function DoorMesh({ room, eq, onSelect, onContext }) {
  const palette = usePalette()
  const wall = eq.wall || 's'
  const yaw = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[wall] ?? 0
  const w = Math.max(0.6, eq.width || 0.9)
  const h = Math.max(1.8, eq.height || 2.1)
  const doors = (room.equipment || []).filter((item) => item.category === 'door')
  const number = Math.max(1, doors.findIndex((item) => item.id === eq.id) + 1)
  const sliding = (eq.name || '').toLowerCase().includes('liuku') || w >= 1.15
  const jamb = 0.055
  const frameColor = '#3f3f46'
  const leaf = '#f7f7f4'
  return (
    <group
      position={[room.x + eq.x, 0, room.z + eq.z]}
      rotation={[0, yaw, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
      onContextMenu={(event) => openMenu(event, onContext, eq.id, 'equipment')}
    >
      {[-1, 1].map((side) => (
        <mesh key={`jamb-${side}`} position={[side * (w / 2 + jamb / 2), h / 2, 0]} castShadow>
          <boxGeometry args={[jamb, h + 0.08, 0.12]} />
          <meshStandardMaterial color={frameColor} roughness={0.42} metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, h + 0.025, 0]} castShadow>
        <boxGeometry args={[w + jamb * 2, 0.07, 0.12]} />
        <meshStandardMaterial color={frameColor} roughness={0.42} metalness={0.5} />
      </mesh>
      {sliding && (
        <mesh position={[0, h + 0.09, 0]} castShadow>
          <boxGeometry args={[w + 0.42, 0.045, 0.07]} />
          <meshStandardMaterial color="#27272a" roughness={0.35} metalness={0.62} />
        </mesh>
      )}
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w - 0.02, h - 0.02, 0.08]} />
        <meshStandardMaterial color={leaf} roughness={0.4} metalness={0.06} />
      </mesh>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w - 0.1, h - 0.12, 0.086]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.62} metalness={0.02} />
      </mesh>
      {(sliding ? [] : [0.16, 0.5, 0.84]).map((t) => (
        <mesh key={`hinge-${t}`} position={[-w / 2 + 0.01, h * t, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.018, 0.11, 10]} />
          <meshStandardMaterial color="#18181b" metalness={0.62} roughness={0.28} />
        </mesh>
      ))}
      <mesh position={[sliding ? w * 0.28 : w * 0.34, h * 0.48, 0.07]} castShadow>
        <boxGeometry args={[0.028, 0.26, 0.04]} />
        <meshStandardMaterial color="#18181b" roughness={0.28} metalness={0.66} />
      </mesh>
      <mesh position={[sliding ? w * 0.28 : w * 0.34, h * 0.59, 0.065]}>
        <boxGeometry args={[0.09, 0.026, 0.028]} />
        <meshStandardMaterial color="#18181b" roughness={0.28} metalness={0.66} />
      </mesh>
      <mesh position={[0, 0.028, 0]} castShadow>
        <boxGeometry args={[w + 0.18, 0.04, 0.16]} />
        <meshStandardMaterial color="#d6d3d1" metalness={0.42} roughness={0.34} />
      </mesh>
      <mesh position={[0, 0.052, 0]}>
        <boxGeometry args={[w - 0.04, 0.012, 0.045]} />
        <meshStandardMaterial color="#c2410c" emissive="#9a3412" emissiveIntensity={0.4} roughness={0.42} />
      </mesh>
      <Html position={[0, h * 0.58, 0.1]} center sprite zIndexRange={[12, 0]} wrapperClass="refcad-float" style={{ pointerEvents: 'none' }}>
        <div style={{ color: palette.id === 'dark' ? '#f8fafc' : '#1c1917', fontWeight: 700, fontSize: 16, textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{number}</div>
      </Html>
    </group>
  )
}

function openMenu(event, onContext, id, kind) {
  event.stopPropagation()
  event.nativeEvent?.preventDefault()
  onContext?.({ x: event.nativeEvent.clientX, y: event.nativeEvent.clientY, id, kind })
}

function EquipFrame({ room, eq, onSelect, onContext, children }) {
  const y = resolvedElevation(room, eq)
  return (
    <group
      position={[room.x + eq.x, y, room.z + eq.z]}
      rotation={[0, -((eq.rotation || 0) * Math.PI) / 180, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
      onContextMenu={(event) => openMenu(event, onContext, eq.id, 'equipment')}
    >
      {children}
    </group>
  )
}

function FanDisc({ x, y, z, radius, flat = false }) {
  const ring = Math.max(0.006, radius * 0.09)
  return (
    <group position={[x, y, z]} rotation={flat ? [0, 0, 0] : [Math.PI / 2, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, ring, 8, 28]} />
        <meshStandardMaterial color="#1e293b" metalness={0.55} roughness={0.32} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius * 0.62, ring * 0.65, 6, 20]} />
        <meshStandardMaterial color="#475569" metalness={0.45} roughness={0.35} />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} rotation={[0, (index * Math.PI) / 4, 0]} position={[0, ring, 0]}>
          <boxGeometry args={[radius * 1.55, Math.max(0.008, radius * 0.08), Math.max(0.012, radius * 0.28)]} />
          <meshStandardMaterial color="#334155" metalness={0.42} roughness={0.38} />
        </mesh>
      ))}
      <mesh position={[0, ring, 0]}>
        <cylinderGeometry args={[radius * 0.2, radius * 0.2, Math.max(0.02, radius * 0.16), 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.62} roughness={0.28} />
      </mesh>
    </group>
  )
}

/** Side profile in the depth/height plane. The fan face is a short steep slope
 *  so it stays readable inside a low catalogue height; the footprint is unchanged. */
function slantSection(h, d) {
  const lip = Math.max(0.045, Math.min(h * 0.58, h - 0.04))
  const low = Math.max(0.02, h * 0.1)
  const rise = Math.max(0.05, lip - low)
  const run = Math.min(d * 0.58, Math.max(0.2, rise / Math.tan((34 * Math.PI) / 180)))
  return { lip, low, rise, run, knee: d / 2 - run }
}

function useSlantGeometry(w, h, d) {
  return useMemo(() => {
    const { lip, low, knee } = slantSection(h, d)
    const shape = new THREE.Shape()
    shape.moveTo(-d / 2, h)
    shape.lineTo(d / 2, h)
    shape.lineTo(d / 2, lip)
    shape.lineTo(knee, low)
    shape.lineTo(-d / 2, low)
    shape.closePath()
    const geom = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false })
    geom.translate(0, 0, -w / 2)
    geom.rotateY(-Math.PI / 2)
    geom.computeVertexNormals()
    return geom
  }, [w, h, d])
}

function SlantFan({ position, quaternion, radius, color }) {
  return (
    <group position={position} quaternion={quaternion}>
      <mesh>
        <torusGeometry args={[radius, Math.max(0.008, radius * 0.085), 8, 28]} />
        <meshStandardMaterial color={color} metalness={0.45} roughness={0.32} />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh key={index} rotation={[0, 0, (index * Math.PI) / 4]}>
          <boxGeometry args={[radius * 1.65, Math.max(0.006, radius * 0.05), Math.max(0.006, radius * 0.04)]} />
          <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.18, radius * 0.18, radius * 0.12, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  )
}

function EvaporatorMesh({ room, eq, onSelect, onContext }) {
  const w = Math.max(0.7, eq.width || 1.2)
  const h = Math.max(0.18, eq.height || 0.45)
  const d = Math.max(0.4, eq.depth || 0.6)
  const slant = eq.style === 'slant'
  const geom = useSlantGeometry(w, h, d)
  const fans = fanCountForWidth(w)
  const section = slantSection(h, d)
  const slopeLen = Math.hypot(section.run, section.rise)
  const fanR = Math.min((w * 0.72) / fans / 2.15, Math.max(slopeLen * 0.4, 0.08), h * 0.62)
  const fanLayout = useMemo(() => {
    const { lip, low, rise, run, knee } = slantSection(h, d)
    const normal = new THREE.Vector3(0, -run, rise).normalize()
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
    const t = 0.52
    const y = low + t * rise
    const z = knee + t * run
    const pitch = (w * 0.76) / fans
    return Array.from({ length: fans }, (_, index) => {
      const x = (index - (fans - 1) / 2) * pitch
      const position = new THREE.Vector3(x, y, z).addScaledVector(normal, fanR * 0.15)
      return { position, quaternion, fanR }
    })
  }, [w, h, d, fans, fanR])
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      {slant ? (
        <mesh geometry={geom} castShadow>
          <meshStandardMaterial color="#f4f7fb" roughness={0.4} metalness={0.16} />
          <Edges threshold={15} color="#94a3b8" />
        </mesh>
      ) : (
        <mesh position={[0, h * 0.52, 0.02]} castShadow>
          <boxGeometry args={[w * 0.96, h * 0.78, d * 0.86]} />
          <meshStandardMaterial color="#f4f7fb" roughness={0.4} metalness={0.16} />
          <Edges threshold={15} color="#94a3b8" />
        </mesh>
      )}
      {Array.from({ length: Math.max(8, Math.round(w / 0.07)) }, (_, index) => {
        const count = Math.max(8, Math.round(w / 0.07))
        return (
        <mesh key={`fin-${index}`} position={[(index - (count - 1) / 2) * ((w * 0.84) / (count - 1)), slant ? h * 0.55 : h * 0.5, -d / 2 - 0.012]}>
          <boxGeometry args={[0.008, h * (slant ? 0.7 : 0.62), 0.045]} />
          <meshStandardMaterial color="#8d6b45" metalness={0.35} roughness={0.45} />
        </mesh>
        )
      })}
      <mesh position={[0, 0.015, 0.01]} castShadow>
        <boxGeometry args={[w * 1.02, 0.03, d * 0.98]} />
        <meshStandardMaterial color="#d5dee8" metalness={0.28} roughness={0.42} />
      </mesh>
      <mesh position={[0, -0.045, d * 0.22]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.09, 10]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.45} roughness={0.35} />
      </mesh>
      {[-1, 1].map((side) => [-1, 1].map((end) => (
        <group key={`hanger-${side}${end}`} position={[side * w * 0.36, h, end * d * 0.26]}>
          <mesh position={[0, 0.07, 0]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.135, 0]}>
            <boxGeometry args={[0.05, 0.012, 0.028]} />
            <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.35} />
          </mesh>
        </group>
      )))}
      {[[-0.28, '#1c1917'], [0.28, '#c47a3a']].map(([offset, color]) => (
        <mesh key={offset} position={[w * offset, h * 0.42, d / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[offset < 0 ? 0.018 : 0.01, offset < 0 ? 0.018 : 0.01, 0.07, 10]} />
          <meshStandardMaterial color={color} metalness={offset < 0 ? 0.08 : 0.7} roughness={offset < 0 ? 0.8 : 0.32} />
        </mesh>
      ))}
      {slant ? fanLayout.map((fan, index) => (
        <SlantFan key={index} position={fan.position} quaternion={fan.quaternion} radius={fan.fanR} color="#1e293b" />
      )) : Array.from({ length: fans }, (_, index) => (
        <FanDisc key={index} x={(index - (fans - 1) / 2) * ((w * 0.7) / Math.max(fans, 1))} y={h * 0.5} z={d / 2 + 0.015} radius={Math.min(h * 0.34, (w * 0.62) / fans / 2.1)} />
      ))}
    </EquipFrame>
  )
}

function ServiceValves({ w, h, d }) {
  return (
    <group>
      {[-0.16, 0.16].map((offset) => (
        <mesh key={offset} position={[w * offset, h * 0.32, -d / 2 - 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.02, 0.09, 12]} />
          <meshStandardMaterial color="#b45309" metalness={0.72} roughness={0.28} />
        </mesh>
      ))}
    </group>
  )
}

function CondenserMesh({ room, eq, onSelect, onContext }) {
  const w = Math.max(0.7, eq.width || 1.1)
  const h = Math.max(0.45, eq.height || 0.7)
  const d = Math.max(0.35, eq.depth || 0.5)
  const fans = w > 1.25 ? 2 : 1
  const fanR = Math.min(0.22, (w * 0.7) / fans / 2.2)
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * w * 0.32, 0.045, 0]} castShadow>
          <boxGeometry args={[0.07, 0.09, d * 0.92]} />
          <meshStandardMaterial color="#44403c" metalness={0.5} roughness={0.45} />
        </mesh>
      ))}
      <mesh position={[0, 0.12 + h * 0.28, 0]} castShadow>
        <boxGeometry args={[w * 0.88, h * 0.5, d * 0.78]} />
        <meshStandardMaterial color="#eef2f6" metalness={0.22} roughness={0.48} />
      </mesh>
      {Array.from({ length: 6 }, (_, index) => (
        <mesh key={index} position={[(index - 2.5) * (w * 0.12), 0.14 + h * 0.28, d * 0.28]}>
          <boxGeometry args={[0.015, h * 0.52, d * 0.08]} />
          <meshStandardMaterial color="#64748b" metalness={0.45} roughness={0.4} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`side-${side}`} position={[side * w * 0.46, h * 0.48, 0]}>
          <boxGeometry args={[0.045, h * 0.72, d]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.4} roughness={0.38} />
        </mesh>
      ))}
      <mesh position={[0, h * 0.82, 0]}>
        <boxGeometry args={[w * 0.94, 0.04, d * 0.94]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.35} roughness={0.4} />
      </mesh>
      {Array.from({ length: fans }, (_, index) => (
        <FanDisc key={index} x={(index - (fans - 1) / 2) * (w * 0.42)} y={h * 0.9} z={0} radius={fanR} flat />
      ))}
      <ServiceValves w={w} h={h} d={d} />
    </EquipFrame>
  )
}

function ComboMesh({ room, eq, onSelect, onContext }) {
  const duty = Math.max(4, eq.capacityKw || 8)
  const w = Math.max(eq.width || 1, Math.min(1.85, 1.05 + duty * 0.02))
  const h = Math.max(eq.height || 0.75, Math.min(1.2, 0.92 + duty * 0.008))
  const d = Math.max(0.42, eq.depth || 0.55)
  const fanR = Math.min(h * 0.34, w * 0.28, 0.42)
  const valveY = Math.min((eq.height || h) * 0.4, 0.48)
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      {[-1, 1].map((side) => (
        <group key={`bracket-${side}`}>
          <mesh position={[side * w * 0.28, 0.04, -d * 0.15]} castShadow>
            <boxGeometry args={[w * 0.16, 0.045, d * 0.72]} />
            <meshStandardMaterial color="#64748b" metalness={0.55} roughness={0.38} />
          </mesh>
          <mesh position={[side * w * 0.28, 0.16, -d / 2 - 0.1]} castShadow>
            <boxGeometry args={[0.045, 0.28, 0.22]} />
            <meshStandardMaterial color="#475569" metalness={0.5} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, h * 0.52, 0]} castShadow>
        <boxGeometry args={[w, h * 0.92, d * 0.92]} />
        <meshStandardMaterial color="#e8eef2" metalness={0.22} roughness={0.4} />
        <Edges threshold={16} color="#94a3b8" />
      </mesh>
      {Array.from({ length: 14 }, (_, index) => (
        <mesh key={`coil-${index}`} position={[(index - 6.5) * (w * 0.055), h * 0.52, d * 0.42]}>
          <boxGeometry args={[0.012, h * 0.72, 0.04]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.48} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[w * 0.5 - 0.012, h * 0.5, 0.02]}>
        <boxGeometry args={[0.02, h * 0.62, d * 0.55]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[w * 0.5 + 0.012, h * 0.48, 0.04]}>
        <boxGeometry args={[0.012, 0.08, 0.03]} />
        <meshStandardMaterial color="#334155" metalness={0.4} roughness={0.4} />
      </mesh>
      <FanDisc x={0} y={h * 0.52} z={d / 2 + 0.02} radius={fanR} />
      <ServiceValves w={w} h={valveY / 0.32} d={d} />
    </EquipFrame>
  )
}

function CompressorMesh({ room, eq, onSelect, onContext }) {
  const w = Math.max(0.6, eq.width || 0.9)
  const h = Math.max(0.8, eq.height || 1.2)
  const d = Math.max(0.4, eq.depth || 0.6)
  const count = w > 1.1 ? 3 : 2
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[w, 0.08, d]} />
        <meshStandardMaterial color="#44403c" metalness={0.45} roughness={0.45} />
      </mesh>
      {[-1, 1].map((x) => [-1, 1].map((z) => (
        <mesh key={`${x}${z}`} position={[x * (w / 2 - 0.04), h * 0.45, z * (d / 2 - 0.04)]}>
          <boxGeometry args={[0.05, h * 0.8, 0.05]} />
          <meshStandardMaterial color="#57534e" metalness={0.4} />
        </mesh>
      )))}
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} position={[(index - (count - 1) / 2) * (w * 0.28), h * 0.42, 0]} castShadow>
          <cylinderGeometry args={[0.16, 0.16, h * 0.55, 18]} />
          <meshStandardMaterial color="#111827" metalness={0.6} roughness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, h * 0.74, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.035, 0.035, w * 0.7, 12]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[w * 0.18, h * 0.22, d * 0.1]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, w * 0.28, 16]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[w * 0.34, h * 0.28, -d * 0.05]}>
        <cylinderGeometry args={[0.035, 0.035, 0.1, 12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[w * 0.34, h * 0.36, -d * 0.2]}>
        <cylinderGeometry args={[0.025, 0.025, 0.012, 12]} />
        <meshStandardMaterial color="#bfdbfe" metalness={0.2} roughness={0.15} />
      </mesh>
    </EquipFrame>
  )
}

function SensorMesh({ room, eq, onSelect, onContext }) {
  const color = eq.category === 'controller' ? '#0f766e' : eq.sensor === 'door' ? '#9a3412' : eq.sensor === 'defrost' ? '#c2410c' : '#0369a1'
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[eq.category === 'controller' ? 0.32 : 0.1, eq.category === 'controller' ? 0.2 : 0.1, 0.06]} />
        <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
      </mesh>
      {eq.category === 'controller' && (
        <mesh position={[0, 0.1, 0.04]}>
          <boxGeometry args={[0.18, 0.08, 0.01]} />
          <meshStandardMaterial color="#042f2e" />
        </mesh>
      )}
    </EquipFrame>
  )
}

function ColumnMesh({ room, eq, onSelect, onContext }) {
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      <mesh position={[0, eq.height / 2, 0]} castShadow>
        <boxGeometry args={[eq.width, eq.height, eq.depth]} />
        <meshStandardMaterial color="#a8a29e" roughness={0.85} />
      </mesh>
    </EquipFrame>
  )
}

function Rod({ ax, ay, az, bx, by, bz, radius, color }) {
  const ref = useRef()
  useEffect(() => {
    const dir = new THREE.Vector3(bx - ax, by - ay, bz - az)
    const len = dir.length()
    if (!ref.current || len < 1e-4) return
    ref.current.scale.set(1, len, 1)
    ref.current.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
    ref.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
  }, [ax, ay, az, bx, by, bz])
  return (
    <mesh ref={ref} castShadow>
      <cylinderGeometry args={[radius, radius, 1, 14]} />
      <meshStandardMaterial color={color} metalness={0.45} roughness={0.35} />
    </mesh>
  )
}

function BoxEquipment({ room, eq, onSelect, onContext, color }) {
  const h = Math.min(eq.height || 1, Math.max(0.4, room.height - 0.15))
  const y = Number.isFinite(eq.elevation) ? eq.elevation : 0
  return (
    <mesh
      position={[room.x + eq.x, y + h / 2, room.z + eq.z]}
      rotation={[0, -((eq.rotation || 0) * Math.PI) / 180, 0]}
      castShadow
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
      onContextMenu={(event) => openMenu(event, onContext, eq.id, 'equipment')}
    >
      <boxGeometry args={[eq.width, h, Math.max(eq.depth, 0.2)]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.2} />
    </mesh>
  )
}

function tagPosition(room) {
  const pts = outlineOf(room)
  let best = pts[0]
  pts.forEach((point) => {
    if (point.x + point.z < best.x + best.z) best = point
  })
  return [best.x, (room.height || 3) + 0.35, best.z]
}

function FloorTicks({ room, color }) {
  const geom = useMemo(() => {
    const pts = outlineOf(room)
    const thick = Math.max(0.04, room.wallThickness || 0.1)
    const positions = []
    pts.forEach((a, index) => {
      const b = pts[(index + 1) % pts.length]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 0.8) return
      const ux = dx / len
      const uz = dz / len
      let nx = -uz
      let nz = ux
      const mx = (a.x + b.x) / 2
      const mz = (a.z + b.z) / 2
      if (nx * (room.x - mx) + nz * (room.z - mz) < 0) {
        nx = -nx
        nz = -nz
      }
      for (let dist = 0.5; dist < len - 0.2; dist += 1) {
        const x = a.x + ux * dist + nx * (thick + 0.12)
        const z = a.z + uz * dist + nz * (thick + 0.12)
        positions.push(x, 0.045, z, x + nx * 0.14, 0.045, z + nz * 0.14)
      }
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [room])
  if (!geom.getAttribute('position')?.count) return null
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} />
    </lineSegments>
  )
}

function PerimeterTrim({ room, y, size, color, inset }) {
  const bars = useMemo(() => {
    const pts = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness || 0.1) + (inset || 0)) || []
    return pts.map((a, index) => {
      const b = pts[(index + 1) % pts.length]
      const dx = b.x - a.x
      const dz = b.z - a.z
      const len = Math.hypot(dx, dz)
      if (len < 0.2) return null
      return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, len, yaw: Math.atan2(dx, dz) }
    }).filter(Boolean)
  }, [room, inset])
  return bars.map((bar, index) => (
    <mesh key={index} position={[bar.x, y, bar.z]} rotation={[0, bar.yaw, 0]}>
      <boxGeometry args={[size, size, bar.len]} />
      <meshStandardMaterial color={color} roughness={0.72} />
    </mesh>
  ))
}

function RoomMesh({ room, selected, onSelect, onContext }) {
  const palette = usePalette()
  const shell = useMemo(() => shellGeometry(room), [room])
  const floor = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.05)
  }, [room])
  const ceiling = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.025)
  }, [room])
  return (
    <group>
      <mesh
        geometry={shell}
        castShadow
        receiveShadow
        onClick={(event) => {
          event.stopPropagation()
          onSelect(room.id)
        }}
        onContextMenu={(event) => openMenu(event, onContext, room.id, 'room')}
      >
        <meshStandardMaterial color={palette.wall} transparent opacity={selected ? palette.wallOpacity + 0.08 : palette.wallOpacity} roughness={0.06} metalness={0.02} depthWrite={false} side={THREE.DoubleSide} />
        <Edges threshold={12} color={selected ? '#ffffff' : palette.edge} />
      </mesh>
      <mesh geometry={floor} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={palette.floor} roughness={0.94} metalness={0.02} />
      </mesh>
      <PerimeterTrim room={room} y={0.055} size={0.018} color={isRefrigerated(room.type) ? (room.color || '#64748b') : '#94a3b8'} inset={0.015} />
      <PerimeterTrim room={room} y={0.09} size={0.045} color={palette.id === 'dark' ? '#8b95a1' : '#cbd5e1'} inset={0.0} />
      <PerimeterTrim room={room} y={room.height - 0.06} size={0.04} color={palette.id === 'dark' ? '#8b95a1' : '#cbd5e1'} inset={0.0} />
      {seamList(room).map((seam, index) => (
        <mesh key={`seam-${index}`} position={[seam.x, room.height / 2, seam.z]} rotation={[0, seam.yaw, 0]}>
          <boxGeometry args={[0.012, room.height * 0.96, 0.01]} />
          <meshStandardMaterial color={palette.id === 'dark' ? '#d5dde6' : '#64748b'} roughness={0.5} />
        </mesh>
      ))}
      <mesh geometry={ceiling} position={[0, room.height - 0.04, 0]}>
        <meshStandardMaterial color={palette.wall} transparent opacity={palette.ceilingOpacity} roughness={0.08} depthWrite={false} side={THREE.DoubleSide} />
        <Edges threshold={20} color={palette.edge} />
      </mesh>
      <FloorTicks room={room} color={palette.tick} />
      <Html position={tagPosition(room)} center zIndexRange={[20, 0]} wrapperClass="refcad-float" style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'stretch', background: '#1b1e22', color: '#f4f6f8', borderRadius: 8, overflow: 'hidden', fontSize: 12, fontWeight: 650, boxShadow: '0 6px 16px rgba(0,0,0,0.28)' }}>
          <span style={{ width: 4, background: '#3b82f6' }} />
          <span style={{ padding: '4px 10px' }}>{room.name || room.label || 'Huone'}</span>
        </div>
      </Html>
      {(room.equipment || []).map((eq) => {
        if (eq.category === 'door') return <DoorMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        if (eq.category === 'evaporator') return <EvaporatorMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        if (eq.category === 'condenser') return <CondenserMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        if (eq.category === 'combo' || eq.category === 'unit') return <ComboMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        if (eq.category === 'compressor') return <CompressorMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        if (eq.category === 'sensor' || eq.category === 'controller') return <SensorMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        if (eq.category === 'column') return <ColumnMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} />
        const color = eq.category === 'rack' ? '#a8a29e' : '#475569'
        return <BoxEquipment key={eq.id} room={room} eq={eq} onSelect={onSelect} onContext={onContext} color={color} />
      })}
    </group>
  )
}

function boundsOf(rooms) {
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let maxH = 2
  rooms.forEach((room) => {
    outlineOf(room).forEach((point) => {
      minX = Math.min(minX, point.x)
      maxX = Math.max(maxX, point.x)
      minZ = Math.min(minZ, point.z)
      maxZ = Math.max(maxZ, point.z)
    })
    maxH = Math.max(maxH, room.height || 2)
  })
  return {
    cx: (minX + maxX) / 2,
    cz: (minZ + maxZ) / 2,
    spanX: Math.max(1, maxX - minX),
    spanZ: Math.max(1, maxZ - minZ),
    maxH,
  }
}

function Frame({ rooms }) {
  const { camera, controls, size } = useThree()
  const signature = `${rooms.map((room) => room.id).join('|')}|${Math.round(size.width)}x${Math.round(size.height)}`
  const primed = useRef('')
  useEffect(() => {
    if (!rooms.length || !controls || size.width < 40 || size.height < 40) return undefined
    if (primed.current === signature) return undefined
    let cancelled = false
    const apply = () => {
      if (cancelled || !controls) return
      const { cx, cz, spanX, spanZ, maxH } = boundsOf(rooms)
      const radius = Math.hypot(spanX, maxH, spanZ) * 0.5
      const fov = (camera.fov * Math.PI) / 180
      const aspect = size.width / Math.max(size.height, 1)
      const distV = radius / Math.sin(fov / 2)
      const distH = radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect))
      const distance = Math.max(distV, distH) * 1.02
      const dir = new THREE.Vector3(1, 0.58, 1).normalize()
      const ty = maxH * 0.36
      controls.target.set(cx, ty, cz)
      camera.position.set(cx + dir.x * distance, ty + dir.y * distance, cz + dir.z * distance)
      camera.near = 0.08
      camera.far = Math.max(500, distance * 10)
      camera.updateProjectionMatrix()
      controls.update()
      primed.current = signature
    }
    const frame = requestAnimationFrame(apply)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [signature, rooms, camera, controls, size.width, size.height])
  return null
}

function serviceCeiling(rooms, point) {
  let best = null
  for (const room of rooms || []) {
    if (!room || room.type === 'yard') continue
    const inside = pointInOutline(point.x, point.z, outlineOf(room))
    const dist = inside ? 0 : Math.hypot(point.x - room.x, point.z - room.z)
    const cold = isRefrigerated(room.type)
    const rank = (inside ? 0 : 1) + (cold ? 0 : 2)
    if (!best || rank < best.rank || (rank === best.rank && dist < best.dist)) best = { room, rank, dist }
  }
  return Math.max(1.8, internalCeiling(best?.room || { height: 3, ceilingThickness: 0.1 }) - 0.2)
}

function anchorHeight(rooms, point, kind, atPort) {
  if (atPort) {
    let best = null
    for (const room of rooms) {
      for (const eq of room.equipment || []) {
        const ports = equipmentPorts(room, eq)
        if (!ports) continue
        const keys = kind === 'drain' ? ['drain'] : kind === 'hotgas' ? ['hotgas', 'discharge'] : kind === 'liquid' ? ['liquid', 'liquidIn', 'liquidOut'] : [kind]
        for (const key of keys) {
          const port = ports[key]
          if (!port) continue
          const dist = Math.hypot(port.x - point.x, port.z - point.z)
          if (dist > 0.85 || (best && dist >= best.dist)) continue
          const base = resolvedElevation(room, eq)
          const h = eq.height || 0.4
          const y = kind === 'drain'
            ? Math.max(0.16, base + 0.04)
            : eq.category === 'evaporator'
              ? base + h * 0.42
              : base + Math.min(h * 0.34, 0.5)
          best = { dist, y }
        }
      }
    }
    if (best) return best.y
  }
  if (kind === 'drain') return 0.28
  return serviceCeiling(rooms, point)
}

function pushLeg(legs, x1, y1, z1, x2, y2, z2) {
  if (Math.hypot(x2 - x1, y2 - y1, z2 - z1) < 0.03) return
  legs.push([x1, y1, z1, x2, y2, z2])
}

function elbowRuns(a, b, ya, yb) {
  const dx = b.x - a.x
  const dz = b.z - a.z
  const horiz = Math.hypot(dx, dz)
  if (horiz < 0.04 && Math.abs(ya - yb) < 0.04) return []
  const legs = []
  const axis = Math.abs(dx) < 0.04 || Math.abs(dz) < 0.04
  if (!axis) {
    const y = Math.max(ya, yb)
    pushLeg(legs, a.x, ya, a.z, a.x, y, a.z)
    pushLeg(legs, a.x, y, a.z, b.x, y, a.z)
    pushLeg(legs, b.x, y, a.z, b.x, y, b.z)
    pushLeg(legs, b.x, y, b.z, b.x, yb, b.z)
    return legs
  }
  if (Math.abs(ya - yb) < 0.05) {
    pushLeg(legs, a.x, ya, a.z, b.x, yb, b.z)
    return legs
  }
  if (yb < ya) {
    pushLeg(legs, a.x, ya, a.z, b.x, ya, b.z)
    pushLeg(legs, b.x, ya, b.z, b.x, yb, b.z)
  } else {
    pushLeg(legs, a.x, ya, a.z, a.x, yb, a.z)
    pushLeg(legs, a.x, yb, a.z, b.x, yb, b.z)
  }
  return legs
}

function filletPath(points, radius) {
  const path = new THREE.CurvePath()
  const vectors = points.map((point) => new THREE.Vector3(point[0], point[1], point[2]))
  if (vectors.length < 2) return null
  if (vectors.length === 2) {
    path.add(new THREE.LineCurve3(vectors[0], vectors[1]))
    return path
  }
  let cursor = vectors[0]
  for (let i = 1; i < vectors.length - 1; i += 1) {
    const prev = vectors[i - 1]
    const curr = vectors[i]
    const next = vectors[i + 1]
    const inDir = curr.clone().sub(prev)
    const outDir = next.clone().sub(curr)
    const inLen = inDir.length()
    const outLen = outDir.length()
    if (inLen < 1e-4 || outLen < 1e-4) continue
    inDir.multiplyScalar(1 / inLen)
    outDir.multiplyScalar(1 / outLen)
    const angle = Math.acos(THREE.MathUtils.clamp(inDir.dot(outDir), -1, 1))
    if (angle < 0.15) continue
    const trim = Math.min(radius, inLen * 0.45, outLen * 0.45)
    const start = curr.clone().addScaledVector(inDir, -trim)
    const end = curr.clone().addScaledVector(outDir, trim)
    if (cursor.distanceTo(start) > 1e-3) path.add(new THREE.LineCurve3(cursor, start))
    path.add(new THREE.QuadraticBezierCurve3(start, curr, end))
    cursor = end
  }
  const last = vectors[vectors.length - 1]
  if (cursor.distanceTo(last) > 1e-3) path.add(new THREE.LineCurve3(cursor, last))
  return path.curves.length ? path : null
}

function SmoothTube({ encoded, radius, color, metalness = 0.25, roughness = 0.4 }) {
  const geom = useMemo(() => {
    const pts = JSON.parse(encoded)
    const path = filletPath(pts, Math.max(0.16, radius * 4))
    if (!path) return null
    const length = path.getLength()
    if (length < 0.05) return null
    return new THREE.TubeGeometry(path, Math.min(220, Math.max(16, Math.ceil(length / 0.06))), radius, 12, false)
  }, [encoded, radius])
  useEffect(() => () => geom?.dispose(), [geom])
  if (!geom) return null
  return (
    <mesh geometry={geom} castShadow>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

function tubeStyle(pipe) {
  const od = Number(pipe?.odMm) || Number(pipe?.sizeMm) || 0
  const copper = od > 4 ? od / 2000 : pipe?.kind === 'suction' ? 0.011 : pipe?.kind === 'hotgas' ? 0.008 : pipe?.kind === 'liquid' ? 0.0065 : 0.01
  if (pipe?.kind === 'suction') return { radius: copper + 0.016, color: '#1c1917', metalness: 0.06, roughness: 0.88 }
  if (pipe?.kind === 'liquid') return { radius: Math.max(0.012, copper), color: '#d4894a', metalness: 0.78, roughness: 0.28 }
  if (pipe?.kind === 'hotgas') return { radius: copper + 0.012, color: '#7f1d1d', metalness: 0.18, roughness: 0.62 }
  if (pipe?.kind === 'drain') return { radius: 0.014, color: pipe.roomTempC < 0 ? '#9a3412' : '#e7e5e4', metalness: 0.08, roughness: 0.55 }
  return { radius: Math.max(0.01, copper), color: '#1d4ed8', metalness: 0.2, roughness: 0.4 }
}

function wallCrossings(rooms, points) {
  const hits = []
  const hostAt = (x, z) => (rooms || []).find((room) => room.type !== 'yard' && pointInOutline(x, z, outlineOf(room)))
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]
    const b = points[i]
    let prev = hostAt(a[0], a[2])
    const steps = 12
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps
      const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
      const next = hostAt(p[0], p[2])
      if ((prev?.id || '') !== (next?.id || '')) {
        const dx = b[0] - a[0]
        const dy = b[1] - a[1]
        const dz = b[2] - a[2]
        const len = Math.hypot(dx, dy, dz) || 1
        const hit = { x: p[0], y: p[1], z: p[2], dx: dx / len, dy: dy / len, dz: dz / len }
        const prior = hits[hits.length - 1]
        if (!prior || Math.hypot(prior.x - hit.x, prior.y - hit.y, prior.z - hit.z) > 0.45) hits.push(hit)
      }
      prev = next
    }
  }
  return hits
}

function clipPoints(sharp) {
  const clips = []
  for (let i = 1; i < sharp.length; i += 1) {
    const a = sharp[i - 1]
    const b = sharp[i]
    const horiz = Math.hypot(b[0] - a[0], b[2] - a[2])
    if (horiz < 0.9 || Math.abs(b[1] - a[1]) > 0.08) continue
    const count = Math.max(1, Math.round(horiz / 1.25))
    for (let step = 1; step <= count; step += 1) {
      const t = step / (count + 1)
      clips.push([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
      ])
    }
  }
  return clips
}

function Sleeve({ x, y, z, dx, dy, dz, radius }) {
  const ref = useRef()
  useEffect(() => {
    if (!ref.current) return
    ref.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx, dy, dz))
  }, [dx, dy, dz])
  return (
    <mesh ref={ref} position={[x, y, z]}>
      <cylinderGeometry args={[radius, radius, 0.16, 14]} />
      <meshStandardMaterial color="#f5f5f4" metalness={0.28} roughness={0.42} />
    </mesh>
  )
}

function PipeRuns({ rooms, pipes }) {
  return (pipes || []).map((pipe) => {
    const traced = pipe.kind === 'drain' && pipe.roomTempC < 0
    const style = tubeStyle(pipe)
    const points = pipe.points || []
    const heights = points.map((point, index) => anchorHeight(rooms, point, pipe.kind, index === 0 || index === points.length - 1))
    const sharp = []
    points.slice(1).forEach((point, index) => {
      elbowRuns(points[index], point, heights[index], heights[index + 1]).forEach((run) => {
        const start = [run[0], run[1], run[2]]
        const end = [run[3], run[4], run[5]]
        if (!sharp.length) sharp.push(start)
        const last = sharp[sharp.length - 1]
        if (Math.hypot(last[0] - start[0], last[1] - start[1], last[2] - start[2]) > 0.02) sharp.push(start)
        sharp.push(end)
      })
    })
    if (sharp.length < 2) return null
    const encoded = JSON.stringify(sharp)
    const sleeves = wallCrossings(rooms, sharp)
    return (
      <group key={pipe.id}>
        <SmoothTube encoded={encoded} radius={style.radius} color={style.color} metalness={style.metalness} roughness={style.roughness} />
        {traced && (
          <SmoothTube
            encoded={JSON.stringify(sharp.map((point) => [point[0], point[1] + style.radius + 0.01, point[2]]))}
            radius={0.006}
            color="#fdba74"
            metalness={0.2}
            roughness={0.45}
          />
        )}
        {sleeves.map((sleeve, index) => (
          <Sleeve key={index} x={sleeve.x} y={sleeve.y} z={sleeve.z} dx={sleeve.dx} dy={sleeve.dy} dz={sleeve.dz} radius={style.radius + 0.02} />
        ))}
        {(pipe.kind === 'suction' || pipe.kind === 'liquid') && clipPoints(sharp).map((clip, index) => (
          <group key={`clip-${index}`} position={clip}>
            <mesh position={[0, 0.045, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.09, 6]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.6} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0.012, 0]}>
              <boxGeometry args={[style.radius * 2.4, 0.012, 0.012]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.55} roughness={0.34} />
            </mesh>
          </group>
        ))}
      </group>
    )
  })
}

function ViewBridge({ rigRef, onHeading }) {
  const { camera, controls } = useThree()
  const last = useRef(999)
  const scratch = useRef({ north: new THREE.Vector3(0, 0, -1), right: new THREE.Vector3(), up: new THREE.Vector3() })
  useFrame(() => {
    if (!controls) return
    const { north, right, up } = scratch.current
    right.setFromMatrixColumn(camera.matrixWorld, 0)
    up.setFromMatrixColumn(camera.matrixWorld, 1)
    const deg = (Math.atan2(north.dot(right), north.dot(up)) * 180) / Math.PI
    if (Math.abs(deg - last.current) < 0.6) return
    last.current = deg
    onHeading(deg)
  })
  useEffect(() => {
    rigRef.current = {
      yaw(delta) {
        if (!controls) return
        const offset = camera.position.clone().sub(controls.target)
        offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), delta)
        camera.position.copy(controls.target).add(offset)
        camera.lookAt(controls.target)
        controls.update()
      },
    }
    return () => { rigRef.current = null }
  }, [camera, controls, rigRef])
  return null
}

function compassMark(label, heading, extra, color) {
  const rad = ((heading + extra) * Math.PI) / 180
  const x = Math.sin(rad) * 26
  const y = -Math.cos(rad) * 26
  return (
    <span key={label} style={{ position: 'absolute', left: '50%', top: '50%', transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`, color, fontSize: 11, fontWeight: 700 }}>{label}</span>
  )
}

export default function Scene3D({ rooms, pipes = [], selectedId, onSelect, onContext, unitSystem }) {
  const [theme, setTheme] = useState('dark')
  const [heading, setHeading] = useState(0)
  const rigRef = useRef(null)
  const palette = PALETTES[theme]
  const roundBtn = {
    width: 28, height: 28, borderRadius: 14, border: `1px solid ${palette.hintBorder}`,
    background: palette.hintBg, color: palette.hintFg, cursor: 'pointer',
  }
  return (
    <SceneTheme.Provider value={palette}>
      <div data-testid="iso-canvas" data-theme={theme} style={{ position: 'relative', width: '100%', height: '100%', background: palette.bg, overflow: 'hidden' }}>
        <Canvas
          shadows
          camera={{ position: [18, 14, 18], fov: 38, near: 0.08, far: 500 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: theme === 'dark' ? 1.08 : 1 }}
          onPointerMissed={() => onSelect(null)}
        >
          <color attach="background" args={[palette.bg]} />
          <hemisphereLight args={[theme === 'dark' ? '#d5dee8' : '#ffffff', theme === 'dark' ? '#2a3038' : '#94a3b8', 0.55]} />
          <ambientLight intensity={theme === 'dark' ? 0.28 : 0.42} />
          <directionalLight
            position={[12, 18, 8]}
            intensity={theme === 'dark' ? 1.35 : 1.15}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-bias={-0.0004}
            shadow-camera-near={0.5}
            shadow-camera-far={48}
            shadow-camera-left={-16}
            shadow-camera-right={16}
            shadow-camera-top={16}
            shadow-camera-bottom={-16}
          />
          <directionalLight position={[-8, 7, -12]} intensity={0.28} />
          <ContactShadows position={[0, 0.012, 0]} opacity={theme === 'dark' ? 0.45 : 0.28} scale={28} blur={2.2} far={8} />
          <Grid
            args={[1, 1]}
            position={[0, 0.004, 0]}
            cellSize={1}
            cellThickness={0.6}
            cellColor={palette.gridCell}
            sectionSize={5}
            sectionThickness={1.15}
            sectionColor={palette.gridSection}
            fadeDistance={55}
            fadeStrength={1.5}
            infiniteGrid
            side={THREE.DoubleSide}
          />
          {rooms.map((room) => (
            room.type === 'yard' ? (
              <mesh
                key={room.id}
                position={[room.x, 0.03, room.z]}
                onClick={(event) => { event.stopPropagation(); onSelect(room.id) }}
                onContextMenu={(event) => openMenu(event, onContext, room.id, 'room')}
              >
                <boxGeometry args={[room.width, 0.04, room.depth]} />
                <meshStandardMaterial color={theme === 'dark' ? '#2a3328' : '#d9e7c4'} transparent opacity={0.45} />
              </mesh>
            ) : (
              <RoomMesh key={room.id} room={room} selected={room.id === selectedId} onSelect={onSelect} onContext={onContext} />
            )
          ))}
          <PipeRuns rooms={rooms} pipes={pipes} />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            maxPolarAngle={Math.PI / 2.05}
            mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 }}
          />
          <Frame rooms={rooms} />
          <ViewBridge rigRef={rigRef} onHeading={setHeading} />
        </Canvas>
        <div data-testid="scene-compass" style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 5 }}>
          <button type="button" data-testid="scene-yaw-left" aria-label="Kierrä vasemmalle" style={roundBtn} onClick={() => rigRef.current?.yaw(Math.PI / 6)}>↺</button>
          <div style={{ width: 74, height: 74, position: 'relative' }}>
            {compassMark('N', heading, 0, '#ef4444')}
            {compassMark('E', heading, 90, palette.hintFg)}
            {compassMark('S', heading, 180, palette.hintFg)}
            {compassMark('W', heading, 270, palette.hintFg)}
            <span style={{ position: 'absolute', left: '50%', top: '50%', width: 6, height: 6, margin: '-3px 0 0 -3px', borderRadius: 3, background: '#ef4444' }} />
          </div>
          <button type="button" data-testid="scene-yaw-right" aria-label="Kierrä oikealle" style={roundBtn} onClick={() => rigRef.current?.yaw(-Math.PI / 6)}>↻</button>
        </div>
        <button
          type="button"
          data-testid="scene-theme"
          onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
          style={{ position: 'absolute', right: 12, bottom: 10, zIndex: 5, ...roundBtn, width: 'auto', padding: '0 10px', borderRadius: 8 }}
        >
          {theme === 'dark' ? 'Vaalea' : 'Tumma'}
        </button>
        <div style={{
          position: 'absolute', left: 12, bottom: 10, padding: '6px 10px',
          background: palette.hintBg, border: `1px solid ${palette.hintBorder}`, borderRadius: 8,
          fontSize: 11, color: palette.hintFg, pointerEvents: 'none',
        }}>
          Vedä kiertää · keskinäppäin siirtää · oikea näppäin valikko · rulla zoomaa
          {unitSystem === 'IP' ? ' · mitat jalkoina paneelissa' : ''}
        </div>
      </div>
    </SceneTheme.Provider>
  )
}
