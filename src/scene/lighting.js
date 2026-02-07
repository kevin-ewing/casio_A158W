import * as THREE from 'three';

export function addProductLighting(scene) {
	const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
	scene.add(ambientLight);

	const photoSphere = new THREE.Mesh(
		new THREE.SphereGeometry(20, 48, 48),
		new THREE.MeshBasicMaterial({
			color: 0x0c111b,
			side: THREE.BackSide
		})
	);
	scene.add(photoSphere);

	const hemiLight = new THREE.HemisphereLight(0xeaf3ff, 0x111111, 0.7);
	scene.add(hemiLight);

	const keyLight = new THREE.RectAreaLight(0xffffff, 16, 3, 2);
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

	const omniFrontLight = new THREE.PointLight(0xffffff, 5, 0, 2);
	omniFrontLight.position.set(0, 1.2, 3.2);
	scene.add(omniFrontLight);

	const omniBackLight = new THREE.PointLight(0xffffff, 3.5, 0, 2);
	omniBackLight.position.set(0, 1, -3.2);
	scene.add(omniBackLight);

	return {
		ambientLight,
		photoSphere,
		hemiLight,
		keyLight,
		fillLight,
		rimLight,
		kickerLight,
		omniFrontLight,
		omniBackLight
	};
}
