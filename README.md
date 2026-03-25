# TXMIT - Transmisi Data KLHK dan HAS

Sistem terintegrasi untuk pengumpulan data kualitas air dari sensor distributed dan transmisi otomatis ke API pemerintah (KLHK - Kementerian Lingkungan Hidup dan HAS - Horizontal Authority System).

**Version:** 1.0.0  
**Status:** Production  
**License:** Proprietary

---

## 📋 Daftar Isi

- [Overview](#overview)
- [Fitur Utama](#fitur-utama)
- [Jenis Proyek & Target User](#jenis-proyek--target-user)
- [Alur Program](#alur-program)
- [Tech Stack](#tech-stack)
- [Struktur Folder](#struktur-folder)
- [Prasyarat](#prasyarat)
- [Instalasi & Setup](#instalasi--setup)
- [Menjalankan Aplikasi](#menjalankan-aplikasi)
- [Konfigurasi](#konfigurasi)
- [API Endpoints](#api-endpoints)
- [Monitoring & Troubleshooting](#monitoring--troubleshooting)
- [Development](#development)

---

## Overview

TXMIT adalah sistem monitoring kualitas air terintegrasi yang dirancang untuk:

1. **Mengumpulkan** data real-time dari multiple water quality sensors (pH, COD, TSS, NH3-N, Flow rate, dll)
2. **Memproses** data dengan validasi dan filtering berdasarkan konfigurasi
3. **Menyimpan** data ke database MySQL lokal
4. **Mengirim** data secara otomatis ke API pemerintah:
   - **KLHK API** - Portal sparing Kementerian Lingkungan Hidup
   - **HAS API** - Horizontal Authority System untuk pelaporan lintas kementerian
5. **Mengelola** retry otomatis untuk pengiriman yang gagal
6. **Menyediakan** dashboard web untuk monitoring dan manajemen konfigurasi

Sistem ini berjalan dalam container Docker dengan multiple processes yang dikelola oleh Supervisor untuk reliability tinggi.

---

## Fitur Utama

✅ **Sensor Data Collection**
- Support multiple sensor types (AT500, RT200, SEM5096, MACE, ISCAN, LTNC, SPECTRO, CONTLYTE, DS502, ARG314)
- CSV file processing automation
- Real-time data ingestion dengan timestamp dan timezone awareness

✅ **Data Management**
- SQLite config storage + MySQL data storage
- Automatic data validation dan filtering
- Deduplication dan duplicate retry mechanism
- Data history logging

✅ **API Integration**
- KLHK API - Environmental data reporting (hourly aggregation)
- HAS API - HAS integration
- JWT token management untuk API authentication
- Automatic retry with configurable intervals

✅ **Web Dashboard**
- Login authentication (default: admin/has123456)
- Real-time statistics monitoring
- Pending data review
- KLHK success transmission history dengan payload inspection
- Configuration management interface
- Support untuk timezone selection (Jakarta/Makassar/Jayapura)

✅ **Reliability Features**
- Multi-process supervision (Supervisor)
- Automatic restart on failure
- Comprehensive logging system
- Log cleanup automation
- Docker containerization

---

## Jenis Proyek & Target User

### Jenis Proyek

**Full-Stack Web Application** dengan komponen:
- **Backend:** Python Flask REST API + Service daemons
- **Frontend:** Responsive web dashboard (HTML/CSS/JavaScript)
- **Database:** MySQL (production data) + SQLite (configuration)
- **Infrastructure:** Docker containerized, Supervisor process management

### Target User

1. **Operators** - Petugas monitoring stasiun air
   - Monitoring dashboard untuk status sistem dan data real-time
   - View transmission history ke API pemerintah
   - Inspect payload yang dikirim (encrypted dan decoded JSON)

2. **System Administrators** - Tim IT/ops
   - Complete configuration management
   - Sensor device management
   - API credential configuration
   - System health monitoring via logs

3. **Environmental Agency Staff** - Data analisis
   - Access ke dashboard untuk review data
   - Export/download capabilities (via pending data section)

---

## Alur Program

### 1. Data Ingestion Pipeline

```
┌─────────────────────────────────────────────────────────┐
│ CSV FILES (dari sensor atau external source)           │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ main.py - CSV Processor (every minute)                  │
│ - Read CSV files dari /app/csv                          │
│ - Parse column mapping & data extraction                │
│ - Validate & convert values to float                    │
│ - Filter: Hanya menit genap (kalibrasi filter)        │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│ MySQL Database - Data Storage                           │
│ - Table: Data sensor (datetime, pH, COD, TSS, dll)     │
│ - Deduplicate check sebelum insert                      │
└────────────────┬────────────────────────────────────────┘
                 │
         ┌───────┴────────┐
         │                │
         ▼                ▼
   [KLHK Flow]    [HAS Flow]
```

### 2. KLHK Transmission Flow

```
┌──────────────────────────────────────────────────────────┐
│ send.py - KLHK Data Sender (scheduled)                   │
│ - Query pending data dari MySQL                           │
│ - Group by waktu transmission (hourly aggregation)        │
│ - Build JWT payload dengan encrypted data               │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Get JWT Token dari KLHK Token URL                     │
│ 2. Encrypt payload menggunakan token                      │
│ 3. Send POST request ke KLHK API endpoint               │
│ 4. Store response & log transmission result             │
└──────────────┬───────────────────────────────────────┘
               │
        ┌──────┴────────┐
        │               │
    [SUCCESS]      [FAILURE]
        │               │
        ▼               ▼
    Store in       Store pending,
    klhk_success   trigger retry.py
    table
```

### 3. HAS Transmission Flow

```
┌──────────────────────────────────────────────────────────┐
│ hasSend.py - HAS API Data Sender (scheduled)             │
│ - Query pending data dari MySQL                           │
│ - Format data sesuai HAS API spec                         │
│ - Send dengan authentication token                        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Build request payload                                 │
│ 2. Send POST ke HAS_API_URL dengan bearer token         │
│ 3. Log transmission result                              │
└──────────────┬───────────────────────────────────────┘
               │
        ┌──────┴────────┐
        │               │
    [SUCCESS]      [FAILURE]
        │               │
        ▼               ▼
    Mark as sent   Retry dengan
                   backoff strategy
```

### 4. Retry Mechanism

```
┌──────────────────────────────────────────────────────────┐
│ retry.py - Failed Transmission Retry Handler             │
│ - Query data dengan status "failed" atau "pending"       │
│ - Check retry count vs MAX_DUP_RETRY (default: 3)       │
│ - Reattempt transmission dengan exponential backoff      │
│ - Update status based on result                          │
└──────────────┬───────────────────────────────────────┘
               │
    ┌──────────┴──────────┐
    │                     │
[Max Retry]          [Success]
    │                     │
    ▼                     ▼
 Mark as           Store in success
 failed            table & clean up
```

### 5. Web Dashboard Flow

```
┌─────────────────────────────────────────────┐
│ User Browser / Web UI                       │
└────────────┬────────────────────────────────┘
             │
      ┌──────┴──────────────────────┐────────────────────┐
      │                             │                    │
      ▼                             ▼                    ▼
┌──────────────┐          ┌──────────────┐        ┌──────────────┐
│ Login Page   │          │ Dashboard    │        │ Config Page  │
│ - Auth       │          │ - Stats      │        │ - Timezone   │
│ - Session    │          │ - MonitorData│        │ - DB config  │
└──────────────┘          │ - KLHK view  │        │ - API config │
                          └──────────────┘        └──────────────┘
      │                      │
      └──────────┬───────────┘
                 │
                 ▼
      [app.py - Flask Routes]
           │     │      │
           ├─────┼──────┼──────── [REST API]
           │     │      │
      /api/ endpoints:
      - /login, /logout
      - /config (GET/POST)
      - /data/stats (GET)
      - /data/pending (GET)
      - /data/klhk-success (GET)
      - /data/filter (POST)
           │
           ▼
      [MySQL/SQLite]
```

### 6. Process Management (Supervisor)

Semua komponen berjalan secara concurrent dan dimonitor by Supervisor:

```
supervisord (master)
├── web_service (app.py) - Flask web server port 5010
├── main_csv (main.py) - CSV processor every minute
├── api_has (hasSend.py) - HAS transmission scheduler
├── klhk_send (send.py) - KLHK transmission scheduler
├── klhk_retry (retry.py) - Retry failed transmissions
└── cleanup_logs (log_cleanup.py) - Automatic log rotation
```

**Catatan:** Masing-masing process memiliki auto-restart policy jika crash.

---

## Tech Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Backend Framework** | Python Flask | 2.3.2 | REST API & web server |
| **Database (Data)** | MySQL | - | Sensor data storage (production)|
| **Database (Config)** | SQLite | - | Application configuration |
| **Language** | Python | 3.11 | Core logic & services |
| **Frontend** | HTML5/CSS3/JavaScript | Vanilla JS | Dashboard & UI |
| **Authentication** | PyJWT | 2.8.0 | API token management |
| **HTTP Client** | requests | 2.32.0 | External API calls |
| **Process Manager** | Supervisor | Latest | Service orchestration |
| **Containerization** | Docker | - | Application deployment |
| **CORS** | Flask-CORS | 4.0.0 | Cross-origin requests |
| **Timezone** | pytz | 2023.3 | Timezone handling |
| **Database Driver** | mysql-connector-python | 8.1.0 | MySQL connection |

---

## Struktur Folder

```
/home/pi/txmit/
├── README.md (documentation - ini file)
├── Dockerfile (container image definition)
├── docker-compose.yml (multi-container orchestration)
├── requirements.txt (Python dependencies)
├── supervisord.conf (process management config)
├── deploy.sh (deployment automation script)
│
├── backend/
│   ├── app.py ⭐ (Flask web server & API routes)
│   │   ├── Login/Auth endpoints
│   │   ├── Config GET/POST endpoints  
│   │   ├── Data API endpoints (stats, pending, klhk-success, filter)
│   │   └── Static file serving (html, css, js)
│   │
│   ├── config.py (configuration manager)
│   │   ├── defaultConfig() - Initialize SQLite with default values
│   │   ├── loadConfig() - Load config dari SQLite
│   │   ├── saveConfig() - Save config ke SQLite
│   │   ├── insert_data() - Insert sensor data ke MySQL
│   │   ├── mysqlConfig() - MySQL connection details
│   │   └── ambilDate(), ambilDateTime() - Query helpers
│   │
│   ├── main.py ⭐ (CSV processor daemon)
│   │   ├── Membaca CSV files dari /app/csv
│   │   ├── Parse headers & column mapping
│   │   ├── Validate & convert data types
│   │   ├── Filter kalibrasi (menit genap)
│   │   └── Insert ke MySQL database
│   │
│   ├── hasSend.py ⭐ (HAS API transmission)
│   │   ├── Query pending data dari MySQL
│   │   ├── Format payload untuk HAS API
│   │   ├── Send dengan authentication
│   │   └── Log transmission results
│   │
│   └── log_cleanup.py (automatic log rotation)
│       ├── Monitor /app/logs/ directory
│       ├── Rotate logs berdasarkan size/age
│       └── Cleanup old log files
│
├── klhk/
│   ├── send.py ⭐ (KLHK API transmission)
│   │   ├── Get JWT token dari KLHK token URL
│   │   ├── Build encrypted JWT payload
│   │   ├── Send POST ke KLHK API endpoint
│   │   ├── Store transmission hasil di klhk_success table
│   │   └── Handle duplicate detection & prevention
│   │
│   └── retry.py ⭐ (Retry failed transmissions)
│       ├── Query failed/pending transmissions
│       ├── Check retry count vs MAX_DUP_RETRY
│       ├── Reattempt dengan exponential backoff  
│       └── Update status based on result
│
├── frontend/
│   ├── index.html (dashboard home page)
│   ├── login.html (authentication page)
│   ├── config.html (configuration management)
│   ├── logs.html (log viewer)
│   │
│   ├── sections/ (reusable page sections)
│   │   ├── config.html (config form)
│   │   ├── dashboard.html (dashboard widgets)
│   │   ├── pending-data.html (pending data table)
│   │   ├── all-data.html (complete data view)
│   │   └── klhk-success.html (transmission history with payload viewer)
│   │
│   ├── components/ (reusable UI components)
│   │   ├── header.html (top navigation)
│   │   └── sidebar.html (side menu)
│   │
│   ├── js/ (frontend logic)
│   │   ├── main.js (global functions, auth, scheduler)
│   │   ├── config.js (configuration form handling)
│   │   ├── dashboard.js (dashboard data loading)
│   │   ├── pending-data.js (pending data management)
│   │   ├── all-data.js (data filtering & viewing)
│   │   ├── klhk-success.js ⭐ (payload viewer & copy utilities)
│   │   └── logs.js (log viewing)
│   │
│   └── css/ (styling)
│       ├── style.css (main styles)
│       ├── dashboard.css (dashboard specific)
│       ├── config.css (config page)
│       ├── pending-data.css
│       ├── all-data.css
│       ├── klhk-success.css
│       ├── logs.css
│       ├── variables.css (design tokens)
│       └── [page-specific css files]
│
├── config/
│   ├── config.db (SQLite database - auto-created)
│   │   └── Table: config (aplikasi settings)
│   │   └── Columns: timezone, db_host, klhk_api_url, etc
│   │   └── Default values di-populate saat first run
│   │
│   └── [other config files if needed]
│
├── csv/
│   └── [sensor CSV files] (auto-processed by main.py)
│       ├── Uploaded atau generated by sensors
│       ├── Format: CSV dengan headers sesuai COLUMN_MAP
│       └── Auto-deleted setelah successful processing
│
├── logs/
│   ├── supervisord.log (supervisor master log)
│   ├── web.log (Flask app log)
│   ├── main.log (CSV processor log)
│   ├── send.log (KLHK transmission log)
│   ├── retry.log (Retry handler log)
│   ├── has-send.log (HAS transmission log)
│   └── [auto-rotated log files]
│
└── [database files]
    └── MySQL database (external, di-docker container db_txmit)
        └── Table: sensor_data (kualitas air measurements)
        └── Table: klhk_success (transmission history)
        └── [other tables]

⭐ = File utama untuk memahami alur program
```

### Database Schema Overview

#### SQLite (config.db)
```sql
config (
  id INTEGER PRIMARY KEY,
  -- general
  port_number_app, port_number_log, timezone,
  -- database
  db_host, db_port, db_name, db_user, db_password,
  -- klhk api
  klhk_status, klhk_api_url, klhk_token_url, klhk_uid,
  klhk_fields, klhk_max_dup_retry, klhk_target_minute,
  -- has api
  has_status, has_api_url, has_token_api, has_fields,
  has_logs_api_url, has_logs_token_api,
  -- dashboard
  parameters, gap_web, web_title, web_name,
  -- device
  device_id, location_name, software_version,
  geo_latitude, geo_longitude
)
```

#### MySQL (production database)
```sql
-- Main sensor data table (exact schema depends on Logix DB implementation)
sensor_data (
  timestamp, datetime, unix_timestamp,
  pH, ORP, TDS, conductivity, DO, salinity,
  NH3-N, battery, depth, flow, total_flow, turbidity,
  TSS, COD, BOD, NO3, water_temp, water_pressure,
  ...
)

-- KLHK transmission history (managed by klhk/send.py)
klhk_success (
  id, timestamp, payload (encrypted), response (server response)
)
```

---

## Prasyarat

### Hardware
- Raspberry Pi 4B+ atau x86_64 server
- Minimal 2GB RAM, 8GB storage
- Network connectivity (ethernet atau WiFi)

### Software
- Docker & Docker Compose
- Python 3.11+ (jika menjalankan tanpa containerization)
- MySQL Server (bisa di Docker atau external)
- Akses internet untuk KLHK/HAS API

### Credentials & Configuration
- Default login: `admin` / `has123456` (change in production!)
- KLHK API credentials (URL, UID)
- HAS API credentials (URL, token)
- MySQL credentials (host, user, password, database)

---

## Instalasi & Setup

### Option 1: Docker Compose (Recommended)

```bash
# 1. Clone repository
git clone <repo-url>
cd /home/pi/txmit

# 2. Verify docker-compose.yml
cat docker-compose.yml

# 3. Build & start containers
docker-compose up -d

# 4. Verify services are running
docker-compose ps

# 5. View logs
docker-compose logs -f txmit
```

### Option 2: Manual Installation

```bash
# 1. Install dependencies
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Initialize configuration
python backend/config.py

# 3. Start supervisor
supervisord -c supervisord.conf

# 4. Verify processes
supervisorctl status
```

### First Run Checklist

- [ ] Containers/services are running
- [ ] Web service accessible at http://localhost:5010
- [ ] Can login with default credentials
- [ ] Configuration page loads
- [ ] MySQL connection test successful
- [ ] Check logs for any errors: `tail -f logs/*.log`

---

## Menjalankan Aplikasi

### Starting Services

```bash
# Docker Compose
docker-compose up -d
docker-compose logs -f txmit  # Monitor logs

# Manual Supervisor
supervisord -c supervisord.conf
supervisorctl start all
supervisorctl status
```

### Web Access

- **Dashboard:** http://localhost:5010
- **Login:** admin / has123456

### Monitoring Processes

```bash
# Docker
docker-compose ps
docker-compose logs -f [service-name]

# Supervisor
supervisorctl status
supervisorctl tail [program-name]
supervisorctl restart [program-name]
```

### Stopping Services

```bash
# Docker
docker-compose down

# Supervisor
supervisorctl stop all
supervisorctl shutdown
```

---

## Konfigurasi

### Timezone Configuration

```
Dashboard → Config Page → General Settings → Timezone

Options:
- Asia/Jakarta (UTC+7) - Default
- Asia/Makassar (UTC+8)
- Asia/Jayapura (UTC+9)

Affects:
- Data timestamp interpretation
- API transmission scheduling
- Log timestamps
```

### Database Configuration

```
Configure in Web Dashboard:
1. DB Host (default: 127.0.0.1)
2. DB Port (default: 3306)
3. DB Name (default: logix)
4. DB User (default: logix)
5. DB Password

Test connection before saving
```

### API Configuration

**KLHK API:**
- Status: Active/Inactive
- API URL: Endpoint untuk send-hourly-vendor
- Token URL: Endpoint untuk secret-sensor (JWT)
- UID: User ID dari KLHK
- Fields: Comma-separated (datetime,pH,cod,tss,nh3n,flow)
- Max Retry: Jumlah percobaan ulang (default: 3)
- Target Minute: Menit target untuk retry (0-59, default: 10)

**HAS API:**
- Status: Active/Inactive
- API URL: Endpoint HAS
- Token: Bearer token untuk authentication
- Fields: Parameter yang dikirim
- Logs API URL: Separate endpoint untuk logs jika ada


### Data Filter Configuration

CSV processing filters (main.py):
- Kalibrasi filter: Hanya ambil menit genap (minute % 2 == 0)
- Data validation: Convert ke float, handle NaN
- Deduplication: Check existing datetime sebelum insert

### System Configuration

```
General Settings:
- Port (Flask): 5010 (default)
- Device ID: Unique identifier perangkat
- Location: Lokasi monitoring station
- Software Version: For tracking

```

---

## API Endpoints

### Authentication

```
POST /api/login
Body: {"username": "admin", "password": "has123456"}
Response: {"success": true, "message": "Login berhasil"}

POST /api/logout
Response: {"success": true, "message": "Logout berhasil"}

GET /api/check-auth
Response: {"authenticated": true/false}
```

### Configuration

```
GET /api/config
Response: {config object dengan semua settings}

POST /api/config
Body: {updated config fields}
Response: {"success": true/false, error message if any}
```

### Data Endpoints

```
GET /api/data/stats
Response: {
  total_data: number,
  pending_data: number,
  sent_data: number,
  klhk_success: number,
  last_sync: "2024-02-10 14:30:00"
}

GET /api/data/pending
Response: {
  success: true,
  data: [array of pending records],
  klhk_fields: "datetime,pH,cod,tss,nh3n,flow"
}

GET /api/data/klhk-success
Response: {
  success: true,
  data: [array of successful KLHK transmissions with payload]
}

POST /api/data/filter
Body: {date_from: "2024-02-01 00:00:00", date_to: "2024-02-10 23:59:59"}
Response: {
  success: true,
  data: [filtered records]
}

GET /api/data/all-data
Response: {
  success: true,
  data: [all sensor records with pagination]
}
```

---

## Monitoring & Troubleshooting

### Check System Health

```bash
# Docker
docker-compose ps
docker-compose logs -f

# Supervisor
supervisorctl status
supervisorctl tail -f [program]

# Manual checks
curl http://localhost:5010/api/check-auth
curl http://localhost:5010/api/data/stats
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Web dashboard not accessible | Flask service not running | `supervisorctl restart web_service` |
| Data not being processed | main.py not running or CSV not in /csv | Check `logs/main.log`, verify CSV format |
| API transmission failing | Authentication, network, invalid config | Check API credentials, test network, verify endpoint |
| Data duplication | Dedup logic not working | Check main.py implementation, verify timestamps |
| High CPU/Memory | Log files too large, processes leaking | Run log cleanup, restart processes |
| Database connection error | Wrong credentials, MySQL down | Verify config, check MySQL container status |

### Viewing Logs

```bash
# Real-time monitoring
tail -f logs/*.log

# Specific service
tail -f logs/send.log          # KLHK transmission
tail -f logs/has-send.log      # HAS transmission
tail -f logs/retry.log         # Retry mechanism
tail -f logs/main.log          # CSV processing
tail -f logs/web.log           # Flask API

# Search for errors
grep -i error logs/*.log
grep -i failed logs/send.log
```

### System Restart

```bash
# Full restart
docker-compose down
docker-compose up -d

# Or with supervisor
supervisorctl restart all

# Individual service restart
supervisorctl restart web_service
supervisorctl restart klhk_send
```

---

## Development

### Project Structure for Developers

**Key Files to Understand (in order):**

1. `backend/config.py` - Configuration system
2. `backend/app.py` - Flask routes & API
3. `klhk/send.py` - KLHK integration logic
4. `backend/main.py` - CSV processing pipeline
5. `klhk/retry.py` - Failure recovery
6. `frontend/js/klhk-success.js` - Payload viewer

### Making Changes

**Backend:**
```bash
# Edit Python files
nano backend/app.py (or use VSCode, vim, etc)

# Test locally
python3 -c "from backend.config import loadConfig; print(loadConfig())"

# Restart service
supervisorctl restart [target-service]
```

**Frontend:**
```bash
# Edit HTML/CSS/JS in frontend/
nano frontend/js/dashboard.js

# Changes apply automatically when container reloads or on page refresh
# No build process needed (vanilla JavaScript)
```

**Configuration:**
```bash
# Changes via web dashboard OR
# Direct SQLite edit
sqlite3 config/config.db "SELECT * FROM config;"
```

### Adding New Features

**Example: Add new sensor type**

1. Update `COLUMN_MAP` in `backend/main.py`
2. Update MySQL schema to include new field
3. Update frontend to display new parameter
4. Update API endpoints if needed
5. Test with sample CSV file

**Example: Add new API integration**

1. Create new file in `/klhk/` or `/backend/` (e.g., `new_api.py`)
2. Implement data formatting & transmission logic
3. Add to `supervisord.conf` as new program
4. Add status/config fields to SQLite schema
5. Add UI fields to configuration page
6. Test transmission with dummy data

### Testing

```bash
# Test CSV processing
python backend/main.py

# Test API endpoints
curl -X GET http://localhost:5010/api/data/stats

# Test KLHK transmission
python klhk/send.py

# Check logs for errors
tail -f logs/*.log
```

### Code Quality Notes

- **Error Handling:** All services have try-catch for MySQL, API calls
- **Logging:** Centralized timestamp-based logging to /app/logs/
- **Configuration:** Hot-reload via loadConfig() calls (no restart needed)
- **Database:** Connection pooling via mysql.connector (verify in production)
- **Security:** JWT tokens for API, session secrets for web auth

---

## Catatan Umum

### Security Considerations
- ⚠️ Default login credentials HARUS diubah di production
- API credentials (KLHK, HAS) disimpan di SQLite - consider encryption
- HTTPS/SSL belum dikonfigurasi - gunakan reverse proxy (nginx) untuk production
- JWT token handling in `klhk/send.py` - verify token validation

### Performance Notes
- CSV processing happens every 1 minute (via scheduler di main.py)
- KLHK/HAS transmission frequency: Configurable per API
- Retry backoff: Exponential, dengan MAX_DUP_RETRY = 3
- Log rotation: Automatic via log_cleanup.py
- Database queries: Consider indexing on timestamp fields untuk large datasets

### Monitoring Recommendations
- Set up external monitoring untuk Docker containers
- Alert pada service restarts atau failures
- Monitor disk usage untuk logs dan database
- Track API transmission success rates
- Monitor MySQL connection pool status

### Known Limitations / Catatan

1. **Database Schema:** Exact MySQL schema untuk sensor_data table tidak terlihat di code - refer to Logix DB documentation
2. **Authentication:** No role-based access control (RBAC) - semua authenticated users memiliki akses penuh
3. **API Response Format:** HAS/KLHK API error handling terbatas - see send.py dan hasSend.py untuk detail
4. **Frontend Persistence:** Data di client-side hanya di session/localStorage - no offline capability
5. **Timezone Handling:** Conversion dilakukan di Python dengan pytz - verify correct handling saat DST
6. **Data Export:** No built-in export to CSV/Excel - manual query dari MySQL diperlukan
7. **Scalability:** Current setup single-instance - untuk multi-location, perlu architecture review

---

## Support & Troubleshooting

Untuk issues atau pertanyaan:

1. Check logs di `/app/logs/` untuk error messages
2. Verify configuration di dashboard Config page
3. Test API connectivity manually dengan curl
4. Check Docker container logs: `docker-compose logs`
5. Verify MySQL connection: `mysql -h 127.0.0.1 -u logix -p logix`

---

**Last Updated:** February 2026  
**Maintained By:** [Abu Bakar]
