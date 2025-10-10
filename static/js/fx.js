function getBrillo() {
    $.ajax({
        url: URL_API + 'brillo',
        type: 'GET',
        success: function (response) {
            $('#brillo').val(response.brillo);
            $('.text-quantity-brillo').text(response.brillo);
        },
        error: function (error) {
            console.log(error);
        }
    });
}
function getContraste() {
    $.ajax({
        url: URL_API + 'contraste',
        type: 'GET',
        success: function (response) {
            $('#contraste').val(response.contraste);
            $('.text-quantity-contraste').text(response.contraste);
        },
        error: function (error) {
            console.log(error);
        }
    });
}

function getMonitores() {
    $.ajax({
        url: URL_API + 'monitores',
        type: 'GET',
        success: function (response) {
            $('.text-quantity-monitores').text(response.length);
        },
        error: function (error) {
            console.log(error);
        }
    });
}

function getVolume(volumen) {
    $.ajax({
        url: URL_API + 'volumen',
        type: 'GET',
        success: function (response) {
            $('#volumen').val(response.volumen);
            $('.text-quantity-volumen').text(response.volumen);
        },
        error: function (error) {
            console.log(error);
        }
    });
}

function getEstadoPantalla() {
    $.ajax({
        url: URL_API + 'estadoPantalla',
        type: 'GET',
        success: function (response) {
            //console.log(response);
            let estado = response.estado;
            estado = parseInt(estado);
            //console.log(estado);
            $('.btn-screen').removeClass('active');
            if (estado === 4500) {
                $('.soloPantallaPrincipal').addClass('active');
            } else if (estado === 4501) {
                $('.soloPantallaSecundaria').addClass('active');
            } else if (estado === 4502) {
                $('#.duplicar').addClass('active');
            } else if (estado == 4503) {
                $('.ampliar').addClass('active');
                //console.log('Ampliar');
            } else {
                console.log('Desconocido');
            }
        },
        error: function (error) {
            console.log(error);
        }
    });
}

function getMuted() {
    $.ajax({
        url: URL_API + 'muted',
        type: 'GET',
        success: function (response) {
            let iconUnmute = '<i class="bi bi-volume-up"></i>';
            let iconMute = '<i class="bi bi-volume-mute"></i>';
            let htmlIcon;
            let classElement;
            let muted = response.muted;
            if (muted) {
                htmlIcon = iconMute;
                classElement = 'btn-muted-active';
            } else {
                htmlIcon = iconUnmute;
                classElement = 'btn-muted-inactive';
            }
            $('.icon-volumen').html(htmlIcon);
            $('.icon-volumen').removeClass('btn-muted-active btn-muted-inactive');
            $('.icon-volumen').addClass(classElement);

        },
        error: function (error) {
            console.log(error);
        }
    });
}

function MutedPc() {
    $.ajax({
        url: URL_API + 'muted',
        type: 'POST',
        data: {
            muted: true
        },
        success: function (response) {
            getMuted();
        },
        error: function (error) {
            console.log(error);
        }
    });
}

function unmutedPc() {
    $.ajax({
        url: URL_API + 'unmute',
        type: 'GET',
        data: {
            muted: false
        },
        success: function (response) {
            console.log(response);
            getMuted();
        },
        error: function (error) {
            console.log(error);
        }
    });
}

/**
 * server.get('/leerDirectorio', (req, res) => {
    let dirPath = req.query.path;
    if (dirPath === '/') {
        // Listar discos en Windows
        exec('wmic logicaldisk get name', (error, stdout, stderr) => {
            if (error) {
                console.error('Error al listar discos:', error);
                res.status(500).send('Error al listar discos');
                return;
            }
            const drives = stdout.split('\r\r\n').filter(value => /[A-Za-z]:/.test(value));
            let data = drives.map(drive => f_html('folder', drive.trim(), drive.trim() + '/')).join('');
            res.send(data);
        });
    } else if (fs.existsSync(dirPath)) {
        if (fs.statSync(dirPath).isDirectory()) {
            let data = leer_directorio(dirPath);
            res.send(data);
        } else {
            res.send('No es un directorio');
        }
    } else {
        res.send('El directorio no existe');
    }
});
 */

function readDir(path) {
    $.ajax({
        url: URL_API + 'leerDirectorio',
        type: 'GET',
        data: { path: path },
        success: function (response) {
            // console.log(response);
            $('.body-select-dir').html(response);
            //ordenar el path con / 
            $('#path-selected').val(path.replace(/\\/g, '/'));
        },
        error: function (error) {
            console.log(error);
        }
    });
}
