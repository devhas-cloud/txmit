// ==========================================
// DASHBOARD.JS - Dashboard Functions
// ==========================================

// Store KLHK preview data
let klhkPreviewData = [];

// Load dashboard data
async function loadDashboard() {
    refreshStats();
    loadPendingDataPreview();
    loadKLHKSuccessPreview();
}

// Refresh statistics
async function refreshStats() {
    try {
        const response = await fetch('/api/data/stats');
        const data = await response.json();
        
        if (data.success) {
            const stats = data.stats;
            
            // Add null checks before setting content
            const statTotal = document.getElementById('stat-total');
            const statPending = document.getElementById('stat-pending');
            const statRetry = document.getElementById('stat-retry');
            const statSent = document.getElementById('stat-sent');
            const statKlhk = document.getElementById('stat-klhk');
            const lastSync = document.getElementById('last-sync');
            
            if (statTotal) statTotal.textContent = stats.total_data.toLocaleString();
            if (statPending) statPending.textContent = stats.pending_data.toLocaleString();
            if (statRetry) statRetry.textContent = (stats.retry_data || 0).toLocaleString();
            if (statSent) statSent.textContent = stats.sent_data.toLocaleString();
            if (statKlhk) statKlhk.textContent = stats.klhk_success.toLocaleString();
            
            // Handle last sync display
            if (lastSync) {
                if (stats.last_sync === 'Belum ada data' || stats.last_sync === 'Belum ada') {
                    lastSync.textContent = 'Belum ada data';
                } else {
                    try {
                        lastSync.textContent = formatDateCustom(stats.last_sync);
                    } catch (e) {
                        lastSync.textContent = stats.last_sync;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load pending data preview
async function loadPendingDataPreview() {
    try {
        const pendingPreview = document.getElementById('pending-preview');
        if (!pendingPreview) return; // Element doesn't exist yet
        
        const response = await fetch('/api/data/pending');
        const data = await response.json();
        
        if (data.success) {
            const preview = data.data.slice(0, 5);
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
            
            if (preview.length === 0) {
                const colSpan = fields.length + 3;
                html = `<tr><td colspan="${colSpan}" class="text-center text-muted padding-3">Tidak ada data pending</td></tr>`;
            } else {
                preview.forEach((row, idx) => {
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
            
            if (pendingPreview) {
                pendingPreview.innerHTML = `
                <div class="table-responsive">
                    <table class="table">
                        <thead><tr>${headerHtml}</tr></thead>
                        <tbody>${html}</tbody>
                    </table>
                </div>
                `;
            }
        }
    } catch (error) {
        console.error('Error loading pending data preview:', error);
        const pendingPreview = document.getElementById('pending-preview');
        if (pendingPreview) {
            pendingPreview.innerHTML = '<div class="text-danger text-center padding-3">Error loading data</div>';
        }
    }
}

// Load KLHK success preview
async function loadKLHKSuccessPreview() {
    try {
        const klhkPreview = document.getElementById('klhk-preview');
        if (!klhkPreview) return; // Element doesn't exist yet
        
        const response = await fetch('/api/data/klhk-success');
        const data = await response.json();
        
        if (data.success && data.data) {
            // Store preview data for modal functions
            klhkPreviewData = Array.isArray(data.data) ? data.data.slice(0, 5) : [];
            
            let html = '';
            
            if (klhkPreviewData.length === 0) {
                html = '<tr><td colspan="5" class="text-center text-muted padding-3">Tidak ada data KLHK success</td></tr>';
            } else {
                klhkPreviewData.forEach((row, idx) => {
                    const date = formatDateCustom(row.timestamp || '');
                    const payload = row.payload || '';
                    const response = row.response || '';
                    const payloadPreview = payload ? payload.substring(0, 50) + (payload.length > 50 ? '...' : '') : '-';
                    const responsePreview = response ? response.substring(0, 50) + (response.length > 50 ? '...' : '') : '-';
                    
                    // Escape HTML in preview
                    const safePayloadPreview = payloadPreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    const safeResponsePreview = responsePreview.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                    
                    html += `<tr>
                        <td>${idx + 1}</td>
                        <td>${date}</td>
                        <td title="${payload.substring(0, 30)}"><code style="font-size: 0.85rem; word-break: break-word;">${safePayloadPreview}</code></td>
                        <td title="${response.substring(0, 30)}"><code style="font-size: 0.85rem; word-break: break-word;">${safeResponsePreview}</code></td>
                        <td>
                            <button class="btn btn-sm btn-primary klhk-preview-view-btn" data-index="${idx}" type="button" title="View Payload">
                                <i class="bi bi-eye"></i>
                            </button> 
                            <button class="btn btn-sm btn-info klhk-preview-info-btn" data-index="${idx}" type="button" title="View Decoded JWT">
                                <i class="bi bi-info-circle"></i>
                            </button>
                        </td>
                    </tr>`;
                });
            }
            
            if (klhkPreview) {
                klhkPreview.innerHTML = `
                <div class="table-responsive">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>No</th>
                                <th>Tanggal</th>
                                <th>Payload (Preview)</th>
                                <th>Response (Preview)</th>
                                <th>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>${html}</tbody>
                    </table>
                </div>
                `;
                attachKLHKPreviewListeners();
            }
        }
    } catch (error) {
        console.error('Error loading KLHK success preview:', error);
        const klhkPreview = document.getElementById('klhk-preview');
        if (klhkPreview) {
            klhkPreview.innerHTML = '<div class="text-danger text-center padding-3">Error loading data</div>';
        }
    }
}

// Attach event listeners to KLHK preview buttons
function attachKLHKPreviewListeners() {
    // View button
    document.querySelectorAll('.klhk-preview-view-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const index = parseInt(this.getAttribute('data-index'));
            if (index >= 0 && index < klhkPreviewData.length) {
                const payload = klhkPreviewData[index]?.payload || '';
                if (typeof showPayloadModal === 'function') {
                    showPayloadModal(payload);
                } else {
                    Swal.fire('Error', 'Modal function not loaded', 'error');
                }
            }
        });
    });
    
    // Info button
    document.querySelectorAll('.klhk-preview-info-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const index = parseInt(this.getAttribute('data-index'));
            if (index >= 0 && index < klhkPreviewData.length) {
                const payload = klhkPreviewData[index]?.payload || '';
                if (typeof showJWTInfoModal === 'function') {
                    showJWTInfoModal(payload);
                } else {
                    Swal.fire('Error', 'Modal function not loaded', 'error');
                }
            }
        });
    });
}
