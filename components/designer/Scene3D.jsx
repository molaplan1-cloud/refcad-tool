'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { insetOrthogonal, outlineOf } from '@/lib/cadDraw'
import { isRefrigerated } from '@/lib/catalog'
import { equipmentPorts, internalCeiling, resolvedElevation } from '@/lib/placement'

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
  const wall = eq.wall || 's'
  const yaw = { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[wall] ?? 0
  const thick = Math.max(0.08, room.wallThickness || 0.1)
  const out = thick / 2 + 0.045
  const ox = wall === 'e' ? out : wall === 'w' ? -out : 0
  const oz = wall === 's' ? out : wall === 'n' ? -out : 0
  const w = Math.max(0.6, eq.width || 0.9)
  const h = Math.max(1.8, eq.height || 2.1)
  return (
    <group
      position={[room.x + eq.x + ox, 0, room.z + eq.z + oz]}
      rotation={[0, yaw, 0]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
      onContextMenu={(event) => openMenu(event, onContext, eq.id, 'equipment')}
    >
      <mesh position={[0, h / 2, 0]} castShadow>
        <boxGeometry args={[w + 0.1, h + 0.06, 0.09]} />
        <meshStandardMaterial color="#44403c" roughness={0.45} metalness={0.42} />
      </mesh>
      <mesh position={[0, (h - 0.04) / 2, 0.055]} castShadow>
        <boxGeometry args={[w - 0.08, h - 0.12, 0.055]} />
        <meshStandardMaterial color="#f4f4f1" roughness={0.32} metalness={0.22} />
      </mesh>
      <mesh position={[0, h * 0.46, 0.09]}>
        <boxGeometry args={[w - 0.16, 0.045, 0.018]} />
        <meshStandardMaterial color="#d6d3d1" roughness={0.3} metalness={0.45} />
      </mesh>
      <mesh position={[w * 0.36, h * 0.48, 0.11]} castShadow>
        <boxGeometry args={[0.035, 0.32, 0.045]} />
        <meshStandardMaterial color="#1c1917" roughness={0.28} metalness={0.62} />
      </mesh>
      <mesh position={[w * 0.36, h * 0.62, 0.1]}>
        <boxGeometry args={[0.09, 0.028, 0.03]} />
        <meshStandardMaterial color="#1c1917" roughness={0.28} metalness={0.62} />
      </mesh>
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
  return (
    <group position={[x, y, z]}>
      <mesh rotation={flat ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <torusGeometry args={[radius, 0.012, 8, 20]} />
        <meshStandardMaterial color="#0f172a" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh rotation={flat ? [0, 0, 0] : [Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.9, radius * 0.9, 0.02, 20]} />
        <meshStandardMaterial color="#0f172a" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh rotation={flat ? [0, 0, 0] : [Math.PI / 2, 0, 0]} position={flat ? [0, 0.012, 0] : [0, 0, 0.014]}>
        <cylinderGeometry args={[radius * 0.22, radius * 0.22, 0.018, 12]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
      </mesh>
    </group>
  )
}

function useSlantGeometry(w, h, d) {
  return useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-d / 2, 0)
    shape.lineTo(d / 2, 0)
    shape.lineTo(d / 2, h * 0.34)
    shape.lineTo(-d / 2, h)
    shape.closePath()
    const geom = new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false })
    geom.translate(0, 0, -w / 2)
    geom.rotateY(-Math.PI / 2)
    geom.computeVertexNormals()
    return geom
  }, [w, h, d])
}

