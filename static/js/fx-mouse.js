// ===================================
// TOUCHPAD VIRTUAL - Control del Mouse
// ===================================

class TouchpadController {
    constructor() {
        this.touchpad = document.getElementById('touchpad');
        this.container = document.querySelector('.container-touchpad');
        this.btnShow = document.querySelector('.btn-touchpad-show');
        this.btnClose = document.querySelector('.btn-touchpad-close');
        this.btnLeftClick = document.getElementById('touchpad-left-click');
        this.btnRightClick = document.getElementById('touchpad-right-click');
        this.btnScrollToggle = document.getElementById('touchpad-scroll-toggle');
        this.btnHoldToggle = document.querySelector('.btn-touchpad-hold');

        // Estado del touchpad
        this.isActive = false;
        this.lastX = 0;
        this.lastY = 0;
        this.isScrollMode = false;
        this.isDragging = false;
        this.touchDragActive = false;
        this.touchHasMoved = false;
        this.longPressTriggered = false;
        this.dragModeByButton = false;

        // Multiplicador de sensibilidad (ajustable)
        this.sensitivity = 2.5;
        this.scrollSensitivity = 1.0;
        this.dragThreshold = 6;
        this.longPressDelay = 600;
        this.doubleTapThreshold = 300;

        // Debounce para evitar enviar demasiadas peticiones
        this.throttleDelay = 12; // ~80fps aproximados
        this.lastSendTime = 0;

        // Valores pendientes para acumular movimiento fraccional
        this.pendingDX = 0;
        this.pendingDY = 0;
        this.pendingScroll = 0;

        // Estado adicional para gestos
        this.longPressTimeout = null;
        this.lastTouchEndTime = 0;
        this.touchStartTime = 0;
        this.initialTouchX = 0;
        this.initialTouchY = 0;
        this.leftButtonHeld = false;
        this.doubleTapPending = false;
        this.singleTapMaxDuration = 220;

        // Referencias UI para mensajes
        this.leftButtonLabel = this.btnLeftClick?.querySelector('span') ?? null;
        this.leftButtonLabelDefault = this.leftButtonLabel?.textContent ?? 'L';
        this.touchpadHintText = this.touchpad?.querySelector('.touchpad-hint span') ?? null;
        this.touchpadHintDefault = this.touchpadHintText?.textContent ?? '';

        this.btnHoldToggle?.setAttribute('aria-pressed', 'false');

        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Mostrar/Ocultar touchpad
        this.btnShow?.addEventListener('click', () => this.show());
        this.btnClose?.addEventListener('click', () => this.hide());

        // Touch events en el touchpad
        this.touchpad?.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.touchpad?.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.touchpad?.addEventListener('touchend', (e) => this.handleTouchEnd(e));
        this.touchpad?.addEventListener('touchcancel', (e) => this.handleTouchEnd(e));

        // Mouse events (para testing en desktop)
        this.touchpad?.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.touchpad?.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.touchpad?.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.touchpad?.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Botones de click
        this.btnLeftClick?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.dragModeByButton) {
                this.disableManualDragMode();
            } else {
                this.sendClick('left');
            }
        });

        this.btnLeftClick?.addEventListener('pointerup', (e) => {
            e.preventDefault();
        });

        this.btnHoldToggle?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            if (this.dragModeByButton) {
                this.disableManualDragMode();
            } else {
                this.enableManualDragMode();
            }
        });

        this.btnRightClick?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.sendClick('right');
        });

        // Toggle scroll mode
        this.btnScrollToggle?.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.toggleScrollMode();
        });
    }

    show() {
        this.container?.classList.add('active');
        this.btnShow?.classList.add('hidden');
    }

    hide() {
        this.container?.classList.remove('active');
        this.btnShow?.classList.remove('hidden');
    }

    toggleScrollMode() {
        if (this.dragModeByButton) {
            this.disableManualDragMode();
        }
        this.isScrollMode = !this.isScrollMode;
        this.btnScrollToggle?.classList.toggle('active', this.isScrollMode);

        if (this.isScrollMode) {
            this.touchpad?.classList.add('scroll-mode');
        } else {
            this.touchpad?.classList.remove('scroll-mode');
        }
    }

    enableManualDragMode() {
        if (this.dragModeByButton) return;
        this.dragModeByButton = true;

        if (this.isScrollMode) {
            this.isScrollMode = false;
            this.btnScrollToggle?.classList.remove('active');
            this.touchpad?.classList.remove('scroll-mode');
        }

        this.btnLeftClick?.classList.add('drag-mode-active');
        this.touchpad?.classList.add('selection-mode');
        this.btnHoldToggle?.classList.add('active');
        this.btnHoldToggle?.setAttribute('aria-pressed', 'true');

        if (this.leftButtonLabel) {
            this.leftButtonLabel.textContent = 'Desliza para seleccionar';
        }
        if (this.touchpadHintText) {
            this.touchpadHintText.textContent = 'Desliza para seleccionar';
        }
    }

    disableManualDragMode() {
        if (!this.dragModeByButton) return;
        this.dragModeByButton = false;

        this.btnLeftClick?.classList.remove('drag-mode-active');
        this.touchpad?.classList.remove('selection-mode');
        this.btnHoldToggle?.classList.remove('active');
        this.btnHoldToggle?.setAttribute('aria-pressed', 'false');

        if (this.leftButtonLabel) {
            this.leftButtonLabel.textContent = this.leftButtonLabelDefault;
        }
        if (this.touchpadHintText) {
            this.touchpadHintText.textContent = this.touchpadHintDefault;
        }

        if (this.leftButtonHeld) {
            this.sendMouseUp('left');
        }

        this.manualDragFingerActive = false;
    }

    // ===== TOUCH EVENTS =====
    handleTouchStart(e) {
        e.preventDefault();
        this.clearLongPressTimeout();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            this.lastX = touch.clientX;
            this.lastY = touch.clientY;
            this.initialTouchX = touch.clientX;
            this.initialTouchY = touch.clientY;
            this.isActive = true;
            this.touchDragActive = false;
            this.touchHasMoved = false;
            this.longPressTriggered = false;
            const now = Date.now();
            this.touchStartTime = now;

            if (this.dragModeByButton) {
                this.doubleTapPending = false;
                this.longPressTriggered = false;
                if (!this.leftButtonHeld) {
                    this.touchDragActive = true;
                    this.startTouchDrag();
                }
                return;
            }

            const timeSinceLastEnd = this.lastTouchEndTime ? now - this.lastTouchEndTime : Number.MAX_SAFE_INTEGER;
            this.doubleTapPending = timeSinceLastEnd > 0 && timeSinceLastEnd < this.doubleTapThreshold;

            if (!this.doubleTapPending) {
                this.longPressTimeout = setTimeout(() => {
                    if (!this.touchHasMoved && !this.touchDragActive) {
                        this.longPressTriggered = true;
                        this.doubleTapPending = false;
                        this.lastTouchEndTime = 0;
                        this.sendClick('right');
                    }
                }, this.longPressDelay);
            }
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (!this.isActive || e.touches.length !== 1) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.lastX;
        const deltaY = touch.clientY - this.lastY;
        const totalDeltaX = touch.clientX - this.initialTouchX;
        const totalDeltaY = touch.clientY - this.initialTouchY;

        if (this.dragModeByButton) {
            if (this.isScrollMode) {
                this.sendScroll(deltaY);
            } else {
                this.sendMovement(deltaX, deltaY);
            }

            this.lastX = touch.clientX;
            this.lastY = touch.clientY;
            return;
        }

        if (!this.touchHasMoved) {
            const distance = Math.hypot(totalDeltaX, totalDeltaY);
            if (distance > this.dragThreshold) {
                this.touchHasMoved = true;
                this.clearLongPressTimeout();
                if (this.doubleTapPending) {
                    this.doubleTapPending = false;
                }
            }
        }

        if (this.longPressTriggered) {
            this.lastX = touch.clientX;
            this.lastY = touch.clientY;
            return;
        }

        if (this.isScrollMode) {
            // Modo scroll: solo delta Y
            this.sendScroll(deltaY);
        } else {
            // Modo normal: movimiento del mouse
            this.sendMovement(deltaX, deltaY);
        }

        this.lastX = touch.clientX;
        this.lastY = touch.clientY;
    }

    handleTouchEnd(e) {
        e.preventDefault();
        this.clearLongPressTimeout();

        const now = Date.now();
        let resetLastEnd = false;
        const wasDragging = this.touchDragActive || this.leftButtonHeld;

        if (this.doubleTapPending && !this.touchHasMoved && !this.longPressTriggered) {
            const duration = now - this.touchStartTime;
            if (duration <= this.singleTapMaxDuration) {
                this.sendDoubleClick();
                resetLastEnd = true;
            }
        }

        if (this.longPressTriggered) {
            resetLastEnd = true;
        }

        if (this.dragModeByButton) {
            resetLastEnd = true;
        }

        if (wasDragging) {
            this.endTouchDrag();
        }

        this.doubleTapPending = false;

        this.isActive = false;
        this.touchDragActive = false;
        this.touchHasMoved = false;
        this.longPressTriggered = false;
        this.touchStartTime = 0;
        this.lastTouchEndTime = (resetLastEnd || wasDragging) ? 0 : now;
    }

    // ===== MOUSE EVENTS (para testing) =====
    handleMouseDown(e) {
        e.preventDefault();
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.isDragging = true;
        this.touchpad.style.cursor = 'grabbing';
        this.touchDragActive = true;
        this.startTouchDrag();
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        e.preventDefault();

        const deltaX = e.clientX - this.lastX;
        const deltaY = e.clientY - this.lastY;

        if (this.isScrollMode) {
            this.sendScroll(deltaY);
        } else {
            this.sendMovement(deltaX, deltaY);
        }

        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    handleMouseUp(e) {
        e.preventDefault();
        this.isDragging = false;
        this.touchpad.style.cursor = 'grab';
        if (this.touchDragActive || this.leftButtonHeld) {
            this.endTouchDrag();
        }
        this.touchDragActive = false;
    }

    // ===== ENVIAR COMANDOS AL SERVIDOR =====
    sendMovement(deltaX, deltaY) {
        // Throttle para no saturar el servidor
        const now = Date.now();
        if (now - this.lastSendTime < this.throttleDelay) return;
        this.lastSendTime = now;

        // Acumular movimiento para no perder precisión
        this.pendingDX += deltaX * this.sensitivity;
        this.pendingDY += deltaY * this.sensitivity;

        const dx = Math.trunc(this.pendingDX);
        const dy = Math.trunc(this.pendingDY);

        if (!dx && !dy) return;

        this.pendingDX -= dx;
        this.pendingDY -= dy;

        fetch(`${URL_API}mouse/move`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dx, dy })
        }).catch(err => console.error('Error moviendo mouse:', err));
    }

    sendScroll(deltaY) {
        const now = Date.now();
        if (now - this.lastSendTime < this.throttleDelay * 2) return; // Más lento para scroll
        this.lastSendTime = now;

        this.pendingScroll += deltaY * this.scrollSensitivity * -1;
        const delta = Math.trunc(this.pendingScroll);
        if (!delta) return;
        this.pendingScroll -= delta;

        fetch(`${URL_API}mouse/scroll`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ delta })
        }).catch(err => console.error('Error en scroll:', err));
    }

    sendClick(button = 'left') {
        fetch(`${URL_API}mouse/click`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ button })
        }).catch(err => console.error('Error en click:', err));
    }

    sendDoubleClick() {
        fetch(`${URL_API}mouse/doubleclick`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).catch(err => console.error('Error en doble click:', err));
    }

    sendMouseDown(button = 'left') {
        if (button === 'left' && this.leftButtonHeld) return;

        if (button === 'left') {
            this.leftButtonHeld = true;
        }

        fetch(`${URL_API}mouse/down`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ button })
        })
            .catch(err => {
                if (button === 'left') {
                    this.leftButtonHeld = false;
                }
                console.error('Error en mouse down:', err);
            });
    }

    sendMouseUp(button = 'left') {
        if (button === 'left' && !this.leftButtonHeld) return;

        const wasHeld = this.leftButtonHeld;
        if (button === 'left') {
            this.leftButtonHeld = false;
        }

        fetch(`${URL_API}mouse/up`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ button })
        })
            .catch(err => {
                if (button === 'left' && wasHeld) {
                    this.leftButtonHeld = true;
                }
                console.error('Error en mouse up:', err);
            });
    }

    startTouchDrag() {
        this.sendMouseDown('left');
    }

    endTouchDrag() {
        this.sendMouseUp('left');
    }

    clearLongPressTimeout() {
        if (this.longPressTimeout) {
            clearTimeout(this.longPressTimeout);
            this.longPressTimeout = null;
        }
    }

    // Ajustar sensibilidad desde fuera
    setSensitivity(value) {
        this.sensitivity = value;
    }

    setScrollSensitivity(value) {
        this.scrollSensitivity = value;
    }
}

// Inicializar cuando el DOM esté listo
let touchpadController;
document.addEventListener('DOMContentLoaded', () => {
    touchpadController = new TouchpadController();
    window.touchpadController = touchpadController;
    try {
        window.dispatchEvent(new CustomEvent('touchpad-ready', { detail: touchpadController }));
    } catch (error) {
        // Fallback para entornos sin CustomEvent
        const event = document.createEvent('CustomEvent');
        event.initCustomEvent('touchpad-ready', false, false, touchpadController);
        window.dispatchEvent(event);
    }
});

// Exportar para uso global
window.TouchpadController = TouchpadController;
