// ==========================================
// RETRY-DATA.JS - Retry Data Functions
// ==========================================

let retryCurrentPage = 1;
let retryPageSize = 15;
let retryTotalPages = 1;
let retryTotalRows = 0;
let retryFilterFrom = '';
let retryFilterTo = '';

function renderRetryTable(data, fields) {
    if (!data || data.length === 0) {
        const colSpan = fields.length + 4;
        return `<tr><td colspan="${colSpan}" class="text-center text-muted">Tidak ada data retry</td></tr>`;
    }
    
    let html = '';
    const startNum = (retryCurrentPage - 1) * retryPageSize + 1;
    
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
        
        html += `<td><span class="badge badge-pending"><i class="bi bi-arrow-repeat"></i> Retry</span></td>
        <td>${statusKeterangan}</td></tr>`;
    });
    
    return html;
}

function renderRetryPagination() {
    const container = document.getElementById('retry-pagination');
    if (!container) return;
    
    if (retryTotalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-info">';
    html += `Menampilkan ${(retryCurrentPage - 1) * retryPageSize + 1} - ${Math.min(retryCurrentPage * retryPageSize, retryTotalRows)} dari ${retryTotalRows} data`;
    html += '</div>';
    
    html += '<div class="pagination-controls">';
    
    const prevDisabled = retryCurrentPage <= 1 ? 'disabled' : '';
    html += `<button class="pagination-btn ${prevDisabled}" onclick="retryGoToPage(${retryCurrentPage - 1})" ${prevDisabled}><i class="bi bi-chevron-left"></i></button>`;
    
    const maxButtons = 5;
    let startPage = Math.max(1, retryCurrentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(retryTotalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="retryGoToPage(1)">1</button>`;
        if (startPage > 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === retryCurrentPage ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="retryGoToPage(${p})">${p}</button>`;
    }
    
    if (endPage < retryTotalPages) {
        if (endPage < retryTotalPages - 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="pagination-btn" onclick="retryGoToPage(${retryTotalPages})">${retryTotalPages}</button>`;
    }
    
    const nextDisabled = retryCurrentPage >= retryTotalPages ? 'disabled' : '';
    html += `<button class="pagination-btn ${nextDisabled}" onclick="retryGoToPage(${retryCurrentPage + 1})" ${nextDisabled}><i class="bi bi-chevron-right"></i></button>`;
    
    html += '</div>';
    
    container.innerHTML = html;
}

function retryGoToPage(page) {
    if (page < 1 || page > retryTotalPages || page === retryCurrentPage) return;
    retryCurrentPage = page;
    fetchRetryData();
}

async function fetchRetryData(silent) {
    const tableBody = document.getElementById('retry-data-body');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted"><div class="loading"><div class="loading-spinner"></div><p>Memuat data pengiriman ulang...</p></div></td></tr>';
    }
    
    try {
        let url = `/api/data/retry?page=${retryCurrentPage}&limit=${retryPageSize}`;
        
        if (retryFilterFrom) {
            url += `&date_from=${encodeURIComponent(retryFilterFrom)}`;
        }
        if (retryFilterTo) {
            url += `&date_to=${encodeURIComponent(retryFilterTo)}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            retryTotalRows = data.total || 0;
            retryTotalPages = data.total_pages || 1;
            
            const fields = (data.klhk_fields || 'datetime,pH,cod,tss,nh3n,flow')
                .split(',')
                .map(f => f.trim())
                .filter(f => f && f.toLowerCase() !== 'datetime');
            
            const headerHtml = '<th>No</th><th>Tanggal</th>'
                + fields.map(f => `<th>${getFieldDisplayName(f)}</th>`).join('')
                + '<th>Status</th><th>Keterangan</th>';
            
            const table = document.getElementById('retry-data-table');
            if (table) {
                table.innerHTML = `<thead><tr>${headerHtml}</tr></thead><tbody id="retry-data-body">${renderRetryTable(data.data, fields)}</tbody>`;
            }
            
            renderRetryPagination();
            
            if (!silent) {
                Swal.fire({
                    title: 'Berhasil',
                    text: 'Data pengiriman ulang berhasil dimuat' + (retryFilterFrom ? '' : ''),
                    icon: 'success',
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true
                });
            }
        } else {
            if (!silent) {
                Swal.fire({
                    icon: 'error',
                    title: 'Gagal',
                    text: data.error || 'Gagal memuat data pengiriman ulang'
                });
            }
            document.getElementById('retry-pagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Error loading retry data:', error);
        document.getElementById('retry-data-body').innerHTML = '<tr><td colspan="8" class="text-center text-danger">Error loading data</td></tr>';
        document.getElementById('retry-pagination').innerHTML = '';
        if (!silent) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Gagal memuat data pengiriman ulang: ' + error.message
            });
        }
    }
}

