import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Sphere, MeshDistortMaterial, OrbitControls } from '@react-three/drei';
import { EffectComposer, GodRays, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

export function SceneControls() {
  const spotlightRef = useRef<THREE.SpotLight>(null);
  const targetRef = useRef<THREE.Object3D>(new THREE.Object3D());

  useFrame((state) => {
    if (spotlightRef.current) {
      // Position the spotlight exactly at the camera position
      spotlightRef.current.position.copy(state.camera.position);
      
      // Update target to be 10 units in front of the camera
      const targetPos = new THREE.Vector3(0, 0, -10);
      targetPos.applyQuaternion(state.camera.quaternion);
      targetPos.add(state.camera.position);
      
      targetRef.current.position.copy(targetPos);
      spotlightRef.current.target = targetRef.current;
    }
  });

  return (
    <>
      <OrbitControls 
        makeDefault
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.5}
        zoomSpeed={1.2}
        panSpeed={0.8}
        screenSpacePanning={true}
      />
      <primitive object={targetRef.current} />
      <spotLight
        ref={spotlightRef}
        intensity={15}
        distance={40}
        angle={Math.PI / 4}
        penumbra={1}
        decay={2}
        color="#00ff66"
      />
    </>
  );
}

export function FloatingDashboard() {
  const [sun, setSun] = useState<THREE.Mesh | null>(null);
  const timeRef = useRef(0);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    
    if (groupRef.current) {
      // Manual floating animation to replace <Float />
      groupRef.current.position.y = Math.sin(t * 0.5) * 0.5;
      groupRef.current.rotation.x = Math.cos(t * 0.3) * 0.1;
      groupRef.current.rotation.z = Math.sin(t * 0.2) * 0.1;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={3} color="#00ff66" />
      <pointLight position={[-10, -10, -10]} intensity={2} color="#bc13fe" />
      
      <group ref={groupRef}>
        <Sphere ref={setSun} args={[1.5, 64, 64]} position={[0, 0, 0]}>
          <MeshDistortMaterial
            color="#00ff66"
            speed={4}
            distort={0.5}
            radius={1}
            emissive="#00ff66"
            emissiveIntensity={2}
          />
        </Sphere>
      </group>

      {sun && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} radius={0.4} />
          <GodRays
            sun={sun}
            exposure={0.3}
            decay={0.96}
            blur
          />
        </EffectComposer>
      )}
    </>
  );
}

export function TopicNode({ 
  position, 
  title, 
  completed, 
  progress = completed ? 1 : 0,
  onClick 
}: { 
  position: [number, number, number], 
  title: string, 
  completed: boolean, 
  progress?: number,
  onClick: () => void 
}) {
  const timeRef = useRef(0);
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const baseColor = completed ? "#00ff66" : "#bc13fe";
  const hoverColor = completed ? "#66ff99" : "#d880ff";
  const glowIntensity = completed ? (hovered ? 6 : 4) : (hovered ? 3 : 2);

  useFrame((_state, delta) => {
    timeRef.current += delta;
    const t = timeRef.current;
    const intensity = glowIntensity * (1 + Math.sin(t * 2) * 0.3);
    
    if (meshRef.current) {
      // Gentle rotation
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.z += 0.005;
      
      // Faster pulsing for completed nodes
      const pulseSpeed = completed ? 4 : 2;
      const pulse = Math.sin(t * pulseSpeed) * 0.1;
      const baseScale = 1 + pulse;
      const targetScale = hovered ? baseScale * 1.3 : baseScale;
      
      // Smoothly interpolate scale
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
      
      // Update emissive intensity
      if (meshRef.current.material) {
        (meshRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity;
      }
    }

    if (ringRef.current) {
      // Ring rotation
      ringRef.current.rotation.z -= 0.02;
      // Pulse the ring scale slightly differently
      const ringPulse = 1 + Math.sin(t * 3) * 0.05;
      ringRef.current.scale.set(ringPulse, ringPulse, ringPulse);
      
      // Update emissive intensity
      if (ringRef.current.material) {
        (ringRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = intensity * 2;
      }
    }
  });

  return (
    <group 
      position={position} 
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Progress Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.03, 16, 100, Math.PI * 2 * progress]} />
        <meshStandardMaterial 
          color={baseColor} 
          emissive={baseColor} 
          emissiveIntensity={glowIntensity * 1.5}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Background Ring (Ghost) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.01, 16, 100]} />
        <meshStandardMaterial 
          color={baseColor} 
          transparent
          opacity={0.2}
          wireframe
        />
      </mesh>

      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.6, 0]} />
        <meshStandardMaterial 
          color={hovered ? hoverColor : baseColor} 
          wireframe 
          emissive={hovered ? hoverColor : baseColor}
          emissiveIntensity={glowIntensity}
        />
      </mesh>
      <Text
        position={[0, -1, 0]}
        fontSize={0.25}
        color="white"
        anchorX="center"
        anchorY="middle"
        font="https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hjp-Ek-_EeA.woff"
      >
        {title.toUpperCase()}
      </Text>
    </group>
  );
}
