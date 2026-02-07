#!/usr/bin/env node
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_FONT = resolve(__dirname, '../node_modules/dseg/fonts/DSEG7-Classic-MINI/DSEG7ClassicMini-Bold.woff');
const DEST_FONT = resolve(__dirname, '../assets/fonts/DSEG7ClassicMini-Bold.woff');

try {
	if (!existsSync(SOURCE_FONT)) {
		throw new Error('Source font not found in node_modules/dseg. Did you run "npm install dseg"?');
	}

	mkdirSync(dirname(DEST_FONT), { recursive: true });
	copyFileSync(SOURCE_FONT, DEST_FONT);
	console.info('Copied DSEG font to', DEST_FONT);
} catch (error) {
	console.error('Failed to copy DSEG font:', error.message);
	process.exitCode = 1;
}
