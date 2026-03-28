/* Shared theme utility for all pages.
 * Keeps theme behavior consistent and avoids duplicate inline scripts.
 */
(function attachSnapTheme(windowObj) {
    if (!windowObj || windowObj.SnapTheme) return;

    const doc = windowObj.document;
    const THEME_STORAGE_KEYS = ['snaplink-theme', 'theme'];
    const KNOWN_BUTTON_IDS = ['themeBtn', 'theme-btn', 'themeBtnTop', 'toggleBtn'];

    function getSavedTheme() {
        for (const key of THEME_STORAGE_KEYS) {
            const value = windowObj.localStorage.getItem(key);
            if (value === 'dark' || value === 'light') return value;
        }
        return 'dark';
    }

    function persistTheme(theme) {
        THEME_STORAGE_KEYS.forEach((key) => windowObj.localStorage.setItem(key, theme));
    }

    function setButtonLabel(button, theme) {
        if (!button) return;

        // Preserve per-page label style.
        if (button.id === 'theme-btn') {
            button.textContent = theme === 'dark' ? '☀ Light' : '☾ Dark';
            return;
        }
        if (button.id === 'toggleBtn') {
            button.textContent = theme === 'dark' ? '🌙 dark' : '☀ light';
            return;
        }
        button.textContent = theme === 'dark' ? '🌙' : '☀️';
    }

    function getThemeButtons() {
        return KNOWN_BUTTON_IDS
            .map((id) => doc.getElementById(id))
            .filter(Boolean);
    }

    function applyTheme(theme) {
        doc.documentElement.setAttribute('data-theme', theme);
        persistTheme(theme);
        getThemeButtons().forEach((button) => setButtonLabel(button, theme));

        if (typeof windowObj.onThemeChange === 'function') {
            windowObj.onThemeChange(theme);
        }
    }

    function toggleTheme() {
        const current = doc.documentElement.getAttribute('data-theme') || getSavedTheme();
        applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    function initTheme() {
        applyTheme(getSavedTheme());
    }

    windowObj.SnapTheme = {
        init: initTheme,
        apply: applyTheme,
        toggle: toggleTheme,
    };

    // Keep compatibility with existing onclick="toggleTheme()".
    windowObj.toggleTheme = toggleTheme;

    if (doc.readyState === 'loading') {
        doc.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
})(window);
