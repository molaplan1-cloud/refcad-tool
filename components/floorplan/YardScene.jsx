'use client'

import { useMemo } from 'react'
import * as THREE from 'three'
import { coverMembers, normalizeCover, roofLook } from '@/lib/covers'
import { buildingSpec, ensureYard, footprint, hasYard, objectSpec, plantSpec, yardBounds } from '@/lib/yard'

function noop() {}

function Ribbon({ points, width, color, y = 0.03, thickness = 0.04, pick }) {
  const list = points || []
  return (
    <group userData={pick ? { pick } : undefined}>
      {list.slice(0, -1).map((a, index) => {
        const b = list[index + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        if (len < 0.05) return null
        const angle = Math.atan2(b.x - a.x, b.z - a.z)
        return (
          <mesh key={`${a.x}-${index}`} position={[(a.x + b.x) / 2, y, (a.z + b.z) / 2]} rotation={[0, angle, 0]}>
            <boxGeometry args={[width, thickness, len]} />
            <meshStandardMaterial color={color} />
          </mesh>
        )
      })}
    </group>
  )
}

function PlantMesh({ item, selected }) {
  const spec = plantSpec(item.kind)
  const canopy = item.canopy || spec.canopy
  const r = canopy / 2
  const color = selected ? '#0f766e' : item.kind === 'conifer' ? '#1f6b3a' : item.kind === 'fruit' ? '#3f8f4a' : item.kind === 'bush' || item.kind === 'hedge' ? '#4d7c3a' : '#2f7d46'
  const pick = { kind: 'yard', collection: 'plants', id: item.id, movable: true }
  return (
    <group position={[item.x, 0, item.z]} userData={{ pick }}>
      {item.kind !== 'bush' && item.kind !== 'hedge' && (
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 1.4, 8]} />
          <meshStandardMaterial color="#6b4f36" />
        </mesh>
      )}
      {item.kind === 'conifer' ? (
        <mesh position={[0, 1.5 + r * 0.45, 0]}>
          <coneGeometry args={[r, r * 1.7, 8]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ) : (
        <mesh position={[0, item.kind === 'bush' || item.kind === 'hedge' ? r * 0.45 : 1.5 + r * 0.35, 0]}>
          {item.kind === 'hedge'
            ? <boxGeometry args={[r * 2.2, r, r * 0.8]} />
            : <sphereGeometry args={[item.kind === 'bush' ? r : r * 0.92, 16, 12]} />}
          <meshStandardMaterial color={color} />
        </mesh>
      )}
      {item.kind === 'fruit' && [0, 1, 2].map((index) => (
        <mesh key={index} position={[Math.cos(index * 2) * r * 0.4, 1.7, Math.sin(index * 2) * r * 0.4]}>
          <sphereGeometry args={[0.12, 8, 8]} />
          <meshStandardMaterial color="#c2410c" />
        </mesh>
      ))}
    </group>
  )
}

