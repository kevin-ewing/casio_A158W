import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import { ensureDsegFont } from './fonts/dseg.js';
import { createScreenDisplay } from './display/screenDisplay.js';
import { addProductLighting } from './scene/lighting.js';
import { initThemeController, getCurrentTheme, THEMES } from './theme/themeController.js';

ensureDsegFont();
initThemeController();

const container = document.getElementById('container');
const loaderOverlay = document.getElementById('loader');
const loaderText = loaderOverlay ? loaderOverlay.querySelector('.loader-text') : null;
const urlParams = new URLSearchParams(window.location.search);
const SCREEN_DISPLAY_MODE = (urlParams.get('screen') || 'time').toLowerCase();

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
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);
renderer.domElement.style.background = 'transparent';

const screenDisplay = createScreenDisplay(renderer, SCREEN_DISPLAY_MODE);
const { setupScreenDisplay } = screenDisplay;

const scene = new THREE.Scene();

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
controls.minDistance = 8;
controls.maxDistance = 34;
controls.update();

const applyZoomEasing = () => {
	if (typeof controls.dollyIn !== 'function' || typeof controls.dollyOut !== 'function') {
		return;
	}

	const baseDollyIn = controls.dollyIn.bind(controls);
	const baseDollyOut = controls.dollyOut.bind(controls);
	const zoomEaseBand = Math.max((controls.maxDistance - controls.minDistance) * 0.2, 0.0001);

	controls.dollyIn = (scale = 1) => {
		const distance = camera.position.distanceTo(controls.target);
		const easeStrength = THREE.MathUtils.smoothstep(
			distance,
			controls.minDistance,
			controls.minDistance + zoomEaseBand
		);
		const easedScale = THREE.MathUtils.lerp(1, scale, easeStrength);
		baseDollyIn(easedScale);
	};

	controls.dollyOut = (scale = 1) => {
		const distance = camera.position.distanceTo(controls.target);
		const easeStrength = THREE.MathUtils.smoothstep(
			distance,
			controls.maxDistance - zoomEaseBand,
			controls.maxDistance
		);
		const easedScale = THREE.MathUtils.lerp(scale, 1, easeStrength);
		baseDollyOut(easedScale);
	};
};

applyZoomEasing();

RectAreaLightUniformsLib.init();
const lights = addProductLighting(scene);

const applySceneTheme = (theme) => {
	const isLight = theme === THEMES.LIGHT;
	renderer.toneMappingExposure = isLight ? 1.45 : 1.2;
	lights.ambientLight.intensity = isLight ? 2.2 : 0.8;
	lights.hemiLight.intensity = isLight ? 1.35 : 0.8;
	lights.keyLight.intensity = isLight ? 22 : 16;
	lights.fillLight.intensity = isLight ? 13.5 : 8;
	lights.rimLight.intensity = isLight ? 1.45 : 0.95;
	lights.kickerLight.intensity = isLight ? 1.25 : 0.75;
	if (lights.omniFrontLight) {
		lights.omniFrontLight.intensity = isLight ? 6 : 1.8;
	}
	if (lights.omniBackLight) {
		lights.omniBackLight.intensity = isLight ? 4.5 : 1.2;
	}
	if (lights.photoSphere?.material) {
		lights.photoSphere.material.color.set(isLight ? 0xffffff : 0x0c111b);
		lights.photoSphere.material.needsUpdate = true;
	}
};

applySceneTheme(getCurrentTheme());
window.addEventListener('themechange', (event) => applySceneTheme(event.detail.theme));

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

					const luminance = material.color.r * 0.2126 + material.color.g * 0.7152 + material.color.b * 0.0722;
					if (material.metalness >= 0.6 && luminance < 0.25) {
						material.color.lerp(new THREE.Color(0xd7d9df), 0.65);
						material.metalness = Math.max(material.metalness, 0.85);
						material.roughness = Math.min(Math.max(material.roughness, 0.4), 0.55);
						material.envMapIntensity = Math.max(material.envMapIntensity ?? 1.35, 1.8);
					}
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
