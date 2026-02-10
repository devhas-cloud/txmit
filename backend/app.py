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
        WHERE status IS NULL OR status = '' OR status = 'retry'
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
        
        # Data pending
        cursor.execute("SELECT COUNT(*) as pending FROM tmp")
        pending_row = cursor.fetchone()
        pending = pending_row['pending'] if pending_row else 0
        
        # Data sent
        cursor.execute("SELECT COUNT(*) as sent FROM data")
        sent_row = cursor.fetchone()
        sent = sent_row['sent'] if sent_row else 0
        
        # KLHK success
        cursor.execute("SELECT COUNT(*) as klhk_success FROM klhk_json_encode_success")
        klhk_row = cursor.fetchone()
        klhk_success = klhk_row['klhk_success'] if klhk_row else 0
        
        # Last sync
        cursor.execute("SELECT MAX(timestamp) as last_sync FROM klhk_json_encode_success")
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
        device = data.get('device')
        status = data.get('status')
        
        params = []
        
        if table == 'data':
            query = "SELECT * FROM tmp WHERE 1=1"
            
            if date_from:
                query += " AND `date` >= %s"
                params.append(date_from)
            if date_to:
                query += " AND `date` <= %s"
                params.append(date_to)
            if device:
                query += " AND device = %s"
                params.append(device)
            if status:
                query += " AND status = %s"
                params.append(status)
            
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
