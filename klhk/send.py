import time
import os
import json
import pytz
import jwt  # Pastikan ini adalah PyJWT
import requests
import mysql.connector
from datetime import datetime
from collections import defaultdict
import sys
sys.path.insert(0, '/app/backend')
from config import loadConfig, insert_data_klhk_success

# Global configuration variables
TIMEZONE = 'Asia/Jakarta'
tz = None
HOST = None
USER = None
PASSWORD = None
DATABASE = None
PORT = None
FIELDS = []
STATUS = None
API_ENDPOINT = None
API_JWT = None
UID = None
MAX_DUP_RETRY = 3
MYSQL_CONFIG = {}
HAS_KLHK_LOG_API_URL = None
HAS_TOKEN_API = None

duplicate_attempt = 0

def update_config():
    """Update all global configuration parameters from loadConfig()"""
    global TIMEZONE, tz, HOST, USER, PASSWORD, DATABASE, PORT, FIELDS, STATUS, API_ENDPOINT, API_JWT, UID, MAX_DUP_RETRY, MYSQL_CONFIG, HAS_KLHK_LOG_API_URL, HAS_TOKEN_API
    
    try:
        config = loadConfig()
        
        TIMEZONE = config.get('timezone', 'Asia/Jakarta')
        tz = pytz.timezone(TIMEZONE)
        
        # Database config
        HOST = config.get('db_host')
        USER = config.get('db_user')
        PASSWORD = config.get('db_password')
        DATABASE = config.get('db_name')
        PORT = int(config.get('db_port', 3306))
        
        # KLHK config
        FIELDS = config.get('klhk_fields', 'datetime,pH,cod,tss,nh3n,flow').split(',')
        STATUS = config.get('klhk_status', 'inactive')
        API_ENDPOINT = config.get('klhk_api_url')
        API_JWT = config.get('klhk_token_url')
        UID = config.get('klhk_uid')
        MAX_DUP_RETRY = int(config.get('klhk_max_dup_retry', 3))
        HAS_KLHK_LOG_API_URL = config.get('has_klhk_log_api_url')
        HAS_TOKEN_API = config.get('has_token_api')
        
        MYSQL_CONFIG = {
            'host': HOST,
            'user': USER,
            'password': PASSWORD,
            'database': DATABASE,
            'port': PORT
        }
    except Exception as e:
        print(f"[ERROR] Gagal update config: {e}")

# Initialize config on startup
update_config()

