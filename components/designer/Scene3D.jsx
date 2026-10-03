'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Edges, Grid, Html, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { insetOrthogonal, outlineOf } from '@/lib/cadDraw'
import { fanCountForWidth, isRefrigerated } from '@/lib/catalog'
import { condenserFanSpec } from '@/lib/fanGuard'
import { pipeSupports } from '@/lib/pipeTopology'
import { comboBody, equipmentPorts, internalCeiling, pointInOutline, resolvedElevation } from '@/lib/placement'
import { sharedWallPanels } from '@/lib/sharedWalls'
import { buildingDimensionSpec, dimensionStyle, layoutRoomTags } from '@/lib/sceneDims'
import { resolveDoor } from '@/lib/doors'

const DOOR_PART = {
  frame: '#3a3f46',
  leaf: '#f7f4ee',
  handle: '#1c1917',
  curtain: '#d9d4cc',
  track: '#2a2e33',
  glass: '#c5d8e8',
  hood: '#4b5563',
  plate: '#6b7280',
  heat: '#c2410c',
  seam: '#57534e',
  seal: '#1f2937',
}

const SceneTheme = createContext(null)

const PALETTES = {
  technical: {
    id: 'technical', flat: true, bg: '#f3f5f7', gridCell: '#e7ebf0', gridSection: '#d5dbe3',
    wall: '#b7bec6', wallOpacity: 0.16, edge: '#1a1d21', floor: '#f7f8fa', floorOpacity: 1,
    ceilingOpacity: 0.1, equip: '#f4f7fb', hintBg: 'rgba(255,255,255,0.94)', hintFg: '#1f2937', hintBorder: '#cfd4dc',
    tick: '#1a1d21',
  },
  dark: {
    id: 'dark', bg: '#1a1c1f', gridCell: '#2c3138', gridSection: '#3c4450',
    wall: '#d5dde6', wallOpacity: 0.22, edge: '#f4f7fb', floor: '#c5c8cc', floorOpacity: 1,
    ceilingOpacity: 0.08, equip: '#e8eef3', hintBg: 'rgba(22,24,28,0.9)', hintFg: '#c8cdd3', hintBorder: '#2c3138',
    tick: '#d5dde6',
  },
  light: {
    id: 'light', bg: '#e7ebf0', gridCell: '#c5ccd6', gridSection: '#8b95a3',
    wall: '#f7f9fb', wallOpacity: 0.4, edge: '#64748b', floor: '#f8fafc', floorOpacity: 1,
    ceilingOpacity: 0.2, equip: '#f8fafc', hintBg: 'rgba(255,255,255,0.92)', hintFg: '#44403c', hintBorder: '#e7e5e4',
    tick: '#64748b',
  },
}

const THEME_ORDER = [
  ['technical', 'Tekninen'],
  ['dark', 'Tumma'],
  ['light', 'Vaalea'],
]

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

function doorBasis(room, eq) {
  const spec = resolveDoor(eq)
  const wall = eq.wall || 's'
  const low = spec.style === 'leveler'
  const w = Math.max(low ? 0.8 : 0.55, eq.width || 0.9)
  const h = Math.max(low ? 0.08 : 1.5, eq.height || 2.1)
  const cx = room.x + (eq.x || 0)
  const cz = room.z + (eq.z || 0)
  const alongX = wall === 'n' || wall === 's'
  const flip = eq.hinge === 'right' || eq.swing === -1
  const hinge = alongX
    ? { x: cx + (flip ? w / 2 : -w / 2), z: cz }
    : { x: cx, z: cz + (flip ? w / 2 : -w / 2) }
  const tangent = alongX ? { x: flip ? -1 : 1, z: 0 } : { x: 0, z: flip ? -1 : 1 }
  const inward = wall === 's' ? { x: 0, z: -1 } : wall === 'n' ? { x: 0, z: 1 } : wall === 'e' ? { x: -1, z: 0 } : { x: 1, z: 0 }
  const basis = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(tangent.x, 0, tangent.z),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(-inward.x, 0, -inward.z),
  )
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(basis)
  return { w, h, hinge, quaternion, spec }
}

function DoorPart({ part, args, position, rotation, children }) {
  const color = DOOR_PART[part] || DOOR_PART.leaf
  return (
    <mesh position={position} rotation={rotation} userData={{ part }} castShadow>
      {children || <boxGeometry args={args} />}
      <meshStandardMaterial
        color={color}
        roughness={part === 'glass' ? 0.08 : 0.45}
        metalness={part === 'handle' || part === 'hood' ? 0.55 : 0.08}
        transparent={part === 'glass'}
        opacity={part === 'glass' ? 0.45 : 1}
      />
    </mesh>
  )
}

function DoorLeaf({ w, h, glass = false }) {
  if (glass) {
    return (
      <group>
        <DoorPart part="frame" args={[0.06, h - 0.08, 0.04]} position={[0.05, h / 2, 0.02]} />
        <DoorPart part="frame" args={[0.06, h - 0.08, 0.04]} position={[w - 0.05, h / 2, 0.02]} />
        <DoorPart part="frame" args={[w - 0.04, 0.06, 0.04]} position={[w / 2, h - 0.07, 0.02]} />
        <DoorPart part="frame" args={[w - 0.04, 0.06, 0.04]} position={[w / 2, 0.08, 0.02]} />
        <DoorPart part="glass" args={[Math.max(0.2, w - 0.16), Math.max(0.4, h - 0.22), 0.015]} position={[w / 2, h / 2, 0.02]} />
      </group>
    )
  }
  return <DoorPart part="leaf" args={[w - 0.04, h - 0.08, 0.04]} position={[w / 2, h / 2, 0.02]} />
}

