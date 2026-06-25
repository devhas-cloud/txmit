// ==========================================
// KLHK-SUCCESS.JS - KLHK Success Functions
// ==========================================

let klhkDataRows = [];
let klhkCurrentPage = 1;
let klhkPageSize = 15;
let klhkTotalPages = 1;
let klhkTotalRows = 0;
let klhkFilterFrom = '';
let klhkFilterTo = '';

function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    
    return new Promise((resolve, reject) => {
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            textarea.style.pointerEvents = 'none';
            document.body.appendChild(textarea);
            
            textarea.select();
            textarea.setSelectionRange(0, 99999);
            
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            
            if (successful) {
                resolve();
            } else {
                reject(new Error('execCommand copy failed'));
            }
        } catch (err) {
            reject(err);
        }
    });
}

function decodeJWT(token) {
    try {
        if (!token) return null;
        
        token = token.replace(/\s+/g, '');
        
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        
        let payload = parts[1];
        
        const padding = 4 - (payload.length % 4);
        if (padding !== 4) {
            payload += '='.repeat(padding);
        }
        
        const decoded = atob(payload);
        
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

function showPayloadModal(payload) {
    const displayPayload = payload || 'No payload';
    
    Swal.fire({
        title: 'Encrypted Payload',
        html: `
            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                <code style="font-size: 0.75rem; word-break: break-all; display: block; padding: 10px; background: #f4f4f4; border-radius: 4px;">
                    ${displayPayload.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </code>
            </div>
        `,
        width: '90%',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-copy"></i> Copy Payload',
        cancelButtonText: 'Close',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280'
    }).then((result) => {
        if (result.isConfirmed) {
            copyToClipboard(displayPayload).then(() => {
                Swal.fire({
                    title: 'Berhasil!',
                    text: 'Payload berhasil dicopy ke clipboard',
                    icon: 'success',
                    timer: 1500
                });
            }).catch((err) => {
                console.error('Copy error:', err);
                Swal.fire({
                    title: 'Error',
                    text: 'Gagal menyalin payload ke clipboard: ' + err.message,
                    icon: 'error',
                    timer: 1500
                });
            });
        }
    });
}

function showJWTInfoModal(payload) {
    const decoded = decodeJWT(payload);
    
    if (!decoded) {
        Swal.fire({
            title: 'Error',
            text: 'Gagal decode JWT payload',
            icon: 'error'
        });
        return;
    }
    
    const jsonString = JSON.stringify(decoded, null, 2);
    
    Swal.fire({
        title: 'JWT Payload (Decoded)',
        html: `
            <div style="text-align: left; max-height: 400px; overflow-y: auto;">
                <pre style="font-size: 0.75rem; word-break: break-word; padding: 10px; background: #f4f4f4; border-radius: 4px; text-align: left;">${jsonString.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </div>
        `,
        width: '90%',
        showCancelButton: true,
        confirmButtonText: '<i class="fas fa-copy"></i> Copy JSON',
        cancelButtonText: 'Close',
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280'
    }).then((result) => {
        if (result.isConfirmed) {
            copyToClipboard(jsonString).then(() => {
                Swal.fire({
                    title: 'Berhasil!',
                    text: 'JSON berhasil dicopy ke clipboard',
                    icon: 'success',
                    timer: 1500
                });
            }).catch((err) => {
                console.error('Copy error:', err);
                Swal.fire({
                    title: 'Error',
                    text: 'Gagal menyalin JSON ke clipboard: ' + err.message,
                    icon: 'error',
                    timer: 1500
                });
            });
        }
    });
}

function renderKLHKTable(data) {
    if (!data || data.length === 0) {
        return '<tr><td colspan="8" class="text-center text-muted">Tidak ada data KLHK success</td></tr>';
    }
    
    let html = '';
    const startNum = (klhkCurrentPage - 1) * klhkPageSize + 1;
    
    data.forEach((row, idx) => {
        const date = formatDateCustom(row.timestamp || '');
        const payload = row.payload || '';
        const response = row.response || '';
        const payloadPreview = payload ? payload.substring(0, 100) + (payload.length > 100 ? '...' : '') : '-';
        const responsePreview = response ? response.substring(0, 100) + (response.length > 100 ? '...' : '') : '-';
        const category = (row.category || '-').toUpperCase();
        const safePayloadPreview = payloadPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const safeResponsePreview = responsePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        html += `<tr>
            <td>${startNum + idx}</td>
            <td>${category}</td>
            <td>${date}</td>
            <td>${row.date_send || ''}</td>
            <td>${row.row_send || ''}</td>
            <td title="${payload.substring(0, 50)}"><code style="font-size: 0.85rem; word-break: break-word;">${safePayloadPreview}</code></td>
            <td title="${response.substring(0, 50)}"><code style="font-size: 0.85rem; word-break: break-word;">${safeResponsePreview}</code></td>
            <td>
                <button class="btn btn-sm btn-primary view-btn" data-index="${idx}" type="button" title="View Payload">
                    <i class="bi bi-eye"></i>
                </button> 
                <button class="btn btn-sm btn-info info-btn" data-index="${idx}" type="button" title="View Decoded JWT">
                    <i class="bi bi-info-circle"></i>
                </button>
            </td>
        </tr>`;
    });
    
    return html;
}

function renderKLHKPagination() {
    const container = document.getElementById('klhk-pagination');
    if (!container) return;
    
    if (klhkTotalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-info">';
    html += `Menampilkan ${(klhkCurrentPage - 1) * klhkPageSize + 1} - ${Math.min(klhkCurrentPage * klhkPageSize, klhkTotalRows)} dari ${klhkTotalRows} data`;
    html += '</div>';
    
    html += '<div class="pagination-controls">';
    
    const prevDisabled = klhkCurrentPage <= 1 ? 'disabled' : '';
    html += `<button class="pagination-btn ${prevDisabled}" onclick="klhkGoToPage(${klhkCurrentPage - 1})" ${prevDisabled}><i class="bi bi-chevron-left"></i></button>`;
    
    const maxButtons = 5;
    let startPage = Math.max(1, klhkCurrentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(klhkTotalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="klhkGoToPage(1)">1</button>`;
        if (startPage > 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === klhkCurrentPage ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="klhkGoToPage(${p})">${p}</button>`;
    }
    
    if (endPage < klhkTotalPages) {
        if (endPage < klhkTotalPages - 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="pagination-btn" onclick="klhkGoToPage(${klhkTotalPages})">${klhkTotalPages}</button>`;
    }
    
    const nextDisabled = klhkCurrentPage >= klhkTotalPages ? 'disabled' : '';
    html += `<button class="pagination-btn ${nextDisabled}" onclick="klhkGoToPage(${klhkCurrentPage + 1})" ${nextDisabled}><i class="bi bi-chevron-right"></i></button>`;
    
    html += '</div>';
    
    container.innerHTML = html;
}

function klhkGoToPage(page) {
    if (page < 1 || page > klhkTotalPages || page === klhkCurrentPage) return;
    klhkCurrentPage = page;
    fetchKLHKData();
}

async function fetchKLHKData(silent) {
    const tableBody = document.getElementById('klhk-success-body');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted"><div class="loading"><div class="loading-spinner"></div><p>Memuat data KLHK...</p></div></td></tr>';
    }
    
    try {
        let url = `/api/data/klhk-logs?page=${klhkCurrentPage}&limit=${klhkPageSize}`;
        
        if (klhkFilterFrom) {
            url += `&date_from=${encodeURIComponent(klhkFilterFrom)}`;
        }
        if (klhkFilterTo) {
            url += `&date_to=${encodeURIComponent(klhkFilterTo)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            klhkDataRows = Array.isArray(data.data) ? data.data : [];
            klhkTotalRows = data.total || 0;
            klhkTotalPages = data.total_pages || 1;
            
            const tableBody = document.getElementById('klhk-success-body');
            if (tableBody) {
                tableBody.innerHTML = renderKLHKTable(klhkDataRows);
                attachButtonListeners();
            }
            
            renderKLHKPagination();
        } else {
            if (!silent) {
                document.getElementById('klhk-success-body').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error: ' + (data.error || 'Tidak ada data atau response error') + '</td></tr>';
                document.getElementById('klhk-pagination').innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Error loading KLHK success:', error);
        if (!silent) {
            document.getElementById('klhk-success-body').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading data: ' + error.message + '</td></tr>';
            document.getElementById('klhk-pagination').innerHTML = '';
        }
    }
}

async function loadKLHKSuccess() {
    klhkCurrentPage = 1;
    await fetchKLHKData();
}

async function filterKLHKData() {
    const dateFrom = document.getElementById('filter-klhk-from').value;
    const dateTo = document.getElementById('filter-klhk-to').value;
    
    if (!dateFrom || !dateTo) {
        Swal.fire({
            title: 'Filter Tanggal',
            text: 'Silakan pilih tanggal mulai dan akhir',
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    if (dateFrom > dateTo) {
        Swal.fire({
            title: 'Filter Tanggal',
            text: 'Tanggal mulai tidak boleh lebih besar dari tanggal akhir',
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    klhkFilterFrom = dateFrom + ' 00:00:00';
    klhkFilterTo = dateTo + ' 23:59:59';
    klhkCurrentPage = 1;
    
    await fetchKLHKData();
}

function attachButtonListeners() {
    document.querySelectorAll('.view-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    document.querySelectorAll('.info-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const index = parseInt(this.getAttribute('data-index'));
            
            if (index >= 0 && index < klhkDataRows.length) {
                const payload = klhkDataRows[index]?.payload || '';
                showPayloadModal(payload);
            } else {
                Swal.fire('Error', 'Data tidak ditemukan', 'error');
            }
        });
    });
    
    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const index = parseInt(this.getAttribute('data-index'));
            
            if (index >= 0 && index < klhkDataRows.length) {
                const payload = klhkDataRows[index]?.payload || '';
                showJWTInfoModal(payload);
            } else {
                Swal.fire('Error', 'Data tidak ditemukan', 'error');
            }
        });
    });
}