function ObjectMesh({ item, selected }) {
  const spec = objectSpec(item.kind)
  const w = item.w || spec.w
  const d = item.d || spec.d
  const pick = { kind: 'yard', collection: 'objects', id: item.id, movable: true }
  const tint = selected ? '#0f766e' : '#44403c'
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, ((item.rotation || 0) * Math.PI) / 180, 0]} userData={{ pick }}>
      {item.kind === 'light-pole' && (
        <>
          <mesh position={[0, 1.3, 0]}><cylinderGeometry args={[0.04, 0.05, 2.6, 8]} /><meshStandardMaterial color="#292524" /></mesh>
          <mesh position={[0, 2.55, 0]}><sphereGeometry args={[0.16, 12, 10]} /><meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.7} /></mesh>
        </>
      )}
      {item.kind === 'light-bollard' && (
        <>
          <mesh position={[0, 0.28, 0]}><cylinderGeometry args={[0.08, 0.1, 0.55, 8]} /><meshStandardMaterial color="#292524" /></mesh>
          <mesh position={[0, 0.58, 0]}><cylinderGeometry args={[0.1, 0.1, 0.08, 8]} /><meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.6} /></mesh>
        </>
      )}
      {item.kind === 'flagpole' && (
        <>
          <mesh position={[0, 2, 0]}><cylinderGeometry args={[0.03, 0.04, 4, 8]} /><meshStandardMaterial color="#e7e5e4" /></mesh>
          <mesh position={[0.28, 3.5, 0]}><boxGeometry args={[0.55, 0.32, 0.02]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
        </>
      )}
      {item.kind === 'well' && (
        <>
          <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.42, 0.48, 0.7, 12]} /><meshStandardMaterial color="#78716c" /></mesh>
          <mesh position={[0, 0.72, 0]} rotation={[0, 0, 0]}><cylinderGeometry args={[0.5, 0.5, 0.08, 12]} /><meshStandardMaterial color="#44403c" /></mesh>
        </>
      )}
      {item.kind === 'rainwell' && (
        <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.38, 0.38, 0.12, 12]} /><meshStandardMaterial color="#64748b" /></mesh>
      )}
      {item.kind === 'hottub' && (
        <>
          <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.9, 0.95, 0.8, 20]} /><meshStandardMaterial color="#1e3a4c" /></mesh>
          <mesh position={[0, 0.72, 0]}><cylinderGeometry args={[0.78, 0.78, 0.08, 20]} /><meshStandardMaterial color="#7dd3fc" /></mesh>
        </>
      )}
      {item.kind === 'gazebo' && (
        <>
          {[[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]].map(([x, z]) => (
            <mesh key={`${x}-${z}`} position={[x, 1.1, z]}><boxGeometry args={[0.12, 2.2, 0.12]} /><meshStandardMaterial color="#6b4f36" /></mesh>
          ))}
          <mesh position={[0, 2.25, 0]}><coneGeometry args={[2.3, 0.7, 4]} /><meshStandardMaterial color="#7f1d1d" /></mesh>
          <mesh position={[0, 0.45, 0]}><cylinderGeometry args={[0.28, 0.32, 0.7, 10]} /><meshStandardMaterial color="#44403c" /></mesh>
        </>
      )}
      {item.kind === 'grill' && (
        <mesh position={[0, 0.45, 0]}><boxGeometry args={[w, 0.7, d]} /><meshStandardMaterial color="#1c1917" /></mesh>
      )}
      {item.kind === 'firepit' && (
        <mesh position={[0, 0.18, 0]}><cylinderGeometry args={[0.55, 0.62, 0.32, 10]} /><meshStandardMaterial color="#57534e" /></mesh>
      )}
      {item.kind === 'mailbox' && (
        <group>
          <mesh position={[0, 0.55, 0]}><boxGeometry args={[0.08, 1.1, 0.08]} /><meshStandardMaterial color="#44403c" /></mesh>
          <mesh position={[0.1, 1.05, 0]}><boxGeometry args={[0.38, 0.22, 0.22]} /><meshStandardMaterial color="#1d4ed8" /></mesh>
        </group>
      )}
      {item.kind === 'playground' && (
        <group>
          <mesh position={[0, 0.04, 0]}><boxGeometry args={[w, 0.06, d]} /><meshStandardMaterial color="#ca8a04" /></mesh>
          <mesh position={[-0.4, 0.9, 0]} rotation={[0, 0, 0.4]}><boxGeometry args={[0.08, 1.8, 0.08]} /><meshStandardMaterial color="#b91c1c" /></mesh>
          <mesh position={[0.4, 0.9, 0]} rotation={[0, 0, -0.4]}><boxGeometry args={[0.08, 1.8, 0.08]} /><meshStandardMaterial color="#b91c1c" /></mesh>
        </group>
      )}
      {item.kind === 'bench' && (
        <mesh position={[0, 0.4, 0]}><boxGeometry args={[w, 0.45, d]} /><meshStandardMaterial color="#8a5a34" /></mesh>
      )}
      {item.kind === 'table' && (
        <mesh position={[0, 0.4, 0]}><boxGeometry args={[w, 0.08, d]} /><meshStandardMaterial color="#a16207" /></mesh>
      )}
      {item.kind === 'trash' && (
        <group>
          <mesh position={[0, 0.7, 0]}><boxGeometry args={[w, 1.3, d]} /><meshStandardMaterial color="#44403c" /></mesh>
          <mesh position={[0, 1.45, 0]}><boxGeometry args={[w + 0.2, 0.08, d + 0.25]} /><meshStandardMaterial color="#292524" /></mesh>
        </group>
      )}
      {item.kind === 'compost' && (
        <mesh position={[0, 0.4, 0]}><boxGeometry args={[w, 0.8, d]} /><meshStandardMaterial color="#4d7c0f" /></mesh>
      )}
      {(item.kind === 'charger' || item.kind === 'gate-opener') && (
        <mesh position={[0, 0.55, 0]}><boxGeometry args={[w, item.kind === 'charger' ? 1.1 : 0.35, d]} /><meshStandardMaterial color={tint} /></mesh>
      )}
    </group>
  )
}

