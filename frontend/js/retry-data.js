// ==========================================
// RETRY-DATA.JS - Retry Data Functions
// ==========================================

// Load retry data full
async function loadRetryData(options = {}) {
    const { notify = false } = options;
    try {
        const response = await fetch('/api/data/retry');
        const data = await response.json();
        
        if (data.success) {
            const fields = (data.klhk_fields || 'datetime,pH,cod,tss,nh3n,flow')
                .split(',')
                .map(f => f.trim())
                .filter(f => f && f.toLowerCase() !== 'datetime');
            
            let html = '';
            let headerHtml = '<th>No</th><th>Tanggal</th>';
            
            // Build dynamic headers (exclude datetime since we have Tanggal column)
            fields.forEach(field => {
                headerHtml += `<th>${getFieldDisplayName(field)}</th>`;
            });
            headerHtml += '<th>Status</th>';
            headerHtml += '<th>Keterangan</th>';
            
            if (data.data.length === 0) {
                const colSpan = fields.length + 4;
                html = `<tr><td colspan="${colSpan}" class="text-center text-muted">Tidak ada data retry</td></tr>`;
            } else {
                data.data.forEach((row, idx) => {
                    const datetimeValue = getFieldValue(row, 'datetime') || getFieldValue(row, 'date');
                    const tanggal = formatDateCustom(datetimeValue);
                    const statusKeterangan = row.keterangan || '';
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
                        <td>${tanggal}</td>`;
                    
                    fields.forEach(field => {
                        const value = getFieldValue(row, field);
                        const formatted = formatFieldValue(value, field);
                        html += `<td>${formatted}</td>`;
                        
                    });
                    
                    html += `<td><span class="badge badge-pending"><i class="bi bi-arrow-repeat"></i> Retry </span></td>
                    <td>${statusKeterangan}</td></tr>`;
                });
            }
            
            // Update the table header and body
            const table = document.getElementById('retry-data-table');
            table.innerHTML = `
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>${html}</tbody>
            `;
            if (notify) {
                Swal.fire({
                    title: 'Berhasil',
                    text: 'Data pengiriman ulang berhasil dimuat',
                    icon: 'success',
                    showConfirmButton: false,
                    timer: 1500,
                    timerProgressBar: true
                });
            }
        } else if (notify) {
            Swal.fire({
                icon: 'error',
                title: 'Gagal',
                text: data.error || 'Gagal memuat data pengiriman ulang'
            });
        }
    } catch (error) {
        console.error('Error loading retry data:', error);
        const colSpan = 8;
        document.getElementById('retry-data-body').innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-danger">Error loading data</td></tr>`;
        if (notify) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Gagal memuat data pengiriman ulang: ' + error.message
            });
        }
    }
}

// Helper function to convert DD-MM-YYYY HH:MM to YYYY-MM-DD HH:MM:SS
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

// Filter retry data
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
    
    try {
        const response = await fetch('/api/retry/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date_from: dateFrom,
                date_to: dateTo
            })
        });
        const data = await response.json();
        
        if (data.success) {
            // Get fields from response or use defaults
            const fields = (data.klhk_fields || 'datetime,pH,cod,tss,nh3n,flow')
                .split(',')
                .map(f => f.trim())
                .filter(f => f && f.toLowerCase() !== 'datetime');
            
            // Render filtered data
            let html = '';
            let headerHtml = '<th>No</th><th>Tanggal</th>';
            
            // Build dynamic headers
            fields.forEach(field => {
                headerHtml += `<th>${getFieldDisplayName(field)}</th>`;
            });
            headerHtml += '<th>Status</th>';
            headerHtml += '<th>Keterangan</th>';
            
            if (data.data.length === 0) {
                const colSpan = fields.length + 4;
                html = '<tr><td colspan="' + colSpan + '" class="text-center text-muted">Tidak ada data pada rentang tanggal ini</td></tr>';
            } else {
                data.data.forEach((row, idx) => {
                    const datetimeValue = getFieldValue(row, 'datetime') || getFieldValue(row, 'date');
                    const tanggal = formatDateCustom(datetimeValue);
                    const statusKeterangan = row.keterangan || '';
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
                        <td>${tanggal}</td>`;
                    
                    fields.forEach(field => {
                        const value = getFieldValue(row, field);
                        const formatted = formatFieldValue(value, field);
                        html += `<td>${formatted}</td>`;
                    });
                    
                    html += `<td><span class="badge badge-pending"><i class="bi bi-arrow-repeat"></i> Retry</span></td>
                    <td>${statusKeterangan}</td></tr>`;
                });
            }
            
            // Update table headers and body
            const table = document.getElementById('retry-data-table');
            table.innerHTML = `
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody id="retry-data-body">${html}</tbody>
            `;
            
            Swal.fire({
                title: 'Berhasil',
                text: 'Data pengiriman ulang berhasil difilter',
                icon: 'success',
                timer: 2000
            });
        } else {
            Swal.fire('Error', data.error || 'Gagal memfilter data pengiriman ulang', 'error');
        }
    } catch (error) {
        console.error('Filter error:', error);
        
        Swal.fire({
            title: 'Error Filter',
            html: `
                <p>Terjadi kesalahan saat memfilter data:</p>
                <p style="color: red; font-size: 12px;">${error.message}</p>
                <p style="font-size: 12px;">Silakan periksa browser console (F12) untuk detail error.</p>
            `,
            icon: 'error',
            confirmButtonColor: '#4f46e5'
        });
    }
}

// Load retry status
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

// Reload retry data
async function reloadRetryData() {
    await loadRetryData({ notify: true });
    await loadRetryStatus();
}

// Manual retry data
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
    
    console.log('Manual retry payload:', payload);
    const bodyString = JSON.stringify(payload);
    console.log('Manual retry body string:', bodyString);
    
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
            
            // Reload data after dialog closes
            await new Promise(resolve => setTimeout(resolve, 1000));
            loadRetryData();
            loadRetryStatus();
        } else {
            // Error response
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

// Initialize datetime picker for retry filter
function initRetryDatetimePicker() {
    // Wait for jQuery and jQuery DateTime Picker to be available
    if (typeof $ === 'undefined' || typeof $.datetimepicker === 'undefined') {
        console.warn('[Retry] jQuery DateTime Picker not loaded, retrying in 200ms...');
        setTimeout(initRetryDatetimePicker, 200);
        return;
    }
    
    console.log('[Retry] Starting datepicker initialization...');
    
    // Find retry filter elements
    const filterRetryFrom = document.getElementById('filter-retry-from');
    const filterRetryTo = document.getElementById('filter-retry-to');
    
    if (!filterRetryFrom || !filterRetryTo) {
        console.warn('[Retry] Filter elements not found, retrying...');
        setTimeout(initRetryDatetimePicker, 200);
        return;
    }
    
    console.log('[Retry] Found filter elements, initializing datetimepicker...');
    
    try {
        // Ensure locale is set
        $.datetimepicker.setLocale('id');
        
        // Destroy existing instances first to ensure clean state
        $('#filter-retry-from').datetimepicker('destroy');
        $('#filter-retry-to').datetimepicker('destroy');
        console.log('[Retry] Destroyed existing instances');
        
        // Now initialize fresh
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
                            const formatted = `${day}-${month}-${year} ${hours}:${minutes}`;
                            $input.val(formatted);
                        }
                    }
                }
            }
        });
        
        console.log('[Retry] Datepicker initialized successfully');
    } catch (error) {
        console.error('[Retry] Error initializing datepicker:', error);
    }
}

// Initialize when section loads
if (typeof window.initRetryDataSection === 'undefined') {
    window.initRetryDataSection = function() {
        initRetryDatetimePicker();
        loadRetryData();
        loadRetryStatus();
        // Auto refresh status every 30 seconds
        //setInterval(loadRetryStatus, 30000);
    };
}