async function loadRetryData(options = {}) {
    const { notify = false } = options;
    retryCurrentPage = 1;
    retryFilterFrom = '';
    retryFilterTo = '';
    await fetchRetryData(notify);
}

function convertDateTimeFormatRetry(datetimeStr) {
    if (!datetimeStr) return null;
    const parts = datetimeStr.split(' ');
    if (parts.length !== 2) return datetimeStr;
    const dateParts = parts[0].split('-');
    if (dateParts.length !== 3) return datetimeStr;
    const day = String(dateParts[0]).padStart(2, '0');
    const month = String(dateParts[1]).padStart(2, '0');
    const year = dateParts[2];
    const timeParts = parts[1].split(':');
    const hours = String(timeParts[0]).padStart(2, '0');
    const minutes = String(timeParts[1] || '0').padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
}

async function filterRetryData() {
    const dateFromInput = document.getElementById('filter-retry-from').value;
    const dateToInput = document.getElementById('filter-retry-to').value;
    
    if (!dateFromInput || !dateToInput) {
        Swal.fire({
            title: 'Filter Tanggal',
            text: 'Silakan pilih tanggal mulai dan akhir',
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    const dateFrom = convertDateTimeFormatRetry(dateFromInput);
    const dateTo = convertDateTimeFormatRetry(dateToInput);
    
    if (!dateFrom || !dateTo) {
        Swal.fire({
            title: 'Filter Tanggal',
            text: 'Format tanggal tidak valid',
            icon: 'warning',
            confirmButtonColor: '#4f46e5'
        });
        return;
    }
    
    retryCurrentPage = 1;
    retryFilterFrom = dateFrom;
    retryFilterTo = dateTo;
    
    await fetchRetryData();
}

async function loadRetryStatus() {
    try {
        const response = await fetch('/api/retry/status');
        const data = await response.json();
        
        if (data.success) {
            const statusText = document.getElementById('retry-status-text');
            const scheduleText = document.getElementById('retry-schedule-text');
            const manualBtn = document.getElementById('manual-retry-btn');
            
            if (data.status === 'active' && data.is_running) {
                statusText.innerHTML = '<i class="bi bi-check-circle-fill" style="color: #10b981;"></i> Pengiriman Ulang Otomatis Aktif';
                scheduleText.textContent = data.schedule || 'Setiap jam pada menit ke-10';
                manualBtn.disabled = false;
            } else if (data.status === 'active') {
                statusText.innerHTML = '<i class="bi bi-exclamation-triangle-fill" style="color: #f59e0b;"></i> Pengiriman Ulang Otomatis Aktif (Service tidak berjalan)';
                scheduleText.textContent = 'Service perlu direstart';
                manualBtn.disabled = false;
            } else {
                statusText.innerHTML = '<i class="bi bi-x-circle-fill" style="color: #ef4444;"></i> Pengiriman Ulang Otomatis Nonaktif';
                scheduleText.textContent = 'Aktifkan di halaman konfigurasi';
                manualBtn.disabled = true;
            }
        }
    } catch (error) {
        console.error('Error loading retry status:', error);
        document.getElementById('retry-status-text').innerHTML = '<i class="bi bi-exclamation-circle-fill" style="color: #ef4444;"></i> Gagal memuat status';
        document.getElementById('retry-schedule-text').textContent = 'Terjadi kesalahan';
    }
}

async function reloadRetryData() {
    await loadRetryData({ notify: true });
    await loadRetryStatus();
}

async function manualRetryData() {
    const dateFromInput = document.getElementById('filter-retry-from').value;
    const dateToInput = document.getElementById('filter-retry-to').value;
    const hasDateRange = dateFromInput && dateToInput;
    
    let title, message, confirmText;
    if (!hasDateRange) {
        title = '⚠️ Kirim Ulang SEMUA Data Retry?';
        message = 'Tanggal tidak dipilih! Ini akan mengirim SEMUA data retry ke KLHK. Pastikan ini sudah benar!';
        confirmText = 'Ya, Kirim Semua';
    } else {
        title = 'Kirim Ulang Data Sesuai Range Tanggal?';
        message = `Data dari ${dateFromInput} hingga ${dateToInput} akan dikirim ulang. Lanjutkan?`;
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
    
    if (!result.isConfirmed) return;
    
    if (!hasDateRange) {
        const extraConfirm = await Swal.fire({
            title: 'Konfirmasi Terakhir',
            html: '<p style="color: red; font-size: 14px;"><strong>Anda akan mengirim ulang SEMUA data retry!</strong></p><p>Apakah Anda yakin?</p>',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Ya, Lanjutkan',
            cancelButtonText: 'Batalkan'
        });
        if (!extraConfirm.isConfirmed) return;
    }
    
    Swal.fire({
        title: 'Mengirim Ulang Data...',
        html: '<p>Mohon tunggu, data sedang dikirim ulang ke KLHK</p><p style="font-size: 12px; color: #999;">Jangan tutup halaman ini</p>',
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
            date_from: convertDateTimeFormatRetry(dateFromInput),
            date_to: convertDateTimeFormatRetry(dateToInput)
        })
    };
    
    const bodyString = JSON.stringify(payload);
    
    try {
        const response = await fetch('/api/retry/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyString
        });
        
        const responseText = await response.text();
        let data = {};
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            data = { success: false, error: 'Invalid response' };
        }
        
        Swal.close();
        
        if (response.ok && data.success) {
            await Swal.fire({
                title: '✅ Berhasil!',
                html: `
                    <p>${data.message || 'Pengiriman ulang manual berhasil dipicu'}</p>
                    <p style="font-size: 12px; color: #666;">Dikirim: ${data.count} data (${data.type || 'all'})</p>
                    <p style="font-size: 12px; color: #666;">Data akan diproses. Periksa log untuk detail.</p>
                `,
                icon: 'success',
                confirmButtonColor: '#4f46e5'
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            loadRetryData();
            loadRetryStatus();
        } else {
            let errorMsg = data.error || 'Gagal memicu pengiriman ulang manual';
            let errorDetail = '';
            
            if (errorMsg.includes('not active')) {
                errorDetail = '<p style="margin-top: 10px; font-size: 12px;">Module KLHK Retry belum diaktifkan di konfigurasi.</p>';
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
            html: `<p>Gagal menghubungi server:</p><p style="color: red; font-size: 12px;">${error.message}</p>`,
            icon: 'error',
            confirmButtonColor: '#4f46e5'
        });
    }
}

function initRetryDatetimePicker() {
    if (typeof $ === 'undefined' || typeof $.datetimepicker === 'undefined') {
        console.warn('[Retry] jQuery DateTime Picker not loaded, retrying in 200ms...');
        setTimeout(initRetryDatetimePicker, 200);
        return;
    }
    
    const filterRetryFrom = document.getElementById('filter-retry-from');
    const filterRetryTo = document.getElementById('filter-retry-to');
    
    if (!filterRetryFrom || !filterRetryTo) {
        console.warn('[Retry] Filter elements not found, retrying...');
        setTimeout(initRetryDatetimePicker, 200);
        return;
    }
    
    try {
        $.datetimepicker.setLocale('id');
        
        $('#filter-retry-from').datetimepicker('destroy');
        $('#filter-retry-to').datetimepicker('destroy');
        
        $('#filter-retry-from, #filter-retry-to').datetimepicker({
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
            onChangeDateTime: (dp, $input) => {
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
                            const hours = String(timeParts[0] || '0').padStart(2, '0');
                            const minutes = String(timeParts[1] || '0').padStart(2, '0');
                            $input.val(`${day}-${month}-${year} ${hours}:${minutes}`);
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('[Retry] Error initializing datepicker:', error);
    }
}

if (typeof window.initRetryDataSection === 'undefined') {
    window.initRetryDataSection = function() {
        initRetryDatetimePicker();
        loadRetryData();
        loadRetryStatus();
    };
}
