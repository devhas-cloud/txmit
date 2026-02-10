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
                    
                    html += `<td><span class="badge badge-pending">Pending</span></td>
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

// Filter pending data
async function filterPendingData() {
    const dateFrom = document.getElementById('filter-pending-from').value;
    const dateTo = document.getElementById('filter-pending-to').value;
    
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
        Swal.fire('Error', 'Gagal memfilter data: ' + error.message, 'error');
    }
}