function DoorMesh({ room, eq, onSelect, onContext }) {
  const { w, h, hinge, quaternion, spec } = useMemo(() => doorBasis(room, eq), [room, eq])
  const doors = (room.equipment || []).filter((item) => item.category === 'door')
  const number = Math.max(1, doors.findIndex((item) => item.id === eq.id) + 1)
  const style = spec.style
  const jamb = 0.05
  const strips = Math.max(6, Math.round(w / 0.12))
  const swing = style === 'hinged' || style === 'freezer' || style === 'fire' || style === 'glass'
  return (
    <group
      position={[hinge.x, 0, hinge.z]}
      quaternion={quaternion}
      userData={{ role: 'door' }}
      onClick={(event) => {
        event.stopPropagation()
        onSelect(eq.id)
      }}
      onContextMenu={(event) => openMenu(event, onContext, eq.id, 'equipment')}
    >
      {style === 'leveler' ? (
        <>
          <DoorPart part="plate" args={[w, 0.05, Math.max(1.4, eq.depth || 2)]} position={[w / 2, 0.06, Math.max(1.4, eq.depth || 2) / 2 + 0.04]} />
          <DoorPart part="seam" args={[w, 0.02, 0.04]} position={[w / 2, 0.09, 0.04]} />
          <DoorPart part="plate" args={[w * 0.92, 0.03, 0.08]} position={[w / 2, 0.1, Math.max(1.4, eq.depth || 2) - 0.02]} />
        </>
      ) : (
        <>
          <DoorPart part="frame" args={[jamb, h + 0.06, 0.1]} position={[-jamb / 2, h / 2, 0]} />
          <DoorPart part="frame" args={[jamb, h + 0.06, 0.1]} position={[w + jamb / 2, h / 2, 0]} />
          <DoorPart part="frame" args={[w + jamb * 2, 0.06, 0.1]} position={[w / 2, h + 0.02, 0]} />
          {style === 'freezer' && <DoorPart part="heat" args={[0.02, h, 0.02]} position={[0.05, h / 2, 0.07]} />}
          {style === 'sliding' && <DoorPart part="track" args={[w * 1.7, 0.04, 0.06]} position={[w * 0.72, h + 0.08, 0]} />}
          {(style === 'roll' || style === 'speed-roll') && (
            <DoorPart part="hood" args={[w + 0.28, style === 'speed-roll' ? 0.16 : 0.32, style === 'speed-roll' ? 0.16 : 0.28]} position={[w / 2, h + (style === 'speed-roll' ? 0.12 : 0.18), 0.08]} />
          )}
          {style === 'dock-seal' && (
            <>
              <DoorPart part="seal" args={[0.16, h, 0.28]} position={[0.02, h / 2, 0.14]} />
              <DoorPart part="seal" args={[0.16, h, 0.28]} position={[w - 0.02, h / 2, 0.14]} />
              <DoorPart part="seal" args={[w, 0.2, 0.28]} position={[w / 2, h - 0.02, 0.14]} />
            </>
          )}
          {swing && (
            <>
              {[0.18, 0.5, 0.82].map((t) => (
                <mesh key={`hinge-${t}`} position={[0.01, h * t, 0]} rotation={[Math.PI / 2, 0, 0]} userData={{ part: 'handle' }} castShadow>
                  <cylinderGeometry args={[0.016, 0.016, 0.1, 8]} />
                  <meshStandardMaterial color="#1c1917" metalness={0.6} roughness={0.3} />
                </mesh>
              ))}
              <group rotation={[0, 0.16, 0]}>
                <DoorLeaf w={w} h={h} glass={style === 'glass'} />
                <DoorPart part="handle" args={[0.025, 0.22, 0.035]} position={[w * 0.78, h * 0.48, 0.055]} />
                <DoorPart part="handle" args={[0.1, 0.022, 0.03]} position={[w * 0.78, h * 0.58, 0.05]} />
              </group>
            </>
          )}
          {style === 'sliding' && (
            <group position={[w * 0.14, 0, 0.02]}>
              <DoorPart part="leaf" args={[w - 0.08, h - 0.1, 0.04]} position={[w / 2, h / 2, 0]} />
              <DoorPart part="handle" args={[0.1, 0.22, 0.03]} position={[w * 0.22, h * 0.48, 0.04]} />
            </group>
          )}
          {(style === 'double' || style === 'impact') && (
            <>
              <group rotation={[0, style === 'impact' ? -0.16 : -0.36, 0]}>
                <DoorPart part="leaf" args={[w / 2 - 0.03, h - 0.08, 0.04]} position={[w / 4, h / 2, 0.02]} />
              </group>
              <group position={[w, 0, 0]} rotation={[0, style === 'impact' ? 0.16 : 0.36, 0]}>
                <DoorPart part="leaf" args={[w / 2 - 0.03, h - 0.08, 0.04]} position={[-w / 4, h / 2, 0.02]} />
              </group>
            </>
          )}
          {style === 'sectional' && (
            <group>
              <DoorPart part="leaf" args={[w - 0.08, h - 0.1, 0.04]} position={[w / 2, h / 2, 0.01]} />
              {Array.from({ length: 5 }, (_, index) => (
                <DoorPart key={`panel-${index}`} part="seam" args={[w - 0.12, 0.035, 0.012]} position={[w / 2, ((index + 1) / 6) * h, 0.036]} />
              ))}
            </group>
          )}
          {(style === 'roll' || style === 'speed-roll') && Array.from({ length: style === 'speed-roll' ? 8 : 6 }, (_, index) => (
            <DoorPart key={`slat-${index}`} part="curtain" args={[w - 0.08, h / (style === 'speed-roll' ? 10 : 8), 0.025]} position={[w / 2, h * ((index + 0.6) / (style === 'speed-roll' ? 9 : 7)), 0.03]} />
          ))}
          {(style === 'strip' || spec.curtain) && Array.from({ length: strips }, (_, index) => (
            <DoorPart key={`strip-${index}`} part="curtain" args={[w / strips * 0.72, h - 0.12, 0.008]} position={[(index + 0.5) * (w / strips), h / 2, 0.012]} />
          ))}
        </>
      )}
      {h > 0.8 && <DoorNumber room={room} number={number} h={h} w={w} />}
    </group>
  )
}

function DoorNumber({ room, number, h, w = 0 }) {
  const palette = usePalette()
  const camera = useThree((state) => state.camera)
  const outline = useMemo(() => outlineOf(room), [room])
  const [inside, setInside] = useState(true)
  useFrame(() => {
    const next = pointInOutline(camera.position.x, camera.position.z, outline)
    setInside((current) => (current === next ? current : next))
  })
  if (!inside) return null
  return (
    <Html position={[w / 2, h * 0.58, 0.12]} center sprite zIndexRange={[12, 0]} wrapperClass="refcad-float" style={{ pointerEvents: 'none' }}>
      <div style={palette.flat
        ? { color: '#1a1d21', fontWeight: 700, fontSize: 15, fontFamily: '"Liberation Sans", Arial, sans-serif' }
        : { color: palette.id === 'dark' ? '#f8fafc' : '#1c1917', fontWeight: 700, fontSize: 16, textShadow: '0 1px 2px rgba(0,0,0,0.45)' }}>{number}</div>
    </Html>
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
      <mesh position={[0, 0.02, d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.014, 0.05, 10]} />
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
      {[[-0.28, '#1c1917', 0.018], [0.28, '#c47a3a', 0.01]].map(([offset, color, radius]) => (
        <mesh key={offset} position={[w * offset, h * 0.42, d / 2 + 0.03]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius, radius, 0.07, 10]} />
          <meshStandardMaterial color={color} metalness={offset < 0 ? 0.08 : 0.7} roughness={offset < 0 ? 0.8 : 0.32} />
        </mesh>
      ))}
      <mesh position={[0, 0.045, d / 2 + 0.025]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.014, 0.012, 0.07, 10]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.35} roughness={0.4} />
      </mesh>
      {slant ? fanLayout.map((fan, index) => (
        <SlantFan key={index} position={fan.position} quaternion={fan.quaternion} radius={fan.fanR} color="#1e293b" />
      )) : Array.from({ length: fans }, (_, index) => (
        <FanDisc key={index} x={(index - (fans - 1) / 2) * ((w * 0.7) / Math.max(fans, 1))} y={h * 0.5} z={d / 2 + 0.015} radius={Math.min(h * 0.34, (w * 0.62) / fans / 2.1)} />
      ))}
    </EquipFrame>
  )
}

