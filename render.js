$(document).ready(function () {
    const api = window.ipcRenderer;
    const $maximizeButton = $('.maximize-window');
    const $statusText = $('#service-status-text');
    const $host = $('#service-host');
    const $httpsUrl = $('#https-url');
    const $httpUrl = $('#http-url');
    const $autostart = $('#autostart-toggle');
    const $autostartStatus = $('#autostart-status');
    const $diagList = $('#input-diag-list');
    const $diagMessage = $('#input-diag-message');
    const $applyFix = $('#apply-input-fix');

    let latestCommands = [];
    let tooltipTarget = null;

    const $tooltip = $('<div id="app-tooltip" class="app-tooltip" role="tooltip"></div>');
    $('body').append($tooltip);

    const setWindowState = (state) => {
        const isMaximized = Boolean(state?.isMaximized);
        $maximizeButton.attr('data-tooltip', isMaximized ? 'Restaurar' : 'Maximizar');
        $maximizeButton.find('i').attr('class', isMaximized ? 'bi bi-fullscreen-exit' : 'bi bi-square');
    };

    const migrateNativeTitles = () => {
        $('[title]').each(function () {
            const value = $(this).attr('title');
            if (value && !$(this).attr('data-tooltip')) {
                $(this).attr('data-tooltip', value);
            }
            $(this).removeAttr('title');
        });
    };

    const positionTooltip = (event) => {
        if (!tooltipTarget || !$tooltip.hasClass('is-visible')) {
            return;
        }

        const tooltipEl = $tooltip[0];
        const margin = 12;
        let left;
        let top;

        if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            left = event.clientX + 14;
            top = event.clientY + 18;
        } else {
            const rect = tooltipTarget.getBoundingClientRect();
            left = rect.left + (rect.width / 2) - (tooltipEl.offsetWidth / 2);
            top = rect.top - tooltipEl.offsetHeight - 10;
        }

        const maxLeft = window.innerWidth - tooltipEl.offsetWidth - margin;
        const maxTop = window.innerHeight - tooltipEl.offsetHeight - margin;

        left = Math.max(margin, Math.min(maxLeft, left));
        top = Math.max(margin, Math.min(maxTop, top));

        $tooltip.css({ left: `${left}px`, top: `${top}px` });
    };

    const showTooltip = (target, event) => {
        const text = target.getAttribute('data-tooltip');
        if (!text) {
            return;
        }
        tooltipTarget = target;
        $tooltip.text(text).addClass('is-visible');
        positionTooltip(event);
    };

    const hideTooltip = () => {
        tooltipTarget = null;
        $tooltip.removeClass('is-visible');
    };

    const copyToClipboard = async (value) => {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(value);
            return;
        }
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    };

    const renderChecks = (checks = []) => {
        $diagList.empty();
        checks.forEach((check) => {
            const $item = $('<li></li>').addClass(check.ok ? 'diag-ok' : 'diag-bad');
            $item.append(`<strong>${check.ok ? 'OK' : 'Atención'} · ${check.name}</strong>`);
            $item.append(`<small>${check.details || 'Sin detalle'}</small>`);
            $diagList.append($item);
        });
    };

    const refreshServiceState = async () => {
        try {
            const state = await api.invoke('service:getStatus');
            const urls = state?.urls || {};
            const diag = state?.inputDiagnosis || {};

            $statusText.text(`Servicio activo en ${state?.platform || 'desconocido'}${state?.sessionType ? ` (${state.sessionType})` : ''}`);
            $host.text(`host: ${urls.host || '--'}`);
            $httpsUrl.text(urls.https || 'https://--');
            $httpUrl.text(urls.http || 'http://--');

            const autostart = state?.autostart || { supported: false, enabled: false };
            $autostart.prop('checked', Boolean(autostart.enabled));
            $autostart.prop('disabled', !autostart.supported);
            $autostartStatus.text(
                autostart.supported
                    ? `Autoinicio ${autostart.enabled ? 'activado' : 'desactivado'}.`
                    : `No disponible: ${autostart.message || 'plataforma no compatible'}`
            );

            renderChecks(diag.checks || []);
            latestCommands = diag.recommendedCommands || [];
            $diagMessage.text(diag.message || 'Sin diagnóstico disponible.');
            $applyFix.prop('disabled', state?.platform !== 'linux');
        } catch (error) {
            console.error('No se pudo cargar estado del servicio:', error);
            $statusText.text('No se pudo cargar el estado del servicio');
        }
    };

    $(document).on('click', '.minimize-window', function () {
        api.send('minimizeApp');
    });

    $(document).on('click', '.maximize-window', function () {
        api.send('toggleMaximize');
    });

    $(document).on('click', '.close-window', function () {
        api.send('closeApp');
    });

    $(document).on('click', '.exitApp', function () {
        Swal.fire({
            title: '¿Estás seguro?',
            text: '¿Quieres cerrar la aplicación?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Salir'
        }).then((result) => {
            if (result.isConfirmed) {
                api.send('exitApp');
            }
        });
    });

    $('#open-https-url').on('click', async () => {
        await api.invoke('service:openUrl', { mode: 'https' });
    });

    $('#open-http-url').on('click', async () => {
        await api.invoke('service:openUrl', { mode: 'http' });
    });

    $('#copy-https-url').on('click', async () => {
        try {
            await copyToClipboard($httpsUrl.text().trim());
            Swal.fire({ icon: 'success', title: 'Copiado', text: 'URL HTTPS copiada al portapapeles', timer: 1400, showConfirmButton: false });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar la URL' });
        }
    });

    $('#copy-http-url').on('click', async () => {
        try {
            await copyToClipboard($httpUrl.text().trim());
            Swal.fire({ icon: 'success', title: 'Copiado', text: 'URL HTTP copiada al portapapeles', timer: 1400, showConfirmButton: false });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo copiar la URL' });
        }
    });

    $autostart.on('change', async function () {
        const enabled = $(this).is(':checked');
        $autostart.prop('disabled', true);
        try {
            const response = await api.invoke('service:setAutostart', { enabled });
            $autostart.prop('checked', Boolean(response.enabled));

            const message = response.message || `Autoinicio ${response.enabled ? 'activado' : 'desactivado'}.`;
            $autostartStatus.text(message);

            if (Boolean(response.enabled) !== enabled) {
                await Swal.fire({
                    icon: 'warning',
                    title: 'Autoinicio no aplicado',
                    text: message
                });
            }
        } catch (error) {
            $autostart.prop('checked', !enabled);
            Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: error.message || 'Error en autoinicio' });
        } finally {
            $autostart.prop('disabled', false);
        }
    });

    $('#refresh-input-diag').on('click', async () => {
        const response = await api.invoke('service:diagnoseInputPermission');
        renderChecks(response.checks || []);
        latestCommands = response.recommendedCommands || [];
        $diagMessage.text(response.message || 'Sin diagnóstico disponible.');
    });

    $('#show-input-commands').on('click', async () => {
        const formatted = latestCommands.length ? latestCommands.join('\n') : 'No hay comandos sugeridos para este sistema.';
        await Swal.fire({
            title: 'Comandos sugeridos',
            html: `<pre style="text-align:left;white-space:pre-wrap;font-size:12px;background:#111827;color:#e5ecff;padding:12px;border-radius:8px;max-height:260px;overflow:auto;">${formatted}</pre>`,
            width: 760
        });
    });

    $applyFix.on('click', async () => {
        try {
            $applyFix.prop('disabled', true);
            const result = await api.invoke('service:applyInputPermissionFix');
            await Swal.fire({ icon: 'success', title: 'Configuración aplicada', text: result.message });
            renderChecks(result?.diagnosis?.checks || []);
            $diagMessage.text(result?.diagnosis?.message || 'Diagnóstico actualizado');
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'No se pudo aplicar', text: error.message || 'Error aplicando configuración' });
        } finally {
            $applyFix.prop('disabled', false);
        }
    });

    api.on('reproducirSonido', () => {
        const audioElement = document.getElementById('audio');
        if (audioElement) {
            audioElement.play().catch(() => { /* Ignorar bloqueo de autoplay */ });
        }
    });

    api.invoke('window:getState').then(setWindowState).catch(() => {
        setWindowState({ isMaximized: false });
    });

    api.on('windowStateChanged', (event, state) => {
        setWindowState(state);
    });

    migrateNativeTitles();

    $(document).on('mouseenter', '[data-tooltip]', function (event) {
        showTooltip(this, event.originalEvent || event);
    });

    $(document).on('mousemove', '[data-tooltip]', function (event) {
        if (tooltipTarget === this) {
            positionTooltip(event.originalEvent || event);
        }
    });

    $(document).on('mouseleave', '[data-tooltip]', function () {
        if (tooltipTarget === this) {
            hideTooltip();
        }
    });

    $(document).on('focusin', '[data-tooltip]', function () {
        showTooltip(this);
    });

    $(document).on('focusout', '[data-tooltip]', function () {
        if (tooltipTarget === this) {
            hideTooltip();
        }
    });

    $(window).on('resize scroll', () => {
        positionTooltip();
    });

    refreshServiceState();
});
