import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

const DSEG_FONT = {
	name: 'DSEG7ClassicMini',
	url: 'assets/fonts/DSEG7ClassicMini-Bold.woff'
};

if ('fonts' in document) {
	const dsegFace = new FontFace(DSEG_FONT.name, `url(${DSEG_FONT.url})`);
	dsegFace.load()
		.then((loaded) => {
			document.fonts.add(loaded);
			console.info('[ScreenDisplay] DSEG font loaded');
		})
		.catch((err) => {
			console.warn('[ScreenDisplay] Failed to load DSEG font; falling back to system monospace', err);
		});
} else {
	console.warn('[ScreenDisplay] FontFace API unavailable; the LCD will use system fonts instead.');
}

const container = document.getElementById('container');
const loaderOverlay = document.getElementById('loader');
const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
const urlParams = new URLSearchParams(window.location.search);
const SCREEN_DISPLAY_MODE = (urlParams.get('screen') || 'time').toLowerCase();
const screenDisplay = {
	canvas: null,
	ctx: null,
	texture: null,
	timer: null,
	material: null,
	mode: SCREEN_DISPLAY_MODE
};

const hideLoader = (message) => {
	if (loaderText && message) {
		loaderText.textContent = message;
	}
	document.body.classList.add('show-scene');
	if (loaderOverlay) {
		loaderOverlay.classList.add('hidden');
		setTimeout(() => loaderOverlay.remove(), 600);
	}
};

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.useLegacyLights = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050608);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
const envMap = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = envMap;
pmremGenerator.dispose();

const camera = new THREE.PerspectiveCamera(
	35,
	window.innerWidth / window.innerHeight,
	0.1,
	100
);
camera.position.set(0, 21, 1.3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enablePan = false;
controls.target.set(0, 0.4, 0);
controls.minPolarAngle = 0.05;
controls.maxPolarAngle = Math.PI - 0.1;
controls.minDistance = 4;
controls.maxDistance = 25;
controls.update();

RectAreaLightUniformsLib.init();

const hemiLight = new THREE.HemisphereLight(0xbfd7ff, 0x111111, 0.6);
scene.add(hemiLight);

const keyLight = new THREE.RectAreaLight(0xffffff, 15, 3, 2);
keyLight.position.set(2.5, 3.5, 1.5);
keyLight.lookAt(0, 0.4, 0);
scene.add(keyLight);

const fillLight = new THREE.RectAreaLight(0x9fb7ff, 7, 2.5, 1.5);
fillLight.position.set(-2.5, 2.6, -1.2);
fillLight.lookAt(0, 0.3, 0);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xdfe7ff, 0.8);
rimLight.position.set(-3, 2, -4);
scene.add(rimLight);

const kickerLight = new THREE.DirectionalLight(0xffffff, 0.6);
kickerLight.position.set(3, 1.5, -2);
scene.add(kickerLight);

const shadowPlane = new THREE.Mesh(
	new THREE.CircleGeometry(3.2, 64),
	new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.3 })
);
shadowPlane.rotation.x = -Math.PI / 2;
shadowPlane.position.y = -0.55;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('jsm/libs/draco/gltf/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load(
	'models/casio_A158W.glb',
	(gltf) => {
		const model = gltf.scene;
		model.position.set(0, -0.45, 0);
		model.scale.setScalar(0.7);

		model.traverse((child) => {
			if (!child.isMesh) return;

			child.castShadow = true;
			child.receiveShadow = true;

			const { geometry } = child;
			const ensureTangents = () => {
				if (!geometry || geometry.attributes.tangent) return true;
				if (!geometry.attributes.uv && geometry.attributes.uv2) {
					geometry.setAttribute('uv', geometry.attributes.uv2.clone());
				}
				if (geometry.index && geometry.attributes.uv) {
					geometry.computeTangents();
					if (geometry.attributes.tangent) {
						geometry.attributes.tangent.needsUpdate = true;
						return true;
					}
				}
				return false;
			};

			const disableAnisotropy = (material) => {
				if (!material || material.anisotropy === undefined || material.anisotropy === 0) return;
				material.anisotropy = 0;
				material.anisotropyMap = null;
				material.needsUpdate = true;
			};

			const processMaterial = (material) => {
				if (!material) return material;

				const needsAnisotropyTangents = material.anisotropy !== undefined && material.anisotropy > 0;
				if (needsAnisotropyTangents && !ensureTangents()) {
					console.warn(`Disabling anisotropy for "${child.name}" due to missing tangents.`);
					disableAnisotropy(material);
				}

				if (material.isMeshStandardMaterial || material.isMeshPhysicalMaterial) {
					material.envMapIntensity = 1.35;
					if (material.metalness > 0.5) {
						material.roughness = Math.max(0.03, material.roughness * 0.65);
					} else {
						material.roughness = Math.min(0.6, material.roughness * 1.1);
					}
					material.needsUpdate = true;
				}

				if (material.name && material.name.toLowerCase().includes('screen')) {
					console.info('[ScreenDisplay] geometry UVs', !!geometry?.attributes?.uv, 'UV2', !!geometry?.attributes?.uv2);
					return setupScreenDisplay(material);
				}

				return material;
			};

			if (Array.isArray(child.material)) {
				child.material = child.material.map(processMaterial);
			} else {
				child.material = processMaterial(child.material);
			}
		});

			scene.add(model);
			hideLoader();
		},
		undefined,
		(error) => {
			hideLoader('Failed to load');
			console.error('Failed to load model:', error);
		}
	);

