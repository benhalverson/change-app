import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
export const DeformableMesh = ({
	geometry,
	scaleVector,
	twist,
	bend,
	taper,
	color,
	onPointerOver,
	onPointerOut,
}: Mesh) => {
	const matRef = useRef<Three.MeshStandardMaterial>(null!);
	const meshRef = useRef<Three.Mesh>(null!);

	const uniforms = useMemo(
		() => ({
			uTwist: { value: twist },
			uBend: { value: bend },
			uTaper: { value: taper },
			uMinY: { value: 0 },
			uHeight: { value: 1 },
			uScale: { value: new THREE.Vector3(1, 1, 1) },
		}),
		[]
	);

	useEffect(() => {
		uniforms.uTwist.value = twist;
	}, [uniforms.uTwist, twist]);
	useEffect(() => {
		uniforms.uBend.value = bend;
	}, [uniforms.uBend, bend]);
	useEffect(() => {
		uniforms.uTaper.value = taper;
	}, [uniforms.uTaper, taper]);
	useEffect(() => {
		uniforms.uScale.value.copy(scaleVector);
	}, [uniforms.uScale, scaleVector]);

	useEffect(() => {
		geometry.computeBoundingBox();
		const boundingBox = geometry.boundingBox;
		const size = new THREE.Vector3();
		boundingBox.getSize(size);
		uniforms.uHeight.value = size.y;
		uniforms.uMinY.value = Math.max(size.y, 1e-6);
	}, [geometry, uniforms]);

	const onBeforeCompile = (shader: THREE.Shader) => {
		shader.uniforms.uTwist = uniforms.uTwist;
		shader.uniforms.uBend = uniforms.uBend;
		shader.uniforms.uTaper = uniforms.uTaper;
		shader.uniforms.uMinY = uniforms.uMinY;
		shader.uniforms.uHeight = uniforms.uHeight;
		shader.uniforms.uScale = uniforms.uScale;
	};

	return (
		<mesh
			ref={meshRef}
			geometry={geometry}
			castShadow
			receiveShadow
			onPointerOver={onPointerOver}
			onPointerOut={onPointerOut}
		>
			<meshStandardMaterial
				ref={matRef}
				color={color}
				metalness={0.1}
				roughness={0.6}
				onBeforeCompile={onBeforeCompile}
			/>
		</mesh>
	);
};

interface Mesh {
	geometry: THREE.BufferGeometry;
	scaleVector: THREE.Vector3;
	twist: number;
	bend: number;
	taper: number;
	color: string;
	onPointerOver: () => void;
	onPointerOut: () => void;
}
