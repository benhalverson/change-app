import React, { Suspense, useMemo, useState } from "react";
import * as THREE from "three";

import { Environment, Grid, OrbitControls, useCursor } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { STLExporter } from "three/examples/jsm/Addons.js";
import { DeformableMesh } from "./DeformableMesh";
import { LabeledNumber } from "./LabeledNumber";

export const Shaper = () => {
	const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
	const [material, setMaterial] = useState("#000000");
	const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
	const [twist, setTwist] = useState(0);
	const [bend, setBend] = useState(0);
	const [taper, setTaper] = useState(0);
	// Target dimensions in mm
	const [targetDims, setTargetDims] = useState<{
		x: number;
		y: number;
		z: number;
	}>({ x: 0, y: 0, z: 0 });

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

	const absoluteScale = useMemo(() => {
		if (!normalizeGeometry) return new THREE.Vector3(scale.x, scale.y, scale.z);
		const bb: THREE.Box3 =
			normalizeGeometry.__originalBBox || normalizeGeometry.boundingBox!;
		const size = new THREE.Vector3();
		bb.getSize(size);
		const goal = new THREE.Vector3(
			targetDims.x ?? size.x,
			targetDims.y ?? size.y,
			targetDims.z ?? size.z
		);
		return new THREE.Vector3(
			(goal.x / size.x) * scale.x,
			(goal.y / size.y) * scale.y,
			(goal.z / size.z) * scale.z
		);
	}, [normalizeGeometry, targetDims, scale]);

	const onExport = () => {
		if (!normalizeGeometry) return;
		// We need to bake modifiers + absolute scale to geometry before export.
		const baked = applyModifiersAndScale(
			normalizeGeometry,
			{ twist, bend, taper },
			absoluteScale
		);
		const exporter = new STLExporter();
		const stlString = exporter.parse(new THREE.Mesh(baked));
		const blob = new Blob([stlString], { type: "application/sla" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "model-modified.stl";
		a.click();
		URL.revokeObjectURL(url);
	};

	const onDrop = (e: React.DragEvent) => {
		e.preventDefault();
		handleFiles(e.dataTransfer.files);
	};

	function applyModifiersAndScale(
		source: THREE.BufferGeometry,
		mods: { twist: number; bend: number; taper: number },
		scale: THREE.Vector3
	) {
		const geo = source.clone();
		geo.computeBoundingBox();
		const bb = geo.boundingBox!;
		const size = new THREE.Vector3();
		bb.getSize(size);
		const minY = bb.min.y;
		const height = Math.max(size.y, 1e-6);

		const pos = geo.attributes.position as THREE.BufferAttribute;
		const v = new THREE.Vector3();

		for (let i = 0; i < pos.count; i++) {
			v.fromBufferAttribute(pos, i);

			// Normalize height 0..1
			const h = (v.y - minY) / height;

			// Taper: scale in XZ along height
			const taperK = 1.0 + mods.taper * (h - 0.5) * 2.0; // centered taper
			v.x *= taperK;
			v.z *= taperK;

			// Twist: rotate around Y depending on height
			const ang = mods.twist * h;
			const cos = Math.cos(ang);
			const sin = Math.sin(ang);
			const x = v.x * cos - v.z * sin;
			const z = v.x * sin + v.z * cos;
			v.x = x;
			v.z = z;

			// Bend: simple bend around X axis across height
			// Maps Y into an arc in YZ plane
			const bendAng = (h - 0.5) * mods.bend; // center bend
			const cy = Math.cos(bendAng);
			const sy = Math.sin(bendAng);
			const y = (h - 0.5) * height; // centered height
			const z2 = v.z * cy - y * sy;
			const y2 = v.z * sy + y * cy;
			// restore absolute Y from centered y2
			v.z = z2;
			v.y = y2 + minY + height * 0.5;

			// Apply absolute scale last
			v.multiply(scale);

			pos.setXYZ(i, v.x, v.y, v.z);
		}

		pos.needsUpdate = true;
		geo.computeVertexNormals();
		geo.computeBoundingBox();
		geo.computeBoundingSphere();
		return geo;
	}

	return (
		<div className="w-full h-full grid bg-slate-50 text-slate-800">
			<div className="flex items-center gap-3 p-3 border-b bg-white/80 backdrop-blur">
				<input
					type="file"
					accept=".stl,.obj"
					onChange={(e) => handleFiles(e.target.files)}
					className="block"
				/>
				<button
					onClick={onExport}
					className="px-3 py-1.5 rounded-2xl bg-slate-900 text-white disabled:opacity-50"
					disabled={!normalizeGeometry}
				>
					Export STL
				</button>
				<div className="ml-auto flex items-center gap-2">
					<label className="text-xs">Color</label>
					<input
						type="color"
						value={material}
						onChange={(e) => setMaterial(e.target.value)}
					/>
				</div>
			</div>

			<div
				className="relative"
				onDragOver={(e) => e.preventDefault()}
				onDrop={onDrop}
			>
				{!normalizeGeometry && (
					<div className="absolute inset-0 pointer-events-none select-none grid place-items-center text-center text-slate-500">
						<div>
							<p className="font-medium">Drop an OBJ or STL here</p>
							<p className="text-sm">or use the file picker above</p>
						</div>
					</div>
				)}
				<Canvas camera={{ position: [140, 120, 160], fov: 40 }} shadows>
					<color attach="background" args={["#f6f8ff"]} />
					<hemisphereLight
						intensity={0.75}
						groundColor={new THREE.Color("#b9b9b9")}
					/>
					<directionalLight
						position={[60, 80, 120]}
						intensity={1.1}
						castShadow
						shadow-mapSize-width={2048}
						shadow-mapSize-height={2048}
					/>
					<Suspense fallback={null}>
						{normalizeGeometry && (
							<DeformableMesh
								geometry={normalizeGeometry}
								scaleVector={absoluteScale}
								twist={twist}
								bend={bend}
								taper={taper}
								color={material}
								onPointerOver={() => setHover(true)}
								onPointerOut={() => setHover(false)}
							/>
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
					<LabeledNumber
						label="Width (X)"
						value={targetDims.x}
						onChange={(value) => setTargetDims((t) => ({ ...t, x: value }))}
					/>
					<LabeledNumber
						label="Height (Y)"
						value={targetDims.y}
						onChange={(value) => setTargetDims((t) => ({ ...t, y: value }))}
					/>
					<LabeledNumber
						label="Depth (Z)"
						value={targetDims.z}
						onChange={(value) => setTargetDims((t) => ({ ...t, z: value }))}
					/>
				</fieldset>

				<fieldset className="space-y-2">
					<legend className="font-semibold">Scale</legend>
					<LabeledNumber
						label="X"
						value={scale.x}
						onChange={(value) => setScale((s) => ({ ...s, x: value }))}
						step={0.1}
					/>
					<LabeledNumber
						label="Y"
						value={scale.y}
						onChange={(value) => setScale((s) => ({ ...s, y: value }))}
						step={0.1}
					/>
					<LabeledNumber
						label="Z"
						value={scale.z}
						onChange={(value) => setScale((s) => ({ ...s, z: value }))}
						step={0.1}
					/>
				</fieldset>

				<fieldset className="space-y-2">
					<legend className="font-semibold">Shape Modifiers</legend>
					<LabeledNumber
						label="Twist (rad per height)"
						value={twist}
						step={0.01}
						onChange={setTwist}
					/>
					<LabeledNumber
						label="Bend (radians)"
						value={bend}
						step={0.01}
						onChange={setBend}
					/>
					<LabeledNumber
						label="Taper (-1..1)"
						value={taper}
						step={0.01}
						onChange={setTaper}
					/>
					<p className="text-xs text-slate-500">
						Height is normalized (0 bottom → 1 top).
					</p>
				</fieldset>
			</div>
		</div>
	);
};
