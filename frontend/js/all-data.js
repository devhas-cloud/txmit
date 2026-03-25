// ==========================================
// ALL-DATA.JS - All Data Functions
// ==========================================

// Filter ALL DATA
async function filterAllData() {
    const dateFrom = document.getElementById('filter-all-from').value;
    const dateTo = document.getElementById('filter-all-to').value;
    
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
        const response = await fetch('/api/data/all', {
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
            const has_fields = (data.has_fields || 'datetime,pH,cod,tss,nh3n,flow')
                .split(',')
                .map(f => f.trim())
                .filter(f => f && f.toLowerCase() !== 'datetime');
            
            // Render filtered data
            let html = '';
            let headerHtml = '<th>No</th><th>Tanggal</th>';
            
            // Build dynamic headers
            has_fields.forEach(field => {
                headerHtml += `<th>${getFieldDisplayName(field)}</th>`;
            });
            headerHtml += '<th>KLHK</th><th>HAS</th>';
            
            if (data.data.length === 0) {
                const colSpan = has_fields.length + 4;
                html = '<tr><td colspan="' + colSpan + '" class="text-center text-muted">Tidak ada data pada rentang tanggal ini</td></tr>';
            } else {
                data.data.forEach((row, idx) => {
                    const datetimeValue = getFieldValue(row, 'datetime') || getFieldValue(row, 'date');
                    const tanggal = formatDateCustom(datetimeValue);
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
                        <td>${tanggal}</td>`;
                    
                    has_fields.forEach(field => {
                        const value = getFieldValue(row, field);
                        const formatted = formatFieldValue(value, field);
                        html += `<td>${formatted}</td>`;
                    });
                    
                    // Status klhk
                    const status_klhk = row.status === 'terkirim' 
                        ? '<span class="badge badge-success">Sent</span>' : '<span class="badge badge-pending">Pending</span>';
                        ;
                    html += `<td>${status_klhk}</td>`;

                    // Determine status - either "Sent" or "Pending"
                    const status_has =  row.has == 1 
                        ? '<span class="badge badge-success">Sent</span>'
                        : '<span class="badge badge-pending">Pending</span>';
                    
                    html += `<td>${status_has}</td></tr>`;
                });
            }
            
            // Update table headers and body
            const table = document.getElementById('all-data-table');
            table.innerHTML = `
                <thead>
                    <tr>${headerHtml}</tr>
                </thead>
                <tbody id="all-data-body">${html}</tbody>
            `;
            
            Swal.fire({
                title: 'Berhasil',
                text: 'Data berhasil difilter. Total: ' + data.data.length + ' records',
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