function EvaporatorMesh({ room, eq, onSelect, onContext }) {
  const w = Math.max(0.7, eq.width || 1.2)
  const h = Math.max(0.18, eq.height || 0.45)
  const d = Math.max(0.4, eq.depth || 0.6)
  const slant = eq.style === 'slant'
  const geom = useSlantGeometry(w, h, d)
  const fans = w > 1.7 ? 3 : 2
  const fanR = Math.min(slant ? h * 0.55 : h * 0.28, (w * 0.7) / fans / 2.1)
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      {slant ? (
        <mesh geometry={geom} castShadow>
          <meshStandardMaterial color="#f8fafc" roughness={0.36} metalness={0.32} />
        </mesh>
      ) : (
        <mesh position={[0, h / 2, 0]} castShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.38} metalness={0.28} />
        </mesh>
      )}
      {Array.from({ length: fans }, (_, index) => {
        const x = (index - (fans - 1) / 2) * (w * 0.28)
        const y = slant ? h * 0.24 : h / 2
        return <FanDisc key={index} x={x} y={y} z={d / 2 + 0.03} radius={fanR} />
      })}
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[w * 0.96, 0.025, d * 0.92]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.4} roughness={0.35} />
      </mesh>
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
        <meshStandardMaterial color="#1e293b" metalness={0.35} roughness={0.62} />
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
  const w = Math.max(0.7, eq.width || 1)
  const h = Math.max(0.5, eq.height || 0.75)
  const d = Math.max(0.4, eq.depth || 0.55)
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * w * 0.3, 0.04, 0]}>
          <boxGeometry args={[w * 0.28, 0.08, d * 0.86]} />
          <meshStandardMaterial color="#44403c" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[-w * 0.24, h * 0.38, 0]} castShadow>
        <cylinderGeometry args={[Math.min(0.22, d * 0.28), Math.min(0.22, d * 0.28), h * 0.62, 20]} />
        <meshStandardMaterial color="#1f2937" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[-w * 0.24, h * 0.72, 0]}>
        <boxGeometry args={[0.16, 0.08, 0.1]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[w * 0.16, h * 0.36, 0]} castShadow>
        <boxGeometry args={[w * 0.48, h * 0.5, d * 0.7]} />
        <meshStandardMaterial color="#1e293b" metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[w * 0.16, h * 0.66, 0]}>
        <boxGeometry args={[w * 0.5, 0.04, d * 0.78]} />
        <meshStandardMaterial color="#f8fafc" metalness={0.35} roughness={0.4} />
      </mesh>
      <FanDisc x={w * 0.16} y={h * 0.74} z={0} radius={Math.min(0.18, w * 0.14)} flat />
      <ServiceValves w={w} h={h} d={d} />
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

