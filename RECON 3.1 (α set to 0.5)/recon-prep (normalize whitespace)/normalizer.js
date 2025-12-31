// FILE: normalizer.js (Final Corrected Version)
document.addEventListener('DOMContentLoaded', () => {
    // --- File Processing Logic (remains unchanged) ---
    const fileInput = document.getElementById('fileInput');
    const processButton = document.getElementById('processButton');
    const resultsArea = document.getElementById('resultsArea');

    const normalizeWhitespace = (text) => {
        const whitespaceRegex = /[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g;
        return text.replace(whitespaceRegex, ' ');
    };

    if (processButton) {
        processButton.addEventListener('click', () => {
            const files = fileInput.files;
            if (files.length === 0) {
                alert('Please select one or more files to process.');
                return;
            }
            resultsArea.innerHTML = '<p>Processing...</p>'; 
            
            Array.from(files).forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (index === 0) resultsArea.innerHTML = '';
                    const rawText = event.target.result;
                    const cleanedText = normalizeWhitespace(rawText);
                    const blob = new Blob([cleanedText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = file.name.replace(/\.txt$/i, '_clean.txt');
                    link.textContent = `Download ${link.download}`;
                    resultsArea.appendChild(link);
                    if (files.length > 1) resultsArea.appendChild(document.createElement('br'));
                };
                reader.readAsText(file);
            });
        });
    }

    // --- Theme and Visualization Logic ---
    const vizSettingsButton = document.getElementById('visualizationSettingsButton');
    const vizMenu = document.getElementById('visualizationMenu');
    const themeLightBtn = document.getElementById('themeLightButton');
    const themeDarkBtn = document.getElementById('themeDarkButton');
    const themeSystemBtn = document.getElementById('themeSystemButton');
    // REMOVED: No longer need a reference to a separate input element.
    // const highContrastToggle = document.getElementById('highContrastToggle'); 
    const highContrastLabel = document.getElementById('highContrastToggleLabel');

    const STORAGE_KEY = 'recon_visualization_settings';
    const THEMES = { LIGHT: 'light', DARK: 'dark', SYSTEM: 'system' };

    const applyTheme = (theme) => {
        document.documentElement.classList.remove('light-theme', 'dark-theme');
        let themeToApply = THEMES.LIGHT;
        if (theme === THEMES.DARK || (theme === THEMES.SYSTEM && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            themeToApply = THEMES.DARK;
        }
        document.documentElement.classList.add(`${themeToApply}-theme`);
        if(themeLightBtn) themeLightBtn.setAttribute('aria-pressed', theme === THEMES.LIGHT);
        if(themeDarkBtn) themeDarkBtn.setAttribute('aria-pressed', theme === THEMES.DARK);
        if(themeSystemBtn) themeSystemBtn.setAttribute('aria-pressed', theme === THEMES.SYSTEM);
    };

    const applyHighContrast = (isHighContrast) => {
        if (isHighContrast) {
            document.documentElement.classList.add('high-contrast');
        } else {
            document.documentElement.classList.remove('high-contrast');
        }
        // The label's aria-checked attribute is now the source of truth
        if(highContrastLabel) highContrastLabel.setAttribute('aria-checked', String(isHighContrast));
    };

    const saveSettings = (settings) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error("Could not save visualization settings to localStorage:", e);
        }
    };

    const loadSettings = () => {
        let settings = { theme: THEMES.SYSTEM, highContrast: false };
        try {
            const storedSettings = localStorage.getItem(STORAGE_KEY);
            if(storedSettings){
                settings = { ...settings, ...JSON.parse(storedSettings) };
            }
        } catch(e){
            console.error("Could not load or parse visualization settings from localStorage:", e);
        }
        applyTheme(settings.theme);
        applyHighContrast(settings.highContrast);
        return settings;
    };
    
    loadSettings();

    // --- Event Listeners ---
    if (vizSettingsButton) {
        vizSettingsButton.addEventListener('click', (e) => {
            e.stopPropagation();
            vizMenu.classList.toggle('hidden');
            vizSettingsButton.setAttribute('aria-expanded', !vizMenu.classList.contains('hidden'));
        });
    }

    document.addEventListener('click', () => {
        if (vizMenu && !vizMenu.classList.contains('hidden')) {
            vizMenu.classList.add('hidden');
            if (vizSettingsButton) vizSettingsButton.setAttribute('aria-expanded', 'false');
        }
    });

    const updateThemePreference = (newTheme) => {
        const settings = loadSettings();
        settings.theme = newTheme;
        applyTheme(newTheme);
        saveSettings(settings);
    };

    if (themeLightBtn) themeLightBtn.addEventListener('click', () => updateThemePreference(THEMES.LIGHT));
    if (themeDarkBtn) themeDarkBtn.addEventListener('click', () => updateThemePreference(THEMES.DARK));
    if (themeSystemBtn) themeSystemBtn.addEventListener('click', () => updateThemePreference(THEMES.SYSTEM));

    // REVISED LOGIC for the High Contrast Widget
    if (highContrastLabel) {
        const toggleHighContrast = () => {
            const settings = loadSettings();
            // The new state is the opposite of the current ARIA state
            const isCurrentlyChecked = settings.highContrast;
            const newCheckedState = !isCurrentlyChecked;
            
            settings.highContrast = newCheckedState;
            applyHighContrast(newCheckedState);
            saveSettings(settings);
        };

        highContrastLabel.addEventListener('click', toggleHighContrast);

        highContrastLabel.addEventListener('keydown', (e) => {
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleHighContrast();
            }
        });
    }
    
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const settings = loadSettings();
        if (settings.theme === THEMES.SYSTEM) {
            applyTheme(THEMES.SYSTEM);
        }
    });
});