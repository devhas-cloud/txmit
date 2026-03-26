from flask import Flask, render_template, request, jsonify, session, redirect, url_for, send_from_directory
from flask_cors import CORS
from functools import wraps
import mysql.connector
import sqlite3
import os
from datetime import datetime, timedelta
import pytz
from config import loadConfig, mysqlConfig, ambilDateAll, CONFIG_DB_PATH

# Get the directory paths
backend_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(os.path.dirname(backend_dir), 'frontend')

app = Flask(__name__, static_folder=frontend_dir, static_url_path='', template_folder=frontend_dir)
app.secret_key = 'txmit_secret_key_2024'
CORS(app)

# ==================== AUTHENTICATION ====================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # Default credentials - bisa diubah sesuai kebutuhan
    if username == 'admin' and password == 'has123456':
        session['user'] = username
        session['login_time'] = datetime.now().isoformat()
        return jsonify({'success': True, 'message': 'Login berhasil'}), 200
    
    return jsonify({'success': False, 'message': 'Username atau password salah'}), 401

@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user', None)
    return jsonify({'success': True, 'message': 'Logout berhasil'}), 200

@app.route('/api/check-auth', methods=['GET'])
def check_auth():
    return jsonify({'authenticated': 'user' in session}), 200

# ==================== CONFIG ENDPOINTS ====================

@app.route('/api/config', methods=['GET'])
@login_required
def get_config():
    config = loadConfig()
    
    # Format response - include all config fields
    response = {
        # general
        'port_number_app': config.get('port_number_app', ''),
        'port_number_log': config.get('port_number_log', ''),
        'timezone': config.get('timezone', ''),
        
        # database
        'db_host': config.get('db_host', ''),
        'db_port': config.get('db_port', ''),
        'db_name': config.get('db_name', ''),
        'db_user': config.get('db_user', ''),
        'db_password': config.get('db_password', ''),
        
        # klhk api
        'klhk_status': config.get('klhk_status', ''),
        'klhk_api_url': config.get('klhk_api_url', ''),
        'klhk_token_url': config.get('klhk_token_url', ''),
        'klhk_uid': config.get('klhk_uid', ''),
        'klhk_fields': config.get('klhk_fields', ''),
        'klhk_max_dup_retry': config.get('klhk_max_dup_retry', ''),
        'klhk_target_minute': config.get('klhk_target_minute', ''),
        
        # has api
        'has_status': config.get('has_status', ''),
        'has_api_url': config.get('has_api_url', ''),
        'has_token_api': config.get('has_token_api', ''),
        'has_fields': config.get('has_fields', ''),
        
        # has logs
        'has_logs_api_url': config.get('has_logs_api_url', ''),
        'has_logs_token_api': config.get('has_logs_token_api', ''),
        
        # dashboard/web
        'parameters': config.get('parameters', '').split(',') if config.get('parameters') else [],
        'gap_web': config.get('gap_web', ''),
        'web_title': config.get('web_title', ''),
        'web_name': config.get('web_name', ''),
        
        # device info
        'device_id': config.get('device_id', ''),
        'location_name': config.get('location_name', ''),
        'software_version': config.get('software_version', ''),
        'geo_latitude': config.get('geo_latitude', ''),
        'geo_longitude': config.get('geo_longitude', ''),
    }
    
    print(f"[{datetime.now()}] Config loaded from DB: db_host={response.get('db_host')}, db_name={response.get('db_name')}")
    
    return jsonify(response), 200