function ServiceValves({ depth, y, valves }) {
  const back = depth / 2
  return (
    <group>
      {valves.map((valve) => (
        <group key={valve.x} position={[valve.x, y, -back - 0.012]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[valve.radius, valve.radius * 0.78, 0.055, 12]} />
            <meshStandardMaterial color="#e0b15a" metalness={0.7} roughness={0.32} />
          </mesh>
          <mesh position={[0, valve.radius * 0.15, 0.006]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.005, 0.005, 0.016, 6]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.72} roughness={0.28} />
          </mesh>
        </group>
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
      <ServiceValves
        depth={eq.depth || d}
        y={h * 0.34}
        valves={[{ x: -(eq.width || w) * 0.18, radius: 0.016 }, { x: (eq.width || w) * 0.18, radius: 0.012 }]}
      />
    </EquipFrame>
  )
}

function useSickleGeometry(tip) {
  return useMemo(() => {
    const shape = new THREE.Shape()
    const r = tip
    shape.moveTo(r * 0.22, r * 0.08)
    shape.quadraticCurveTo(r * 0.46, r * 0.58, r * 0.98, r * 0.2)
    shape.quadraticCurveTo(r * 0.99, 0, r * 0.88, -r * 0.18)
    shape.quadraticCurveTo(r * 0.4, -r * 0.02, r * 0.22, -r * 0.07)
    shape.closePath()
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.01, bevelEnabled: false, curveSegments: 12 })
    geom.translate(0, 0, -0.005)
    return geom
  }, [tip])
}

function useAnnulus(outer, inner, depth) {
  return useMemo(() => {
    const shape = new THREE.Shape()
    shape.absarc(0, 0, outer, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0, 0, inner, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geom = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 56 })
    geom.translate(0, 0, -depth)
    return geom
  }, [outer, inner, depth])
}

function useFacePlate(width, height, holeR, holeY, thickness) {
  return useMemo(() => {
    const shape = new THREE.Shape()
    const hw = width / 2
    const hh = height / 2
    shape.moveTo(-hw, -hh)
    shape.lineTo(hw, -hh)
    shape.lineTo(hw, hh)
    shape.lineTo(-hw, hh)
    shape.closePath()
    const hole = new THREE.Path()
    hole.absarc(0, holeY, holeR, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 56 })
    geom.translate(0, 0, -thickness)
    return geom
  }, [width, height, holeR, holeY, thickness])
}

function GuardedFan({ radius }) {
  const spec = condenserFanSpec(radius)
  const blade = useSickleGeometry(spec.bladeR)
  const shroud = useAnnulus(spec.shroudOuter, spec.shroudInner, spec.shroudLength)
  useEffect(() => () => {
    blade.dispose()
    shroud.dispose()
  }, [blade, shroud])
  const steel = { color: '#e7eef5', metalness: 0.88, roughness: 0.18 }
  return (
    <group>
      <mesh position={[0, 0, spec.recessZ]}>
        <circleGeometry args={[spec.recessR, 40]} />
        <meshStandardMaterial color="#05070b" roughness={0.92} metalness={0.02} />
      </mesh>
      <mesh geometry={shroud}>
        <meshStandardMaterial color="#121820" metalness={0.4} roughness={0.48} side={THREE.DoubleSide} />
      </mesh>
      {[0, 1, 2].map((index) => (
        <mesh key={`blade-${index}`} geometry={blade} rotation={[0, 0, (index * 2 * Math.PI) / 3]} position={[0, 0, spec.bladeZ]}>
          <meshStandardMaterial color="#1e293b" metalness={0.48} roughness={0.38} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, 0, spec.hubZ]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[spec.hubR * 0.82, spec.hubR, spec.hubLength, 20]} />
        <meshStandardMaterial color="#64748b" metalness={0.72} roughness={0.28} />
      </mesh>
      {[0.38, 0.68, 1].map((scale) => (
        <mesh key={`ring-${scale}`} position={[0, 0, spec.grilleZ]}>
          <torusGeometry args={[spec.grilleR * scale, spec.wire, 10, 64]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <mesh key={`spoke-${index}`} position={[0, 0, spec.grilleZ]} rotation={[0, 0, (index * Math.PI) / 6]}>
          <cylinderGeometry args={[spec.wire, spec.wire, spec.grilleR * 2, 8]} />
          <meshStandardMaterial {...steel} />
        </mesh>
      ))}
    </group>
  )
}

function WallConsole({ x, depth, top }) {
  const profile = 0.04
  const wallZ = -depth / 2 - 0.115
  const tipZ = depth / 2 + 0.14
  const arm = tipZ - wallZ
  const leg = 0.56
  const shelfY = top - profile / 2
  const footY = shelfY - leg
  const steel = { color: '#c5ced6', metalness: 0.78, roughness: 0.3 }
  const dz = tipZ - wallZ
  const dy = shelfY - footY
  const length = Math.hypot(dz, dy)
  const angle = -Math.atan2(dy, dz)
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, shelfY - leg * 0.42, wallZ - 0.006]} castShadow>
        <boxGeometry args={[0.12, 0.2, 0.008]} />
        <meshStandardMaterial color="#b7c1ca" metalness={0.72} roughness={0.34} />
      </mesh>
      {[0.06, -0.04].map((bolt) => (
        <mesh key={bolt} position={[0.03, shelfY - leg * 0.42 + bolt, wallZ + 0.002]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.01, 8]} />
          <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.32} />
        </mesh>
      ))}
      <mesh position={[0, (shelfY + footY) / 2, wallZ]} castShadow>
        <boxGeometry args={[profile, leg, profile]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0, shelfY, (wallZ + tipZ) / 2]} castShadow>
        <boxGeometry args={[profile, profile, arm]} />
        <meshStandardMaterial {...steel} />
      </mesh>
      <mesh position={[0, (footY + shelfY) / 2, (wallZ + tipZ) / 2]} rotation={[angle, 0, 0]} castShadow>
        <boxGeometry args={[0.008, profile, length * 0.9]} />
        <meshStandardMaterial color="#9aa6b1" metalness={0.74} roughness={0.34} />
      </mesh>
    </group>
  )
}

