// ==========================================
// PENDING-DATA.JS - Pending Data Functions
// ==========================================

let pendingCurrentPage = 1;
let pendingPageSize = 15;
let pendingTotalPages = 1;
let pendingTotalRows = 0;
let pendingFilterFrom = '';
let pendingFilterTo = '';

function renderPendingTable(data, fields) {
    if (!data || data.length === 0) {
        const colSpan = fields.length + 4;
        return `<tr><td colspan="${colSpan}" class="text-center text-muted">Tidak ada data pending</td></tr>`;
    }
    
    let html = '';
    const startNum = (pendingCurrentPage - 1) * pendingPageSize + 1;
    
    data.forEach((row, idx) => {
        const datetimeValue = getFieldValue(row, 'datetime') || getFieldValue(row, 'date');
        const tanggal = formatDateCustom(datetimeValue);
        const statusKeterangan = row.keterangan || '';
        
        html += `<tr>
            <td>${startNum + idx}</td>
            <td>${tanggal}</td>`;
        
        fields.forEach(field => {
            const value = getFieldValue(row, field);
            const formatted = formatFieldValue(value, field);
            html += `<td>${formatted}</td>`;
        });
        
        html += `<td><span class="badge badge-pending"><i class="bi bi-hourglass-split"></i> Pending</span></td>
        <td>${statusKeterangan}</td></tr>`;
    });
    
    return html;
}

function renderPendingPagination() {
    const container = document.getElementById('pending-pagination');
    if (!container) return;
    
    if (pendingTotalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-info">';
    html += `Menampilkan ${(pendingCurrentPage - 1) * pendingPageSize + 1} - ${Math.min(pendingCurrentPage * pendingPageSize, pendingTotalRows)} dari ${pendingTotalRows} data`;
    html += '</div>';
    
    html += '<div class="pagination-controls">';
    
    const prevDisabled = pendingCurrentPage <= 1 ? 'disabled' : '';
    html += `<button class="pagination-btn ${prevDisabled}" onclick="pendingGoToPage(${pendingCurrentPage - 1})" ${prevDisabled}><i class="bi bi-chevron-left"></i></button>`;
    
    const maxButtons = 5;
    let startPage = Math.max(1, pendingCurrentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(pendingTotalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="pendingGoToPage(1)">1</button>`;
        if (startPage > 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === pendingCurrentPage ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="pendingGoToPage(${p})">${p}</button>`;
    }
    
    if (endPage < pendingTotalPages) {
        if (endPage < pendingTotalPages - 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="pagination-btn" onclick="pendingGoToPage(${pendingTotalPages})">${pendingTotalPages}</button>`;
    }
    
    const nextDisabled = pendingCurrentPage >= pendingTotalPages ? 'disabled' : '';
    html += `<button class="pagination-btn ${nextDisabled}" onclick="pendingGoToPage(${pendingCurrentPage + 1})" ${nextDisabled}><i class="bi bi-chevron-right"></i></button>`;
    
    html += '</div>';
    
    container.innerHTML = html;
}

function pendingGoToPage(page) {
    if (page < 1 || page > pendingTotalPages || page === pendingCurrentPage) return;
    pendingCurrentPage = page;
    fetchPendingData();
}

async function fetchPendingData(silent) {
    const tableBody = document.getElementById('pending-data-body');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted"><div class="loading"><div class="loading-spinner"></div><p>Memuat data pending...</p></div></td></tr>';
    }
    
    try {
        let url = `/api/data/pending?page=${pendingCurrentPage}&limit=${pendingPageSize}`;
        
        if (pendingFilterFrom) {
            url += `&date_from=${encodeURIComponent(pendingFilterFrom)}`;
        }
        if (pendingFilterTo) {
            url += `&date_to=${encodeURIComponent(pendingFilterTo)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            pendingTotalRows = data.total || 0;
            pendingTotalPages = data.total_pages || 1;
            
            const fields = (data.klhk_fields || 'datetime,pH,cod,tss,nh3n,flow')
                .split(',')
                .map(f => f.trim())
                .filter(f => f && f.toLowerCase() !== 'datetime');
            
            const headerHtml = '<th>No</th><th>Tanggal</th>'
                + fields.map(f => `<th>${getFieldDisplayName(f)}</th>`).join('')
                + '<th>Status</th><th>Keterangan</th>';
            
            const table = document.getElementById('pending-data-table');
            if (table) {
                table.innerHTML = `<thead><tr>${headerHtml}</tr></thead><tbody id="pending-data-body">${renderPendingTable(data.data, fields)}</tbody>`;
            }
            
            renderPendingPagination();
        } else {
            if (!silent) {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: data.error || 'Gagal memuat data pending'
                });
            }
            document.getElementById('pending-pagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading pending data:', error);
        document.getElementById('pending-data-body').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading data</td></tr>';
        document.getElementById('pending-pagination').innerHTML = '';
        if (!silent) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Gagal memuat data pending: ' + error.message
            });
        }
    }
}

