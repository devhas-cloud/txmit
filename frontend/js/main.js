// ==========================================
// MAIN.JS - Global/Shared Functions
// ==========================================

function startEfficientScheduler(task, delaySeconds = 0) {
    function scheduleNext() {
        const now = new Date();
        // Hitung sisa detik sampai detik target berikutnya
        let secondsUntilTarget = delaySeconds - now.getSeconds();
        if (secondsUntilTarget <= 0) {
            secondsUntilTarget += 60;
        }
        const msUntilTarget = secondsUntilTarget * 1000 - now.getMilliseconds();

        setTimeout(() => {
            const runTime = new Date();
            task(runTime); // Jalankan task tepat di detik yang ditentukan
            scheduleNext(); // Jadwalkan task berikutnya
        }, msUntilTarget);
    }

    scheduleNext();
}

// ==========================================
// REAL-TIME CLOCK WITH TIMEZONE
// ==========================================

let appTimezone = 'Asia/Jakarta'; // Default timezone

async function loadTitleFromConfig() {
    try {
        const response = await fetch('/api/config');
        const data = await response.json();
        const deviceId = data.device_id || '';
        document.title = (deviceId ? deviceId + ' - ' : '') + 'API Monitoring System';
        const titleEl = document.getElementById('title');
        if (titleEl) {
            titleEl.textContent = document.title;
        }
    } catch (error) {
        console.warn('Failed to load title from config:', error);
    }
}

async function loadTimezoneFromConfig() {
    try {
        const response = await fetch('/api/timezone');
        const data = await response.json();
        if (data.timezone) {
            appTimezone = data.timezone;
        }
    } catch (error) {
        console.warn('Failed to load timezone from config, using default:', error);
        appTimezone = 'Asia/Jakarta';
    }
}

function formatTimeWithTimezone(date, timezone) {
    try {
        const formatter = new Intl.DateTimeFormat('id-ID', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: timezone
        });
        
        const parts = formatter.formatToParts(date);
        const values = {};
        
        parts.forEach(part => {
            if (part.type !== 'literal') {
                values[part.type] = part.value;
            }
        });
        
        return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
    } catch (error) {
        // Fallback jika timezone tidak valid
        console.warn('Invalid timezone:', timezone, error);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
}

function updateRealTimeClock() {
    const clockElement = document.getElementById('current-time');
    if (clockElement) {
        const now = new Date();
        const timeString = formatTimeWithTimezone(now, appTimezone);
        clockElement.textContent = timeString;
    }
}

function startRealTimeClock() {
    // Load title from config
    loadTitleFromConfig();

    // Load timezone from config first
    loadTimezoneFromConfig().then(() => {
        // Update clock immediately
        updateRealTimeClock();
        
        // Set interval to update every 1000ms (1 second)
        setInterval(updateRealTimeClock, 1000);
    }).catch((error) => {
        console.error('Error loading timezone config:', error);
        // Still start clock with default timezone if config fails
        updateRealTimeClock();
        setInterval(updateRealTimeClock, 1000);
    });
}

function refreshDashboardData() {
    if (typeof refreshStats === 'function') refreshStats();
    if (typeof loadPendingDataPreview === 'function') loadPendingDataPreview();
    if (typeof loadKLHKSuccessPreview === 'function') loadKLHKSuccessPreview();
}

function refreshPendingAndRetryData() {
    // Note: Auto-reload removed for pending-data section on user request
    // Users must manually click Reload or Filter buttons to refresh
    // But retry section still auto-refreshes
    
    const retrySection = document.getElementById('retry-section');
    if (retrySection && retrySection.style.display !== 'none' && typeof loadRetryData === 'function') {
        loadRetryData();
        if (typeof loadRetryStatus === 'function') loadRetryStatus();
    }
}

