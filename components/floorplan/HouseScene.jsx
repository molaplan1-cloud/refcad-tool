'use client'

import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Edges, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  WALL_HEIGHT,
  fixtureTemplate,
  materialOf,
  planBounds,
  pointInPolygon,
  roofFaces,
  roofModel,
  roofOutline,
  segmentLength,
  wallPieces,
  wallThickness,
} from '@/lib/floorplan'

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

function Solid({ args, position, rotation, color, map, opacity = 1, edges = true }) {
  const transparent = opacity < 0.98
  return (
    <mesh position={position} rotation={rotation} castShadow={false} receiveShadow={false}>
      <boxGeometry args={args} />
      <meshLambertMaterial
        color={color}
        map={transparent ? null : map || null}
        transparent={transparent}
        opacity={opacity}
        depthWrite={!transparent}
      />
      {edges && !transparent && <Edges threshold={20} color="#1e293b" />}
    </mesh>
  )
}

function WallMesh({ plan, mode }) {
  if (mode === 'hidden') return null
  const opacity = mode === 'ghost' ? 0.14 : 1
  const exterior = materialOf('exterior', plan.exteriorId)
  const exteriorMap = mode === 'solid' ? finishTexture('exterior', exterior.id) : null
  return (
    <group>
      {(plan.walls || []).flatMap((wall) => {
        const len = segmentLength(wall.a, wall.b) || 1
        const dx = (wall.b.x - wall.a.x) / len
        const dz = (wall.b.z - wall.a.z) / len
        const yaw = Math.atan2(-dz, dx)
        const thick = wallThickness(wall.kind)
        return wallPieces(wall, plan.openings).map((piece) => {
          const span = piece.to - piece.from
          const mid = pointAt(wall, (piece.from + piece.to) / 2)
          const y = (piece.y0 + piece.y1) / 2
          const height = piece.y1 - piece.y0
          const finish = wall.kind === 'exterior' ? exterior : adjacentInterior(plan, wall, piece)
          const map = wall.kind === 'exterior' ? exteriorMap : (mode === 'solid' ? finishTexture('interior', finish.id) : null)
          return (
            <Solid
              key={`${wall.id}-${piece.from}-${piece.y0}`}
              args={[span, height, thick]}
              position={[mid.x, y, mid.z]}
              rotation={[0, yaw, 0]}
              color={finish.color}
              map={map}
              opacity={opacity}
            />
          )
        })
      })}
    </group>
  )
}

function FloorMesh({ room }) {
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
  return (
    <mesh geometry={geom} position={[0, 0.012, 0]} receiveShadow={false}>
      <meshLambertMaterial color={finish.color} map={map} side={THREE.DoubleSide} />
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

function RoofMesh({ plan, mode }) {
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
  return (
    <group>
      <mesh geometry={geom}>
        <meshLambertMaterial
          color={ghost ? '#94a3b8' : finish.color}
          map={map}
          side={THREE.DoubleSide}
          transparent={ghost}
          opacity={ghost ? 0.15 : 1}
          depthWrite={!ghost}
        />
      </mesh>
      {edgeSpecs.map((edge, index) => (
        <mesh key={index} position={edge.position} quaternion={edge.quaternion}>
          <boxGeometry args={[0.045, edge.length, 0.045]} />
          <meshBasicMaterial color="#1e293b" />
        </mesh>
      ))}
      {!ghost && (
        <mesh geometry={ceiling} position={[0, WALL_HEIGHT - 0.02, 0]}>
          <meshLambertMaterial color="#f8fafc" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

function FixtureBody({ type, w, d }) {
  const box = (size, position, color) => (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshLambertMaterial color={color} />
      <Edges threshold={18} color="#334155" />
    </mesh>
  )
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
  if (type === 'fridge') return box([w, 1.8, d], [0, 0.9, 0], '#f8fafc')
  if (type === 'wardrobe') return box([w, 2.1, d], [0, 1.05, 0], '#e7e5e4')
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
  if (type === 'shower') {
    return (
      <group>
        {box([w, 0.08, d], [0, 0.04, 0], '#e2e8f0')}
        <mesh position={[0, 1.05, 0]}>
          <boxGeometry args={[w, 1.9, d]} />
          <meshLambertMaterial color="#bae6fd" transparent opacity={0.28} depthWrite={false} />
        </mesh>
      </group>
    )
  }
  return box([w, 0.8, d], [0, 0.4, 0], '#f5f5f4')
}

function FixtureMesh({ fixture }) {
  const tpl = fixtureTemplate(fixture.type)
  return (
    <group position={[fixture.x, 0, fixture.z]} rotation={[0, ((fixture.rotation || 0) * Math.PI) / 180, 0]}>
      <FixtureBody type={fixture.type} w={tpl.w} d={tpl.d} />
    </group>
  )
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

export default function HouseScene({ plan, wallMode, roofMode, fitToken = 0 }) {
  const controlsRef = useRef(null)
  const box = planBounds(plan)
  const cx = (box.minX + box.maxX) / 2
  const cz = (box.minZ + box.maxZ) / 2
  const span = Math.max(box.maxX - box.minX, box.maxZ - box.minZ, 8)
  return (
    <Canvas
      camera={{ position: [cx, span, cz + span], fov: 34, near: 0.08, far: 240 }}
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
      <gridHelper args={[Math.max(24, span * 2.2), Math.round(Math.max(24, span * 2.2)), '#cfcabe', '#e4e0d8']} position={[cx, 0, cz]} />
      {(plan.rooms || []).map((room) => <FloorMesh key={room.id} room={room} />)}
      <WallMesh plan={plan} mode={wallMode} />
      <RoofMesh plan={plan} mode={roofMode} />
      {(plan.fixtures || []).map((fixture) => <FixtureMesh key={fixture.id} fixture={fixture} />)}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[cx, 1.25, cz]}
        maxPolarAngle={Math.PI / 2.08}
        enableDamping={false}
      />
      <FrameCamera plan={plan} fitToken={fitToken} controlsRef={controlsRef} />
    </Canvas>
  )
}