function FenceMesh({ fence }) {
  const points = fence.points || []
  const height = fence.height || 1.2
  const hedge = fence.kind === 'hedge'
  const stone = fence.kind === 'stone'
  const color = hedge ? '#3f6212' : stone ? '#78716c' : fence.kind === 'mesh' ? '#94a3b8' : '#9a6b3f'
  const pick = { kind: 'yard', collection: 'fences', id: fence.id, movable: false }
  const posts = []
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    const len = Math.hypot(b.x - a.x, b.z - a.z)
    const step = hedge ? len : 1.8
    const count = Math.max(1, Math.round(len / step))
    for (let n = 0; n <= count; n += 1) {
      const t = n / count
      posts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, key: `${i}-${n}` })
    }
  }
  return (
    <group userData={{ pick }}>
      {hedge || stone ? (
        <Ribbon points={points} width={hedge ? 0.55 : 0.38} y={height / 2} thickness={height} color={color} />
      ) : (
        <>
          {posts.map((post) => (
            <mesh key={post.key} position={[post.x, height / 2, post.z]}>
              <boxGeometry args={[0.1, height, 0.1]} />
              <meshStandardMaterial color={color} />
            </mesh>
          ))}
          <Ribbon points={points} width={0.08} y={height - 0.08} thickness={0.08} color={color} />
          <Ribbon points={points} width={0.06} y={height * 0.45} thickness={0.05} color={color} />
        </>
      )}
    </group>
  )
}

function RoofMesh({ w, d, height, roof }) {
  if (roof === 'flat' || roof === 'shed') {
    return (
      <mesh position={[0, height + 0.08, roof === 'shed' ? 0 : 0]} rotation={roof === 'shed' ? [0.18, 0, 0] : [0, 0, 0]}>
        <boxGeometry args={[w + 0.3, 0.1, d + 0.3]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    )
  }
  return (
    <mesh position={[0, height + 0.45, 0]}>
      <coneGeometry args={[Math.max(w, d) * 0.72, 0.95, 4]} />
      <meshStandardMaterial color="#3f3f46" />
    </mesh>
  )
}

function memberMesh(a, b, width, depth, color, key, metal) {
  const dx = b.x - a.x
  const dy = (b.y || 0) - (a.y || 0)
  const dz = b.z - a.z
  const len = Math.hypot(dx, dy, dz)
  if (len < 0.05) return null
  const yaw = Math.atan2(dx, dz)
  const pitch = -Math.atan2(dy, Math.hypot(dx, dz) || 1)
  return (
    <mesh key={key} position={[(a.x + b.x) / 2, ((a.y || 0) + (b.y || 0)) / 2, (a.z + b.z) / 2]} rotation={new THREE.Euler(pitch, yaw, 0, 'YXZ')}>
      <boxGeometry args={[width, depth, len]} />
      <meshStandardMaterial color={color} roughness={metal ? 0.35 : 0.62} metalness={metal ? 0.55 : 0.04} />
    </mesh>
  )
}

function sheetGeometry(points, lift = 0.03) {
  if (!points || points.length < 3) return null
  const positions = []
  const origin = points[0]
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i]
    const b = points[i + 1]
    positions.push(origin.x, origin.y + lift, origin.z, a.x, a.y + lift, a.z, b.x, b.y + lift, b.z)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  geo.computeBoundingSphere()
  return geo
}

