// ==========================================
// KLHK-SUCCESS.JS - KLHK Success Functions
// ==========================================

// Store KLHK data rows untuk copy function
let klhkDataRows = [];

// Fallback copy function untuk browsers tanpa Clipboard API
function copyToClipboard(text) {
    // Try modern Clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    }
    
    // Fallback untuk non-HTTPS atau older browsers
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

// Decode JWT payload from Base64
function decodeJWT(token) {
    try {
        if (!token) return null;
        
        // Remove spaces and newlines
        token = token.replace(/\s+/g, '');
        
        // JWT format: header.payload.signature
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }
        
        // Decode payload (second part)
        let payload = parts[1];
        
        // Add padding if needed
        const padding = 4 - (payload.length % 4);
        if (padding !== 4) {
            payload += '='.repeat(padding);
        }
        
        // Decode base64
        const decoded = atob(payload);
        
        // Parse JSON
        return JSON.parse(decoded);
    } catch (error) {
        console.error('Error decoding JWT:', error);
        return null;
    }
}

// Show view payload modal
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

// Show decoded JWT info modal
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

// Load KLHK success full
async function loadKLHKSuccess() {
    try {
        const response = await fetch('/api/data/klhk-logs');
        const data = await response.json();
        
        console.log('KLHK Success Data:', data);
        
        if (data.success && data.data) {
            // Store raw data for copy functions
            klhkDataRows = Array.isArray(data.data) ? data.data : [];
            console.log('Stored klhkDataRows:', klhkDataRows);
            
            let html = '';
            
            if (klhkDataRows.length === 0) {
                html = '<tr><td colspan="7" class="text-center text-muted">Tidak ada data KLHK success</td></tr>';
            } else {
                klhkDataRows.forEach((row, idx) => {
                    const date = formatDateCustom(row.timestamp || '');
                    const payload = row.payload || '';
                    const response = row.response || '';
                    const payloadPreview = payload ? payload.substring(0, 100) + (payload.length > 100 ? '...' : '') : '-';
                    const responsePreview = response ? response.substring(0, 100) + (response.length > 100 ? '...' : '') : '-';
                    
                    // Escape HTML in preview
                    const safePayloadPreview = payloadPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeResponsePreview = responsePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
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
            }
            
            const tableBody = document.getElementById('klhk-success-body');
            if (tableBody) {
                tableBody.innerHTML = html;
                attachButtonListeners();
            }
        } else {
            console.error('API response error:', data);
            document.getElementById('klhk-success-body').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error: Tidak ada data atau response error</td></tr>';
        }
    } catch (error) {
        console.error('Error loading KLHK success:', error);
        document.getElementById('klhk-success-body').innerHTML = '<tr><td colspan="5" class="text-center text-danger">Error loading data: ' + error.message + '</td></tr>';
    }
}


// Filter KLHK data
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
    
    try {
        const response = await fetch('/api/data/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date_from: dateFrom + ' 00:00:00',
                date_to: dateTo + ' 23:59:59'
            })
        });
        const data = await response.json();
        
        console.log('Filter result:', data);
        
        if (data.success && data.data) {
            // Store raw data for copy functions
            klhkDataRows = Array.isArray(data.data) ? data.data : [];
            console.log('Filtered klhkDataRows:', klhkDataRows);
            
            let html = '';
            if (klhkDataRows.length === 0) {
                html = '<tr><td colspan="5" class="text-center text-muted">Tidak ada data pada rentang tanggal ini</td></tr>';
            } else {
                klhkDataRows.forEach((row, idx) => {
                    const date = formatDateCustom(row.timestamp || '');
                    const payload = row.payload || '';
                    const response = row.response || '';
                    const payloadPreview = payload ? payload.substring(0, 100) + (payload.length > 100 ? '...' : '') : '-';
                    const responsePreview = response ? response.substring(0, 100) + (response.length > 100 ? '...' : '') : '-';
                    
                    // Escape HTML in preview
                    const safePayloadPreview = payloadPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeResponsePreview = responsePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
                        <td>${date}</td>
                        <td title="${payload.substring(0, 50)}"><code style="font-size: 0.85rem; word-break: break-word;">${safePayloadPreview}</code></td>
                        <td title="${response.substring(0, 50)}"><code style="font-size: 0.85rem; word-break: break-word;">${safeResponsePreview}</code></td>
                        <td>
                            <button class="btn btn-sm btn-primary view-btn" data-index="${idx}" type="button" title="View Payload">
                                <i class="fas fa-eye"></i>
                            </button> 
                            <button class="btn btn-sm btn-info info-btn" data-index="${idx}" type="button" title="View Decoded JWT">
                                <i class="fas fa-info-circle"></i>
                            </button>
                        </td>
                    </tr>`;
                });
            }
            
            const tableBody = document.getElementById('klhk-success-body');
            if (tableBody) {
                tableBody.innerHTML = html;
                attachButtonListeners();
            }
            
            Swal.fire({
                title: 'Berhasil',
                text: 'Data berhasil difilter (' + klhkDataRows.length + ' baris)',
                icon: 'success',
                timer: 2000
            });
        } else {
            Swal.fire('Error', data.error || 'Gagal memfilter data', 'error');
        }
    } catch (error) {
        console.error('Filter error:', error);
        Swal.fire('Error', 'Gagal memfilter data: ' + error.message, 'error');
    }
}

// Attach event listeners to buttons
function attachButtonListeners() {
    console.log('Attaching button listeners. Total data rows:', klhkDataRows.length);
    
    // Remove old listeners first to prevent duplicates
    document.querySelectorAll('.view-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    document.querySelectorAll('.info-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
    });
    
    // ViewPayLoad Button
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const index = parseInt(this.getAttribute('data-index'));
            console.log('View button clicked, index:', index);
            
            if (index >= 0 && index < klhkDataRows.length) {
                const payload = klhkDataRows[index]?.payload || '';
                console.log('Payload to show:', payload.substring(0, 50));
                showPayloadModal(payload);
            } else {
                console.error('Invalid index:', index);
                Swal.fire('Error', 'Data tidak ditemukan', 'error');
            }
        });
    });
    
    // Info Button
    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const index = parseInt(this.getAttribute('data-index'));
            console.log('Info button clicked, index:', index);
            
            if (index >= 0 && index < klhkDataRows.length) {
                const payload = klhkDataRows[index]?.payload || '';
                console.log('Payload to decode:', payload.substring(0, 50));
                showJWTInfoModal(payload);
            } else {
                console.error('Invalid index:', index);
                Swal.fire('Error', 'Data tidak ditemukan', 'error');
            }
        });
    });
    
    console.log('Button listeners attached successfully');
}
