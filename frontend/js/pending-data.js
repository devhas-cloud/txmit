// ==========================================
// PENDING-DATA.JS - Pending Data Functions
// ==========================================

// Load pending data full
async function loadPendingData(options = {}) {
    const { notify = false } = options;
    try {
        const response = await fetch('/api/data/pending');
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
                const colSpan = fields.length + 3;
                html = `<tr><td colspan="${colSpan}" class="text-center text-muted">Tidak ada data pending</td></tr>`;
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
                    
                    html += `<td><span class="badge badge-pending"><i class="bi bi-hourglass-split"></i> Pending </span></td>
                    <td>${statusKeterangan}</td></tr>`;
                });
            }
            
            // Update the table header and body
            const table = document.getElementById('pending-data-table');
            table.innerHTML = `
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody>${html}</tbody>
            `;
            if (notify) {
                Swal.fire({
                    title: 'Berhasil',
                    text: 'Data pending berhasil dimuat',
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
                text: data.error || 'Gagal memuat data pending'
            });
        }
    } catch (error) {
        console.error('Error loading pending data:', error);
        const colSpan = 7;
        document.getElementById('pending-data-body').innerHTML = `<tr><td colspan="${colSpan}" class="text-center text-danger">Error loading data</td></tr>`;
        if (notify) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Gagal memuat data pending: ' + error.message
            });
        }
    }
}

// Helper function to convert DD-MM-YYYY HH:MM to YYYY-MM-DD HH:MM:SS format for API
function convertDateTimeFormat(datetimeStr) {
    if (!datetimeStr) return null;
    
    // Input format: D-M-YYYY H:M (from datepicker d-m-Y H:i format)
    // Or: DD-MM-YYYY HH:MM (formatted version)
    // Output format: YYYY-MM-DD HH:MM:SS (MySQL DATETIME format)
    
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
    
    // Ensure values are properly padded with leading zeros
    const day = String(dateParts[0]).padStart(2, '0');
    const month = String(dateParts[1]).padStart(2, '0');
    const year = dateParts[2];
    
    // Ensure time is in HH:MM format and add :00 for seconds
    const timeParts = parts[1].split(':');
    const hours = String(timeParts[0]).padStart(2, '0');
    const minutes = String(timeParts[1] || '0').padStart(2, '0');
    const time = `${hours}:${minutes}:00`;
    
    const result = `${year}-${month}-${day} ${time}`;
    return result;
}

// Filter pending data
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
    
    // Convert from DD-MM-YYYY HH:MM to YYYY-MM-DD HH:MM:SS for API
    const dateFrom = convertDateTimeFormat(dateFromInput);
    const dateTo = convertDateTimeFormat(dateToInput);
    
    
    try {
        const response = await fetch('/api/data/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date_from: dateFrom,
                date_to: dateTo,
                table: 'data'
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
                    
                    html += `<td><span class="badge badge-pending"><i class="bi bi-hourglass-split"></i> Pending</span></td>
                    <td>${statusKeterangan}</td></tr>`;
                });
            }
            
            // Update table headers and body
            const table = document.getElementById('pending-data-table');
            table.innerHTML = `
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody id="pending-data-body">${html}</tbody>
            `;
            
            Swal.fire({
                title: 'Berhasil',
                text: 'Data berhasil difilter',
                icon: 'success',
                timer: 2000
            });
        } else {
            Swal.fire('Error', data.error || 'Gagal memfilter data', 'error');
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

// Load send status
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

// Reload pending data
async function reloadPendingData() {
    await loadPendingData({ notify: true });
    await loadSendStatus();
}

// Manual send data
async function manualSendData() {
    const dateFromInput = document.getElementById('filter-pending-from').value;
    const dateToInput = document.getElementById('filter-pending-to').value;
    const hasDateRange = dateFromInput && dateToInput;
    
    let title, message, confirmText;
    
    if (!hasDateRange) {
        // No date range specified - send ALL pending data
        title = '⚠️ Kirim SEMUA Data Pending?';
        message = 'Tanggal tidak dipilih! Ini akan mengirim SEMUA data pending ke KLHK. Pastikan ini sudah benar!';
        confirmText = 'Ya, Kirim Semua';
    } else {
        // Date range specified - send filtered data
        title = 'Kirim Data Sesuai Range Tanggal?';
        message = `Data dari ${dateFromInput} hingga ${dateToInput} akan dikirim. Lanjutkan?`;
        confirmText = 'Ya, Kirim';
    }
    
    // First confirmation
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
    
    // For "send all" without date range, require extra confirmation
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
    
    // Show loading dialog WITHOUT awaiting (don't block execution)
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
    
    // Prepare request payload
    const payload = {
        ...(hasDateRange && {
            date_from: convertDateTimeFormat(dateFromInput),
            date_to: convertDateTimeFormat(dateToInput)
        })
    };
    
    console.log('Manual send payload:', payload);
    const bodyString = JSON.stringify(payload);
    console.log('Manual send body string:', bodyString);
    
    try {
        const response = await fetch('/api/send/manual', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: bodyString
        });
        
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);
        
        // Get response body
        const responseText = await response.text();
        console.log('Response raw text:', responseText);
        
        // Parse JSON
        let data = {};
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            data = { success: false, error: 'Invalid response: ' + responseText };
        }
        
        // Close loading dialog
        Swal.close();
        
        // Check if success
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
            
            // Reload data after dialog closes
            await new Promise(resolve => setTimeout(resolve, 1000));
            loadPendingData();
            loadSendStatus();
        } else {
            // Error response
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





// Helper function to format datetime to DD-MM-YYYY HH:MM format
function formatDateTimeToString(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
}

// Initialize jQuery Datepicker with datetime support
function initDatetimePicker() {
    // Wait for jQuery and jQuery DateTime Picker to be available
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
                    format: 'd-m-Y H:i',  // Format: DD-MM-YYYY HH:MM for display
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
                        // Ensure proper formatting with leading zeros
                        const value = $input.val();
                        if (value) {
                            const parts = value.split(' ');
                            if (parts.length === 2) {
                                const dateParts = parts[0].split('-');
                                if (dateParts.length === 3) {
                                    // d-m-Y H:i -> DD-MM-YYYY HH:MM (with leading zeros)
                                    const day = String(dateParts[0]).padStart(2, '0');
                                    const month = String(dateParts[1]).padStart(2, '0');
                                    const year = dateParts[2];
                                    const timeParts = parts[1].split(':');
                                    const hours = String(timeParts[0]).padStart(2, '0');
                                    const minutes = String(timeParts[1] || '0').padStart(2, '0');
                                    const formattedValue = `${day}-${month}-${year} ${hours}:${minutes}`;
                                    $input.val(formattedValue);
                                    console.log('Formatted datepicker value:', formattedValue);
                                }
                            }
                        }
                    }
                });
                
                // Mark them as initialized
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

// Initialize when section loads
if (typeof window.initPendingDataSection === 'undefined') {
    window.initPendingDataSection = function() {
        loadPendingData();
        loadSendStatus();
        initDatetimePicker();
        // Note: Auto-refresh is disabled for pending-data section
        // Refresh is handled by main scheduler in main.js
    };
}