function sideGeometry(beams, mode) {
  if (!beams?.length || !mode || mode === 'none') return null
  const positions = []
  beams.forEach((beam) => {
    const y0 = mode === 'curtain' ? Math.min(beam.a.y, beam.b.y) * 0.42 : 0.06
    positions.push(
      beam.a.x, y0, beam.a.z,
      beam.b.x, y0, beam.b.z,
      beam.b.x, beam.b.y, beam.b.z,
      beam.a.x, y0, beam.a.z,
      beam.b.x, beam.b.y, beam.b.z,
      beam.a.x, beam.a.y, beam.a.z,
    )
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.computeVertexNormals()
  return geo
}

function CoverMesh({ plan, item, selected }) {
  const cover = normalizeCover(item)
  const wall = (plan.walls || []).find((entry) => entry.id === cover.wallId) || null
  const members = coverMembers(cover, wall)
  const look = roofLook(cover)
  const pointKey = cover.points.map((point) => `${point.x},${point.z}`).join('|')
  const roofGeo = useMemo(() => (look.slats ? null : sheetGeometry(members.roof, 0.045)), [look.slats, look.id, cover.pitch, cover.height, pointKey])
  const sideGeo = useMemo(() => sideGeometry(members.beams, cover.sides), [cover.sides, cover.pitch, cover.height, pointKey])
  if (cover.points.length < 3) return null
  const pick = { kind: 'yard', collection: 'covers', id: cover.id, movable: false }
  const metal = cover.frame === 'aluminium' || cover.frame === 'steel'
  const frame = selected ? '#0f766e' : cover.frameColor
  const center = cover.points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
  center.x /= cover.points.length
  center.z /= cover.points.length
  const glass = look.transparent && (cover.roofing === 'glass' || cover.roofing === 'polycarbonate')
  const sideTransparent = cover.sides === 'glazing' || cover.sides === 'sliding' || cover.sides === 'curtain'
  const sideOpacity = cover.sides === 'curtain' ? 0.55 : cover.sides === 'sliding' ? 0.28 : 0.2
  const sideColor = cover.sides === 'wall' ? '#E7E5E4' : cover.sides === 'curtain' ? '#D6D3D1' : '#E0F2FE'
  return (
    <group userData={{ pick }}>
      {members.posts.map((post, index) => (
        <mesh key={`post-${index}`} position={[post.x, cover.height / 2, post.z]} frustumCulled={false}>
          <boxGeometry args={[cover.postSize, cover.height, cover.postSize]} />
          <meshStandardMaterial color={frame} roughness={metal ? 0.35 : 0.62} metalness={metal ? 0.55 : 0.04} />
        </mesh>
      ))}
      {members.beams.map((beam, index) => memberMesh(beam.a, beam.b, Math.max(0.08, cover.postSize * 0.85), 0.1, frame, `beam-${index}`, metal))}
      {members.rafters.map((rafter, index) => memberMesh(
        rafter.a,
        rafter.b,
        look.slats ? 0.12 : 0.05,
        look.slats ? 0.035 : 0.07,
        frame,
        `rafter-${index}`,
        metal,
      ))}
      {roofGeo && (
        <mesh geometry={roofGeo} frustumCulled={false}>
          <meshStandardMaterial
            color={glass ? (cover.roofing === 'polycarbonate' && cover.roofTint !== 'opal' ? '#8ECAEF' : (look.color || '#E0F2FE')) : (look.color || '#334155')}
            transparent={Boolean(look.transparent)}
            opacity={look.transparent ? (cover.roofing === 'polycarbonate' ? (cover.roofTint === 'opal' ? 0.55 : 0.46) : cover.roofing === 'glass' ? 0.32 : (look.opacity || 0.9)) : 1}
            roughness={cover.roofing === 'glass' ? 0.04 : cover.roofing === 'metal' ? 0.4 : 0.12}
            metalness={cover.roofing === 'metal' ? 0.35 : 0}
            side={THREE.DoubleSide}
            depthWrite={!look.transparent}
          />
        </mesh>
      )}
      {sideGeo && (
        <mesh geometry={sideGeo}>
          <meshStandardMaterial
            color={sideColor}
            transparent={sideTransparent}
            opacity={sideTransparent ? sideOpacity : 1}
            roughness={sideTransparent ? 0.08 : 0.7}
            side={THREE.DoubleSide}
            depthWrite={!sideTransparent}
          />
        </mesh>
      )}
      {cover.lights && (
        <mesh position={[center.x, Math.max(1.5, cover.height - 0.08), center.z]}>
          <boxGeometry args={[0.42, 0.05, 0.16]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.85} />
        </mesh>
      )}
      {cover.heaters && members.beams[0] && (
        <mesh position={[(members.beams[0].a.x + members.beams[0].b.x) / 2, members.beams[0].a.y - 0.14, (members.beams[0].a.z + members.beams[0].b.z) / 2]}>
          <boxGeometry args={[0.9, 0.08, 0.12]} />
          <meshStandardMaterial color="#292524" />
        </mesh>
      )}
    </group>
  )
}

function BuildingMesh({ item, selected }) {
  const spec = { ...buildingSpec(item.kind), ...item }
  const pick = { kind: 'yard', collection: 'buildings', id: item.id, movable: true }
  const open = item.kind === 'carport'
  const wall = selected ? '#0f766e' : item.kind === 'sauna' ? '#a16207' : '#d6d3d1'
  return (
    <group position={[item.x, 0, item.z]} rotation={[0, ((item.rotation || 0) * Math.PI) / 180, 0]} userData={{ pick }}>
      {open ? (
        [[-spec.w / 2, -spec.d / 2], [spec.w / 2, -spec.d / 2], [spec.w / 2, spec.d / 2], [-spec.w / 2, spec.d / 2]].map(([x, z]) => (
          <mesh key={`${x}-${z}`} position={[x, spec.height / 2, z]}>
            <boxGeometry args={[0.14, spec.height, 0.14]} />
            <meshStandardMaterial color="#6b4f36" />
          </mesh>
        ))
      ) : (
        <>
          <mesh position={[0, spec.height / 2, -spec.d / 2]}>
            <boxGeometry args={[spec.w, spec.height, 0.12]} />
            <meshStandardMaterial color={wall} />
          </mesh>
          <mesh position={[0, spec.height / 2, spec.d / 2]}>
            <boxGeometry args={[spec.w * 0.62, spec.height, 0.12]} />
            <meshStandardMaterial color={wall} />
          </mesh>
          <mesh position={[-spec.w / 2, spec.height / 2, 0]}>
            <boxGeometry args={[0.12, spec.height, spec.d]} />
            <meshStandardMaterial color={wall} />
          </mesh>
          <mesh position={[spec.w / 2, spec.height / 2, 0]}>
            <boxGeometry args={[0.12, spec.height, spec.d]} />
            <meshStandardMaterial color={wall} />
          </mesh>
        </>
      )}
      <RoofMesh w={spec.w} d={spec.d} height={spec.height} roof={spec.roof} />
    </group>
  )
}

export default function YardScene({ plan, selected }) {
  if (!hasYard(plan)) return null
  const yard = ensureYard(plan)
  const box = yardBounds(plan)
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const w = Math.max(4, box.maxX - box.minX)
  const d = Math.max(4, box.maxZ - box.minZ)
  const active = (collection, id) => selected?.kind === 'yard' && selected.collection === collection && selected.id === id
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.004, cz]} raycast={noop}>
        <planeGeometry args={[w + 1.2, d + 1.2]} />
        <meshStandardMaterial color="#c4b89a" />
      </mesh>
      {yard.plot && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.008, cz]} raycast={noop}>
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial color="#d9e7c4" />
        </mesh>
      )}
      {yard.beds.map((bed) => {
        const center = bed.points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
        center.x /= bed.points.length
        center.z /= bed.points.length
        const spanX = Math.max(...bed.points.map((point) => point.x)) - Math.min(...bed.points.map((point) => point.x))
        const spanZ = Math.max(...bed.points.map((point) => point.z)) - Math.min(...bed.points.map((point) => point.z))
        return (
          <mesh key={bed.id} rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0.012, center.z]} raycast={noop}>
            <planeGeometry args={[spanX, spanZ]} />
            <meshStandardMaterial color={bed.kind === 'flowerbed' ? '#e7c56a' : '#7da35a'} />
          </mesh>
        )
      })}
      {yard.terraces.map((item) => {
        const center = item.points.reduce((acc, point) => ({ x: acc.x + point.x, z: acc.z + point.z }), { x: 0, z: 0 })
        center.x /= item.points.length
        center.z /= item.points.length
        const spanX = Math.max(...item.points.map((point) => point.x)) - Math.min(...item.points.map((point) => point.x))
        const spanZ = Math.max(...item.points.map((point) => point.z)) - Math.min(...item.points.map((point) => point.z))
        const color = item.material === 'concrete' ? '#a8a29e' : item.material === 'composite' ? '#78716c' : item.material === 'paving' ? '#d6d3d1' : '#c4a574'
        return (
          <group key={item.id}>
            <mesh position={[center.x, 0.16, center.z]}>
              <boxGeometry args={[spanX, 0.28, spanZ]} />
              <meshStandardMaterial color={color} />
            </mesh>
            {item.railing !== false && footprint({ x: center.x, z: center.z, w: spanX, d: spanZ }).map((corner, index) => (
              <mesh key={index} position={[corner.x, 0.55, corner.z]}>
                <boxGeometry args={[0.06, 0.7, 0.06]} />
                <meshStandardMaterial color="#44403c" />
              </mesh>
            ))}
          </group>
        )
      })}
      {yard.paths.map((item) => (
        <Ribbon
          key={item.id}
          points={item.points}
          width={item.width || 1.2}
          y={0.02}
          color={item.material === 'asphalt' ? '#4b5563' : item.material === 'paving' ? '#d6d3d1' : item.material === 'grass' ? '#86a36a' : '#c4b49a'}
          pick={{ kind: 'yard', collection: 'paths', id: item.id, movable: false }}
        />
      ))}
      {yard.fences.map((fence) => <FenceMesh key={fence.id} fence={fence} />)}
      {yard.plants.map((item) => <PlantMesh key={item.id} item={item} selected={active('plants', item.id)} />)}
      {yard.objects.map((item) => <ObjectMesh key={item.id} item={item} selected={active('objects', item.id)} />)}
      {yard.buildings.map((item) => <BuildingMesh key={item.id} item={item} selected={active('buildings', item.id)} />)}
      {(yard.covers || []).map((item) => <CoverMesh key={item.id} plan={plan} item={item} selected={active('covers', item.id)} />)}
    </group>
  )
}