window.addEventListener('resize', onWindowResize);

function onWindowResize() {
	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize(width, height);
}

function animate() {
	requestAnimationFrame(animate);
	controls.update();
	renderer.render(scene, camera);
}

animate();

function setupScreenDisplay(inputMaterial) {
	const previousMap = inputMaterial.map || null;
	const previousMapSettings = previousMap ? {
		channel: previousMap.channel ?? 0,
		offset: previousMap.offset ? previousMap.offset.clone() : new THREE.Vector2(),
		repeat: previousMap.repeat ? previousMap.repeat.clone() : new THREE.Vector2(1, 1),
		center: previousMap.center ? previousMap.center.clone() : new THREE.Vector2(),
		rotation: previousMap.rotation || 0,
		matrixAutoUpdate: previousMap.matrixAutoUpdate ?? true,
		matrix: previousMap.matrix ? previousMap.matrix.clone() : new THREE.Matrix3()
	} : null;
	screenDisplay.mode = SCREEN_DISPLAY_MODE;

	if (!screenDisplay.canvas) {
		screenDisplay.canvas = document.createElement('canvas');
		screenDisplay.canvas.width = 512;
		screenDisplay.canvas.height = 512;
		screenDisplay.ctx = screenDisplay.canvas.getContext('2d');
		screenDisplay.texture = new THREE.CanvasTexture(screenDisplay.canvas);
		screenDisplay.texture.flipY = false;
		screenDisplay.texture.colorSpace = THREE.SRGBColorSpace;
		screenDisplay.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
	}

	const material = inputMaterial.userData.__screenMaterial
		? inputMaterial
		: new THREE.MeshBasicMaterial({
			name: inputMaterial.name,
			side: THREE.DoubleSide,
			transparent: true,
			toneMapped: false,
			depthWrite: true
		});

	material.userData.__screenMaterial = true;

	if (previousMapSettings) {
		screenDisplay.texture.channel = previousMapSettings.channel;
		screenDisplay.texture.offset.copy(previousMapSettings.offset);
		screenDisplay.texture.repeat.copy(previousMapSettings.repeat);
		screenDisplay.texture.center.copy(previousMapSettings.center);
		screenDisplay.texture.rotation = previousMapSettings.rotation;
		screenDisplay.texture.matrixAutoUpdate = previousMapSettings.matrixAutoUpdate;
		screenDisplay.texture.matrix.copy(previousMapSettings.matrix);
	} else {
		screenDisplay.texture.channel = 0;
		screenDisplay.texture.offset.set(0, 0);
		screenDisplay.texture.repeat.set(1, 1);
		screenDisplay.texture.center.set(0, 0);
		screenDisplay.texture.rotation = 0;
		screenDisplay.texture.matrix.identity();
	}

	material.map = screenDisplay.texture;
	material.color = new THREE.Color(0xffffff);
	material.opacity = 1;
	material.needsUpdate = true;

	screenDisplay.material = material;

	console.info('[ScreenDisplay] Attached to material:', material.name, 'texture channel:', screenDisplay.texture.channel, 'mode:', screenDisplay.mode);

	const updateTexture = () => {
		if (!screenDisplay.ctx) return;
		const ctx = screenDisplay.ctx;
		const { width, height } = screenDisplay.canvas;
		ctx.clearRect(0, 0, width, height);

		if (screenDisplay.mode === 'uv') {
			drawUvDebugPattern(ctx, width, height);
		} else {
			drawTimeDisplay(ctx, width, height);
		}

		screenDisplay.texture.needsUpdate = true;
	};

	updateTexture();
	if (screenDisplay.timer) clearInterval(screenDisplay.timer);
	screenDisplay.timer = setInterval(updateTexture, screenDisplay.mode === 'uv' ? 2000 : 1000);
	return material;
}

function drawTimeDisplay(ctx, width, height) {
	drawDsegDisplay(ctx, width, height);
}

