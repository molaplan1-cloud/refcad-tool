'use client'

import * as THREE from 'three'
import { ensureServices, pipeRadius, runColor, serviceItemVisible } from '@/lib/services'

function Segment({ a, b, radius, color, pick, mark }) {
  const start = new THREE.Vector3(a.x, a.y || 0, a.z)
  const end = new THREE.Vector3(b.x, b.y || 0, b.z)
  const length = start.distanceTo(end)
  if (length < 0.03) return null
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const direction = end.clone().sub(start).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
  return (
    <mesh position={mid.toArray()} quaternion={quaternion} userData={pick ? { pick } : undefined}>
      <cylinderGeometry args={[Math.max(radius, mark === 'selected' ? 0.09 : mark ? 0.055 : radius), Math.max(radius, mark === 'selected' ? 0.09 : mark ? 0.055 : radius), length, 8]} />
      <meshLambertMaterial
        color={mark === 'selected' ? '#0f766e' : mark === 'hover' ? '#14b8a6' : color}
        emissive={mark === 'selected' ? '#042f2e' : '#000000'}
        emissiveIntensity={mark === 'selected' ? 0.6 : 0}
      />
    </mesh>
  )
}

function sameService(item, run, target) {
  return item?.kind === 'service' && item.service?.target === target && item.service?.id === (target === 'run' ? run.id : run.id)
}

function RunMesh({ run, selected, hovered }) {
  const radius = pipeRadius(run)
  const color = runColor(run)
  const points = run.points || []
  const activeId = selected?.service?.id === run.id || hovered?.service?.id === run.id
  const mark = selected?.service?.id === run.id ? 'selected' : hovered?.service?.id === run.id ? 'hover' : null
  return (
    <group>
      {points.slice(1).map((point, index) => (
        <Segment
          key={`${run.id}-${index}`}
          a={points[index]}
          b={point}
          radius={radius}
          color={color}
          pick={{ kind: 'service', service: { target: 'segment', id: run.id, system: run.system, index } }}
          mark={mark}
        />
      ))}
      {activeId && mark === 'selected' && points.map((point, index) => (
        <mesh
          key={`grip-${run.id}-${index}`}
          position={[point.x, point.y || 0, point.z]}
          userData={{ pick: { kind: 'service', service: { target: 'vertex', id: run.id, system: run.system, index } } }}
        >
          <sphereGeometry args={[0.07, 10, 8]} />
          <meshBasicMaterial color="#0f766e" depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

function NodeBody({ node, y, tint }) {
  const color = (fallback) => tint || fallback
  if (node.kind === 'ahu') {
    return (
      <mesh position={[node.x, y - 0.15, node.z]}>
        <boxGeometry args={[0.9, 0.5, 0.5]} />
        <meshLambertMaterial color={color('#e2e8f0')} />
      </mesh>
    )
  }
  if (node.kind === 'hood') {
    return (
      <mesh position={[node.x, y - 0.2, node.z]}>
        <boxGeometry args={[0.7, 0.16, 0.45]} />
        <meshLambertMaterial color={color('#ca8a04')} />
      </mesh>
    )
  }
  if (node.kind === 'silencer') {
    return (
      <mesh position={[node.x, y, node.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.46, 10]} />
        <meshLambertMaterial color={color('#94a3b8')} />
      </mesh>
    )
  }
  if (node.kind === 'valve' || node.kind === 'floor-drain') {
    return (
      <mesh position={[node.x, node.kind === 'floor-drain' ? 0.02 : y, node.z]}>
        <coneGeometry args={[0.12, 0.12, 10]} />
        <meshLambertMaterial color={color(node.role === 'poisto' ? '#ca8a04' : node.kind === 'floor-drain' ? '#57534e' : '#dc2626')} />
      </mesh>
    )
  }
  if (node.kind === 'panel') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <boxGeometry args={[0.42, 0.62, 0.12]} />
        <meshLambertMaterial color={color('#f8fafc')} />
      </mesh>
    )
  }
  if (node.kind === 'light') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <sphereGeometry args={[0.1, 12, 10]} />
        <meshLambertMaterial color={color('#fef3c7')} />
      </mesh>
    )
  }
  if (node.kind === 'manifold') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <boxGeometry args={[0.28, 0.12, 0.1]} />
        <meshLambertMaterial color={color('#1d4ed8')} />
      </mesh>
    )
  }
  if (node.system === 'electric') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <boxGeometry args={[0.12, 0.12, 0.06]} />
        <meshLambertMaterial color={color('#1c1917')} />
      </mesh>
    )
  }
  return (
    <mesh position={[node.x, y, node.z]}>
      <sphereGeometry args={[0.08, 8, 8]} />
      <meshLambertMaterial color={color(node.system === 'drain' ? '#57534e' : '#1d4ed8')} />
    </mesh>
  )
}

function NodeMesh({ node, selected, hovered }) {
  const y = node.y || 0
  const pick = { kind: 'service', service: { target: 'node', id: node.id, system: node.system } }
  const mark = sameService(selected, node, 'node') ? 'selected' : sameService(hovered, node, 'node') ? 'hover' : null
  const tint = mark === 'selected' ? '#0f766e' : mark === 'hover' ? '#14b8a6' : null
  return (
    <group userData={{ pick }}>
      <NodeBody node={node} y={y} tint={tint} />
    </group>
  )
}

export default function Services3D({ plan, selected = null, hovered = null, activeSystems = null, revealSystems = null }) {
  const services = ensureServices(plan)
  const revealed = (item) => {
    if (!item || item.hidden) return false
    if (Array.isArray(revealSystems) && revealSystems.includes(item.system)) return true
    return serviceItemVisible(plan, item)
  }
  const runs = services.runs.filter(revealed)
  const nodes = services.nodes.filter(revealed)
  const live = (system) => !Array.isArray(activeSystems) || activeSystems.includes(system)
  return (
    <group>
      {runs.map((run) => (
        <group key={run.id} opacity={live(run.system) ? 1 : 0.22}>
          <RunMesh run={run} selected={selected} hovered={hovered} />
        </group>
      ))}
      {nodes.map((node) => (
        <group key={node.id} opacity={live(node.system) ? 1 : 0.22}>
          <NodeMesh node={node} selected={selected} hovered={hovered} />
        </group>
      ))}
    </group>
  )
}