@app.route('/api/config', methods=['POST'])
@login_required
def update_config():
    data = request.get_json()
    
    try:
        conn = sqlite3.connect(CONFIG_DB_PATH)
        cursor = conn.cursor()
        
        # List of valid config fields to prevent SQL injection
        valid_fields = {
            'port_number_app', 'port_number_log', 'timezone',
            'db_host', 'db_port', 'db_name', 'db_user', 'db_password',
            'klhk_status', 'klhk_api_url', 'klhk_token_url', 'klhk_uid', 
            'klhk_fields', 'klhk_max_dup_retry', 'klhk_target_minute',
            'has_status', 'has_api_url', 'has_token_api', 'has_fields',
            'has_logs_api_url', 'has_logs_token_api',
            'parameters', 'gap_web', 'web_title', 'web_name',
            'device_id', 'location_name', 'software_version', 'geo_latitude', 'geo_longitude'
        }
        
        # Update each field safely using parameterized queries
        for key, value in data.items():
            # Only update valid fields
            if key not in valid_fields:
                continue
                
            if key == 'parameters' and isinstance(value, list):
                value = ','.join(value)
            
            # Use parameterized query with double quotes for SQLite column names
            cursor.execute(f'UPDATE config SET "{key}"=? WHERE id=1', (value,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        print(f"[{datetime.now()}] Config updated successfully: {list(data.keys())}")
        
        return jsonify({'success': True, 'message': 'Konfigurasi berhasil diperbarui'}), 200
    
    except Exception as e:
        import traceback
        print(f"[{datetime.now()}] Error updating config: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'message': str(e)}), 500

# ==================== MONITORING ENDPOINTS ====================

@app.route('/api/data/pending', methods=['GET'])
@login_required
def get_pending_data():
    """Mendapatkan data yang siap dikirim (belum dikirim ke API)"""
    try:
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get data yang belum dikirim (status != 'sent' atau dateterkirim NULL)
        query = """
        SELECT * FROM tmp 
        WHERE status IS NULL OR status = ''
        ORDER BY `date` DESC 
        LIMIT 1000
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings and handle None values
        for row in rows:
            if isinstance(row.get('date'), datetime):
                row['date'] = row['date'].isoformat()
            if isinstance(row.get('dateterkirim'), datetime):
                row['dateterkirim'] = row['dateterkirim'].isoformat()
            
            # Ensure numeric fields are properly formatted
            for key in ['pH', 'orp', 'tds', 'do', 'conduct', 'flow', 'cod', 'tss', 'bod']:
                if row.get(key) is not None:
                    if isinstance(row[key], (int, float)):
                        row[key] = float(row[key])
        
        # Load config to get klhk_fields
        from config import loadConfig
        config = loadConfig()
        klhk_fields = config.get('klhk_fields', 'datetime,pH,cod,tss,nh3n,flow')
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'data': rows,
            'klhk_fields': klhk_fields
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
@app.route('/api/retry/status', methods=['GET'])
@login_required
def get_retry_status():
    """Get the status of automatic KLHK retry sending"""
    try:
        from config import loadConfig
        config = loadConfig()
        klhk_status = config.get('klhk_status', 'inactive')
        target_minute = config.get('klhk_target_minute', '10')
        
        # Check if retry.py process is running
        import glob
        try:
            is_running = False
            # Scan /proc/*/cmdline to find retry.py process
            for cmdline_file in glob.glob('/proc/[0-9]*/cmdline'):
                try:
                    with open(cmdline_file, 'r') as f:
                        cmdline = f.read().replace('\x00', ' ')
                        # Check if this is "python -u retry.py"
                        if 'python' in cmdline and ' retry.py' in cmdline:
                            is_running = True
                            break
                except (IOError, OSError):
                    continue
        except Exception as e:
            is_running = False
        
        return jsonify({
            'success': True,
            'status': klhk_status,
            'is_running': is_running,
            'target_minute': target_minute,
            'schedule': f'Setiap jam pada menit ke-{target_minute}'
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/retry/manual', methods=['POST'])
@login_required
def manual_retry():
    """Trigger manual KLHK retry data sending with optional date range"""
    try:
        from config import loadConfig
        config = loadConfig()
        klhk_status = config.get('klhk_status', 'inactive')
        
        if klhk_status.lower() != 'active':
            return jsonify({
                'success': False,
                'error': 'KLHK retry module is not active. Please enable it in configuration.'
            }), 400
        
        # Extract optional date parameters from request
        request_data = request.get_json(force=True, silent=True) or {}
        date_from = request_data.get('date_from')
        date_to = request_data.get('date_to')
        
        # Check if there's data to retry
        try:
            mysql_config = mysqlConfig()
            conn = mysql.connector.connect(**mysql_config)
            cursor = conn.cursor()
            
            # Build COUNT query based on whether date filters are provided
            if date_from and date_to:
                cursor.execute("SELECT COUNT(*) FROM tmp WHERE status='retry' AND `date` >= %s AND `date` <= %s", (date_from, date_to))
                operation_type = "filtered"
                print(f"[RETRY] Counting filtered data: from {date_from} to {date_to}")
            else:
                cursor.execute("SELECT COUNT(*) FROM tmp WHERE status='retry'")
                operation_type = "all"
                print(f"[RETRY] Counting all retry data")
            
            retry_count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            
            if retry_count == 0:
                return jsonify({
                    'success': False,
                    'error': 'Tidak ada data retry untuk dikirim. Silakan periksa data di tabel.'
                }), 400
        except Exception as db_error:
            # If DB check fails, continue anyway
            retry_count = 0
            print(f"[RETRY] DB check failed: {db_error}")
        
        # Import and run the retry function
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(backend_dir), 'klhk'))
        
        try:
            from retry import ambil_data, reload_config
            
            # Wrapper function to reload config before running
            def manual_retry_wrapper():
                # Redirect stdout to retry.log
                import sys
                log_file = open('/app/logs/retry.log', 'a')
                sys.stdout = log_file
                sys.stderr = log_file
                
                try:
                    reload_config()  # Reload config to ensure STATUS is active
                    ambil_data(date_from=date_from, date_to=date_to)
                finally:
                    log_file.flush()
                    log_file.close()
                    sys.stdout = sys.__stdout__
                    sys.stderr = sys.__stderr__
            
            # Run in a thread to avoid blocking
            import threading
            thread = threading.Thread(target=manual_retry_wrapper)
            thread.daemon = True
            thread.start()
            
            print(f"[RETRY] Manual retry triggered - count: {retry_count}, type: {operation_type}")
            return jsonify({
                'success': True,
                'count': retry_count,
                'type': operation_type,
                'message': f'Pengiriman ulang manual berhasil dipicu untuk {retry_count} data. Periksa log untuk detail.'
            }), 200
            
        except Exception as retry_error:
            return jsonify({
                'success': False,
                'error': f'Failed to trigger retry: {str(retry_error)}'
            }), 500
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
@app.route('/api/data/retry', methods=['GET'])
@login_required
def get_retry_data():
    """Mendapatkan data yang statusnya retry (gagal kirim sebelumnya)"""
    try:
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get data dengan status 'retry'
        query = """
        SELECT * FROM tmp 
        WHERE status = 'retry'
        ORDER BY `date` DESC 
        LIMIT 1000
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings and handle None values
        for row in rows:
            if isinstance(row.get('date'), datetime):
                row['date'] = row['date'].isoformat()
            if isinstance(row.get('dateterkirim'), datetime):
                row['dateterkirim'] = row['dateterkirim'].isoformat()
            
            # Ensure numeric fields are properly formatted
            for key in ['pH', 'orp', 'tds', 'do', 'conduct', 'flow', 'cod', 'tss', 'bod']:
                if row.get(key) is not None:
                    if isinstance(row[key], (int, float)):
                        row[key] = float(row[key])
        
        # Load config to get klhk_fields
        from config import loadConfig
        config = loadConfig()
        klhk_fields = config.get('klhk_fields', 'datetime,pH,cod,tss,nh3n,flow')
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'data': rows,
            'klhk_fields': klhk_fields
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/data/klhk-success', methods=['GET'])
@login_required
def get_klhk_success():
    """Mendapatkan data pengiriman KLHK yang berhasil"""
    try:
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get data dari tabel klhk_json_encode_success
        query = """
        SELECT * FROM klhk_json_encode_success WHERE status = 1
        ORDER BY timestamp DESC 
        LIMIT 10
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings
        for row in rows:
            if isinstance(row.get('timestamp'), datetime):
                row['timestamp'] = row['timestamp'].isoformat()
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'data': rows
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/data/klhk-logs', methods=['GET'])
@login_required
def get_klhk_logs():
    """Mendapatkan data pengiriman KLHK yang berhasil"""
    try:
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Get data dari tabel klhk_json_encode_success
        query = """
        SELECT * FROM klhk_json_encode_success
        ORDER BY timestamp DESC 
        LIMIT 1000
        """
        
        cursor.execute(query)
        rows = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Convert datetime objects to strings
        for row in rows:
            if isinstance(row.get('timestamp'), datetime):
                row['timestamp'] = row['timestamp'].isoformat()
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'data': rows
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/data/stats', methods=['GET'])
@login_required
def get_data_stats():
    """Mendapatkan statistik data pengiriman"""
    try:
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Total data (dari tmp dan data table)
        cursor.execute("SELECT COUNT(*) as total FROM tmp")
        tmp_count = cursor.fetchone()
        total_tmp = tmp_count['total'] if tmp_count else 0
        
        cursor.execute("SELECT COUNT(*) as total FROM data")
        data_count = cursor.fetchone()
        total_data = data_count['total'] if data_count else 0
        
        total = total_tmp + total_data
        
        # Data pending (status NULL atau empty)
        cursor.execute("SELECT COUNT(*) as pending FROM tmp WHERE status IS NULL OR status = ''")
        pending_row = cursor.fetchone()
        pending = pending_row['pending'] if pending_row else 0
        
        # Data retry (status = 'retry')
        cursor.execute("SELECT COUNT(*) as retry FROM tmp WHERE status = 'retry'")
        retry_row = cursor.fetchone()
        retry = retry_row['retry'] if retry_row else 0
        
        # Data sent
        cursor.execute("SELECT COUNT(*) as sent FROM data")
        sent_row = cursor.fetchone()
        sent = sent_row['sent'] if sent_row else 0
        
        # KLHK success
        cursor.execute("SELECT COUNT(*) as klhk_success FROM klhk_json_encode_success WHERE status = 1")
        klhk_row = cursor.fetchone()
        klhk_success = klhk_row['klhk_success'] if klhk_row else 0
        
        # Last sync
        cursor.execute("SELECT MAX(timestamp) as last_sync FROM klhk_json_encode_success WHERE status = 1")
        last_sync_row = cursor.fetchone()
        if last_sync_row and last_sync_row['last_sync']:
            last_sync = last_sync_row['last_sync'].isoformat() if isinstance(last_sync_row['last_sync'], datetime) else str(last_sync_row['last_sync'])
        else:
            last_sync = 'Belum ada data'
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'stats': {
                'total_data': total,
                'pending_data': pending,
                'retry_data': retry,
                'sent_data': sent,
                'klhk_success': klhk_success,
                'last_sync': last_sync
            }
        }), 200
    
    except Exception as e:
        import traceback
        print(f"Error in get_data_stats: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/send/status', methods=['GET'])
@login_required
def get_send_status():
    """Get the status of automatic KLHK sending"""
    try:
        from config import loadConfig
        config = loadConfig()
        klhk_status = config.get('klhk_status', 'inactive')
        target_minute = 0
        
        # Check if send.py process is running
        # Note: pgrep is not available in slim Docker image, use /proc instead
        import glob
        try:
            is_running = False
            # Scan /proc/*/cmdline to find send.py process
            for cmdline_file in glob.glob('/proc/[0-9]*/cmdline'):
                try:
                    with open(cmdline_file, 'r') as f:
                        cmdline = f.read().replace('\x00', ' ')
                        # Check if this is "python -u send.py" (not hasSend.py)
                        if 'python' in cmdline and ' send.py' in cmdline:
                            is_running = True
                            break
                except (IOError, OSError):
                    # Process might have terminated, skip
                    continue
        except Exception as e:
            is_running = False
        
        return jsonify({
            'success': True,
            'status': klhk_status,
            'is_running': is_running,
            'target_minute': target_minute,
            'schedule': f'Setiap jam pada menit ke-{target_minute}'
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/send/manual', methods=['POST'])
@login_required
def manual_send():
    """Trigger manual KLHK data sending"""
    try:
        from config import loadConfig
        config = loadConfig()
        klhk_status = config.get('klhk_status', 'inactive')
        
        if klhk_status.lower() != 'active':
            return jsonify({
                'success': False,
                'error': 'KLHK send module is not active. Please enable it in configuration.'
            }), 400
        
        # Extract optional date range from request (handle empty/malformed body)
        try:
            request_data = request.get_json(force=True, silent=True) or {}
        except Exception as json_error:
            print(f"[SEND] JSON parse error: {str(json_error)}, using empty dict")
            request_data = {}
        
        date_from = request_data.get('date_from')
        date_to = request_data.get('date_to')
        
        print(f"[SEND] Manual send triggered. date_from={date_from}, date_to={date_to}")
        
        # Check if there's data to send
        try:
            mysql_config = mysqlConfig()
            conn = mysql.connector.connect(**mysql_config)
            cursor = conn.cursor()
            
            # Count data with optional date range filter
            if date_from and date_to:
                cursor.execute(
                    "SELECT COUNT(*) FROM tmp WHERE (status IS NULL OR status = '') AND `date` >= %s AND `date` <= %s",
                    [date_from, date_to]
                )
                print(f"[SEND] Filtering count with date_from={date_from}, date_to={date_to}")
            else:
                cursor.execute("SELECT COUNT(*) FROM tmp WHERE status IS NULL OR status = ''")
                print(f"[SEND] Counting all pending data (no date filter)")
            
            pending_count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            
            if pending_count == 0:
                error_msg = 'Tidak ada data pending untuk dikirim dalam range tanggal tersebut.' if (date_from and date_to) else 'Tidak ada data pending untuk dikirim. Silakan periksa data di tabel.'
                return jsonify({
                    'success': False,
                    'error': error_msg
                }), 400
            
            print(f"[SEND] Found {pending_count} rows to send")
        except Exception as db_error:
            print(f"[SEND] Database error during count: {str(db_error)}")
            # If DB check fails, continue anyway
            pending_count = 0
        
        # Import and run the send function
        import sys
        sys.path.insert(0, os.path.join(os.path.dirname(backend_dir), 'klhk'))
        
        try:
            from send import ambil_data, update_config
            
            # Wrapper function to update config before running
            def manual_send_wrapper():
                # Redirect stdout to send.log
                import sys
                log_file = open('/app/logs/send.log', 'a')
                sys.stdout = log_file
                sys.stderr = log_file
                
                try:
                    update_config()  # Reload config to ensure STATUS is active
                    # Pass date parameters to ambil_data if provided
                    ambil_data(date_from=date_from, date_to=date_to)
                finally:
                    log_file.flush()
                    log_file.close()
                    sys.stdout = sys.__stdout__
                    sys.stderr = sys.__stderr__
            
            # Run in a thread to avoid blocking
            import threading
            thread = threading.Thread(target=manual_send_wrapper)
            thread.daemon = True
            thread.start()
            
            send_type = 'filtered' if (date_from and date_to) else 'all'
            return jsonify({
                'success': True,
                'message': f'Pengiriman manual {send_type} berhasil dipicu untuk {pending_count} data. Periksa log untuk detail.',
                'count': pending_count,
                'type': send_type
            }), 200
            
        except Exception as send_error:
            print(f"[SEND] Error triggering send: {str(send_error)}")
            return jsonify({
                'success': False,
                'error': f'Failed to trigger send: {str(send_error)}'
            }), 500
    
    except Exception as e:
        print(f"[SEND] Unexpected error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500



@app.route('/api/data/filter', methods=['POST'])
@login_required
def filter_data():
    """Filter data berdasarkan kriteria tertentu"""
    try:
        data = request.get_json()
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build query with parameterized statements to prevent SQL injection
        table = data.get('table', 'data')  # 'data' atau 'klhk'
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        
        params = []
        
        # Debug logging
        print(f"[FILTER] Table: {table}, Date From: {date_from}, Date To: {date_to}")
        
        if table == 'data':
            # Filter pending data (belum terkirim) - query dari tmp table
            query = "SELECT * FROM tmp WHERE (status IS NULL OR status = '')"
            
            if date_from:
                query += " AND `date` >= %s"
                params.append(date_from)
            if date_to:
                query += " AND `date` <= %s"
                params.append(date_to)
            
            query += " ORDER BY `date` DESC LIMIT 1000"
        
        elif table == 'klhk':
            query = "SELECT * FROM klhk_json_encode_success WHERE 1=1"
            
            if date_from:
                query += " AND timestamp >= %s"
                params.append(date_from)
            if date_to:
                query += " AND timestamp <= %s"
                params.append(date_to)
            
            query += " ORDER BY timestamp DESC LIMIT 1000"
        
        print(f"[FILTER] Query: {query}")
        print(f"[FILTER] Params: {params}")
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        print(f"[FILTER] Result count: {len(rows)}")
        
        # Convert datetime
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        
        cursor.close()
        conn.close()
        
        # Load klhk_fields from config
        from config import loadConfig
        config = loadConfig()
        klhk_fields = config.get('klhk_fields', 'datetime,pH,cod,tss,nh3n,flow')
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'taggal': f"{date_from} s/d {date_to}",
            'data': rows,
            'klhk_fields': klhk_fields
        }), 200
    
    except Exception as e:
        print(f"[FILTER ERROR] {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/retry/filter', methods=['POST'])
@login_required
def filter_retry_data():
    """Filter data retry berdasarkan kriteria tertentu"""
    try:
        data = request.get_json()
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        # Build query with parameterized statements to prevent SQL injection
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        
        params = []
        
        query = "SELECT * FROM tmp WHERE status = 'retry'"
        
        if date_from:
            query += " AND `date` >= %s"
            params.append(date_from)
        if date_to:
            query += " AND `date` <= %s"
            params.append(date_to)
        
        query += " ORDER BY `date` DESC LIMIT 1000"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert datetime
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'data': rows
        }), 200
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/data/all', methods=['POST'])
@login_required
def get_all_data():
    """Mendapatkan semua data (union dari tabel data dan tmp)"""
    try:
        data = request.get_json()
        mysql_config = mysqlConfig()
        conn = mysql.connector.connect(**mysql_config)
        cursor = conn.cursor(dictionary=True)
        
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        
        params = []
        date_col = '`date`'
        
        # Build UNION query to get data from both data and tmp tables
        query = f"""
        SELECT * FROM (
            SELECT * FROM data WHERE 1=1
        """
        
        if date_from:
            query += f" AND {date_col} >= %s"
            params.append(date_from)
        if date_to:
            query += f" AND {date_col} <= %s"
            params.append(date_to)
        
        query += f"""
            UNION ALL
            SELECT * FROM tmp WHERE 1=1
        """
        
        if date_from:
            query += f" AND {date_col} >= %s"
            params.append(date_from)
        if date_to:
            query += f" AND {date_col} <= %s"
            params.append(date_to)
        
        query += f"""
        ) AS combined_data
        ORDER BY {date_col} DESC
        LIMIT 1000
        """
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert datetime
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        
        # Get has_fields from config
        from config import loadConfig
        config = loadConfig()
        has_fields = config.get('has_fields', 'datetime,pH,cod,tss,nh3n,flow')
        
        cursor.close()
        conn.close()
        
        return jsonify({
            'success': True,
            'count': len(rows),
            'data': rows,
            'has_fields': has_fields
        }), 200
    
    except Exception as e:
        import traceback
        print(f"Error in get_all_data: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/logs/<log_type>', methods=['GET'])
@login_required
def get_logs(log_type):
    """Mendapatkan log files dari folder logs"""
    try:
        # Validasi log_type
        valid_logs = ['web','main', 'send', 'retry', 'has-send']
        if log_type not in valid_logs:
            return jsonify({'success': False, 'error': 'Invalid log type'}), 400
        
        logs_dir = '/app/logs'
        log_file = os.path.join(logs_dir, f'{log_type}.log')
        
        # Check if file exists
        if not os.path.exists(log_file):
            return jsonify({
                'success': True,
                'count': 0,
                'data': [],
                'message': f'Log file {log_type}.log not found'
            }), 200
        
        # Read log file - last N lines
        lines = []
        try:
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                all_lines = f.readlines()
                # Get last 1000 lines
                lines = all_lines[-1000:]
        except Exception as e:
            return jsonify({'success': False, 'error': f'Error reading log file: {str(e)}'}), 500
        
        # Format log lines with timestamp and sequence number
        formatted_logs = []
        for idx, line in enumerate(lines):
            formatted_logs.append({
                'no': len(lines) - idx,  # Reverse numbering (highest first)
                'message': line.strip(),
                'timestamp': datetime.now().isoformat()
            })
        
        return jsonify({
            'success': True,
            'count': len(formatted_logs),
            'data': formatted_logs,
            'log_type': log_type
        }), 200
    
    except Exception as e:
        import traceback
        print(f"Error in get_logs: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'success': False, 'error': str(e)}), 500

# ==================== STATIC ROUTES ====================

@app.route('/', methods=['GET'])
def index():
    if 'user' in session:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login_page'))

@app.route('/login', methods=['GET'])
def login_page():
    return send_from_directory(frontend_dir, 'login.html')

@app.route('/dashboard', methods=['GET'])
def dashboard():
    if 'user' not in session:
        return redirect(url_for('login_page'))
    return send_from_directory(frontend_dir, 'index.html')

@app.route('/config', methods=['GET'])
def config_page():
    if 'user' not in session:
        return redirect(url_for('login_page'))
    return send_from_directory(frontend_dir, 'index.html')

@app.route('/logs.html', methods=['GET'])
def logs_page():
    if 'user' not in session:
        return redirect(url_for('login_page'))
    return send_from_directory(frontend_dir, 'logs.html')

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(error):
    return send_from_directory(frontend_dir, '404.html'), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error'}), 500

if __name__ == '__main__':
    # Load config dan jalankan app
    config = loadConfig()
    port = int(config.get('port_number_app', 5010))
    
    app.run(
        host='0.0.0.0',
        port=port,
        debug=True
    )
