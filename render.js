$(document).ready(function () {
    const api = window.ipcRenderer;
    const $authScreen = $('#auth-screen');
    const $dashboardScreen = $('#dashboard-screen');
    const $maximizeButton = $('.maximize-window');
    const $statusText = $('#service-status-text');
    const $cloudStatusPill = $('#cloud-status-pill');
    const $cloudStatusMessage = $('#cloud-status-message');
    const $userInfo = $('#user-info');
    const $renameDevice = $('#rename-device');
    const $autostart = $('#autostart-toggle');
    const $autostartStatus = $('#autostart-status');
    const $diagList = $('#input-diag-list');
    const $diagMessage = $('#input-diag-message');
    const $applyFix = $('#apply-input-fix');
    const $waylandRow = $('#wayland-experimental-row');
    const $waylandToggle = $('#wayland-experimental-toggle');
    const $waylandStatus = $('#wayland-experimental-status');
    const $windowsInputSection = $('#windows-input-section');
    const $interceptionToggle = $('#interception-input-toggle');
    const $interceptionStatus = $('#interception-input-status');
    const $refreshInterception = $('#refresh-interception-status');

    let authMode = 'login';
    let latestCommands = [];
    let tooltipTarget = null;

    const $tooltip = $('<div id="app-tooltip" class="app-tooltip" role="tooltip"></div>');
    $('body').append($tooltip);

    const setWindowState = (state) => {
        const isMaximized = Boolean(state?.isMaximized);
        $maximizeButton.attr('data-tooltip', isMaximized ? 'Restaurar' : 'Maximizar');
        $maximizeButton.find('i').attr('class', isMaximized ? 'bi bi-fullscreen-exit' : 'bi bi-square');
    };

    const showAuthScreen = () => {
        $authScreen.show();
        $dashboardScreen.hide();
    };

    const showDashboard = () => {
        $authScreen.hide();
        $dashboardScreen.show();
    };

    const renderCloudState = (cloud = {}, auth = {}) => {
        const connected = Boolean(cloud.connected);
        const paired = Boolean(cloud.deviceId);

        $cloudStatusPill.text(connected ? 'En línea' : 'Desconectado');

        if (auth.user) {
            $userInfo.text(`Sesión: ${auth.user.name || auth.user.email}`);
        }

        if (paired && connected) {
            $cloudStatusMessage.text(`"${cloud.deviceName || 'Mi PC'}" listo para control remoto desde la web.`);
        } else if (paired) {
            $cloudStatusMessage.text('Reconectando con el servidor...');
        } else {
            $cloudStatusMessage.text('Equipo no registrado todavía.');
        }

        if (cloud.deviceName) {
            $renameDevice.val(cloud.deviceName);
        }
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
            const auth = state?.auth || {};
            const cloud = state?.cloud || {};
            const diag = state?.inputDiagnosis || {};

            if (auth.loggedIn) {
                showDashboard();
            } else {
                showAuthScreen();
            }

            $statusText.text(`Agente en ${state?.platform || 'desconocido'}${state?.sessionType ? ` (${state.sessionType})` : ''}`);
            renderCloudState(cloud, auth);

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
            $diagMessage.data('sessionType', state?.sessionType || '');
            const isWayland = String(state.sessionType || '').toLowerCase() === 'wayland';
            $applyFix.prop('disabled', state?.platform !== 'linux');

            const inputControl = state?.inputControl || {};
            const showWaylandControls = Boolean(inputControl.waylandExperimentalAvailable);
            $waylandRow.toggle(showWaylandControls);
            $waylandStatus.toggle(showWaylandControls);

            if (showWaylandControls) {
                const enabled = Boolean(inputControl.waylandExperimentalEnabled);
                $waylandToggle.prop('checked', enabled);
                $waylandStatus.text(
                    enabled
                        ? 'Modo Wayland experimental activado.'
                        : 'Modo Wayland experimental desactivado.'
                );
            }

            const interception = inputControl.interception || {};
            const showInterceptionControls = Boolean(interception.available);
            $windowsInputSection.toggle(showInterceptionControls);

            if (showInterceptionControls) {
                $interceptionToggle.prop('checked', Boolean(interception.enabled));
                const statusParts = [interception.message || 'Sin estado disponible.'];
                if (interception.enabled && interception.driverReady) {
                    statusParts.push('Listo para usar sin reiniciar la app.');
                } else if (interception.enabled && !interception.driverReady) {
                    statusParts.push('Instala el driver y reinicia Windows solo la primera vez.');
                }
                $interceptionStatus.text(statusParts.join(' '));
            }
        } catch (error) {
            console.error('No se pudo cargar estado del servicio:', error);
            $statusText.text('No se pudo cargar el estado del servicio');
        }
    };

    $('.auth-tabs button').on('click', function () {
        authMode = $(this).data('auth-mode');
        $('.auth-tabs button').removeClass('active');
        $(this).addClass('active');
        $('.register-only').toggle(authMode === 'register');
        $('#auth-submit .auth-submit__label').text(authMode === 'register' ? 'Crear cuenta' : 'Entrar');
        $('.auth-screen__brand h1').text(authMode === 'register' ? 'Crear cuenta' : 'Inicia sesión');
    });

    $('#toggle-password').on('click', function () {
        const $input = $('#auth-password');
        const isPassword = $input.attr('type') === 'password';
        $input.attr('type', isPassword ? 'text' : 'password');
        $(this).find('i').attr('class', isPassword ? 'bi bi-eye-slash' : 'bi bi-eye');
    });

    const setAuthLoading = (loading) => {
        $('#auth-submit').prop('disabled', loading).toggleClass('is-loading', loading);
    };

    $('#auth-form').on('submit', async function (event) {
        event.preventDefault();
        const payload = {
            email: $('#auth-email').val().trim(),
            password: $('#auth-password').val(),
            name: $('#auth-name').val().trim(),
            deviceName: $('#device-name').val().trim()
        };

        setAuthLoading(true);

        try {
            if (authMode === 'register') {
                await api.invoke('auth:register', payload);
            } else {
                await api.invoke('auth:login', payload);
            }
            await refreshServiceState();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo completar la autenticación.' });
        } finally {
            setAuthLoading(false);
        }
    });

    $('#logout-btn').on('click', async () => {
        const result = await Swal.fire({
            title: '¿Cerrar sesión?',
            text: 'Otro usuario podrá iniciar sesión en este equipo.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Cerrar sesión'
        });
        if (!result.isConfirmed) {
            return;
        }
        await api.invoke('auth:logout');
        showAuthScreen();
        await refreshServiceState();
    });

    $('#save-device-name').on('click', async () => {
        try {
            const name = $renameDevice.val().trim();
            if (!name) {
                throw new Error('El nombre no puede estar vacío.');
            }
            await api.invoke('auth:renameDevice', { name });
            await refreshServiceState();
            Swal.fire({ icon: 'success', title: 'Nombre actualizado', timer: 1200, showConfirmButton: false });
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.message || 'No se pudo actualizar el nombre.' });
        }
    });

    $(document).on('click', '.minimize-window', () => api.send('minimizeApp'));
    $(document).on('click', '.maximize-window', () => api.send('toggleMaximize'));
    $(document).on('click', '.exitApp', () => {
        Swal.fire({
            title: '¿Estás seguro?',
            text: '¿Quieres cerrar la aplicación?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Salir'
        }).then((result) => {
            if (result.isConfirmed) {
                api.send('exitApp');
            }
        });
    });

    $('#open-web-url').on('click', async () => {
        await api.invoke('service:openUrl');
    });

    api.on('cloud:statusChanged', () => {
        refreshServiceState();
    });

    api.on('auth:stateChanged', () => {
        refreshServiceState();
    });

    $autostart.on('change', async function () {
        const enabled = $(this).is(':checked');
        $autostart.prop('disabled', true);
        try {
            const response = await api.invoke('service:setAutostart', { enabled });
            $autostart.prop('checked', Boolean(response.enabled));
            $autostartStatus.text(response.message || `Autoinicio ${response.enabled ? 'activado' : 'desactivado'}.`);
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

    $waylandToggle.on('change', async function () {
        const enabled = $(this).is(':checked');
        $waylandToggle.prop('disabled', true);
        try {
            const result = await api.invoke('service:setWaylandInputExperimental', { enabled });
            $waylandToggle.prop('checked', Boolean(result.enabled));
            $waylandStatus.text(result.message || 'Estado actualizado.');
        } catch (error) {
            $waylandToggle.prop('checked', !enabled);
            Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: error.message || 'Error al actualizar Wayland.' });
        } finally {
            $waylandToggle.prop('disabled', false);
        }
    });

    $interceptionToggle.on('change', async function () {
        const enabled = $(this).is(':checked');
        $interceptionToggle.prop('disabled', true);
        try {
            const result = await api.invoke('service:setInterceptionInput', { enabled });
            await refreshServiceState();
            if (enabled && !result.driverReady) {
                const openDriver = await Swal.fire({
                    icon: 'info',
                    title: 'Driver Interception no detectado',
                    text: 'Descarga e instala Interception desde GitHub. Solo necesitas reiniciar Windows la primera vez.',
                    showCancelButton: true,
                    confirmButtonText: 'Abrir releases',
                    cancelButtonText: 'Cerrar'
                });
                if (openDriver.isConfirmed) {
                    await api.invoke('service:openInterceptionReleases');
                }
            }
        } catch (error) {
            $interceptionToggle.prop('checked', !enabled);
            Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: error.message || 'Error al actualizar Interception.' });
        } finally {
            $interceptionToggle.prop('disabled', false);
        }
    });

    $refreshInterception.on('click', async () => {
        $refreshInterception.prop('disabled', true);
        try {
            await api.invoke('service:probeInterception');
            await refreshServiceState();
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'No se pudo actualizar', text: error.message || 'Error al comprobar Interception.' });
        } finally {
            $refreshInterception.prop('disabled', false);
        }
    });

    $('#interception-download-link').on('click', async (event) => {
        event.preventDefault();
        await api.invoke('service:openInterceptionReleases');
    });

    $('#show-input-commands').on('click', async () => {
        const formatted = latestCommands.length ? latestCommands.join('\n') : 'No hay comandos sugeridos.';
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
        } catch (error) {
            await Swal.fire({ icon: 'error', title: 'No se pudo aplicar', text: error.message || 'Error aplicando configuración' });
        } finally {
            $applyFix.prop('disabled', false);
        }
    });

    api.on('reproducirSonido', () => {
        const audioElement = document.getElementById('audio');
        if (audioElement) {
            audioElement.play().catch(() => { });
        }
    });

    api.invoke('window:getState').then(setWindowState).catch(() => setWindowState({ isMaximized: false }));
    api.on('windowStateChanged', (_event, state) => setWindowState(state));

    refreshServiceState();
});
