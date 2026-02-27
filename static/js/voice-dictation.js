$(document).ready(function () {
    const $voiceButton = $('#btn-voice-show');
    if (!$voiceButton.length) {
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        $voiceButton.on('click', function () {
            Swal.fire({
                icon: 'info',
                title: 'No disponible',
                text: 'Tu navegador no soporta dictado por voz en este dispositivo.'
            });
        });
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-CO';
    recognition.continuous = true;
    recognition.interimResults = false;

    let isListening = false;

    function setListeningState(active) {
        isListening = active;
        $voiceButton.toggleClass('is-listening', active);
        $voiceButton.attr('title', active ? 'Detener dictado por voz' : 'Dictado por voz');
        $voiceButton.find('i').attr('class', active ? 'bi bi-mic-fill' : 'bi bi-mic');
    }

    function sendDictatedText(text) {
        const value = typeof text === 'string' ? text.trim() : '';
        if (!value) {
            return;
        }

        $.ajax({
            url: URL_API + 'teclear',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ char: `${value} ` }),
            error: function (error) {
                console.log(error);
            }
        });
    }

    recognition.onresult = function (event) {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
            if (event.results[i].isFinal) {
                const transcript = event.results[i][0]?.transcript || '';
                sendDictatedText(transcript);
            }
        }
    };

    recognition.onerror = function (event) {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            Swal.fire({
                icon: 'error',
                title: 'Permiso denegado',
                text: 'Debes permitir el uso del micrófono para dictar por voz.'
            });
        } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
            Swal.fire({
                icon: 'error',
                title: 'Error de dictado',
                text: 'No fue posible iniciar el reconocimiento de voz.'
            });
        }
        setListeningState(false);
    };

    recognition.onend = function () {
        setListeningState(false);
    };

    $voiceButton.on('click', function () {
        if (!isListening) {
            try {
                recognition.start();
                setListeningState(true);
            } catch (error) {
                console.log(error);
                setListeningState(false);
            }
            return;
        }

        recognition.stop();
        setListeningState(false);
    });
});
