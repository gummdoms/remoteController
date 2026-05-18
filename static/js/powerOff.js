(() => {
    const STATUS_ENDPOINT = `${URL_API}programarApagado`;
    const POLL_INTERVAL = 5000;
    const TICK_INTERVAL = 1000;

    const formatRemaining = (ms) => {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return [hours, minutes, seconds].map((value) => value.toString().padStart(2, '0')).join(':');
    };

    const formatTargetClock = (timestamp) => {
        const date = new Date(timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    };

    $(document).ready(() => {
        const $programButton = $('#app-programar-apagado');
        if (!$programButton.length) {
            return;
        }

        const $modal = $('.modal-power-off');
        const $overlay = $modal.find('.overlay');
        const $timeInput = $('#time-power-off');
        const $scheduleButton = $('#set-power-off');
        const $cancelModalButton = $('#cancel-power-off');
        const $closeModalButton = $('#close-modal-power-off');

        const $buttonIcon = $programButton.find('i');
        const $buttonLabel = $programButton.find('.text-pc');
        const originalIconClass = $buttonIcon.attr('class') || '';
        const originalLabel = ($buttonLabel.text() || '').trim() || 'Programar';

        const $banner = $(`<div class="shutdown-banner" id="shutdown-banner" role="status">
                <span class="shutdown-banner__handle" title="Arrastra para mover">
                    <span></span><span></span><span></span>
                </span>
                <span class="shutdown-banner__text"></span>
            </div>`);
        $('body').append($banner);
        const $bannerText = $banner.find('.shutdown-banner__text');
        const $bannerHandle = $banner.find('.shutdown-banner__handle');

        let dragActive = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        let pollTimer = null;
        let tickerTimer = null;
        let countdownTarget = null;
        let fetchingStatus = false;

        const setButtonActive = () => {
            $programButton.data('shutdownActive', true);
            $programButton.addClass('is-scheduled');
            $buttonIcon.attr('class', 'bi bi-stop-circle');
            $buttonLabel.text('Detener');
        };

        const setButtonInactive = () => {
            $programButton.data('shutdownActive', false);
            $programButton.removeClass('is-scheduled');
            $buttonIcon.attr('class', originalIconClass || 'bi bi-clock');
            $buttonLabel.text(originalLabel);
        };

        const updateBannerText = (remainingMs) => {
            if (!countdownTarget) {
                return;
            }

            const remaining = typeof remainingMs === 'number' ? remainingMs : countdownTarget - Date.now();

            if (remaining <= 0) {
                applyInactiveState();
                fetchStatus();
                return;
            }

            const targetClock = formatTargetClock(countdownTarget);
            $bannerText.text(`Apagado programado para las ${targetClock} (faltan ${formatRemaining(remaining)})`);
        };

        const startTicker = () => {
            if (tickerTimer) {
                return;
            }
            tickerTimer = setInterval(() => {
                updateBannerText();
            }, TICK_INTERVAL);
        };

        const stopTicker = () => {
            if (!tickerTimer) {
                return;
            }
            clearInterval(tickerTimer);
            tickerTimer = null;
        };

        const startPolling = () => {
            if (pollTimer) {
                return;
            }
            pollTimer = setInterval(() => {
                fetchStatus();
            }, POLL_INTERVAL);
        };

        const stopPolling = () => {
            if (!pollTimer) {
                return;
            }
            clearInterval(pollTimer);
            pollTimer = null;
        };

        const applyActiveState = (targetIso, remainingMs) => {
            const parsed = Date.parse(targetIso);
            if (!Number.isFinite(parsed)) {
                return;
            }

            countdownTarget = parsed;
            setButtonActive();
            $banner.addClass('is-visible');
            updateBannerText(remainingMs);
            startTicker();
            startPolling();
        };

        const applyInactiveState = () => {
            countdownTarget = null;
            stopTicker();
            stopPolling();
            setButtonInactive();
            stopDrag();
            $('body').removeClass('is-dragging-banner');
            $banner.removeClass('is-visible is-manual-position').css({
                left: '',
                top: '',
                transform: ''
            });
        };

        const openModal = () => {
            $modal.addClass('is-active');
            setTimeout(() => {
                $timeInput.trigger('focus');
            }, 100);
        };

        const closeModal = () => {
            $modal.removeClass('is-active');
            $timeInput.val('');
        };

        const scheduleShutdown = (timeValue) => {
            $scheduleButton.prop('disabled', true);
            $.ajax({
                url: STATUS_ENDPOINT,
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ time: timeValue })
            }).done((response) => {
                closeModal();
                Swal.fire({
                    icon: 'success',
                    title: 'Apagado programado',
                    text: 'El equipo se apagará en la hora seleccionada.'
                });
                applyActiveState(response?.target);
                fetchStatus();
            }).fail((error) => {
                const message = error?.responseJSON?.error || 'No se pudo programar el apagado';
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: message
                });
            }).always(() => {
                $scheduleButton.prop('disabled', false);
            });
        };

        const cancelScheduledShutdown = () => {
            $programButton.prop('disabled', true);
            $.ajax({
                url: STATUS_ENDPOINT,
                method: 'DELETE'
            }).done((response) => {
                if (response?.status === 'cancelled') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Apagado cancelado',
                        text: 'Se canceló el apagado programado.'
                    });
                }
                applyInactiveState();
            }).fail(() => {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo cancelar el apagado programado.'
                });
            }).always(() => {
                $programButton.prop('disabled', false);
                fetchStatus();
            });
        };

        function fetchStatus() {
            if (fetchingStatus) {
                return;
            }
            fetchingStatus = true;
            $.ajax({
                url: STATUS_ENDPOINT,
                method: 'GET',
                dataType: 'json'
            }).done((data) => {
                if (data?.active) {
                    applyActiveState(data.target, data.remainingMs);
                } else {
                    applyInactiveState();
                }
            }).always(() => {
                fetchingStatus = false;
            });
        }

        $programButton.on('click', (event) => {
            event.preventDefault();
            event.stopPropagation();

            if ($programButton.data('shutdownActive')) {
                cancelScheduledShutdown();
                return;
            }

            openModal();
        });

        $scheduleButton.on('click', (event) => {
            event.preventDefault();
            const timeValue = ($timeInput.val() || '').trim();

            if (!timeValue) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Hora requerida',
                    text: 'Selecciona una hora para programar el apagado.'
                });
                return;
            }

            scheduleShutdown(timeValue);
        });

        $cancelModalButton.on('click', (event) => {
            event.preventDefault();
            closeModal();
        });

        $closeModalButton.on('click', (event) => {
            event.preventDefault();
            closeModal();
        });

        $overlay.on('click', () => {
            closeModal();
        });

        const startDrag = (event) => {
            event.preventDefault();
            dragActive = true;

            const pointer = event.type.startsWith('touch') ? event.touches[0] : event;
            const bannerRect = $banner[0].getBoundingClientRect();

            dragOffsetX = pointer.clientX - bannerRect.left;
            dragOffsetY = pointer.clientY - bannerRect.top;

            $('body').addClass('is-dragging-banner');
            $(document).on('mousemove.shutdownBanner touchmove.shutdownBanner', onDragMove);
            $(document).on('mouseup.shutdownBanner touchend.shutdownBanner touchcancel.shutdownBanner', stopDrag);
        };

        const onDragMove = (event) => {
            if (!dragActive) {
                return;
            }

            const pointer = event.type.startsWith('touch') ? event.touches[0] : event;
            const newLeft = pointer.clientX - dragOffsetX;
            const newTop = pointer.clientY - dragOffsetY;

            const maxLeft = window.innerWidth - $banner.outerWidth();
            const maxTop = window.innerHeight - $banner.outerHeight();

            const clampedLeft = Math.max(12, Math.min(maxLeft - 12, newLeft));
            const clampedTop = Math.max(12, Math.min(maxTop - 12, newTop));

            $banner.css({
                left: clampedLeft,
                top: clampedTop,
                transform: 'none'
            }).addClass('is-manual-position');
        };

        const stopDrag = () => {
            if (!dragActive) {
                return;
            }
            dragActive = false;
            $('body').removeClass('is-dragging-banner');
            $(document).off('.shutdownBanner');
        };

        $bannerHandle.on('mousedown touchstart', startDrag);

        fetchStatus();
    });
})();