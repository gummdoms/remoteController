$(document).ready(function () {
    const contentTeclado = $('.teclado');
    contentTeclado.html(teclado_principal());

    const activeModifiers = new Set();
    const holdTimers = new Map();
    const HOLD_INTERVAL = 90;
    const HOLD_DELAY = 320;

    function sendPayload(payload) {
        return $.ajax({
            url: URL_API + 'teclear',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(payload)
        });
    }

    function consumeModifiers() {
        if (!activeModifiers.size) {
            return;
        }
        activeModifiers.clear();
        $('.btn-modifier').removeClass('active');
    }

    function toKeyString(value) {
        if (value === undefined || value === null) {
            return undefined;
        }
        return typeof value === 'string' ? value : value.toString();
    }

    function sendCharacterKey(rawKey) {
        const key = toKeyString(rawKey);
        if (!key) {
            return;
        }

        if (activeModifiers.size) {
            const combo = Array.from(activeModifiers);
            combo.push(key);
            return sendPayload({ combo }).always(consumeModifiers);
        }
        return sendPayload({ char: key });
    }

    function scheduleHold($button, key) {
        const existing = holdTimers.get($button[0]);
        if (existing && existing.timeoutId) {
            clearTimeout(existing.timeoutId);
        }
        consumeModifiers();
        sendCharacterKey(key);
        const intervalId = setInterval(() => {
            sendCharacterKey(key);
        }, HOLD_INTERVAL);
        holdTimers.set($button[0], { intervalId });
        $button.data('holdActive', true);
    }

    function clearHold($button) {
        const holdState = holdTimers.get($button[0]);
        if (!holdState) {
            return;
        }

        if (holdState.timeoutId) {
            clearTimeout(holdState.timeoutId);
        }

        if (holdState.intervalId) {
            clearInterval(holdState.intervalId);
        }

        holdTimers.delete($button[0]);
        setTimeout(() => {
            $button.removeData('holdActive');
        }, 0);
    }

    $(document).on('click', '.btn-teclado', function (event) {
        const $button = $(this);
        if ($button.data('holdActive')) {
            event.preventDefault();
            return;
        }
        const key = toKeyString($button.data('key'));
        if (key === undefined) {
            return;
        }
        sendCharacterKey(key);
    });

    $(document).on('pointerdown', '.btn-teclado', function (event) {
        event.preventDefault();
        const $button = $(this);
        const key = toKeyString($button.data('key'));
        if (key === undefined || $button.data('hold') === false || $button.data('holdActive')) {
            return;
        }
        const timeoutId = setTimeout(() => {
            scheduleHold($button, key);
        }, HOLD_DELAY);
        holdTimers.set($button[0], { timeoutId });
    });

    $(document).on('pointerup pointerleave pointercancel', '.btn-teclado', function () {
        clearHold($(this));
    });

    $(document).on('pointerup pointercancel', function () {
        holdTimers.forEach((_, element) => {
            clearHold($(element));
        });
    });

    $(document).on('click', '.btn-modifier', function () {
        const $button = $(this);
        const modifier = ($button.data('modifier') || $button.data('key') || '').toString().toLowerCase();
        if (!modifier) {
            return;
        }

        if (activeModifiers.has(modifier)) {
            activeModifiers.delete(modifier);
            $button.removeClass('active');
        } else {
            activeModifiers.add(modifier);
            $button.addClass('active');
        }
    });

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    $(document).on('click', '.btn-teclado-cod', async function () {
        const key = toKeyString($(this).data('key'));
        if (!key) {
            return;
        }
        consumeModifiers();
        const sequence = ['º', key, 'enter', 'º'];
        for (const value of sequence) {
            await sendCharacterKey(value);
            await delay(40);
        }
    });

    $(document).on('click', '.btn-shift', function () {
        consumeModifiers();
        contentTeclado.html(teclado_mayus());
    });
    $(document).on('click', '.btn-unshift', function () {
        consumeModifiers();
        contentTeclado.html(teclado_principal());
    });
    $(document).on('click', '.btn-number', function () {
        consumeModifiers();
        contentTeclado.html(teclado_principal_special());
    });
    $(document).on('click', '.btn-abc', function () {
        consumeModifiers();
        contentTeclado.html(teclado_principal());
    });
    $(document).on('click', '.btn-special', function () {
        consumeModifiers();
        contentTeclado.html(teclado_other_special());
    });
    $(document).on('click', '.btn-only-number', function () {
        consumeModifiers();
        contentTeclado.html(teclado_only_numeric());
    });
    $(document).on('click', '.btn-special-microsoft', function () {
        consumeModifiers();
        contentTeclado.html(teclado_microsoft());
    });
    //btn-show-tecl-f
    $(document).on('click', '.btn-show-tecl-f', function () {
        consumeModifiers();
        contentTeclado.html(tecladoF());
    });
    $(document).on('click', '.btn-special-co2', function () {
        consumeModifiers();
        contentTeclado.html(teclado_cod_bo2());
    });
    $(document).on('click', '.btn-teclado-show', function () {
        $('.container-teclados').toggleClass('active');
    });
    $(document).on('click', '.btn-otion-pc-show', function () {
        $('.container-option-pc').toggleClass('active');
    });
    $(document).on('click', '.container-option-pc', function (e) {
        if ($(e.target).is('.container-option-pc')) {
            $('.container-option-pc').removeClass('active');
        }
    });
});
