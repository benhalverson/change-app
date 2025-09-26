import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];

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
	const matRef = useRef<THREE.MeshStandardMaterial>(null!);
	const meshRef = useRef<THREE.Mesh>(null!);

	const uniforms = useMemo(
		() => ({
			uTwist: { value: twist },
			uBend: { value: bend },
			uTaper: { value: taper },
			uMinY: { value: 0 },
			uHeight: { value: 1 },
			uScale: { value: new THREE.Vector3(1, 1, 1) },
		}), []
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
		boundingBox?.getSize(size);
		uniforms.uHeight.value = size.y;
		uniforms.uMinY.value = Math.max(size.y, 1e-6);
	}, [geometry, uniforms]);

	const onBeforeCompile = (shader: Shader) => {
		const s = shader as ShaderLike;
		s.uniforms.uTwist = uniforms.uTwist;
		s.uniforms.uBend = uniforms.uBend;
		s.uniforms.uTaper = uniforms.uTaper;
		s.uniforms.uMinY = uniforms.uMinY;
		s.uniforms.uHeight = uniforms.uHeight;
		s.uniforms.uScale = uniforms.uScale;

		s.vertexShader = s.vertexShader
			.replace(
				`#include <common>`,
				`
        #include <common>
        uniform float uTwist;
        uniform float uBend;
        uniform float uTaper;
        uniform float uMinY;
        uniform float uHeight;
        uniform vec3 uScale;
        `
			)
			.replace(
				`#include <begin_vertex>`,
				`
        #include <begin_vertex>

        transformed *= uScale;

        float h = clamp((transformed.y - uMinY) / max(uHeight, 1e-6), 0.0, 1.0);

        float taperK = 1.0 + uTaper * (h - 0.5) * 2.0;
        transformed.xz *= taperK;

        float ang = uTwist * h;
        float c = cos(ang);
        float s = sin(ang);
        mat2 R = mat2(c, -s, s, c);
        transformed.xz = R * transformed.xz;

        float bendAng = (h - 0.5) * uBend;
        float cy = cos(bendAng);
        float sy = sin(bendAng);
        float yC = (h - 0.5) * uHeight;
        float z2 = transformed.z * cy - yC * sy;
        float y2 = transformed.z * sy + yC * cy;
        transformed.z = z2;
        transformed.y = y2 + uMinY + uHeight * 0.5;
        `
			);
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

type ShaderLike = {
  uniforms: Record<string, THREE.IUniform>;
  vertexShader: string;
  fragmentShader: string;
};