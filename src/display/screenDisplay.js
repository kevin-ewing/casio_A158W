import * as THREE from 'three';
import { DSEG_FONT } from '../fonts/dseg.js';

export function createScreenDisplay(renderer, mode = 'time') {
	const state = {
		canvas: null,
		ctx: null,
		texture: null,
		timer: null,
		material: null,
		mode
	};

	const updateMode = (newMode) => {
		state.mode = newMode;
	};

	const setupScreenDisplay = (inputMaterial) => {
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
		state.mode = state.mode || mode;

		if (!state.canvas) {
			state.canvas = document.createElement('canvas');
			state.canvas.width = 512;
			state.canvas.height = 512;
			state.ctx = state.canvas.getContext('2d');
			state.texture = new THREE.CanvasTexture(state.canvas);
			state.texture.flipY = false;
			state.texture.colorSpace = THREE.SRGBColorSpace;
			state.texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
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
			state.texture.channel = previousMapSettings.channel;
			state.texture.offset.copy(previousMapSettings.offset);
			state.texture.repeat.copy(previousMapSettings.repeat);
			state.texture.center.copy(previousMapSettings.center);
			state.texture.rotation = previousMapSettings.rotation;
			state.texture.matrixAutoUpdate = previousMapSettings.matrixAutoUpdate;
			state.texture.matrix.copy(previousMapSettings.matrix);
		} else {
			state.texture.channel = 0;
			state.texture.offset.set(0, 0);
			state.texture.repeat.set(1, 1);
			state.texture.center.set(0, 0);
			state.texture.rotation = 0;
			state.texture.matrix.identity();
		}

		material.map = state.texture;
		material.color = new THREE.Color(0xffffff);
		material.opacity = 1;
		material.needsUpdate = true;

		state.material = material;

		const updateTexture = () => {
			if (!state.ctx) return;
			const ctx = state.ctx;
			const { width, height } = state.canvas;
			ctx.clearRect(0, 0, width, height);

			if (state.mode === 'uv') {
				drawUvDebugPattern(ctx, width, height);
			} else {
				drawTimeDisplay(ctx, width, height);
			}

			state.texture.needsUpdate = true;
		};

		updateTexture();
		if (state.timer) clearInterval(state.timer);
		state.timer = setInterval(updateTexture, state.mode === 'uv' ? 2000 : 1000);
		return material;
	};

	return {
		setupScreenDisplay,
		updateMode
	};
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
		timeBaseline: height * 0.56 - 30
	};

	ctx.fillStyle = colors.text;
	ctx.textBaseline = 'alphabetic';

	if (ampm) {
		ctx.textAlign = 'left';
		ctx.font = '900 30px "Helvetica Neue", "Arial", sans-serif';
		ctx.fillText(ampm, layout.margin - 14, layout.topRowY + 24);
	}

	ctx.textAlign = 'center';
	ctx.font = `52px "${DSEG_FONT.name}", monospace`;
	ctx.fillText(dayName, width / 2 - 50, layout.topRowY);

	ctx.textAlign = 'right';
	ctx.font = `46px "${DSEG_FONT.name}", monospace`;
	ctx.fillText(dateNumber, width - layout.margin, layout.topRowY);

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