async function loadPendingData(options = {}) {
    const { notify = false } = options;
    pendingCurrentPage = 1;
    pendingFilterFrom = '';
    pendingFilterTo = '';
    await fetchPendingData(notify);
}

function convertDateTimeFormat(datetimeStr) {
    if (!datetimeStr) return null;
    
    const parts = datetimeStr.split(' ');
    if (parts.length !== 2) {
        console.warn('Invalid datetime format, expected 2 parts separated by space');
        return datetimeStr;
    }
    
    const dateParts = parts[0].split('-');
    if (dateParts.length !== 3) {
        console.warn('Invalid date format, expected 3 parts separated by dash');
        return datetimeStr;
    }
    
    const day = String(dateParts[0]).padStart(2, '0');
    const month = String(dateParts[1]).padStart(2, '0');
    const year = dateParts[2];
    
    const timeParts = parts[1].split(':');
    const hours = String(timeParts[0]).padStart(2, '0');
    const minutes = String(timeParts[1] || '0').padStart(2, '0');
    const time = `${hours}:${minutes}:00`;
    
    return `${year}-${month}-${day} ${time}`;
}

async function filterPendingData() {
    const dateFromInput = document.getElementById('filter-pending-from').value;
    const dateToInput = document.getElementById('filter-pending-to').value;
    
    if (!dateFromInput || !dateToInput) {
        Swal.fire({
            title: 'Filter Tanggal',
            text: 'Silakan pilih tanggal mulai dan akhir',
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    const dateFrom = convertDateTimeFormat(dateFromInput);
    const dateTo = convertDateTimeFormat(dateToInput);
    
    if (!dateFrom || !dateTo) {
        Swal.fire({
            title: 'Filter Tanggal',
            text: 'Format tanggal tidak valid',
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    pendingCurrentPage = 1;
    pendingFilterFrom = dateFrom;
    pendingFilterTo = dateTo;
    
    await fetchPendingData();
}

async function loadSendStatus() {
    try {
        const response = await fetch('/api/send/status');
        const data = await response.json();
        
        if (data.success) {
            const statusText = document.getElementById('send-status-text');
            const scheduleText = document.getElementById('send-schedule-text');
            const manualBtn = document.getElementById('manual-send-btn');
            
            if (data.status === 'active' && data.is_running) {
                statusText.innerHTML = '<i class="bi bi-check-circle-fill" style="color: #10b981;"></i> Pengiriman Otomatis Aktif';
                scheduleText.textContent = data.schedule || 'Setiap jam pada menit ke-0';
                manualBtn.disabled = false;
            } else if (data.status === 'active') {
                statusText.innerHTML = '<i class="bi bi-exclamation-triangle-fill" style="color: #f59e0b;"></i> Pengiriman Otomatis Aktif (Service tidak berjalan)';
                scheduleText.textContent = 'Service perlu direstart';
                manualBtn.disabled = false;
            } else {
                statusText.innerHTML = '<i class="bi bi-x-circle-fill" style="color: #ef4444;"></i> Pengiriman Otomatis Nonaktif';
                scheduleText.textContent = 'Aktifkan di halaman konfigurasi';
                manualBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error loading send status:', error);
        document.getElementById('send-status-text').innerHTML = '<i class="bi bi-exclamation-circle-fill" style="color: #ef4444;"></i> Gagal memuat status';
        document.getElementById('send-schedule-text').textContent = 'Terjadi kesalahan';
    }
}

async function reloadPendingData() {
    await loadPendingData({ notify: true });
    await loadSendStatus();
}

async function manualSendData() {
    const dateFromInput = document.getElementById('filter-pending-from').value;
    const dateToInput = document.getElementById('filter-pending-to').value;
    const hasDateRange = dateFromInput && dateToInput;
    
    let title, message, confirmText;
    
    if (!hasDateRange) {
        title = '⚠️ Kirim SEMUA Data Pending?';
        message = 'Tanggal tidak dipilih! Ini akan mengirim SEMUA data pending ke KLHK. Pastikan ini sudah benar!';
        confirmText = 'Ya, Kirim Semua';
    } else {
        title = 'Kirim Data Sesuai Range Tanggal?';
        message = `Data dari ${dateFromInput} hingga ${dateToInput} akan dikirim. Lanjutkan?`;
        confirmText = 'Ya, Kirim';
    }
    
    const result = await Swal.fire({
        title: title,
        html: message,
        icon: hasDateRange ? 'question' : 'warning',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#6b7280',
        confirmButtonText: confirmText,
        cancelButtonText: 'Batal'
    });
    
    if (!result.isConfirmed) {
        return;
    }
    
    if (!hasDateRange) {
        const extraConfirm = await Swal.fire({
            title: 'Konfirmasi Terakhir',
            html: '<p style="color: red; font-size: 14px;"><strong>Anda akan mengirim SEMUA data pending!</strong></p><p>Apakah Anda yakin?</p>',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Ya, Lanjutkan',
            cancelButtonText: 'Batalkan'
        });
        
        if (!extraConfirm.isConfirmed) {
            return;
        }
    }
    
    Swal.fire({
        title: 'Mengirim Data...',
        html: '<p>Mohon tunggu, data sedang dikirim ke KLHK</p><p style="font-size: 12px; color: #999;">Jangan tutup halaman ini</p>',
        icon: 'info',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    const payload = {
        ...(hasDateRange && {
            date_from: convertDateTimeFormat(dateFromInput),
            date_to: convertDateTimeFormat(dateToInput)
        })
    };
    
    const bodyString = JSON.stringify(payload);
    
    try {
        const response = await fetch('/api/send/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyString
        });
        
        const responseText = await response.text();
        let data = {};
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            data = { success: false, error: 'Invalid response: ' + responseText };
        }
        
        Swal.close();
        
        if (response.ok && data.success) {
            await Swal.fire({
                title: '✅ Berhasil!',
                html: `
                    <p>${data.message || 'Pengiriman manual berhasil dipicu'}</p>
                    <p style="font-size: 12px; color: #666;">Dikirim: ${data.count} data (${data.type || 'all'})</p>
                    <p style="font-size: 12px; color: #666;">Data akan diproses. Periksa log untuk detail.</p>
                `,
                icon: 'success',
                confirmButtonColor: '#4f46e5'
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            loadPendingData();
            loadSendStatus();
        } else {
            let errorMsg = data.error || 'Gagal memicu pengiriman manual';
            let errorDetail = '';
            
            if (errorMsg.includes('not active')) {
                errorDetail = '<p style="margin-top: 10px; font-size: 12px;">Module KLHK Send belum diaktifkan di konfigurasi.</p>';
            } else if (errorMsg.includes('tidak ada')) {
                errorDetail = '<p style="margin-top: 10px; font-size: 12px;">Tidak ada data untuk dikirim pada range tanggal yang dipilih.</p>';
            }
            
            await Swal.fire({
                title: '❌ Gagal',
                html: `<p>${errorMsg}</p>${errorDetail}`,
                icon: 'error',
                confirmButtonColor: '#4f46e5',
                footer: errorMsg.includes('not active') 
                    ? '<a href="#" onclick="showSection(\'config\'); return false;" style="color: #4f46e5;">Buka Halaman Konfigurasi</a>' 
                    : ''
            });
        }
    } catch (error) {
        console.error('Fetch error:', error);
        Swal.close();
        
        await Swal.fire({
            title: '❌ Network Error',
            html: `
                <p>Gagal menghubungi server:</p>
                <p style="color: red; font-size: 12px;">${error.message}</p>
                <p style="font-size: 12px; color: #999;">Periksa koneksi internet dan browser console (F12)</p>
            `,
            icon: 'error',
            confirmButtonColor: '#4f46e5'
        });
    }
}

function formatDateTimeToString(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function initDatetimePicker() {
    if (typeof $ === 'undefined' || typeof $.datetimepicker === 'undefined') {
        console.warn('jQuery DateTime Picker not loaded yet, retrying...');
        setTimeout(initDatetimePicker, 200);
        return;
    }
    
    setTimeout(function() {
        const elements = document.querySelectorAll('.datepicker-datetime:not([data-datetimepicker-initialized])');
        
        if (elements.length > 0) {
            try {
                $.datetimepicker.setLocale('id');
                
                $(elements).datetimepicker({
                    format: 'd-m-Y H:i',
                    formatTime: 'H:i',
                    formatDate: 'd-m-Y',
                    step: 1,
                    defaultTime: '00:00',
                    defaultDate: new Date(),
                    timepicker: true,
                    datepicker: true,
                    lang: 'id',
                    closeOnDateSelect: false,
                    onChangeDateTime: function(dp, $input) {
                        const value = $input.val();
                        if (value) {
                            const parts = value.split(' ');
                            if (parts.length === 2) {
                                const dateParts = parts[0].split('-');
                                if (dateParts.length === 3) {
                                    const day = String(dateParts[0]).padStart(2, '0');
                                    const month = String(dateParts[1]).padStart(2, '0');
                                    const year = dateParts[2];
                                    const timeParts = parts[1].split(':');
                                    const hours = String(timeParts[0]).padStart(2, '0');
                                    const minutes = String(timeParts[1] || '0').padStart(2, '0');
                                    $input.val(`${day}-${month}-${year} ${hours}:${minutes}`);
                                }
                            }
                        }
                    }
                });
                
                elements.forEach(el => {
                    el.setAttribute('data-datetimepicker-initialized', 'true');
                });
                
                console.log(`Initialized ${elements.length} datepicker(s)`);
            } catch (error) {
                console.error('Error initializing datepicker:', error);
            }
        } else {
            console.warn('No datepicker elements found');
        }
    }, 50);
}

if (typeof window.initPendingDataSection === 'undefined') {
    window.initPendingDataSection = function() {
        loadPendingData();
        loadSendStatus();
        initDatetimePicker();
    };
}