function RoomMesh({ room, selected, onSelect, onContext }) {
  const shell = useMemo(() => shellGeometry(room), [room])
  const floor = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.05)
  }, [room])
  const ceiling = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.025)
  }, [room])
  const seams = useMemo(() => seamList(room), [room])
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
        <meshStandardMaterial color={isRefrigerated(room.type) ? (selected ? '#f7f4ee' : '#ebe6dc') : '#d6d3d1'} roughness={0.78} metalness={0.04} />
        <Edges threshold={18} color="#a8a29e" />
      </mesh>
      {seams.map((seam, index) => (
        <mesh key={index} position={[seam.x, room.height / 2, seam.z]} rotation={[0, seam.yaw, 0]} castShadow>
          <boxGeometry args={[0.018, room.height * 0.985, seam.depth]} />
          <meshStandardMaterial color="#c4bfb6" roughness={0.7} />
        </mesh>
      ))}
      <mesh geometry={floor} position={[0, room.type === 'yard' ? 0.01 : 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={isRefrigerated(room.type) ? (room.color || '#3b82f6') : (room.type === 'yard' ? '#d9e7c4' : '#e7e5e4')} roughness={0.92} />
      </mesh>
      {isRefrigerated(room.type) && (
        <mesh geometry={ceiling} position={[0, room.height - 0.02, 0]}>
          <meshStandardMaterial color="#f8fafc" transparent opacity={0.22} roughness={0.15} metalness={0.05} depthWrite={false} />
        </mesh>
      )}
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

function anchorHeight(rooms, point, kind) {
  let best = null
  for (const room of rooms) {
    for (const eq of room.equipment || []) {
      const ports = equipmentPorts(room, eq)
      if (!ports) continue
      const keys = kind === 'drain' ? ['drain'] : [kind]
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
  const host = rooms.find((item) => point && Math.abs(item.x - point.x) <= item.width / 2 + 0.4 && Math.abs(item.z - point.z) <= item.depth / 2 + 0.4)
  const ceil = internalCeiling(host || { height: 3, ceilingThickness: 0.1 })
  if (kind === 'liquid') return Math.max(1.1, ceil - 0.7)
  if (kind === 'drain') return 0.22
  return Math.max(1.4, ceil - 0.35)
}

function elbowRuns(a, b, ya, yb) {
  const horiz = Math.hypot(b.x - a.x, b.z - a.z)
  if (horiz < 0.05 && Math.abs(ya - yb) < 0.05) return []
  if (Math.abs(ya - yb) < 0.2 || horiz < 0.35) {
    return [[a.x, ya, a.z, b.x, yb, b.z]]
  }
  const drop = Math.min(0.28, horiz * 0.35)
  const along = (horiz - drop) / horiz
  const lowAtEnd = yb < ya
  const t = lowAtEnd ? along : 1 - along
  const mx = a.x + (b.x - a.x) * t
  const mz = a.z + (b.z - a.z) * t
  if (lowAtEnd) {
    return [
      [a.x, ya, a.z, mx, ya, mz],
      [mx, ya, mz, mx, yb, mz],
      [mx, yb, mz, b.x, yb, b.z],
    ]
  }
  return [
    [a.x, ya, a.z, mx, ya, mz],
    [mx, ya, mz, mx, yb, mz],
    [mx, yb, mz, b.x, yb, b.z],
  ]
}

function PipeRuns({ rooms, pipes }) {
  return (pipes || []).map((pipe) => {
    const color = pipe.kind === 'suction' ? '#1d4ed8' : pipe.kind === 'liquid' ? '#15803d' : '#c2410c'
    const radius = pipe.kind === 'drain' && (pipe.roomTempC < 0) ? 0.045 : 0.028
    const points = pipe.points || []
    const heights = points.map((point) => anchorHeight(rooms, point, pipe.kind))
    const runs = []
    points.slice(1).forEach((point, index) => {
      elbowRuns(points[index], point, heights[index], heights[index + 1]).forEach((run) => runs.push(run))
    })
    return (
      <group key={pipe.id}>
        {runs.map((run, index) => (
          <Rod
            key={`${pipe.id}-${index}`}
            ax={run[0]}
            ay={run[1]}
            az={run[2]}
            bx={run[3]}
            by={run[4]}
            bz={run[5]}
            radius={radius}
            color={color}
          />
        ))}
        {pipe.kind === 'drain' && pipe.roomTempC < 0 && runs.map((run, index) => (
          <Rod
            key={`${pipe.id}-trace-${index}`}
            ax={run[0]}
            ay={run[1] + 0.06}
            az={run[2]}
            bx={run[3]}
            by={run[4] + 0.06}
            bz={run[5]}
            radius={0.012}
            color="#fdba74"
          />
        ))}
      </group>
    )
  })
}

export default function Scene3D({ rooms, pipes = [], selectedId, onSelect, onContext, unitSystem }) {
  return (
    <div data-testid="iso-canvas" style={{ position: 'relative', width: '100%', height: '100%', background: '#d5d9e0' }}>
      <Canvas
        shadows
        camera={{ position: [18, 14, 18], fov: 38, near: 0.08, far: 500 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#d5d9e0']} />
        <hemisphereLight args={['#f8fafc', '#94a3b8', 0.62]} />
        <ambientLight intensity={0.28} />
        <directionalLight
          position={[16, 22, 10]}
          intensity={1.25}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-near={1}
          shadow-camera-far={70}
          shadow-camera-left={-22}
          shadow-camera-right={22}
          shadow-camera-top={22}
          shadow-camera-bottom={-22}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-10, 8, -12]} intensity={0.28} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow>
          <planeGeometry args={[160, 160]} />
          <meshStandardMaterial color="#eceae6" roughness={1} />
        </mesh>
        {rooms.map((room) => (
          room.type === 'yard' ? (
            <mesh
              key={room.id}
              position={[room.x, 0.03, room.z]}
              onClick={(event) => { event.stopPropagation(); onSelect(room.id) }}
              onContextMenu={(event) => openMenu(event, onContext, room.id, 'room')}
            >
              <boxGeometry args={[room.width, 0.06, room.depth]} />
              <meshStandardMaterial color="#d9e7c4" roughness={1} />
            </mesh>
          ) : (
            <RoomMesh key={room.id} room={room} selected={room.id === selectedId} onSelect={onSelect} onContext={onContext} />
          )
        ))}
        <PipeRuns rooms={rooms} pipes={pipes} />
        <ContactShadows position={[0, 0, 0]} opacity={0.38} scale={48} blur={2.4} far={8} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          maxPolarAngle={Math.PI / 2.08}
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 }}
        />
        <Frame rooms={rooms} />
      </Canvas>
      <div style={{
        position: 'absolute', left: 12, bottom: 10, padding: '6px 10px',
        background: 'rgba(255,255,255,0.9)', border: '1px solid #e7e5e4', borderRadius: 8,
        fontSize: 11, color: '#57534e', pointerEvents: 'none',
      }}>
        Vedä kiertää · keskinäppäin siirtää · oikea näppäin valikko · rulla zoomaa
        {unitSystem === 'IP' ? ' · mitat jalkoina paneelissa' : ''}
      </div>
    </div>
  )
}
