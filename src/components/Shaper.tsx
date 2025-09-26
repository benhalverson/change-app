import React, { Suspense, useMemo, useState } from "react";
import * as THREE from "three";

import { Environment, Grid, OrbitControls, useCursor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { DeformableMesh } from "./DeformableMesh";
import { LabeledNumber } from './LabeledNumber';

export const Shaper = () => {
	const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
	const [material, setMaterial] = useState("#000000");
	const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
	const [targetDims, setTargetDims] = useState<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });

	const [hover, setHover] = useState(false);

	useCursor(hover);

	const handleFiles = async (files: FileList | null) => {
		console.log("file", files);
		if (!files || files.length === 0) return;
		const file = files[0];
		const extension = file.name.split(".").pop()?.toLowerCase();
		const data = await file.arrayBuffer();
		console.log("data", data);

		if (extension === "stl") {
			const loader = new STLLoader();
			const geometry = loader.parse(data);
			setGeometry(geometry);
		}
	};

	const normalizeGeometry = useMemo(() => {
		if (!geometry) return null;
		const geoClone = geometry.clone();
		geoClone.computeBoundingBox();

		const boundingBox = geoClone.boundingBox;
		const center = new THREE.Vector3();
		boundingBox?.getCenter(center);

		const position = geometry.attributes.position as THREE.BufferAttribute;
		const vector = new THREE.Vector3();

		for (let i = 0; i < position.count; i++) {
			vector.fromBufferAttribute(position, i).sub(center);
			position.setXYZ(i, vector.x, vector.y, vector.z);
		}

		geoClone.computeBoundingBox();
		geoClone.computeVertexNormals();

		geoClone.__originalBBox = geoClone.boundingBox?.clone();

		return geoClone;
	}, [geometry]);

	const onDrop = (e: React.DragEvent) => {
		e.preventDefault();
		handleFiles(e.dataTransfer.files);
	};

	return (
		<div className="w-full h-full grid bg-slate-50 text-slate-800">
			<div className="flex items-center gap-3 p-3 border-b bg-white/80 backdrop-blur">
				<input
					type="file"
					accept=".stl,.obj"
					onChange={(e) => handleFiles(e.target.files)}
				/>
				<button className="px-3 py-1.5 rounded-2xl bg-slate-900 text-white disabled:opacity-50">
					Export STL
				</button>
				<label>
					<span className="ml-auto">Color:</span>
					<input
						type="color"
						className="text-xs"
						value={material}
						onChange={(e) => setMaterial(e.target.value)}
					/>
				</label>
			</div>

			<div
				onDrop={onDrop}
				onDragOver={(e) => e.preventDefault()}
				onDropCapture={onDrop}
			>
				{!normalizeGeometry && (
					<div>
						<p className="font-medium">Drop an STL here</p>
						<p className="font-xs">or use the file picker</p>
					</div>
				)}

				<Canvas camera={{ position: [140, 140, 160], fov: 40 }} shadows>
					<color attach="background" args={["#ffffff"]} />
					<hemisphereLight
						intensity={0.75}
						groundColor={new THREE.Color("#cccccc")}
					/>
					<Suspense fallback={null}>
						{normalizeGeometry && (
							<DeformableMesh
								geometry={normalizeGeometry}
								scaleVector={new THREE.Vector3(scale.x, scale.y, scale.z)}
								twist={0}
								bend={0}
								taper={0}
								color={material}
								onPointerOver={() => setHover(true)}
								onPointerOut={() => setHover(false)}
							></DeformableMesh>
						)}
						<Grid
							infiniteGrid
							fadeDistance={60}
							cellSize={10}
							sectionSize={100}
							position={[0, -0.5, 0]}
						/>
						<Environment preset="city" />
					</Suspense>
					<OrbitControls makeDefault enableDamping dampingFactor={0.1} />
				</Canvas>
			</div>

      <div className="grid md:grid-cols-3 gap-4 p-4 border-t bg-white/80">
        <fieldset className="space-y-2">
          <legend className="font-semibold">Absolute Size (mm)</legend>
          <LabeledNumber label="Width (X)" value={targetDims.x} onChange={(value) => setTargetDims((t) => ({ ...t, x: value }))} />
          <LabeledNumber label="Height (Y)" value={targetDims.y} onChange={(value) => setTargetDims((t) => ({ ...t, y: value }))} />
          <LabeledNumber label="Depth (Z)" value={targetDims.z} onChange={(value) => setTargetDims((t) => ({ ...t, z: value }))} />
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="font-semibold">Scale</legend>
          <LabeledNumber label="X" value={scale.x} onChange={(value) => setScale((s) => ({ ...s, x: value }))} step={0.1} />
          <LabeledNumber label="Y" value={scale.y} onChange={(value) => setScale((s) => ({ ...s, y: value }))} step={0.1} />
          <LabeledNumber label="Z" value={scale.z} onChange={(value) => setScale((s) => ({ ...s, z: value }))} step={0.1} />
        </fieldset>

      </div>
		</div>
	);
};
