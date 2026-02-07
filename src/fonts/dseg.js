export const DSEG_FONT = {
	name: 'DSEG7ClassicMini',
	url: 'assets/fonts/DSEG7ClassicMini-Bold.woff'
};

export function ensureDsegFont() {
	if (!('fonts' in document)) {
		console.warn('[ScreenDisplay] FontFace API unavailable; the LCD will use system fonts instead.');
		return;
	}

	const dsegFace = new FontFace(DSEG_FONT.name, `url(${DSEG_FONT.url})`);
	dsegFace.load()
		.then((loaded) => {
			document.fonts.add(loaded);
			console.info('[ScreenDisplay] DSEG font loaded');
		})
		.catch((err) => {
			console.warn('[ScreenDisplay] Failed to load DSEG font; falling back to system monospace', err);
		});
}
