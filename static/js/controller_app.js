$(document).ready(function () {
    $(document).on('click', '.btn-add-app-direct', function () {
        $('.modal-add-app').addClass('active');
    });
    //.btn-close-modal-add-app

    $(document).on('click', '.btn-close-modal-add-app', function () {
        $('.modal-add-app').removeClass('active');
    });
    $(document).on('click', '#cancel-add-app', function () {
        $('.modal-add-app').removeClass('active');
    });

    //cuando cabien type-app
    $(document).on('change', '#type-app', function () {
        let tipo = $(this).val(); //web o desktop
        if (tipo == 'web') {
            $('.form-web-path').removeClass('d-none');
            $('.form-desk-path').addClass('d-none');
        } else if (tipo == 'desktop') {
            $('.form-web-path').addClass('d-none');
            $('.form-desk-path').removeClass('d-none');
        }
    });
    //#select-dir-app-desk
    $(document).on('click', '#select-dir-app-desk', function () {
        $('.select-dir').addClass('active');
        readDir('/');
    });
    //#close-modal-dir
    $(document).on('click', '#close-modal-dir', function () {
        $('.select-dir').removeClass('active');
    });

    //.event_folder
    $(document).on('click', '.event_folder', function () {
        let path = $(this).data('path');
        //console.log(path);
        readDir(path);
    });
    //.event_file
    $(document).on('click', '.event_file', function () {
        let path = $(this).data('path');
        //console.log(path);
        $('#path-selected').val(path);
        $('#select-dir-app-desk').html(path);
        $('.select-dir').removeClass('active');
    });
    //btn-return-modal-dir
    $(document).on('click', '.btn-return-modal-dir', function () {
        let path = $('#path-selected').val();
        //verificar si path tiene / al final
        if (path.charAt(path.length - 1) == '/') {
            path = path.substring(0, path.length - 1);
        }
        let pathArray = path.split('/');
        pathArray.pop();

        path = pathArray.join('/') + '/';
        //si queda vacio path, ponerlo en /
        if (path == '') {
            path = '/';
        }
        //console.log(path);
        readDir(path);
    });

    $(document).on('click', '#add-app', function (event) {
        event.preventDefault();
        $('.loadding').addClass('active');

        let name = $('#name-app').val();
        let type = $('#type-app').val();
        let path;
        if (type == 'web') {
            path = $('#path-app-web').val();
        } else if (type == 'desktop') {
            path = $('#path-selected').val();
        }
        let iconFile = $('#icon-app')[0].files[0];

        // Validaciones
        if (name == '') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El nombre de la aplicación es requerido!',
            });
            $('.loadding').removeClass('active');
            return;
        }
        if (path == '') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'La ruta de la aplicación es requerida!',
            });
            $('.loadding').removeClass('active');
            return;
        }
        if (!iconFile) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El icono de la aplicación es requerido!',
            });
            $('.loadding').removeClass('active');
            return;
        }
        if (type == '') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El tipo de la aplicación es requerido!',
            });
            $('.loadding').removeClass('active');
            return;
        }

        // Convertir la imagen a Base64
        const reader = new FileReader();
        reader.onload = function (e) {
            const iconBase64 = e.target.result; // Base64 de la imagen

            // Crear el objeto de datos para enviar al servidor
            const data = {
                name: name,
                path: path,
                icon: iconBase64,
                type: type
            };

            // Enviar los datos al servidor
            $.ajax({
                url: URL_API + 'AddAplicacion',
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(data),
                success: function (response) {
                    $('.modal-add-app').removeClass('active');
                    getApps();
                    $('.loadding').removeClass('active');
                    Swal.fire({
                        icon: 'success',
                        title: 'Éxito',
                        text: 'La aplicación se ha agregado correctamente!',
                    });
                    $('#name-app').val('');
                },
                error: function (error) {
                    console.log(error);
                    $('.loadding').removeClass('active');
                    if (error.responseJSON && error.responseJSON.error) {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: error.responseJSON.error,
                        });
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: 'Error al agregar la aplicación!',
                        });
                    }
                }
            });
        };

        reader.onerror = function () {
            $('.loadding').removeClass('active');
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudo procesar el icono de la aplicación!',
            });
        };

        reader.readAsDataURL(iconFile); // Leer el archivo como Base64
    });
    function getApps() {
        $.ajax({
            url: URL_API + 'getAplicaciones',
            type: 'GET',
            dataType: 'json',
            data: { action: 'getApps' },
            success: function (response) {
                let html = '';
                response.forEach(function (app) {
                    let icon = app.icon; // Base64 de la imagen
                    let name = app.name;
                    let path = app.path;
                    let type = app.type;
                    let classApp = 'btn-open-executable';
                    if (type == 'web') {
                        classApp = 'btn-open-web';
                    }
                    html += `
                    <button class="btn btn-app ${classApp} btn-link-open" data-url="${path}">
                        <img src="${icon}" alt="${name}" class="icon-app" />
                        <span class="text-app">${name}</span>
                    </button>
                    `;
                });
                $('.apps-container').html(html);
            },
            error: function (error) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al obtener las aplicaciones!',
                });

                $('.apps-container').html('');
                $('.apps-container').html('<p class="text-center">No hay aplicaciones disponibles</p>');
            }
        });
    }
    getApps();
    $(document).on('click', '.btn-link-open', function (event) {
        event.preventDefault();
        let url = $(this).data('url');
        //console.log(url);
        $.ajax({
            url: URL_API + 'abrirUrl',
            type: 'POST',
            data: { action: 'openUrl', url: url },
            success: function (response) {
                console.log(response);
            }
        });
    });

    $(document).on('click', '.btn-executable-open', function (event) {
        event.preventDefault();
        let url = $(this).data('url');
        //console.log(url);
        $.ajax({
            url: URL_API + 'abrirAplicacion',
            type: 'POST',
            data: { action: 'openApp', aplicacion: url },
            success: function (response) {
                console.log(response);
            }
        });
    });
    //#btn-transferir
    $(document).on('click', '#btn-transferir', function (event) {
        event.preventDefault();
        let archivo = $('#icon-app')[0].files[0];
        let path = $('#path-selected').val();
        let formData = new FormData();
        //verificar que la ruta no sea vacia o /
        if (path == '' || path == '/') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'La ruta de destino es requerida!',
            });
            return;
        }
        //verificar que el archivo no sea vacio
        if (!archivo) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El archivo de destino es requerido!',
            });
            return;
        }
        $('.loadding').addClass('active');
        formData.append('archivo', archivo);
        formData.append('path', path);
        $.ajax({
            url: URL_API + 'transferirArchivo',
            type: 'POST',
            data: formData,
            contentType: false,
            processData: false,
            success: function (response) {
                $('.select-dir').removeClass('active');
                $('.loadding').removeClass('active');
                Swal.fire({
                    icon: 'success',
                    title: 'Exito',
                    text: 'El archivo se ha transferido correctamente!',
                });

            },
            error: function (error) {
                console.log(error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Error al transferir el archivo!',
                });
            }
        });

    });
})