def write_log(message):
    try:
        timestamp = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    except:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def has_send_log(date_start, date_end):
    global HAS_KLHK_LOG_API_URL, HAS_TOKEN_API, MYSQL_CONFIG, tz

    if not HAS_KLHK_LOG_API_URL or not HAS_TOKEN_API:
        return

    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT device AS device_id, unix_time, `date` AS date_klhk_sent, status, keterangan
            FROM tmp
            WHERE `date` >= %s AND `date` <= %s
            UNION ALL
            SELECT device AS device_id, unix_time, `date` AS date_klhk_sent, status, keterangan
            FROM data
            WHERE `date` >= %s AND `date` <= %s
            ORDER BY date_klhk_sent ASC
        """
        cursor.execute(query, (date_start, date_end, date_start, date_end))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        if not rows:
            return

        payload = []
        for row in rows:
            dt = row['date_klhk_sent']

            payload.append({
                "device_id": row['device_id'],
                "unix_timestamp": row['unix_time'],
                "date_klhk_sent": dt.strftime("%Y-%m-%d %H:%M:%S") if dt else None,
                "is_sent": row['status'] == 'terkirim',
                "response": row['keterangan']
            })

        headers = {
            "X-API-Key": HAS_TOKEN_API,
            "Content-Type": "application/json"
        }
        resp = requests.post(HAS_KLHK_LOG_API_URL, headers=headers, json=payload, timeout=(29, 59))

        if resp.status_code in [200, 201]:
            write_log(f"HAS KLHK Log terkirim: {len(payload)} records ({date_start} s/d {date_end})")
        else:
            write_log(f"HAS KLHK Log gagal: {resp.status_code} - {resp.text}")

    except Exception as e:
        write_log(f"Error has_send_log: {e}")

def get_jwt_token():
    global API_JWT
    try:
        response = requests.get(API_JWT, timeout=(5,15))
        if response.status_code == 200:
            jwt_token = response.text.strip()
            if jwt_token:
                write_log(f"Token JWT didapatkan : {jwt_token}")
                return jwt_token
        write_log(f"Gagal dapatkan token, status code: {response.status_code}")
        return None
    except requests.exceptions.RequestException as e:
        write_log(f"Error koneksi token API: {e}")
        return None

def ambil_data(date_from=None, date_to=None):
    global duplicate_attempt, FIELDS, STATUS, MYSQL_CONFIG, tz
    duplicate_attempt = 0  # Reset duplicate attempt setiap kali ambil data

    now = datetime.now(tz).replace(second=0, microsecond=0) # selalu di detik 00
    now = now.strftime("%Y-%m-%d %H:%M:%S")
    grouped_data = defaultdict(list)
    
    write_log(f"Fungsi ambil_data() dipanggil - STATUS: {STATUS}")
    if date_from or date_to:
        write_log(f"Filter date_from: {date_from}, date_to: {date_to}")
    
    # Check if STATUS is active (important for scheduled runs, but manual runs should proceed)
    if STATUS.lower() != "active":
        write_log("PERINGATAN: KLHK Send status tidak aktif, namun melanjutkan karena manual trigger")

    try:
        write_log(f"Menghubungkan ke database...")
        with mysql.connector.connect(**MYSQL_CONFIG) as conn:
            with conn.cursor() as cursor:
                query_fields = ", ".join(["`date`"] + FIELDS)
                
                # Build query with optional date range filter
                params = []
                query = f"SELECT {query_fields} FROM tmp WHERE status IS NULL"
                
                # Add date range filter if provided
                if date_from and date_to:
                    query += " AND `date` >= %s AND `date` <= %s"
                    params.extend([date_from, date_to])
                else:
                    # Default: only send data before current hour
                    query += " AND `date` < %s"
                    params.append(now)
                
                query += " ORDER BY id ASC"
                write_log(f"Mencari data pending dengan query: {query}")
                write_log(f"Query parameters: {params}")
                cursor.execute(query, params)
                rows = cursor.fetchall()
        
                write_log(f"Ditemukan {len(rows)} baris data pending")
                if not rows:
                    write_log("Tidak ada data pending untuk dikirim.")
                    return

                for row in rows:
                    date_val = row[0]
                    key = f"{date_val.strftime('%Y-%m-%d')} {date_val.hour}:00"
                    grouped_data[key].append(row)

                for key, data in grouped_data.items():
                    start_time = min(entry[0] for entry in data)
                    end_time = max(entry[0] for entry in data)
                    start = start_time.strftime('%Y-%m-%d %H:%M:%S')
                    end = end_time.strftime('%Y-%m-%d %H:%M:%S')

                    payload = []
                    for entry in data:
                        row_dict = dict(zip(["date"] + FIELDS, entry))
                        item = {("debit" if field == "flow" else field): (0 if row_dict[field] is None else row_dict[field]) for field in FIELDS}
                        payload.append(item)

                    write_log(f"Mengumpulkan data jam {start} - {end} dengan {len(payload)} entri")
                    send_data_to_api(payload, start, end)
    except mysql.connector.Error as e:
        write_log(f"DB Error: {e}")
    except Exception as e:
        write_log(f"Error ambil_data: {e}")

def send_data_to_api(data, start, end):
    global duplicate_attempt, FIELDS, MYSQL_CONFIG, UID, MAX_DUP_RETRY, API_ENDPOINT, tz
    
    now = datetime.now(tz)
    if not data:
        write_log("Tidak ada data baru.")
        return

    write_log(f"Mengirim data jam {start} - {end}")
    try:
        key_token = get_jwt_token()
        if not key_token:
            with mysql.connector.connect(**MYSQL_CONFIG) as conn:
                with conn.cursor() as cursor:
                    cursor.execute("UPDATE tmp SET status='retry', keterangan='Gagal dapat token JWT' WHERE `date` >=%s AND `date` <=%s", [start, end])
                    conn.commit()
            write_log("Gagal dapat token JWT.")
            insert_data_klhk_success(now, None, "Gagal dapat token JWT", f'{start} - {end}' , row_send=len(data), status=False, category="send")
            has_send_log(start, end)
            return

        payload = {"uid": UID, "data": data}
        jwt_header = {"alg": "HS256", "typ": "JWT"}

        try:
            encoded = jwt.encode(payload, key_token, algorithm='HS256', headers=jwt_header)
            #write_log(f"Payload JWT: \n{json.dumps(payload, default=str, indent=4)}")
            write_log(f"Encoded JWT: {encoded}")
        except AttributeError:
            write_log("Gagal encode JWT. Pastikan gunakan `PyJWT`, bukan `jwt` package lain.")
            return

        headers = {'Authorization': f'Bearer {key_token}', 'Content-Type': 'application/json'}
        response = requests.post(API_ENDPOINT, json={"token": encoded}, headers=headers, timeout=(15, 60))
        result = response.json()

        write_log(f"API Response : {response.text}")
        with mysql.connector.connect(**MYSQL_CONFIG) as conn:
            with conn.cursor() as cursor:
                if result.get("status"):
                    now = datetime.now(tz)
                    cursor.execute("UPDATE tmp SET dateterkirim=%s, status='terkirim', keterangan='sukses' WHERE `date` >=%s AND `date` <=%s", [now, start, end])
                    cursor.execute("INSERT INTO `data` SELECT * FROM tmp WHERE `date` >=%s AND `date` <=%s", [start, end])
                    cursor.execute("DELETE FROM tmp WHERE `date` >=%s AND `date` <=%s", [start, end])
                    conn.commit()
                    insert_data_klhk_success(now, encoded, response.text, f'{start} - {end}' , row_send=len(data), status=True, category="send")
                    write_log("Data berhasil dikirim & diproses.")

                else:
                    insert_data_klhk_success(now, encoded, response.text, f'{start} - {end}' , row_send=len(data), status=False, category="send")
                    desc = result.get("desc", "unknown error")
                    write_log(f"Gagal kirim: {desc}")

                    if "duplikasi" in desc.lower():
                        cursor.execute("UPDATE tmp SET dateterkirim=%s, status='terkirim', keterangan='Terkirim duplikasi data, Check Manual' WHERE `date` >=%s AND `date` <=%s", [now,start, end])
                        cursor.execute("INSERT INTO `data` SELECT * FROM tmp WHERE `date` >=%s AND `date` <=%s", [start, end])
                        cursor.execute("DELETE FROM tmp WHERE `date` >=%s AND `date` <=%s", [start, end])
                        conn.commit()
                    else:
                        cursor.execute("UPDATE tmp SET status='retry', keterangan=%s WHERE `date` >=%s AND `date` <=%s", [desc, start, end])
                        conn.commit()

        has_send_log(start, end)

    except Exception as e:
        write_log(f"Error kirim data: {e}")
        insert_data_klhk_success(now, None, str(e), f'{start} - {end}' , row_send=len(data), status=False, category="send")
        has_send_log(start, end)

def scheduler():
    global STATUS, tz
    write_log("Service aktif. Menunggu eksekusi setiap jam pada menit ke-0")
    last_run = None
    try:
        while True:
            # Update config setiap iterasi scheduler
            
            
            now = datetime.now(tz)
            if now.minute == 0 and now.second == 0:
                key_time = now.replace(minute=0, second=0, microsecond=0)
                if last_run != key_time:
                    update_config()
                    if STATUS.lower() != "active":
                        write_log("Module KLHK Send tidak aktif. Melewati eksekusi.")
                    else:   
                        write_log(f"Menjalankan scheduler pada {now}")
                        ambil_data()      
                    last_run = key_time
            time.sleep(1)
    except KeyboardInterrupt:
        write_log("Service dihentikan manual.")

if __name__ == "__main__":
    scheduler()
    #ambil_data()  # Uncomment jika ingin satu kali jalan
