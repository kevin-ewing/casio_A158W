const STORAGE_KEY = 'a158w-theme';

export const THEMES = {
	LIGHT: 'light',
	DARK: 'dark'
};

let currentTheme = THEMES.DARK;
let initialized = false;

export function initThemeController() {
	if (initialized) {
		return {
			getCurrentTheme,
			toggleTheme,
			setTheme
		};
	}

	initialized = true;

	const storedTheme = window.__INITIAL_THEME || getStoredTheme() || THEMES.DARK;
	currentTheme = Object.values(THEMES).includes(storedTheme) ? storedTheme : THEMES.DARK;

	document.body.classList.remove('theme-light', 'theme-dark');
	document.body.classList.add(`theme-${currentTheme}`);

	const toggle = document.getElementById('theme-toggle');

	const updateToggleUI = (theme) => {
		if (!toggle) return;
		const nextAction = theme === THEMES.LIGHT ? 'Switch to dark mode' : 'Switch to light mode';
		toggle.checked = theme === THEMES.LIGHT;
		toggle.setAttribute('aria-checked', toggle.checked ? 'true' : 'false');
		toggle.setAttribute('aria-label', nextAction);
	};

	const updateThemeImages = (theme) => {
		const attribute = theme === THEMES.LIGHT ? 'themeSrcLight' : 'themeSrcDark';
		document.querySelectorAll('[data-theme-src-light]').forEach((img) => {
			const nextSrc = img.dataset[attribute];
			if (nextSrc && img.getAttribute('src') !== nextSrc) {
				img.setAttribute('src', nextSrc);
			}
		});
	};

	const saveTheme = (theme) => {
		try {
			localStorage.setItem(STORAGE_KEY, theme);
		} catch (err) {
			console.warn('Unable to persist theme preference', err);
		}
	};

	const applyTheme = (theme, { emit = true, persist = false } = {}) => {
		currentTheme = theme;
		document.body.classList.remove('theme-light', 'theme-dark');
		document.body.classList.add(`theme-${theme}`);
		updateToggleUI(theme);
		updateThemeImages(theme);
		if (persist) {
			saveTheme(theme);
		}
		if (emit) {
			window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
		}
	};

	const toggleHandler = () => {
		const nextTheme = currentTheme === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
		applyTheme(nextTheme, { persist: true });
	};

	if (toggle) {
		toggle.addEventListener('click', toggleHandler);
	}

	applyTheme(currentTheme, { emit: false });

	return {
		getCurrentTheme,
		toggleTheme: toggleHandler,
		setTheme: (theme) => applyTheme(theme, { persist: true })
	};
}

export function getCurrentTheme() {
	return currentTheme;
}

function getStoredTheme() {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch (err) {
		console.warn('Unable to access theme preference', err);
		return null;
	}
}
