$(document).ready(function () {
    const $modal = $('#modal-cert-manager');
    if (!$modal.length) {
        return;
    }

    const $status = $('#cert-status');
    const $httpsUrl = $('#cert-https-url');
    const $qrImage = $('#cert-qr-image');
    const $downloadLink = $('#cert-download-link');

    function setLoadingState() {
        $status.text('Cargando estado del certificado...');
        $httpsUrl.text('');
        $qrImage.attr('src', '');
        $downloadLink.attr('href', '#');
    }

    function renderCertInfo(info) {
        $status.text(info.message || 'Estado desconocido');
        $httpsUrl.text(info.httpsUrl ? `URL segura: ${info.httpsUrl}` : 'URL segura no disponible');

        if (info.qrDataUrl) {
            $qrImage.attr('src', info.qrDataUrl).show();
        } else {
            $qrImage.hide();
        }

        $downloadLink.attr('href', info.rootCaDownloadUrl || '#');
        $downloadLink.text(info.rootCaDownloadUrl
            ? 'Descargar rootCA.crt para instalar en Android'
            : 'No hay enlace de descarga disponible');
    }

    function loadCertificateInfo() {
        setLoadingState();
        return $.ajax({
            url: URL_API + 'cert/info',
            type: 'GET',
            dataType: 'json'
        }).then((response) => {
            renderCertInfo(response || {});
        }).catch((error) => {
            console.log(error);
            $status.text('No se pudo consultar el certificado.');
        });
    }

    $(document).on('click', '#app-certificado', function () {
        $modal.addClass('active');
        loadCertificateInfo();
    });

    $(document).on('click', '#close-modal-cert, #cancel-cert-modal', function () {
        $modal.removeClass('active');
    });

    $(document).on('click', '#regenerate-cert', function () {
        $('.loadding').addClass('active');
        $.ajax({
            url: URL_API + 'cert/regenerate',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ force: true })
        }).then((response) => {
            Swal.fire({
                icon: 'success',
                title: 'Certificado actualizado',
                text: response?.message || 'Se regeneró correctamente.'
            });
            return loadCertificateInfo();
        }).catch((error) => {
            const message = error?.responseJSON?.message || error?.responseJSON?.error || 'No se pudo regenerar el certificado.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: message
            });
        }).always(() => {
            $('.loadding').removeClass('active');
        });
    });
});