function refreshVisibleSectionData() {
    refreshPendingAndRetryData();

    const klhkSuccessSection = document.getElementById('klhk-success-section');
    if (klhkSuccessSection && klhkSuccessSection.style.display !== 'none' && typeof loadKLHKSuccess === 'function') {
        loadKLHKSuccess();
    }

    const allDataSection = document.getElementById('all-data-section');
    if (allDataSection && allDataSection.style.display !== 'none' && typeof filterAllData === 'function') {
        filterAllData();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    startRealTimeClock();
    refreshDashboardData();

    // Dashboard data at second 0 every minute
    startEfficientScheduler(() => {
        refreshDashboardData();
    }, 0);

    // Pending and Retry data at second 5 every minute
    startEfficientScheduler(() => {
        refreshPendingAndRetryData();
    }, 5);

    // Note: loadDashboard() is called from index.html's loadComponents()
    // after all components and sections are loaded
});

// ==========================================
// AUTHENTICATION & LOGOUT
// ==========================================

async function checkAuth() {
    try {
        const response = await fetch('/api/check-auth');
        const data = await response.json();
        if (!data.authenticated) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

async function logout() {
    Swal.fire({
        title: 'Logout',
        text: 'Yakin ingin logout dari sistem?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: 'Ya, Logout',
        cancelButtonText: 'Batal'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const response = await fetch('/api/logout', { method: 'POST' });
                if (response.ok) {
                    Swal.fire({
                        title: 'Berhasil',
                        text: 'Anda berhasil logout',
                        icon: 'success',
                        timer: 1500,
                        didClose: () => {
                            window.location.href = '/login';
                        }
                    });
                }
            } catch (error) {
                console.error('Logout error:', error);
                Swal.fire('Error', 'Gagal logout: ' + error.message, 'error');
            }
        }
    });
}

// ==========================================
// SIDEBAR TOGGLE
// ==========================================

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
}

// ==========================================
// SECTION NAVIGATION
// ==========================================

function showSection(sectionName) {
    try {
        // Stop auto-refresh for logs if switching away from logs
        if (sectionName !== 'logs' && typeof logAutoRefreshInterval !== 'undefined' && logAutoRefreshInterval) {
            clearInterval(logAutoRefreshInterval);
            logAutoRefreshInterval = null;
        }
        
        // Hide all sections
        document.getElementById('dashboard-section').style.display = 'none';
        document.getElementById('pending-data-section').style.display = 'none';
        document.getElementById('retry-section').style.display = 'none';
        document.getElementById('klhk-success-section').style.display = 'none';
        document.getElementById('all-data-section').style.display = 'none';
        // Note: logs-section removed - logs is now standalone page
        document.getElementById('config-section').style.display = 'none';
        
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show selected section and mark nav item as active
        const navItems = document.querySelectorAll('.nav-item');
        let activeItem = null;
        
        // Helper to set default dates (today and yesterday for 1 day range)
        function setDefaultDateFilters(fromId, toId) {
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            const formatDate = (d) => d.toISOString().split('T')[0];
            document.getElementById(fromId).value = formatDate(yesterday);
            document.getElementById(toId).value = formatDate(today);
        }
        
        if (sectionName === 'dashboard') {
            const section = document.getElementById('dashboard-section');
            if (section) section.style.display = 'block';
            activeItem = document.querySelector('[data-section="dashboard"]');
            refreshDashboardData();
            refreshVisibleSectionData();
        } else if (sectionName === 'pending-data') {
            const section = document.getElementById('pending-data-section');
            if (section) section.style.display = 'block';
            activeItem = document.querySelector('[data-section="pending-data"]');
            loadPendingData({ notify: true });
            if (typeof loadSendStatus === 'function') loadSendStatus();
            // Initialize datepicker for pending data section
            setTimeout(() => {
                if (typeof initDatetimePicker === 'function') {
                    initDatetimePicker();
                }
            }, 100);
        } else if (sectionName === 'retry') {
            const section = document.getElementById('retry-section');
            if (section) section.style.display = 'block';
            activeItem = document.querySelector('[data-section="retry"]');
            loadRetryData();
            if (typeof loadRetryStatus === 'function') loadRetryStatus();
            // Initialize datepicker for retry data section
            setTimeout(() => {
                if (typeof initDatetimePicker === 'function') {
                    initDatetimePicker();
                }
            }, 100);

        } else if (sectionName === 'klhk-success') {
            const section = document.getElementById('klhk-success-section');
            if (section) section.style.display = 'block';
            activeItem = document.querySelector('[data-section="klhk-success"]');
            // Set default date filters (1 day / 24 hours)
            setDefaultDateFilters('filter-klhk-from', 'filter-klhk-to');
            loadKLHKSuccess();
        } else if (sectionName === 'all-data') {
            const section = document.getElementById('all-data-section');
            if (section) section.style.display = 'block';
            activeItem = document.querySelector('[data-section="all-data"]');
            // Set default date filters (1 day)
            setDefaultDateFilters('filter-all-from', 'filter-all-to');
            filterAllData();
        } else if (sectionName === 'logs') {
            // Redirect to standalone logs page
            window.location.href = '/logs.html';
            return;
        } else if (sectionName === 'config') {
            const section = document.getElementById('config-section');
            if (section) section.style.display = 'block';
            activeItem = document.querySelector('[data-section="config"]');
            loadConfiguration();
        }
        
        // Add active class to the selected nav item
        if (activeItem) {
            activeItem.classList.add('active');
        }

        // Close sidebar on mobile after selection
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            const overlay = document.getElementById('sidebarOverlay');
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        }

    } catch (error) {
        console.error('Error in showSection:', error);
    }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function getFieldValue(row, fieldName) {
    const fieldMapping = {
        'datetime': 'date',
        'date': 'date',
        'ph': 'pH',
        'pH': 'pH',
        'orp': 'orp',
        'tds': 'tds',
        'do': 'do',
        'conduct': 'conduct',
        'conductivity': 'conduct',
        'flow': 'flow',
        'cod': 'cod',
        'tss': 'tss',
        'bod': 'bod',
        'nh3n': 'nh3n'
    };
    
    const actualField = fieldMapping[fieldName.toLowerCase()] || fieldName;
    return row[actualField];
}

