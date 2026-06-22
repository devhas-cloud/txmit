// ==========================================
// CONFIG.JS - Configuration Functions
// ==========================================

async function loadConfiguration() {
    try {
        const response = await fetch('/api/config');
        const config = await response.json();
        
        // General
        if (document.getElementById('config-timezone')) {
            document.getElementById('config-timezone').value = config.timezone || 'Asia/Jakarta';
        }
        if (document.getElementById('config-device-id')) {
            document.getElementById('config-device-id').value = config.device_id || '';
        }
        
        // Database
        if (document.getElementById('config-db-host')) {
            document.getElementById('config-db-host').value = config.db_host || '';
        }
        if (document.getElementById('config-db-port')) {
            document.getElementById('config-db-port').value = config.db_port || '';
        }
        if (document.getElementById('config-db-name')) {
            document.getElementById('config-db-name').value = config.db_name || '';
        }
        if (document.getElementById('config-db-user')) {
            document.getElementById('config-db-user').value = config.db_user || '';
        }
        if (document.getElementById('config-db-password')) {
            document.getElementById('config-db-password').value = config.db_password || '';
        }
        
        // KLHK

        if (document.getElementById('config-klhk-timezone')) {
            document.getElementById('config-klhk-timezone').value = config.klhk_timezone || 'Asia/Jakarta';
        }

        if (document.getElementById('config-klhk-status')) {
            document.getElementById('config-klhk-status').value = config.klhk_status || 'inactive';
        }
        if (document.getElementById('config-klhk-api-url')) {
            document.getElementById('config-klhk-api-url').value = config.klhk_api_url || '';
        }
        if (document.getElementById('config-klhk-token-url')) {
            document.getElementById('config-klhk-token-url').value = config.klhk_token_url || '';
        }
        if (document.getElementById('config-klhk-uid')) {
            document.getElementById('config-klhk-uid').value = config.klhk_uid || '';
        }
        if (document.getElementById('config-klhk-fields')) {
            document.getElementById('config-klhk-fields').value = config.klhk_fields || '';
        }
        if (document.getElementById('config-klhk-max-dup-retry')) {
            document.getElementById('config-klhk-max-dup-retry').value = config.klhk_max_dup_retry || '';
        }
        if (document.getElementById('config-klhk-target-minute')) {
            document.getElementById('config-klhk-target-minute').value = config.klhk_target_minute || '';
        }
        
        // HAS
        if (document.getElementById('config-has-status')) {
            document.getElementById('config-has-status').value = config.has_status || 'inactive';
        }
        if (document.getElementById('config-has-api-url')) {
            document.getElementById('config-has-api-url').value = config.has_api_url || '';
        }
        if (document.getElementById('config-has-token-api')) {
            document.getElementById('config-has-token-api').value = config.has_token_api || '';
        }
        if (document.getElementById('config-has-fields')) {
            document.getElementById('config-has-fields').value = config.has_fields || '';
        }
        if (document.getElementById('config-has-logs-api-url')) {
            document.getElementById('config-has-logs-api-url').value = config.has_logs_api_url || '';
        }
        if (document.getElementById('config-has-klhk-log-api-url')) {
            document.getElementById('config-has-klhk-log-api-url').value = config.has_klhk_log_api_url || '';
        }
        
        showConfigAlert('✅ Konfigurasi berhasil dimuat', 'success');
    } catch (error) {
        console.error('Error loading configuration:', error);
        showConfigAlert('❌ Gagal memuat konfigurasi', 'danger');
    }
}

async function saveConfiguration() {
    Swal.fire({
        title: 'Konfirmasi Penyimpanan',
        text: 'Apakah Anda yakin ingin menyimpan konfigurasi ini?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Simpan',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        
        try {
            const configData = {
                // General
                timezone: document.getElementById('config-timezone')?.value || 'Asia/Jakarta',
                device_id: document.getElementById('config-device-id')?.value || '',
                
                // Database
                db_host: document.getElementById('config-db-host')?.value || '',
                db_port: document.getElementById('config-db-port')?.value || '',
                db_name: document.getElementById('config-db-name')?.value || '',
                db_user: document.getElementById('config-db-user')?.value || '',
                db_password: document.getElementById('config-db-password')?.value || '',
                
                // KLHK API
                klhk_timezone: document.getElementById('config-klhk-timezone')?.value || 'Asia/Jakarta',
                klhk_status: document.getElementById('config-klhk-status')?.value || 'inactive',
                klhk_api_url: document.getElementById('config-klhk-api-url')?.value || '',
                klhk_token_url: document.getElementById('config-klhk-token-url')?.value || '',
                klhk_uid: document.getElementById('config-klhk-uid')?.value || '',
                klhk_fields: document.getElementById('config-klhk-fields')?.value || '',
                klhk_max_dup_retry: document.getElementById('config-klhk-max-dup-retry')?.value || '',
                klhk_target_minute: document.getElementById('config-klhk-target-minute')?.value || '',
                
                // HAS API
                has_status: document.getElementById('config-has-status')?.value || 'inactive',
                has_api_url: document.getElementById('config-has-api-url')?.value || '',
                has_token_api: document.getElementById('config-has-token-api')?.value || '',
                has_fields: document.getElementById('config-has-fields')?.value || '',
                has_logs_api_url: document.getElementById('config-has-logs-api-url')?.value || '',
                has_klhk_log_api_url: document.getElementById('config-has-klhk-log-api-url')?.value || '',
            };
            
            console.log('Sending config data:', configData);
            
            const response = await fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(configData)
            });
                
                const result = await response.json();
                console.log('Response:', result);
                
                if (result.success) {
                    showConfigAlert('✅ Konfigurasi berhasil disimpan', 'success');
                    setTimeout(() => {
                        loadConfiguration();
                    }, 500);
                } else {
                    showConfigAlert('❌ Error: ' + (result.error || 'Unknown error'), 'danger');
                }
        } catch (error) {
            console.error('Error saving configuration:', error);
            showConfigAlert('❌ Error: ' + error.message, 'danger');
        }
    });
}
