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
        const colSpan = 7;
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

// Filter retry data
async function filterRetryData() {
    const dateFrom = document.getElementById('filter-retry-from').value;
    const dateTo = document.getElementById('filter-retry-to').value;
    
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
        const response = await fetch('/api/retry/filter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date_from: dateFrom + ' 00:00:00',
                date_to: dateTo + ' 23:59:59'
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
            
            if (data.data.length === 0) {
                const colSpan = fields.length + 3;
                html = '<tr><td colspan="' + colSpan + '" class="text-center text-muted">Tidak ada data pada rentang tanggal ini</td></tr>';
            } else {
                data.data.forEach((row, idx) => {
                    const datetimeValue = getFieldValue(row, 'datetime') || getFieldValue(row, 'date');
                    const tanggal = formatDateCustom(datetimeValue);
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
                        <td>${tanggal}</td>`;
                    
                    fields.forEach(field => {
                        const value = getFieldValue(row, field);
                        const formatted = formatFieldValue(value, field);
                        html += `<td>${formatted}</td>`;
                    });
                    
                    html += `<td><span class="badge badge-pending">Pending</span></td></tr>`;
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
        Swal.fire('Error', 'Gagal memfilter data pengiriman ulang: ' + error.message, 'error');
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
    try {
        const result = await Swal.fire({
            title: 'Kirim Ulang Data Manual?',
            text: 'Data retry akan segera dikirim ulang ke KLHK. Lanjutkan?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Ya, Kirim Ulang',
            cancelButtonText: 'Batal'
        });
        
        if (result.isConfirmed) {
            // Show loading
            Swal.fire({
                title: 'Mengirim Ulang Data...',
                text: 'Mohon tunggu, data sedang dikirim ulang',
                icon: 'info',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            const response = await fetch('/api/retry/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const data = await response.json();
            
            if (data.success) {
                await Swal.fire({
                    title: 'Berhasil!',
                    text: data.message || 'Pengiriman ulang manual berhasil dipicu. Periksa log untuk detail.',
                    icon: 'success',
                    confirmButtonColor: '#4f46e5'
                });
                
                // Reload data after 3 seconds
                setTimeout(() => {
                    loadRetryData();
                }, 3000);
            } else {
                Swal.fire({
                    title: 'Gagal',
                    html: data.error || 'Gagal memicu pengiriman ulang manual',
                    icon: 'error',
                    confirmButtonColor: '#4f46e5',
                    footer: data.error && data.error.includes('not active') 
                        ? '<a href="#" onclick="loadSection(\'config\'); return false;">Buka Halaman Konfigurasi</a>' 
                        : ''
                });
            }
        }
    } catch (error) {
        console.error('Error manual retry:', error);
        Swal.fire({
            title: 'Error',
            text: 'Terjadi kesalahan: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#4f46e5'
        });
    }
}

// Initialize when section loads
if (typeof window.initRetryDataSection === 'undefined') {
    window.initRetryDataSection = function() {
        loadRetryData();
        loadRetryStatus();
        // Auto refresh status every 30 seconds
        setInterval(loadRetryStatus, 30000);
    };
}
