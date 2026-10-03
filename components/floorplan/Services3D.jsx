'use client'

import * as THREE from 'three'
import { ensureServices, layerVisible, pipeRadius, runColor } from '@/lib/services'

function Segment({ a, b, radius, color }) {
  const start = new THREE.Vector3(a.x, a.y || 0, a.z)
  const end = new THREE.Vector3(b.x, b.y || 0, b.z)
  const length = start.distanceTo(end)
  if (length < 0.03) return null
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const direction = end.clone().sub(start).normalize()
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
  return (
    <mesh position={mid.toArray()} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 8]} />
      <meshLambertMaterial color={color} />
    </mesh>
  )
}

function RunMesh({ run }) {
  const radius = pipeRadius(run)
  const color = runColor(run)
  const points = run.points || []
  return (
    <group>
      {points.slice(1).map((point, index) => (
        <Segment key={`${run.id}-${index}`} a={points[index]} b={point} radius={radius} color={color} />
      ))}
    </group>
  )
}

function NodeMesh({ node }) {
  const y = node.y || 0
  if (node.kind === 'ahu') {
    return (
      <mesh position={[node.x, y - 0.15, node.z]}>
        <boxGeometry args={[0.9, 0.5, 0.5]} />
        <meshLambertMaterial color="#e2e8f0" />
      </mesh>
    )
  }
  if (node.kind === 'hood') {
    return (
      <mesh position={[node.x, y - 0.2, node.z]}>
        <boxGeometry args={[0.7, 0.16, 0.45]} />
        <meshLambertMaterial color="#ca8a04" />
      </mesh>
    )
  }
  if (node.kind === 'silencer') {
    return (
      <mesh position={[node.x, y, node.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.46, 10]} />
        <meshLambertMaterial color="#94a3b8" />
      </mesh>
    )
  }
  if (node.kind === 'valve' || node.kind === 'floor-drain') {
    return (
      <mesh position={[node.x, node.kind === 'floor-drain' ? 0.02 : y, node.z]}>
        <coneGeometry args={[0.08, 0.08, 10]} />
        <meshLambertMaterial color={node.role === 'poisto' ? '#ca8a04' : node.kind === 'floor-drain' ? '#57534e' : '#dc2626'} />
      </mesh>
    )
  }
  if (node.kind === 'panel') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <boxGeometry args={[0.42, 0.62, 0.12]} />
        <meshLambertMaterial color="#f8fafc" />
      </mesh>
    )
  }
  if (node.kind === 'light') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <sphereGeometry args={[0.08, 12, 10]} />
        <meshLambertMaterial color="#fef3c7" />
      </mesh>
    )
  }
  if (node.kind === 'manifold') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <boxGeometry args={[0.28, 0.12, 0.1]} />
        <meshLambertMaterial color="#1d4ed8" />
      </mesh>
    )
  }
  if (node.system === 'electric') {
    return (
      <mesh position={[node.x, y, node.z]}>
        <boxGeometry args={[0.08, 0.08, 0.04]} />
        <meshLambertMaterial color="#1c1917" />
      </mesh>
    )
  }
  return (
    <mesh position={[node.x, y, node.z]}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshLambertMaterial color={node.system === 'drain' ? '#57534e' : '#1d4ed8'} />
    </mesh>
  )
}

export default function Services3D({ plan }) {
  const services = ensureServices(plan)
  const runs = services.runs.filter((run) => layerVisible(plan, run.system))
  const nodes = services.nodes.filter((node) => layerVisible(plan, node.system))
  return (
    <group>
      {runs.map((run) => <RunMesh key={run.id} run={run} />)}
      {nodes.map((node) => <NodeMesh key={node.id} node={node} />)}
    </group>
  )
}
