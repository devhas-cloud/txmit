// ==========================================
// LOGS.JS - Logs Functions (Standalone & Shared)
// ==========================================

let currentLogType = 'main';
let logAutoRefreshInterval;
let isLogAutoRefreshActive = true;
let lastLogUpdate = new Date();

// Switch between log categories
function switchLog(logType) {
    currentLogType = logType;
    
    // Update active button
    document.querySelectorAll('.log-category-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.log-category-btn[data-log="${logType}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Update title
    const titles = {
        'main': 'Main Log',
        'send': 'Send Log',
        'retry': 'Retry Log',
        'has-send': 'HAS Send Log'
    };
    
    const logTitle = document.getElementById('logTitle');
    if (logTitle) {
        logTitle.textContent = titles[logType] || logType;
    }
    
    // Load the new log
    loadLogContent();
}

// Format log content with syntax highlighting
function formatLogContent(logText) {
    if (!logText) return '<span style="color: #999;">No log data available</span>';
    
    // Split into lines and format each
    const lines = logText.split('\n').map(line => {
        if (!line.trim()) return '';
        
        // Add timestamp styling
        line = line.replace(/(\d{2}:\d{2}:\d{2})/g, '<span class="log-timestamp">$1</span>');
        
        // Add color coding for log levels
        line = line.replace(/\[INFO\]/g, '<span class="log-info">[INFO]</span>');
        line = line.replace(/\[WARN\]/g, '<span class="log-warning">[WARN]</span>');
        line = line.replace(/\[ERROR\]/g, '<span class="log-error">[ERROR]</span>');
        line = line.replace(/\[SUCCESS\]/g, '<span class="log-success">[SUCCESS]</span>');
        
        return line;
    }).join('<br>');
    
    return line || '<span style="color: #999;">No log data available</span>';
}

// Load log content
async function loadLogContent() {
    try {
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        
        if (statusIndicator) statusIndicator.style.opacity = '0.5';
        if (statusText) statusText.textContent = 'Loading...';
        
        const response = await fetch(`/api/logs/${currentLogType}`);
        const data = await response.json();
        
        if (data.success) {
            const logViewer = document.getElementById('log-viewer');
            if (logViewer) {
                const formattedContent = formatLogContent(data.content);
                logViewer.innerHTML = formattedContent;
                
                // Auto-scroll to bottom
                logViewer.scrollTop = logViewer.scrollHeight;
            }
            
            if (statusIndicator) statusIndicator.style.opacity = '1';
            if (statusText) statusText.textContent = 'Connected';
            lastLogUpdate = new Date();
            updateLogTimestamp();
        } else {
            const logViewer = document.getElementById('log-viewer');
            if (logViewer) {
                logViewer.innerHTML = `<span style="color: #f44336;">Error: ${data.error}</span>`;
            }
            if (statusIndicator) statusIndicator.style.opacity = '0.5';
            if (statusText) statusText.textContent = 'Error';
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        const logViewer = document.getElementById('log-viewer');
        if (logViewer) {
            logViewer.innerHTML = `<span style="color: #f44336;">[ERROR] ${error.message}</span>`;
        }
        
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        if (statusIndicator) statusIndicator.style.opacity = '0.5';
        if (statusText) statusText.textContent = 'Connection Error';
    }
}

// Refresh log content manually
function refreshLogContent() {
    const btn = document.querySelector('button[onclick="refreshLogContent()"]');
    if (btn) {
        btn.disabled = true;
        const icon = btn.querySelector('i');
        if (icon) icon.style.animation = 'spin 0.6s linear infinite';
        
        loadLogContent().then(() => {
            btn.disabled = false;
            if (icon) icon.style.animation = '';
        });
        
        setTimeout(() => {
            btn.disabled = false;
            if (icon) icon.style.animation = '';
        }, 600);
    } else {
        loadLogContent();
    }
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    const pauseBtn = document.getElementById('pauseBtn');
    
    if (isLogAutoRefreshActive) {
        // Pause
        isLogAutoRefreshActive = false;
        if (logAutoRefreshInterval) {
            clearInterval(logAutoRefreshInterval);
        }
        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i> Resume';
            pauseBtn.style.background = '#4caf50';
        }
        
        const statusText = document.getElementById('statusText');
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusText) statusText.textContent = 'Paused';
        if (statusIndicator) statusIndicator.style.opacity = '0.3';
    } else {
        // Resume
        isLogAutoRefreshActive = true;
        if (pauseBtn) {
            pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i> Pause';
            pauseBtn.style.background = '#ff9800';
        }
        
        const statusText = document.getElementById('statusText');
        const statusIndicator = document.getElementById('statusIndicator');
        if (statusText) statusText.textContent = 'Connected';
        if (statusIndicator) statusIndicator.style.opacity = '1';
        
        loadLogContent();
        if (logAutoRefreshInterval) clearInterval(logAutoRefreshInterval);
        logAutoRefreshInterval = setInterval(loadLogContent, 5000);
    }
}

// Update "last updated" timestamp
function updateLogTimestamp() {
    const now = new Date();
    const diffSeconds = Math.floor((now - lastLogUpdate) / 1000);
    
    let timeText = 'last updated just now';
    if (diffSeconds >= 60 && diffSeconds < 120) {
        timeText = 'last updated a minute ago';
    } else if (diffSeconds >= 120) {
        const minutes = Math.floor(diffSeconds / 60);
        timeText = `last updated ${minutes} minutes ago`;
    }
    
    const logSubtitle = document.getElementById('logSubtitle');
    if (logSubtitle) {
        logSubtitle.textContent = timeText;
    }
}

// Update timestamp every 30 seconds
setInterval(updateLogTimestamp, 30000);