function SideServiceValves({ x, y, valves }) {
  const brass = { color: '#f0c14b', metalness: 0.72, roughness: 0.28 }
  return (
    <group>
      {valves.map((valve) => (
        <group key={valve.z} position={[x, y, valve.z]}>
          <mesh position={[0.045, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[valve.radius, valve.radius, 0.09, 18]} />
            <meshStandardMaterial {...brass} />
          </mesh>
          <mesh position={[0.008, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[valve.radius * 1.55, valve.radius * 1.55, 0.016, 18]} />
            <meshStandardMaterial {...brass} />
          </mesh>
          <mesh position={[0.045, valve.radius + 0.022, 0]}>
            <boxGeometry args={[0.036, 0.044, valve.radius * 1.7]} />
            <meshStandardMaterial color="#e2b34a" metalness={0.68} roughness={0.32} />
          </mesh>
          <mesh position={[0.045, valve.radius + 0.07, 0]}>
            <boxGeometry args={[0.012, 0.06, 0.012]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.8} roughness={0.22} />
          </mesh>
          <mesh position={[0.045, valve.radius + 0.1, 0]}>
            <boxGeometry args={[0.056, 0.012, 0.014]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.8} roughness={0.22} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function ComboMesh({ room, eq, onSelect, onContext }) {
  const body = comboBody(eq)
  const w = body.width
  const h = body.height
  const d = body.depth
  const fanR = Math.min(h * 0.32, w * 0.26, 0.38)
  const valveY = h / 3
  const valveX = -w / 2 - 0.09
  const casingH = h * 0.86
  const casingD = d * 0.88
  const coil = '#8b98a5'
  const fanSpec = condenserFanSpec(fanR)
  const faceT = 0.006
  const skin = 0.016
  const cy = h * 0.5
  const fanY = h * 0.52
  const plate = useFacePlate(w, casingH, fanSpec.openingR, fanY - cy, faceT)
  useEffect(() => () => plate.dispose(), [plate])
  const shell = { color: '#e7eef3', metalness: 0.24, roughness: 0.42 }
  return (
    <EquipFrame room={room} eq={eq} onSelect={onSelect} onContext={onContext}>
      {[-1, 1].map((side) => (
        <WallConsole key={`bracket-${side}`} x={side * w * 0.42} depth={d} top={h * 0.08} />
      ))}
      <mesh position={[-w / 2 + skin / 2, cy, -faceT / 2]} castShadow>
        <boxGeometry args={[skin, casingH, casingD - faceT]} />
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh position={[w / 2 - skin / 2, cy, -faceT / 2]} castShadow>
        <boxGeometry args={[skin, casingH, casingD - faceT]} />
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh position={[0, cy + casingH / 2 - skin / 2, -faceT / 2]} castShadow>
        <boxGeometry args={[w, skin, casingD - faceT]} />
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh position={[0, cy - casingH / 2 + skin / 2, -faceT / 2]} castShadow>
        <boxGeometry args={[w, skin, casingD - faceT]} />
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh position={[0, cy, -casingD / 2 + skin / 2]} castShadow>
        <boxGeometry args={[w, casingH, skin]} />
        <meshStandardMaterial {...shell} />
      </mesh>
      <mesh geometry={plate} position={[0, cy, casingD / 2]} castShadow>
        <meshStandardMaterial {...shell} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, h * 0.5 + casingH / 2 - 0.012, 0]}>
        <boxGeometry args={[w * 0.992, 0.008, casingD * 0.98]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.35} roughness={0.5} />
      </mesh>
      <mesh position={[0, h * 0.5 + casingH / 2 + 0.006, 0]} castShadow>
        <boxGeometry args={[w * 0.9, 0.016, casingD * 0.82]} />
        <meshStandardMaterial color="#f4f7fa" metalness={0.22} roughness={0.4} />
      </mesh>
      {Array.from({ length: 16 }, (_, index) => (
        <mesh key={`side-fin-${index}`} position={[w / 2 + 0.012, h * 0.52, (index - 7.5) * ((d * 0.62) / 15)]}>
          <boxGeometry args={[0.016, h * 0.58, 0.006]} />
          <meshStandardMaterial color={coil} metalness={0.5} roughness={0.38} />
        </mesh>
      ))}
      {Array.from({ length: 18 }, (_, index) => (
        <mesh key={`rear-fin-${index}`} position={[(index - 8.5) * ((w * 0.72) / 17), h * 0.52, -d / 2 - 0.01]}>
          <boxGeometry args={[0.006, h * 0.58, 0.02]} />
          <meshStandardMaterial color={coil} metalness={0.5} roughness={0.38} />
        </mesh>
      ))}
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={`end-fin-${index}`} position={[-w / 2 - 0.01, h * 0.62, 0.12 + (index - 3.5) * 0.028]}>
          <boxGeometry args={[0.012, h * 0.28, 0.006]} />
          <meshStandardMaterial color={coil} metalness={0.48} roughness={0.4} />
        </mesh>
      ))}
      <group position={[w * 0.36, h * 0.145, casingD / 2 + 0.006]}>
        <mesh>
          <boxGeometry args={[0.15, 0.09, 0.012]} />
          <meshStandardMaterial color="#d5dee6" metalness={0.32} roughness={0.48} />
        </mesh>
        {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => (
          <mesh key={`screw-${sx}${sy}`} position={[sx * 0.055, sy * 0.03, 0.008]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.005, 0.005, 0.006, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.35} />
          </mesh>
        ))}
      </group>
      <group position={[0, h * 0.52, casingD / 2]}>
        <GuardedFan radius={fanR} />
      </group>
      <SideServiceValves
        x={valveX}
        y={valveY}
        valves={[
          { z: -0.1, radius: 0.05 },
          { z: 0.1, radius: 0.036 },
        ]}
      />
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

function RoomTag({ room, tag }) {
  const palette = usePalette()
  const leader = useMemo(() => {
    if (!tag?.leader) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      tag.ax, (room.height || 3) + 0.05, tag.az,
      tag.x, tag.y - 0.02, tag.z,
    ], 3))
    return geometry
  }, [tag, room.height])
  useEffect(() => () => leader?.dispose(), [leader])
  if (!tag) return null
  return (
    <group>
      {leader && (
        <lineSegments geometry={leader} userData={{ role: 'skip' }}>
          <lineBasicMaterial color={palette.edge} toneMapped={false} />
        </lineSegments>
      )}
      <Html position={[tag.x, tag.y, tag.z]} center zIndexRange={[20, 0]} wrapperClass="refcad-float" style={{ pointerEvents: 'none' }}>
        {palette.flat ? (
          <div style={{ background: '#ffffff', color: '#1a1d21', border: '1px solid #1a1d21', fontSize: 12, fontWeight: 650, fontFamily: '"Liberation Sans", Arial, sans-serif', letterSpacing: '0.01em', padding: '2px 7px', lineHeight: 1.3 }}>{tag.name}</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'stretch', background: palette.id === 'dark' ? '#14161a' : '#1b1e22', color: '#f4f6f8', border: palette.id === 'dark' ? '1px solid #f4f7fb' : 'none', borderRadius: 8, overflow: 'hidden', fontSize: 12, fontWeight: 650, boxShadow: '0 6px 16px rgba(0,0,0,0.28)' }}>
            <span style={{ width: 4, background: '#3b82f6' }} />
            <span style={{ padding: '4px 10px' }}>{tag.name}</span>
          </div>
        )}
      </Html>
    </group>
  )
}

