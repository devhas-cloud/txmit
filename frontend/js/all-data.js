// ==========================================
// ALL-DATA.JS - All Data Functions
// ==========================================

let allDataCurrentPage = 1;
let allDataPageSize = 15;
let allDataTotalPages = 1;
let allDataTotalRows = 0;
let allDataFilterFrom = '';
let allDataFilterTo = '';

function renderAllDataTable(data, hasFields) {
    if (!data || data.length === 0) {
        const colSpan = (hasFields && hasFields.length) ? hasFields.length + 4 : 7;
        return '<tr><td colspan="' + colSpan + '" class="text-center text-muted">Tidak ada data pada rentang tanggal ini</td></tr>';
    }
    
    let html = '';
    const startNum = (allDataCurrentPage - 1) * allDataPageSize + 1;
    
    data.forEach((row, idx) => {
        const datetimeValue = getFieldValue(row, 'date');
        const tanggal = formatDateCustom(datetimeValue);
        const createdAt = formatDateCustom(getFieldValue(row, 'created_at') || getFieldValue(row, 'createdat') || getFieldValue(row, 'created'));
        
        html += `<tr>
            <td>${startNum + idx}</td>
            <td>${createdAt}</td>
            <td>${tanggal}</td>`;
        
        hasFields.forEach(field => {
            const value = getFieldValue(row, field);
            const formatted = formatFieldValue(value, field);
            html += `<td>${formatted}</td>`;
        });
        
        const status_klhk = row.status === 'terkirim' 
            ? '<span class="badge badge-success">Sent</span>' 
            : '<span class="badge badge-pending">Pending</span>';
        html += `<td>${status_klhk}</td>`;
        
        const status_has = row.has == 1 
            ? '<span class="badge badge-success">Sent</span>'
            : '<span class="badge badge-pending">Pending</span>';
        html += `<td>${status_has}</td></tr>`;
    });
    
    return html;
}

function renderAllDataPagination() {
    const container = document.getElementById('all-pagination');
    if (!container) return;
    
    if (allDataTotalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-info">';
    html += `Menampilkan ${(allDataCurrentPage - 1) * allDataPageSize + 1} - ${Math.min(allDataCurrentPage * allDataPageSize, allDataTotalRows)} dari ${allDataTotalRows} data`;
    html += '</div>';
    
    html += '<div class="pagination-controls">';
    
    const prevDisabled = allDataCurrentPage <= 1 ? 'disabled' : '';
    html += `<button class="pagination-btn ${prevDisabled}" onclick="allDataGoToPage(${allDataCurrentPage - 1})" ${prevDisabled}><i class="bi bi-chevron-left"></i></button>`;
    
    const maxButtons = 5;
    let startPage = Math.max(1, allDataCurrentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(allDataTotalPages, startPage + maxButtons - 1);
    
    if (endPage - startPage < maxButtons - 1) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }
    
    if (startPage > 1) {
        html += `<button class="pagination-btn" onclick="allDataGoToPage(1)">1</button>`;
        if (startPage > 2) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
    }
    
    for (let p = startPage; p <= endPage; p++) {
        const activeClass = p === allDataCurrentPage ? 'active' : '';
        html += `<button class="pagination-btn ${activeClass}" onclick="allDataGoToPage(${p})">${p}</button>`;
    }
    
    if (endPage < allDataTotalPages) {
        if (endPage < allDataTotalPages - 1) {
            html += '<span class="pagination-ellipsis">...</span>';
        }
        html += `<button class="pagination-btn" onclick="allDataGoToPage(${allDataTotalPages})">${allDataTotalPages}</button>`;
    }
    
    const nextDisabled = allDataCurrentPage >= allDataTotalPages ? 'disabled' : '';
    html += `<button class="pagination-btn ${nextDisabled}" onclick="allDataGoToPage(${allDataCurrentPage + 1})" ${nextDisabled}><i class="bi bi-chevron-right"></i></button>`;
    
    html += '</div>';
    
    container.innerHTML = html;
}

function allDataGoToPage(page) {
    if (page < 1 || page > allDataTotalPages || page === allDataCurrentPage) return;
    allDataCurrentPage = page;
    fetchAllData();
}

async function fetchAllData(silent) {
    const tableBody = document.getElementById('all-data-body');
    if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-muted"><div class="loading"><div class="loading-spinner"></div><p>Memuat data...</p></div></td></tr>';
    }
    
    try {
        const response = await fetch('/api/data/all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                page: allDataCurrentPage,
                limit: allDataPageSize,
                date_from: allDataFilterFrom,
                date_to: allDataFilterTo
            })
        });
        const data = await response.json();
        
        if (data.success) {
            allDataTotalRows = data.total || 0;
            allDataTotalPages = data.total_pages || 1;
            
            const hasFields = (data.has_fields || 'pH,cod,tss,nh3n,flow')
                .split(',')
                .map(f => f.trim())
                .filter(f => f && f.toLowerCase() !== 'datetime');
            
            const headerHtml = '<th>No</th><th>Create At</th><th>Tanggal</th>'
                + hasFields.map(f => `<th>${getFieldDisplayName(f)}</th>`).join('')
                + '<th>KLHK</th><th>HAS</th>';
            
            const table = document.getElementById('all-data-table');
            if (table) {
                table.innerHTML = `<thead><tr>${headerHtml}</tr></thead><tbody id="all-data-body">${renderAllDataTable(data.data, hasFields)}</tbody>`;
            }
            
            renderAllDataPagination();
            
            if (!silent && data.total > 0) {
                Swal.fire({
                    title: 'Berhasil',
                    text: 'Data berhasil difilter. Total: ' + data.total + ' records',
                    icon: 'success',
                    timer: 2000
                });
            }
        } else {
            if (!silent) {
                Swal.fire('Error', data.error || 'Gagal memfilter data', 'error');
            }
            document.getElementById('all-pagination').innerHTML = '';
        }
    } catch (error) {
        console.error('Filter error:', error);
        if (!silent) {
            Swal.fire('Error', 'Gagal memfilter data: ' + error.message, 'error');
        }
        document.getElementById('all-pagination').innerHTML = '';
    }
}

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
    
    const newFrom = dateFrom + ' 00:00:00';
    const newTo = dateTo + ' 23:59:59';
    
    if (newFrom !== allDataFilterFrom || newTo !== allDataFilterTo) {
        allDataCurrentPage = 1;
        allDataFilterFrom = newFrom;
        allDataFilterTo = newTo;
    }
    
    await fetchAllData();
}