function drawDsegDisplay(ctx, width, height) {
	const colors = {
		background: '#d7d4b4',
		text: '#16160f'
	};

	ctx.fillStyle = colors.background;
	ctx.fillRect(0, 0, width, height);

	const now = new Date();
	const hours = now.getHours();
	const hours12 = hours % 12 || 12;
	const minutes = now.getMinutes().toString().padStart(2, '0');
	const seconds = now.getSeconds().toString().padStart(2, '0');
	const ampm = hours >= 12 ? 'PM' : '';
	const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
		.format(now)
		.toUpperCase()
		.slice(0, 2);
	const dateNumber = now.getDate().toString();

	const layout = {
		margin: 60,
		topRowY: 88,
		timeBaseline: height * 0.56 - 40
	};
	const dateRowY = layout.topRowY;

	ctx.fillStyle = colors.text;
	ctx.textBaseline = 'alphabetic';

	if (ampm) {
		ctx.textAlign = 'left';
		ctx.font = '900 30px "Helvetica Neue", "Arial", sans-serif';
		ctx.fillText(ampm, layout.margin - 14, layout.topRowY + 24);
	}

	ctx.textAlign = 'center';
	ctx.font = `52px "${DSEG_FONT.name}", monospace`;
	ctx.fillText(dayName, width / 2 - 50, dateRowY);

	ctx.textAlign = 'right';
	ctx.font = `46px "${DSEG_FONT.name}", monospace`;
	ctx.fillText(dateNumber, width - layout.margin, dateRowY);

	const typography = {
		time: 110,
		seconds: 64
	};

	const hoursText = hours12.toString();
	const minutesText = minutes;
	const colonChar = ':';
	const digitSpacing = -12;
	const colonSpacing = -6;
	const secondsSpacing = 32;

	ctx.textAlign = 'left';
	ctx.font = `${typography.time}px "${DSEG_FONT.name}", monospace`;

	const timeSegments = [
		{ text: hoursText, spacingAfter: digitSpacing },
		{ text: colonChar, spacingAfter: colonSpacing },
		{ text: minutesText, spacingAfter: 0 }
	];

	const totalTimeWidth = measureSegmentSequence(ctx, timeSegments);

	ctx.font = `${typography.seconds}px "${DSEG_FONT.name}", monospace`;
	const secondsWidth = ctx.measureText(seconds).width;

	const combinedWidth = totalTimeWidth + secondsSpacing + secondsWidth;
	const blockStartX = width / 2 - combinedWidth / 2;

	ctx.font = `${typography.time}px "${DSEG_FONT.name}", monospace`;
	drawSegmentSequence(ctx, timeSegments, blockStartX, layout.timeBaseline);

	ctx.textAlign = 'left';
	ctx.font = `${typography.seconds}px "${DSEG_FONT.name}", monospace`;
	ctx.fillText(seconds, blockStartX + totalTimeWidth + secondsSpacing - 30, layout.timeBaseline);
}

function measureSegmentSequence(ctx, segments) {
	return segments.reduce((total, segment, index) => {
		const advance = ctx.measureText(segment.text).width;
		const spacing = index < segments.length - 1 ? segment.spacingAfter : 0;
		return total + advance + spacing;
	}, 0);
}

function drawSegmentSequence(ctx, segments, startX, baseline) {
	let cursor = startX;

	segments.forEach((segment, index) => {
		ctx.fillText(segment.text, cursor, baseline);
		cursor += ctx.measureText(segment.text).width;
		if (index < segments.length - 1) {
			cursor += segment.spacingAfter;
		}
	});

	return cursor;
}

function drawUvDebugPattern(ctx, width, height) {
	const cols = 8;
	const rows = 8;
	const cellW = width / cols;
	const cellH = height / rows;

	ctx.fillStyle = '#0a0a0a';
	ctx.fillRect(0, 0, width, height);

	for (let y = 0; y < rows; y++) {
		for (let x = 0; x < cols; x++) {
			const hue = (x / cols) * 360;
			const light = 40 + (y / rows) * 25;
			ctx.fillStyle = `hsl(${hue}, 65%, ${light}%)`;
			ctx.fillRect(x * cellW, y * cellH, cellW, cellH);

			ctx.strokeStyle = 'rgba(255,255,255,0.35)';
			ctx.lineWidth = 2;
			ctx.strokeRect(x * cellW, y * cellH, cellW, cellH);

			ctx.fillStyle = '#ffffff';
			ctx.font = '32px "SFMono-Regular", "Roboto Mono", monospace';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			const uVal = `U${(x / (cols - 1)).toFixed(2)}`;
			const vVal = `V${(y / (rows - 1)).toFixed(2)}`;
			ctx.fillText(uVal, x * cellW + cellW / 2, y * cellH + cellH / 2 - 14);
			ctx.fillText(vVal, x * cellW + cellW / 2, y * cellH + cellH / 2 + 18);
		}
	}

	ctx.fillStyle = '#000000';
	ctx.globalAlpha = 0.3;
	ctx.fillRect(0, height / 2 - 4, width, 8);
	ctx.fillRect(width / 2 - 4, 0, 8, height);
	ctx.globalAlpha = 1;
}
