'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { insetOrthogonal, outlineOf } from '@/lib/cadDraw'

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

function DoorMesh({ room, eq, onSelect }) {
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

function EvaporatorMesh({ room, eq, onSelect }) {
  const w = Math.max(0.7, eq.width || 1.2)
  const h = Math.max(0.32, eq.height || 0.45)
  const d = Math.max(0.4, eq.depth || 0.6)
  const y = Math.max(h / 2 + 0.2, room.height - h / 2 - 0.22)
  const fans = w > 1.7 ? 3 : 2
  const fanR = Math.min(h * 0.32, (w * 0.72) / fans / 2.2)
  return (
    <group
      position={[room.x + eq.x, y, room.z + eq.z]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
    >
      <mesh castShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.38} metalness={0.28} />
      </mesh>
      <mesh position={[0, 0, d / 2 + 0.012]}>
        <boxGeometry args={[w * 0.9, h * 0.7, 0.02]} />
        <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.25} />
      </mesh>
      {Array.from({ length: fans }, (_, index) => {
        const x = (index - (fans - 1) / 2) * (w * 0.3)
        return (
          <group key={index} position={[x, 0, d / 2 + 0.028]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[fanR, fanR, 0.03, 24]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.45} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
              <cylinderGeometry args={[fanR * 0.28, fanR * 0.28, 0.02, 12]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.25} metalness={0.7} />
            </mesh>
          </group>
        )
      })}
      <mesh position={[0, -h / 2 - 0.02, 0]} castShadow>
        <boxGeometry args={[w * 0.96, 0.028, d * 0.92]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.35} metalness={0.4} />
      </mesh>
    </group>
  )
}

function BoxEquipment({ room, eq, onSelect, color }) {
  const alongX = eq.rotation !== 90
  const w = alongX ? eq.width : eq.depth
  const d = alongX ? eq.depth : eq.width
  const h = Math.min(eq.height || 1, Math.max(0.4, room.height - 0.15))
  return (
    <mesh
      position={[room.x + eq.x, h / 2, room.z + eq.z]}
      castShadow
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
    >
      <boxGeometry args={[w, h, Math.max(d, 0.2)]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.2} />
    </mesh>
  )
}

function RoomMesh({ room, selected, onSelect }) {
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
      >
        <meshStandardMaterial color={selected ? '#f7f4ee' : '#ebe6dc'} roughness={0.78} metalness={0.04} />
        <Edges threshold={18} color="#a8a29e" />
      </mesh>
      {seams.map((seam, index) => (
        <mesh key={index} position={[seam.x, room.height / 2, seam.z]} rotation={[0, seam.yaw, 0]} castShadow>
          <boxGeometry args={[0.018, room.height * 0.985, seam.depth]} />
          <meshStandardMaterial color="#c4bfb6" roughness={0.7} />
        </mesh>
      ))}
      <mesh geometry={floor} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={room.color || '#3b82f6'} roughness={0.92} />
      </mesh>
      <mesh geometry={ceiling} position={[0, room.height - 0.02, 0]}>
        <meshStandardMaterial color="#f8fafc" transparent opacity={0.22} roughness={0.15} metalness={0.05} depthWrite={false} />
      </mesh>
      {(room.equipment || []).map((eq) => {
        if (eq.category === 'door') return <DoorMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} />
        if (eq.category === 'evaporator') return <EvaporatorMesh key={eq.id} room={room} eq={eq} onSelect={onSelect} />
        const color = eq.category === 'condenser' ? '#64748b' : eq.category === 'rack' ? '#a8a29e' : '#475569'
        return <BoxEquipment key={eq.id} room={room} eq={eq} onSelect={onSelect} color={color} />
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

export default function Scene3D({ rooms, selectedId, onSelect, unitSystem }) {
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
          <RoomMesh key={room.id} room={room} selected={room.id === selectedId} onSelect={onSelect} />
        ))}
        <ContactShadows position={[0, 0, 0]} opacity={0.38} scale={48} blur={2.4} far={8} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.08} />
        <Frame rooms={rooms} />
      </Canvas>
      <div style={{
        position: 'absolute', left: 12, bottom: 10, padding: '6px 10px',
        background: 'rgba(255,255,255,0.9)', border: '1px solid #e7e5e4', borderRadius: 8,
        fontSize: 11, color: '#57534e', pointerEvents: 'none',
      }}>
        Vedä kiertää · oikea tai keskinäppäin siirtää · rulla zoomaa
        {unitSystem === 'IP' ? ' · mitat jalkoina paneelissa' : ''}
      </div>
    </div>
  )
}
