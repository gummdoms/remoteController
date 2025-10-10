$(document).ready(function () {
    getBrillo();
    getContraste();
    getMonitores();
    getVolume();
    getMuted();
    //getEstadoPantalla();

    $('#brillo').on('input', function () {
        let brillo = $(this).val();
        $('.text-quantity-brillo').text(brillo);
        $.ajax({
            url: URL_API + 'brillo',
            type: 'POST',
            data: {
                brillo: brillo
            },
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    $('#contraste').on('input', function () {
        let contraste = $(this).val();
        $('.text-quantity-contraste').text(contraste);
        $.ajax({
            url: URL_API + 'contraste',
            type: 'POST',
            data: {
                contraste: contraste
            },
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#volumen').on('input', function () {
        let volumen = $(this).val();
        $('.text-quantity-volumen').text(volumen);
        $.ajax({
            url: URL_API + 'volumen',
            type: 'POST',
            data: {
                volumen: volumen
            },
            success: function (response) {
                $.ajax({
                    url: URL_API + 'reproducirSonido',
                    type: 'GET',
                    success: function (response) {
                        console.log(response);
                    },
                    error: function (error) {
                        console.log(error);
                    }
                });
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    //.btn-muted-inactive //.btn-muted-active
    $(document).on('click', '.btn-muted-inactive', function () {
        MutedPc()
    });
    $(document).on('click', '.btn-muted-active', function () {
        unmutedPc();
    });
    $('#pantallaPrincipal').on('click', function () {
        $.ajax({
            url: URL_API + 'soloPc',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#duplicar').on('click', function () {
        $.ajax({
            url: URL_API + 'duplicado',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#ampliar').on('click', function () {
        $.ajax({
            url: URL_API + 'extender',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#pantallaSecundaria').on('click', function () {
        $.ajax({
            url: URL_API + 'mostrarSecundaria',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#apagar').on('click', function () {
        $.ajax({
            url: URL_API + 'apagar',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#reiniciar').on('click', function () {
        $.ajax({
            url: URL_API + 'reiniciar',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#close_session').on('click', function () {
        $.ajax({
            url: URL_API + 'cerrarSesion',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#suspender').on('click', function () {
        $.ajax({
            url: URL_API + 'suspender',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    $('#app-cerrar').on('click', function () {
        $.ajax({
            url: URL_API + 'cerrarApp',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });
    $('#app-reiniciar').on('click', function () {
        $.ajax({
            url: URL_API + 'reiniciarApp',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    $('#app-ocultar').on('click', function () {
        $.ajax({
            url: URL_API + 'ocultarApp',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    ///mostrarApp
    $('#app-mostrar').on('click', function () {
        $.ajax({
            url: URL_API + 'mostrarApp',
            type: 'GET',
            success: function (response) {
                console.log(response);
            },
            error: function (error) {
                console.log(error);
            }
        });
    });

    //#btn-reload
    $('#btn-reload').on('click', function () {
        location.reload();
    });


});