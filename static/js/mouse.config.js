(() => {
    const API_ENDPOINT = '/mouse/config';
    const SAVE_DEBOUNCE_MS = 450;
    const POINTER_MIN = 0.5;
    const POINTER_MAX = 6;
    const SCROLL_MIN = 0.5;
    const SCROLL_MAX = 18;

    const DEFAULTS = {
        pointerSpeed: 2.5,
        scrollSpeed: 1.0
    };

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    class MouseConfigPanel {
        constructor() {
            this.pointerInput = document.getElementById('mouse-pointer-speed');
            this.scrollInput = document.getElementById('mouse-scroll-speed');
            this.pointerIndicator = document.querySelector('[data-role="pointer-indicator"]');
            this.scrollIndicator = document.querySelector('[data-role="scroll-indicator"]');
            this.statusElement = document.querySelector('[data-role="config-status"]');
            this.resetButton = document.getElementById('mouse-config-reset');

            if (!this.pointerInput || !this.scrollInput) {
                return;
            }

            this.settings = { ...DEFAULTS };
            this.saveTimer = null;
            this.statusTimer = null;
            this.controller = (typeof touchpadController !== 'undefined') ? touchpadController : null;

            this.bindEvents();
            this.watchTouchpad();
            this.applySettingsToUI();
            this.loadConfig();
        }

        bindEvents() {
            this.pointerInput.addEventListener('input', () => {
                const value = this.parseInputValue(this.pointerInput, DEFAULTS.pointerSpeed, POINTER_MIN, POINTER_MAX);
                this.updatePointerSpeed(value, false);
            });

            this.pointerInput.addEventListener('change', () => {
                const value = this.parseInputValue(this.pointerInput, DEFAULTS.pointerSpeed, POINTER_MIN, POINTER_MAX);
                this.updatePointerSpeed(value, true);
            });

            this.scrollInput.addEventListener('input', () => {
                const value = this.parseInputValue(this.scrollInput, DEFAULTS.scrollSpeed, SCROLL_MIN, SCROLL_MAX);
                this.updateScrollSpeed(value, false);
            });

            this.scrollInput.addEventListener('change', () => {
                const value = this.parseInputValue(this.scrollInput, DEFAULTS.scrollSpeed, SCROLL_MIN, SCROLL_MAX);
                this.updateScrollSpeed(value, true);
            });

            if (this.resetButton) {
                this.resetButton.addEventListener('click', () => {
                    this.settings = { ...DEFAULTS };
                    this.applySettingsToUI();
                    this.applySettingsToController();
                    this.setStatus('Valores restablecidos', 'info', 2000);
                    this.scheduleSave();
                });
            }
        }

        watchTouchpad() {
            if (this.controller) {
                this.applySettingsToController();
                return;
            }

            window.addEventListener('touchpad-ready', (event) => {
                this.controller = event?.detail || (typeof touchpadController !== 'undefined' ? touchpadController : null);
                this.applySettingsToController();
            }, { once: true });
        }

        parseInputValue(input, fallback, min, max) {
            const value = Number.parseFloat(input.value);
            if (!Number.isFinite(value)) {
                return fallback;
            }
            return clamp(value, min, max);
        }

        updatePointerSpeed(value, persist) {
            this.settings.pointerSpeed = clamp(value, POINTER_MIN, POINTER_MAX);
            this.updateIndicator(this.pointerIndicator, this.settings.pointerSpeed);
            this.applySettingsToController();
            if (persist) {
                this.scheduleSave();
            }
        }

        updateScrollSpeed(value, persist) {
            this.settings.scrollSpeed = clamp(value, SCROLL_MIN, SCROLL_MAX);
            this.updateIndicator(this.scrollIndicator, this.settings.scrollSpeed);
            this.applySettingsToController();
            if (persist) {
                this.scheduleSave();
            }
        }

        updateIndicator(target, value) {
            if (!target) {
                return;
            }
            target.textContent = `${value.toFixed(1)}x`;
        }

        applySettingsToUI() {
            this.pointerInput.value = this.settings.pointerSpeed;
            this.scrollInput.value = this.settings.scrollSpeed;
            this.updateIndicator(this.pointerIndicator, this.settings.pointerSpeed);
            this.updateIndicator(this.scrollIndicator, this.settings.scrollSpeed);
        }

        applySettingsToController() {
            if (!this.controller) {
                return;
            }
            if (typeof this.controller.setSensitivity === 'function') {
                this.controller.setSensitivity(this.settings.pointerSpeed);
            }
            if (typeof this.controller.setScrollSensitivity === 'function') {
                this.controller.setScrollSensitivity(this.settings.scrollSpeed);
            }
        }

        scheduleSave() {
            if (this.saveTimer) {
                clearTimeout(this.saveTimer);
            }
            this.setStatus('Guardando...', 'info');
            this.saveTimer = setTimeout(() => {
                this.saveTimer = null;
                this.persistConfig();
            }, SAVE_DEBOUNCE_MS);
        }

        async loadConfig() {
            try {
                const response = await fetch(API_ENDPOINT);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const payload = await response.json();
                this.applyLoadedConfig(payload);
                this.setStatus('Configuración cargada', 'success', 1500);
            } catch (error) {
                console.error('No se pudo cargar la configuración del mouse:', error);
                this.setStatus('No se pudo cargar la configuración', 'error', 3000);
            }
        }

        applyLoadedConfig(payload) {
            const pointerSpeed = clamp(Number(payload?.pointerSpeed), POINTER_MIN, POINTER_MAX);
            const scrollSpeed = clamp(Number(payload?.scrollSpeed), SCROLL_MIN, SCROLL_MAX);

            this.settings = {
                pointerSpeed: Number.isFinite(pointerSpeed) ? pointerSpeed : DEFAULTS.pointerSpeed,
                scrollSpeed: Number.isFinite(scrollSpeed) ? scrollSpeed : DEFAULTS.scrollSpeed
            };

            this.applySettingsToUI();
            this.applySettingsToController();
        }

        async persistConfig() {
            try {
                const response = await fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pointerSpeed: this.settings.pointerSpeed,
                        scrollSpeed: this.settings.scrollSpeed
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const saved = await response.json();
                this.applyLoadedConfig(saved);
                this.setStatus('Configuración guardada', 'success', 2000);
            } catch (error) {
                console.error('No se pudo guardar la configuración del mouse:', error);
                this.setStatus('No se pudo guardar la configuración', 'error', 3500);
            }
        }

        setStatus(message, type = 'info', clearAfterMs = 0) {
            if (!this.statusElement) {
                return;
            }

            this.statusElement.textContent = message || '';
            this.statusElement.classList.remove('is-success', 'is-error');

            if (type === 'success') {
                this.statusElement.classList.add('is-success');
            } else if (type === 'error') {
                this.statusElement.classList.add('is-error');
            }

            if (this.statusTimer) {
                clearTimeout(this.statusTimer);
                this.statusTimer = null;
            }

            if (clearAfterMs > 0 && message) {
                this.statusTimer = setTimeout(() => {
                    this.statusElement.textContent = '';
                    this.statusElement.classList.remove('is-success', 'is-error');
                    this.statusTimer = null;
                }, clearAfterMs);
            }
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        new MouseConfigPanel();
    });
})();