function WallAssembly({ rooms, onSelect, onContext }) {
  const palette = usePalette()
  const panels = useMemo(() => sharedWallPanels(rooms), [rooms])
  const seams = useMemo(() => {
    const positions = []
    panels.forEach((panel) => {
      const faces = panel.shared ? [panel.c0, panel.c1] : [Math.abs(panel.c0 - panel.plane) < Math.abs(panel.c1 - panel.plane) ? panel.c0 : panel.c1]
      panel.pieces.forEach((piece) => {
        if (piece.y1 - piece.y0 < 0.35) return
        const length = piece.b - piece.a
        const count = Math.max(1, Math.round(length / 1.15))
        for (let step = 1; step < count; step += 1) {
          const along = piece.a + (length * step) / count
          faces.forEach((face) => {
            const x = panel.axis === 'x' ? along : face
            const z = panel.axis === 'x' ? face : along
            const lift = panel.shared ? 0.012 : 0.008
            const ox = panel.axis === 'x' ? 0 : (face === panel.c0 ? -lift : lift)
            const oz = panel.axis === 'x' ? (face === panel.c0 ? -lift : lift) : 0
            positions.push(x + ox, piece.y0 + 0.05, z + oz, x + ox, piece.y1 - 0.05, z + oz)
          })
        }
      })
    })
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    return geometry
  }, [panels])
  useEffect(() => () => seams.dispose(), [seams])
  return (
    <group>
      {panels.flatMap((panel) => panel.pieces.map((piece, index) => {
        const length = piece.b - piece.a
        const height = piece.y1 - piece.y0
        const thick = Math.max(0.04, panel.c1 - panel.c0)
        const x = panel.axis === 'x' ? (piece.a + piece.b) / 2 : (panel.c0 + panel.c1) / 2
        const z = panel.axis === 'x' ? (panel.c0 + panel.c1) / 2 : (piece.a + piece.b) / 2
        const y = (piece.y0 + piece.y1) / 2
        const args = panel.axis === 'x' ? [length, height, thick] : [thick, height, length]
        return (
          <mesh
            key={`${panel.id}-${index}`}
            position={[x, y, z]}
            userData={{ role: 'panel' }}
            castShadow
            receiveShadow
            onClick={(event) => {
              event.stopPropagation()
              onSelect(panel.roomIds[0])
            }}
            onContextMenu={(event) => openMenu(event, onContext, panel.roomIds[0], 'room')}
          >
            <boxGeometry args={args} />
            <meshStandardMaterial color={palette.wall} roughness={0.78} metalness={0.02} />
          </mesh>
        )
      }))}
      {seams.getAttribute('position')?.count ? (
        <lineSegments geometry={seams} userData={{ role: 'skip' }}>
          <lineBasicMaterial color={palette.flat ? '#aeb6c0' : palette.edge} transparent opacity={palette.flat ? 0.45 : 0.35} toneMapped={false} />
        </lineSegments>
      ) : null}
    </group>
  )
}

function RoomMesh({ room, onSelect, onContext, tag }) {
  const palette = usePalette()
  const floor = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.04)
  }, [room])
  const ceiling = useMemo(() => {
    const inner = insetOrthogonal(outlineOf(room), Math.max(0.04, room.wallThickness)) || outlineOf(room)
    return footprintGeometry(inner, 0.02)
  }, [room])
  return (
    <group>
      <mesh
        geometry={floor}
        position={[0, 0.02, 0]}
        receiveShadow
        userData={{ role: 'floor' }}
        onClick={(event) => {
          event.stopPropagation()
          onSelect(room.id)
        }}
        onContextMenu={(event) => openMenu(event, onContext, room.id, 'room')}
      >
        <meshStandardMaterial color={palette.floor} roughness={0.94} metalness={0} />
      </mesh>
      {palette.flat ? null : (
        <>
          <PerimeterTrim room={room} y={0.055} size={0.016} color={isRefrigerated(room.type) ? (room.color || '#64748b') : '#94a3b8'} inset={0.015} />
          <PerimeterTrim room={room} y={room.height - 0.05} size={0.028} color={palette.id === 'dark' ? '#8b95a1' : '#cbd5e1'} inset={0.0} />
          <FloorTicks room={room} color={palette.tick} />
        </>
      )}
      <mesh geometry={ceiling} position={[0, room.height - 0.03, 0]} userData={{ role: 'panel' }}>
        <meshStandardMaterial color={palette.wall} transparent opacity={palette.flat ? palette.wallOpacity : palette.ceilingOpacity} roughness={0.08} depthWrite={false} side={THREE.DoubleSide} />
        {palette.flat ? null : <Edges threshold={20} color={palette.edge} />}
      </mesh>
      <RoomTag room={room} tag={tag} />
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
  if (Number.isFinite(point?.y)) return point.y
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
  const dy = yb - ya
  if (horiz < 0.04 && Math.abs(dy) < 0.04) return []
  const legs = []
  const axis = Math.abs(dx) < 0.04 || Math.abs(dz) < 0.04
  // Condensate falls a few percent along one axis. Refrigerant changes height on its own vertical.
  if (axis && horiz >= 0.04 && Math.abs(dy) / horiz <= 0.08) {
    pushLeg(legs, a.x, ya, a.z, b.x, yb, b.z)
    return legs
  }
  if (!axis) {
    const y = Math.max(ya, yb)
    pushLeg(legs, a.x, ya, a.z, a.x, y, a.z)
    pushLeg(legs, a.x, y, a.z, b.x, y, a.z)
    pushLeg(legs, b.x, y, a.z, b.x, y, b.z)
    pushLeg(legs, b.x, y, b.z, b.x, yb, b.z)
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
    const trim = Math.min(radius, 0.06, inLen * 0.45, outLen * 0.45)
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
    const path = filletPath(pts, 0.05)
    if (!path) return null
    const length = path.getLength()
    if (length < 0.05) return null
    return new THREE.TubeGeometry(path, Math.min(220, Math.max(16, Math.ceil(length / 0.06))), radius, 12, false)
  }, [encoded, radius])
  useEffect(() => () => geom?.dispose(), [geom])
  if (!geom) return null
  return (
    <mesh geometry={geom} castShadow userData={{ role: 'pipe' }}>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />
    </mesh>
  )
}

