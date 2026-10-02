'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
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

function RoomMesh({ room, selected, onSelect }) {
  const shell = useMemo(() => shellGeometry(room), [room])
  const floor = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.06)
  }, [room])
  const ceiling = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.04)
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
      >
        <meshStandardMaterial color={selected ? '#f5f5f4' : '#e7e2d8'} roughness={0.82} metalness={0.04} />
      </mesh>
      <mesh geometry={floor} position={[0, 0.02, 0]} receiveShadow>
        <meshStandardMaterial color={room.color || '#3b82f6'} roughness={0.9} />
      </mesh>
      <mesh geometry={ceiling} position={[0, room.height - 0.04, 0]}>
        <meshStandardMaterial color="#f8fafc" transparent opacity={0.18} roughness={0.4} />
      </mesh>
      {(room.equipment || []).map((eq) => {
        const alongX = eq.rotation !== 90
        const w = alongX ? eq.width : eq.depth
        const d = alongX ? eq.depth : eq.width
        const y = eq.category === 'evaporator'
          ? Math.max(eq.height / 2, room.height - eq.height / 2 - 0.25)
          : eq.height / 2
        const color = eq.category === 'door' ? '#9a3412' : eq.category === 'evaporator' ? '#7dd3fc' : '#fbbf24'
        return (
          <group key={eq.id} position={[room.x + eq.x, y, room.z + eq.z]}>
            <mesh
              castShadow
              onClick={(event) => {
                event.stopPropagation()
                onSelect(eq.id)
              }}
            >
              <boxGeometry args={[w, eq.height, Math.max(d, 0.06)]} />
              <meshStandardMaterial color={color} roughness={eq.category === 'evaporator' ? 0.35 : 0.6} metalness={eq.category === 'evaporator' ? 0.45 : 0.05} />
            </mesh>
            {eq.category === 'evaporator' && [ -0.28, 0, 0.28 ].map((offset) => (
              <mesh key={offset} position={[offset * w, -eq.height / 2 - 0.12, 0]} rotation={[Math.PI, 0, 0]} castShadow>
                <coneGeometry args={[0.1, 0.22, 10]} />
                <meshStandardMaterial color="#e0f2fe" emissive="#0284c7" emissiveIntensity={0.25} />
              </mesh>
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Frame({ rooms }) {
  const { camera, controls } = useThree()
  const signature = rooms.map((room) => room.id).join('|')
  const primed = useRef('')
  useEffect(() => {
    if (!rooms.length || primed.current === signature) return
    primed.current = signature
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
      maxH = Math.max(maxH, room.height)
    })
    const cx = (minX + maxX) / 2
    const cz = (minZ + maxZ) / 2
    const span = Math.max(maxX - minX, maxZ - minZ, maxH, 4)
    camera.position.set(cx + span * 0.95, span * 0.72, cz + span * 0.95)
    camera.near = 0.1
    camera.far = 400
    camera.lookAt(cx, maxH * 0.35, cz)
    camera.updateProjectionMatrix()
    if (controls) {
      controls.target.set(cx, maxH * 0.3, cz)
      controls.update()
    }
  }, [signature, rooms, camera, controls])
  return null
}

export default function Scene3D({ rooms, selectedId, onSelect, unitSystem }) {
  return (
    <div data-testid="iso-canvas" style={{ position: 'relative', width: '100%', height: '100%', background: '#e7e5e4' }}>
      <Canvas
        shadows
        camera={{ position: [10, 8, 10], fov: 40 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        onPointerMissed={() => onSelect(null)}
      >
        <color attach="background" args={['#e7e5e4']} />
        <ambientLight intensity={0.55} />
        <directionalLight
          position={[14, 18, 8]}
          intensity={1.35}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <directionalLight position={[-8, 10, -10]} intensity={0.35} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[80, 80]} />
          <meshStandardMaterial color="#d6d3d1" roughness={1} />
        </mesh>
        <gridHelper args={[40, 40, '#a8a29e', '#d6d3d1']} position={[0, 0.001, 0]} />
        {rooms.map((room) => (
          <RoomMesh key={room.id} room={room} selected={room.id === selectedId} onSelect={onSelect} />
        ))}
        <ContactShadows position={[0, 0, 0]} opacity={0.28} scale={40} blur={2.2} far={6} />
        <OrbitControls makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={Math.PI / 2.05} />
        <Frame rooms={rooms} />
      </Canvas>
      <div style={{
        position: 'absolute', left: 12, bottom: 10, padding: '6px 10px',
        background: 'rgba(255,255,255,0.88)', border: '1px solid #d6d3d1', borderRadius: 8,
        fontSize: 11, color: '#57534e', pointerEvents: 'none',
      }}>
        Vedä kiertää · oikea tai keskinäppäin siirtää · rulla zoomaa
        {unitSystem === 'IP' ? ' · mitat jalkoina paneelissa' : ''}
      </div>
    </div>
  )
}