function formatFieldValue(value, fieldName) {
    if (value === null || value === undefined) return '-';
    
    // Date fields
    if (fieldName.toLowerCase() === 'datetime' || fieldName.toLowerCase() === 'date') {
        try {
            return new Date(value).toLocaleString('id-ID');
        } catch (e) {
            return value;
        }
    }
    
    // Numeric fields
    if (value !== null && value !== undefined && (typeof value === 'number' || !isNaN(parseFloat(value)))) {
        const numVal = parseFloat(value);
        return numVal.toFixed(2);
    }
    
    return value;
}

function getFieldDisplayName(fieldName) {
    const displayNames = {
        'datetime': 'Tanggal',
        'date': 'Tanggal',
        'ph': 'pH',
        'orp': 'ORP',
        'tds': 'TDS',
        'do': 'DO',
        'conduct': 'Conductivity',
        'flow': 'Flow',
        'cod': 'COD',
        'tss': 'TSS',
        'bod': 'BOD',
        'nh3n': 'NH3-N'
    };
    return displayNames[fieldName.toLowerCase()] || fieldName.toUpperCase();
}

function formatDateCustom(dateValue) {
    if (!dateValue) return '-';
    try {
        const date = new Date(dateValue);
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch (e) {
        return dateValue;
    }
}

// ==========================================
// SWAL ALERT HELPER
// ==========================================

function showConfigAlert(message, type) {
    const iconMap = {
        'success': 'success',
        'danger': 'error',
        'info': 'info'
    };
    
    Swal.fire({
        title: type === 'success' ? 'Berhasil' : type === 'danger' ? 'Error' : 'Informasi',
        html: message,
        icon: iconMap[type] || 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer)
            toast.addEventListener('mouseleave', Swal.resumeTimer)
        }
    });
}