function tubeStyle(pipe) {
  const od = Number(pipe?.odMm) || Number(pipe?.sizeMm) || 0
  const copper = od > 4 ? od / 2000 : pipe?.kind === 'suction' ? 0.011 : pipe?.kind === 'hotgas' ? 0.008 : pipe?.kind === 'liquid' ? 0.0048 : 0.01
  const freezer = pipe?.roomTempC < 0
  if (pipe?.kind === 'suction') return { radius: copper + 0.019, color: '#1c1917', metalness: 0.02, roughness: 0.94 }
  if (pipe?.kind === 'liquid') {
    if (freezer) return { radius: copper + 0.013, color: '#292524', metalness: 0.02, roughness: 0.94 }
    return { radius: Math.max(0.006, copper), color: '#d4894a', metalness: 0.78, roughness: 0.28 }
  }
  if (pipe?.kind === 'hotgas') return { radius: copper + 0.013, color: '#44403c', metalness: 0.04, roughness: 0.9 }
  if (pipe?.kind === 'drain') return { radius: 0.02, color: '#f5f5f4', metalness: 0.06, roughness: 0.55 }
  return { radius: Math.max(0.01, copper), color: '#1d4ed8', metalness: 0.2, roughness: 0.4 }
}

function traceBeside(sharp) {
  let ox = 0.03
  let oz = 0
  for (let i = 1; i < sharp.length; i += 1) {
    const dx = sharp[i][0] - sharp[i - 1][0]
    const dz = sharp[i][2] - sharp[i - 1][2]
    const len = Math.hypot(dx, dz)
    if (len < 0.2) continue
    ox = (-dz / len) * 0.03
    oz = (dx / len) * 0.03
    break
  }
  return sharp.map((point) => [point[0] + ox, point[1], point[2] + oz])
}

function Sleeve({ x, y, z, dx, dz, width, height, length, round = false }) {
  const yaw = Math.atan2(dx, dz)
  const ring = (round ? width : Math.max(width, height)) + 0.016
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]}>
      {round ? (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[width / 2, width / 2, length, 20]} />
          <meshStandardMaterial color="#f5f5f4" metalness={0.12} roughness={0.55} />
        </mesh>
      ) : (
        <mesh>
          <boxGeometry args={[width, height, length]} />
          <meshStandardMaterial color="#f5f5f4" metalness={0.12} roughness={0.55} />
        </mesh>
      )}
      {[1, -1].map((face) => (
        <mesh key={face} position={[0, 0, face * (length / 2 + 0.003)]} rotation={round ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
          {round ? (
            <cylinderGeometry args={[ring / 2, ring / 2, 0.005, 20]} />
          ) : (
            <boxGeometry args={[width + 0.016, height + 0.016, 0.005]} />
          )}
          <meshStandardMaterial color="#d6d3d1" metalness={0.05} roughness={0.75} />
        </mesh>
      ))}
    </group>
  )
}

function clusterSleeves(rooms, pipes) {
  const marks = []
  ;(pipes || []).forEach((pipe) => {
    ;(pipe.points || []).forEach((point) => {
      if (!point.sleeve) return
      marks.push({ ...point, y: point.y || 0, kind: pipe.kind, temp: pipe.roomTempC })
    })
  })
  const groups = []
  marks.forEach((mark) => {
    const group = groups.find((item) => {
      const sameFamily = (item.kind === 'drain') === (mark.kind === 'drain')
      return sameFamily
        && Math.abs(item.y - mark.y) < 0.08
        && Math.hypot(item.x - mark.x, item.z - mark.z) < 0.35
    })
    if (!group) {
      groups.push({
        x: mark.x, y: mark.y, z: mark.z, ox: mark.sox || 0, oz: mark.soz || 1, kind: mark.kind, members: [mark],
      })
      return
    }
    group.members.push(mark)
    if (mark.sox || mark.soz) {
      group.ox = mark.sox || 0
      group.oz = mark.soz || 0
    }
  })
  return groups.map((group) => {
    const n = group.members.length
    const x = group.members.reduce((sum, mark) => sum + mark.x, 0) / n
    const y = group.members.reduce((sum, mark) => sum + mark.y, 0) / n
    const z = group.members.reduce((sum, mark) => sum + mark.z, 0) / n
    const room = (rooms || []).find((item) => pointInOutline(x, z, outlineOf(item))) || rooms?.[0]
    const thick = Math.max(0.08, room?.wallThickness || 0.1)
    const len = Math.hypot(group.ox, group.oz) || 1
    const dx = group.ox / len
    const dz = group.oz / len
    const radii = group.members.map((mark) => tubeStyle({ kind: mark.kind, roomTempC: mark.temp }).radius)
    const maxR = Math.max(...radii)
    const along = group.members.map((mark) => Math.abs((mark.x - x) * -dz + (mark.z - z) * dx) + tubeStyle({ kind: mark.kind, roomTempC: mark.temp }).radius)
    const half = Math.max(...along)
    const drain = group.kind === 'drain'
    return {
      x, y, z, dx, dz,
      width: drain ? (maxR + 0.01) * 2 : half * 2 + 0.02,
      height: maxR * 2 + 0.02,
      length: thick,
      round: drain,
    }
  })
}

