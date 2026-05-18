$(document).ready(function () {
    const $modal = $('#modal-transfer');
    const $body = $('#transfer-body');
    const $pathInput = $('#transfer-current-path');
    const $fileInput = $('#transfer-file-input');

    let currentPath = '/';
    let parentPath = null;
    let selectedPath = '/';
    let selectedType = 'folder';

    function normalizeSlashes(value) {
        return (value || '').toString().replace(/\\/g, '/');
    }

    function getParentPathFromFile(filePath) {
        const normalized = normalizeSlashes(filePath).replace(/\/+$/, '');
        if (!normalized || normalized === '/') {
            return '/';
        }

        const lastSlash = normalized.lastIndexOf('/');
        if (lastSlash < 0) {
            return '/';
        }

        const parent = normalized.slice(0, lastSlash);
        if (!parent) {
            return '/';
        }

        if (/^[A-Za-z]:$/.test(parent)) {
            return `${parent}/`;
        }

        return parent;
    }

    function updatePathBox() {
        $pathInput.val(normalizeSlashes(selectedPath || currentPath || '/'));
    }

    function getItemIcon(type) {
        if (type === 'folder') {
            return 'bi-folder-fill';
        }
        return 'bi-file-earmark-text';
    }

    function triggerFileDownload(filePath) {
        const url = URL_API + 'descargarArchivo?path=' + encodeURIComponent(filePath);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = '';
        anchor.style.display = 'none';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }

    function renderTransferEntries(entries) {
        if (!Array.isArray(entries) || !entries.length) {
            $body.html('<div class="transfer-empty">No hay elementos en esta ubicación.</div>');
            return;
        }

        const html = entries.map((entry) => {
            const type = entry.type === 'folder' ? 'folder' : 'file';
            const showMenu = type === 'file';
            return `
                <div class="transfer-item" data-type="${type}" data-path="${entry.path}">
                    <div class="transfer-item-main">
                        <i class="bi ${getItemIcon(type)}"></i>
                        <span class="transfer-item-name">${entry.name}</span>
                    </div>
                    ${showMenu ? `
                    <div class="transfer-item-actions">
                        <button class="transfer-menu-btn" data-path="${entry.path}" title="Opciones">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <div class="transfer-menu" data-path="${entry.path}">
                            <button class="transfer-download-btn" data-path="${entry.path}">Descargar</button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        $body.html(html);
    }

    function loadTransferDirectory(pathValue) {
        const queryPath = pathValue || '/';

        $.ajax({
            url: URL_API + 'leerDirectorioTransfer',
            type: 'GET',
            dataType: 'json',
            data: { path: queryPath },
            success: function (response) {
                currentPath = response.currentPath || '/';
                parentPath = response.parentPath || null;
                selectedPath = currentPath;
                selectedType = 'folder';
                updatePathBox();
                renderTransferEntries(response.entries || []);
            },
            error: function (error) {
                console.log(error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'No se pudo leer el directorio seleccionado.'
                });
            }
        });
    }

    function openTransferModal() {
        $modal.addClass('active');
        loadTransferDirectory('/');
    }

    function closeTransferModal() {
        $modal.removeClass('active');
        $fileInput.val('');
        $body.empty();
        currentPath = '/';
        parentPath = null;
        selectedPath = '/';
        selectedType = 'folder';
        updatePathBox();
    }

    function getDestinationPath() {
        if (selectedType === 'file') {
            return getParentPathFromFile(selectedPath);
        }

        return selectedPath || currentPath;
    }

    async function uploadFiles(files, destinationPath) {
        let successCount = 0;
        let failCount = 0;

        for (const file of files) {
            const formData = new FormData();
            formData.append('archivo', file);
            formData.append('path', destinationPath);

            try {
                await $.ajax({
                    url: URL_API + 'transferirArchivo',
                    type: 'POST',
                    data: formData,
                    contentType: false,
                    processData: false
                });
                successCount += 1;
            } catch (error) {
                console.log(error);
                failCount += 1;
            }
        }

        return { successCount, failCount };
    }

    $(document).on('click', '#app-transferir-archivos', function () {
        openTransferModal();
    });

    $(document).on('click', '#transfer-close, #transfer-cancel', function () {
        closeTransferModal();
    });

    $(document).on('click', '#transfer-back', function () {
        if (!parentPath) {
            loadTransferDirectory('/');
            return;
        }

        loadTransferDirectory(parentPath);
    });

    $(document).on('click', '.transfer-item', function (event) {
        if ($(event.target).closest('.transfer-item-actions').length) {
            return;
        }

        const itemPath = $(this).data('path');
        const itemType = $(this).data('type');
        selectedPath = itemPath;
        selectedType = itemType;
        updatePathBox();

        if (itemType === 'folder') {
            loadTransferDirectory(itemPath);
        }
    });

    $(document).on('click', '.transfer-menu-btn', function (event) {
        event.stopPropagation();
        const $menu = $(this).closest('.transfer-item-actions').find('.transfer-menu');

        $('.transfer-menu').not($menu).removeClass('active');
        $menu.toggleClass('active');
    });

    $(document).on('click', function (event) {
        if (!$(event.target).closest('.transfer-item-actions').length) {
            $('.transfer-menu').removeClass('active');
        }
    });

    $(document).on('click', '.transfer-download-btn', function (event) {
        event.stopPropagation();
        const filePath = $(this).data('path');
        if (!filePath) {
            return;
        }
        triggerFileDownload(filePath);
        $('.transfer-menu').removeClass('active');
    });

    $(document).on('click', '#transfer-select-files', function () {
        const destinationPath = getDestinationPath();
        if (!destinationPath || destinationPath === '/') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Selecciona primero una carpeta de destino.'
            });
            return;
        }

        $fileInput.trigger('click');
    });

    $(document).on('change', '#transfer-file-input', async function () {
        const files = Array.from(this.files || []);
        if (!files.length) {
            return;
        }

        const destinationPath = getDestinationPath();
        if (!destinationPath || destinationPath === '/') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Selecciona una carpeta válida para transferir.'
            });
            return;
        }

        $('.loadding').addClass('active');
        const result = await uploadFiles(files, destinationPath);
        $('.loadding').removeClass('active');

        if (result.failCount === 0) {
            Swal.fire({
                icon: 'success',
                title: 'Transferencia completada',
                text: `Se transfirieron ${result.successCount} archivo(s) correctamente.`
            });
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Transferencia parcial',
                text: `Éxito: ${result.successCount} | Error: ${result.failCount}`
            });
        }

        $fileInput.val('');
        loadTransferDirectory(currentPath);
    });
});
