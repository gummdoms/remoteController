$(document).ready(function () {
    $(document).on('click', '.minimize-window', function () {
        ipcRenderer.send('minimizeApp');
    });
    $(document).on('click', '.maximize-window', function () {
        ipcRenderer.send('toggleMaximize');
    });
    $(document).on('click', '.close-window', function () {
        ipcRenderer.send('closeApp');
    });
    $(document).on('click', '.exitApp', function () {
        Swal.fire({
            title: '¿Estás seguro?',
            text: "¿Quieres cerrar la aplicación?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: 'Salir'
        }).then((result) => {
            if (result.isConfirmed) {
                ipcRenderer.send('exitApp');
            }
        });
    });
    ipcRenderer.on('reproducirSonido', (event, arg) => {
        let audioElement = document.getElementById('audio');
        audioElement.play();
    });
});