function PipeRuns({ rooms, pipes }) {
  const sleeves = clusterSleeves(rooms, pipes)
  return (
    <group>
      {sleeves.map((sleeve, index) => (
        <Sleeve key={`sleeve-${index}`} x={sleeve.x} y={sleeve.y} z={sleeve.z} dx={sleeve.dx} dz={sleeve.dz} width={sleeve.width} height={sleeve.height} length={sleeve.length} round={sleeve.round} />
      ))}
      {(pipes || []).map((pipe) => {
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
    const supports = (pipe.kind === 'suction' || pipe.kind === 'liquid') ? pipeSupports(sharp, rooms) : { hangers: [], wallClips: [] }
    return (
      <group key={pipe.id}>
        <SmoothTube encoded={encoded} radius={style.radius} color={style.color} metalness={style.metalness} roughness={style.roughness} />
        {traced && (
          <SmoothTube
            encoded={JSON.stringify(traceBeside(sharp))}
            radius={0.009}
            color="#f97316"
            metalness={0.25}
            roughness={0.4}
          />
        )}
        {pipe.kind === 'drain' && (
          <group position={[sharp[sharp.length - 1][0], 0.025, sharp[sharp.length - 1][2]]}>
            <mesh>
              <boxGeometry args={[0.62, 0.04, 0.28]} />
              <meshStandardMaterial color="#d6d3d1" metalness={0.08} roughness={0.72} />
            </mesh>
            <mesh position={[0, 0.012, 0]}>
              <boxGeometry args={[0.46, 0.02, 0.12]} />
              <meshStandardMaterial color="#44403c" metalness={0.2} roughness={0.7} />
            </mesh>
            {[-0.16, -0.05, 0.06, 0.16].map((offset) => (
              <mesh key={`grate-${offset}`} position={[offset, 0.028, 0]}>
                <boxGeometry args={[0.018, 0.01, 0.2]} />
                <meshStandardMaterial color="#78716c" metalness={0.35} roughness={0.5} />
              </mesh>
            ))}
          </group>
        )}
        {supports.hangers.map((hanger, index) => (
          <group key={`hanger-${index}`} position={[hanger.x, hanger.y, hanger.z]}>
            <mesh position={[0, 0.14, 0]}>
              <cylinderGeometry args={[0.004, 0.004, 0.28, 8]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.62} roughness={0.28} />
            </mesh>
            <mesh position={[0, 0.275, 0]}>
              <boxGeometry args={[0.07, 0.01, 0.028]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.55} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[Math.max(0.055, style.radius * 3.2), 0.016, 0.018]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.5} roughness={0.3} />
            </mesh>
          </group>
        ))}
        {supports.wallClips.map((clip, index) => (
          <group key={`wall-clip-${index}`} position={[clip.x, clip.y, clip.z]} rotation={[0, Math.atan2(clip.nx, clip.nz), 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[Math.max(0.02, style.radius + 0.008), 0.004, 8, 18]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.62} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.028]}>
              <boxGeometry args={[0.01, 0.012, 0.04]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.55} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0, 0.05]}>
              <boxGeometry args={[0.046, 0.07, 0.008]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.35} />
            </mesh>
          </group>
        ))}
      </group>
    )
      })}
    </group>
  )
}

function roleOf(obj) {
  let node = obj
  while (node) {
    if (node.userData?.role) return node.userData.role
    node = node.parent
  }
  return 'equip'
}

function technicalMaterial(role, mesh, palette) {
  if (role === 'pipe') {
    const color = mesh.material?.color ? mesh.material.color.clone() : new THREE.Color('#64748b')
    return new THREE.MeshLambertMaterial({ color })
  }
  if (role === 'floor') {
    return new THREE.MeshLambertMaterial({ color: palette.floor })
  }
  if (role === 'panel') {
    return new THREE.MeshLambertMaterial({
      color: palette.wall,
      transparent: true,
      opacity: palette.wallOpacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  }
  if (role === 'door') {
    const part = mesh.userData?.part || 'leaf'
    return new THREE.MeshLambertMaterial({ color: DOOR_PART[part] || DOOR_PART.leaf, side: THREE.DoubleSide })
  }
  const color = mesh.material?.color ? mesh.material.color.clone() : new THREE.Color(palette.equip)
  return new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
}

function StylePass() {
  const palette = usePalette()
  const scene = useThree((state) => state.scene)
  const mounted = useRef(new Map())
  const edgeMat = useRef(null)
  useEffect(() => () => {
    mounted.current.forEach((rec) => {
      rec.lines?.removeFromParent()
      rec.lines?.geometry.dispose()
      rec.mat.dispose()
    })
    mounted.current.clear()
    edgeMat.current?.dispose()
    edgeMat.current = null
  }, [])
  useEffect(() => {
    if (!palette.flat) {
      mounted.current.forEach((rec, obj) => {
        if (rec.original && obj.material === rec.mat) obj.material = rec.original
        rec.lines?.removeFromParent()
        rec.lines?.geometry.dispose()
        rec.mat.dispose()
      })
      mounted.current.clear()
    }
    if (edgeMat.current) edgeMat.current.color.set(palette.edge)
  }, [palette.flat, palette.edge])
  useFrame(() => {
    if (!palette.flat) return
    if (!edgeMat.current) edgeMat.current = new THREE.LineBasicMaterial({ color: palette.edge, toneMapped: false })
    const seen = new Set()
    scene.traverse((obj) => {
      if (!obj.isMesh || obj.isInstancedMesh) return
      const role = roleOf(obj)
      if (role === 'skip') return
      seen.add(obj)
      let rec = mounted.current.get(obj)
      if (!rec || rec.role !== role) {
        if (rec) {
          rec.lines?.removeFromParent()
          rec.lines?.geometry.dispose()
          rec.mat.dispose()
        }
        rec = { role, mat: technicalMaterial(role, obj, palette), original: obj.material, lines: null, geom: null }
        mounted.current.set(obj, rec)
      }
      if (obj.material !== rec.mat) {
        if (role === 'pipe' && obj.material?.color) rec.mat.color.copy(obj.material.color)
        obj.material = rec.mat
      }
      obj.castShadow = false
      obj.receiveShadow = false
      if (role === 'floor') {
        if (rec.lines) {
          rec.lines.removeFromParent()
          rec.lines.geometry.dispose()
          rec.lines = null
        }
        return
      }
      if (role === 'panel') obj.renderOrder = 2
      const threshold = role === 'pipe' ? 28 : role === 'panel' ? 24 : role === 'door' ? 14 : 20
      if (!rec.lines || rec.geom !== obj.geometry || rec.threshold !== threshold) {
        if (rec.lines) {
          rec.lines.removeFromParent()
          rec.lines.geometry.dispose()
        }
        const edges = new THREE.EdgesGeometry(obj.geometry, threshold)
        const lines = new THREE.LineSegments(edges, edgeMat.current)
        lines.userData.role = 'skip'
        lines.matrixAutoUpdate = false
        lines.matrixWorldAutoUpdate = false
        lines.renderOrder = 4
        lines.raycast = () => {}
        scene.add(lines)
        rec.lines = lines
        rec.geom = obj.geometry
        rec.threshold = threshold
      }
      obj.updateWorldMatrix(true, false)
      rec.lines.matrix.copy(obj.matrixWorld)
      rec.lines.matrixWorld.copy(obj.matrixWorld)
      rec.lines.visible = obj.visible
    })
    mounted.current.forEach((rec, obj) => {
      if (seen.has(obj)) return
      rec.lines?.removeFromParent()
      rec.lines?.geometry.dispose()
      rec.mat.dispose()
      mounted.current.delete(obj)
    })
  })
  return null
}

function RoomDimensions({ rooms, theme }) {
  const ink = dimensionStyle(theme)
  const spec = useMemo(() => buildingDimensionSpec(rooms), [rooms])
  const geom = useMemo(() => {
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(spec.segments, 3))
    return geometry
  }, [spec])
  useEffect(() => () => geom.dispose(), [geom])
  if (!spec.labels.length) return null
  return (
    <group userData={{ role: 'skip' }}>
      <lineSegments geometry={geom} renderOrder={8}>
        <lineBasicMaterial color={ink.line} toneMapped={false} depthTest={false} />
      </lineSegments>
      {spec.labels.map((label) => (
        <Html key={label.key} position={[label.x, label.y, label.z]} center sprite zIndexRange={[18, 0]} wrapperClass="refcad-float" style={{ pointerEvents: 'none' }}>
          <span style={{
            background: ink.chipBg,
            color: ink.chipFg,
            border: `1px solid ${ink.chipBorder}`,
            fontSize: 11,
            fontWeight: 650,
            fontFamily: '"Liberation Sans", Arial, sans-serif',
            padding: '1px 5px',
            lineHeight: 1.25,
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap',
          }}>{label.text}</span>
        </Html>
      ))}
    </group>
  )
}

function ToneMap({ theme }) {
  const gl = useThree((state) => state.gl)
  useEffect(() => {
    gl.toneMapping = theme === 'technical' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping
    gl.toneMappingExposure = theme === 'dark' ? 1.08 : 1
    gl.shadowMap.enabled = theme !== 'technical'
  }, [gl, theme])
  return null
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
    return () => {
      rigRef.current = null
    }
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
  const [theme, setTheme] = useState('technical')
  const [dims, setDims] = useState(true)
  const [heading, setHeading] = useState(0)
  const rigRef = useRef(null)
  const palette = PALETTES[theme] || PALETTES.technical
  const technical = palette.flat === true
  const tags = useMemo(() => layoutRoomTags(rooms), [rooms])
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
          gl={{ antialias: true, toneMapping: technical ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, toneMappingExposure: theme === 'dark' ? 1.08 : 1 }}
          onPointerMissed={() => onSelect(null)}
        >
          <ToneMap theme={theme} />
          <StylePass />
          <color attach="background" args={[palette.bg]} />
          <hemisphereLight args={[technical ? '#f7f8fa' : theme === 'dark' ? '#d5dee8' : '#ffffff', technical ? '#e6e9ee' : theme === 'dark' ? '#2a3038' : '#94a3b8', technical ? 0.3 : 0.55]} />
          <ambientLight intensity={technical ? 0.86 : theme === 'dark' ? 0.28 : 0.42} />
          <directionalLight
            position={[12, 18, 8]}
            intensity={technical ? 0.18 : theme === 'dark' ? 1.35 : 1.15}
            castShadow={!technical}
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
          {technical ? null : <directionalLight position={[-8, 7, -12]} intensity={0.28} />}
          {technical ? null : <ContactShadows position={[0, 0.012, 0]} opacity={theme === 'dark' ? 0.45 : 0.28} scale={28} blur={2.2} far={8} />}
          <group userData={{ role: 'skip' }}>
            <Grid
              args={[1, 1]}
              position={[0, 0.004, 0]}
              cellSize={1}
              cellThickness={technical ? 0.35 : 0.6}
              cellColor={palette.gridCell}
              sectionSize={5}
              sectionThickness={technical ? 0.55 : 1.15}
              sectionColor={palette.gridSection}
              fadeDistance={technical ? 42 : 55}
              fadeStrength={1.5}
              infiniteGrid
              side={THREE.DoubleSide}
            />
          </group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} userData={{ role: 'skip' }}>
            <planeGeometry args={[120, 120]} />
            <meshBasicMaterial color={technical ? '#e8eef3' : theme === 'dark' ? '#23262c' : '#d9e0e8'} />
          </mesh>
          <WallAssembly rooms={rooms} onSelect={onSelect} onContext={onContext} />
          {rooms.map((room) => (
            room.type === 'yard' ? (
              <mesh
                key={room.id}
                userData={{ role: 'floor' }}
                position={[room.x, 0.015, room.z]}
                onClick={(event) => { event.stopPropagation(); onSelect(room.id) }}
                onContextMenu={(event) => openMenu(event, onContext, room.id, 'room')}
              >
                <boxGeometry args={[room.width, 0.03, room.depth]} />
                <meshStandardMaterial color={technical ? '#e7efe0' : theme === 'dark' ? '#2a3328' : '#d9e7c4'} />
              </mesh>
            ) : (
              <RoomMesh key={room.id} room={room} tag={tags.find((item) => item.id === room.id)} selected={room.id === selectedId} onSelect={onSelect} onContext={onContext} />
            )
          ))}
          <PipeRuns rooms={rooms} pipes={pipes} />
          {dims ? <RoomDimensions rooms={rooms} theme={palette.id} /> : null}
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
        <div style={{ position: 'absolute', right: 12, bottom: 10, zIndex: 5, display: 'flex', gap: 6 }}>
          <button
            type="button"
            data-testid="scene-dims"
            aria-pressed={dims}
            onClick={() => setDims((current) => !current)}
            style={{ ...roundBtn, width: 'auto', padding: '0 10px', borderRadius: 8, fontWeight: dims ? 700 : 500 }}
          >
            Mitat
          </button>
          {THEME_ORDER.map(([id, label]) => (
            <button
              key={id}
              type="button"
              data-testid={id === 'technical' ? 'scene-theme' : `scene-theme-${id}`}
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
              style={{
                ...roundBtn,
                width: 'auto',
                padding: '0 10px',
                borderRadius: 8,
                fontWeight: theme === id ? 700 : 500,
                background: theme === id ? '#1a1d21' : palette.hintBg,
                color: theme === id ? '#f8fafc' : palette.hintFg,
              }}
            >
              {label}
            </button>
          ))}
        </div>
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
