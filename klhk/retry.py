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

# Global parameters yang akan di-update dari config
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
TARGET_MINUTE = 10
duplicate_attempt = 0
MYSQL_CONFIG = {}

def reload_config():
    """Reload semua parameter global dari loadConfig()"""
    global TIMEZONE, tz, HOST, USER, PASSWORD, DATABASE, PORT
    global FIELDS, STATUS, API_ENDPOINT, API_JWT, UID, MAX_DUP_RETRY, TARGET_MINUTE, MYSQL_CONFIG
    
    try:
        config = loadConfig()
        
        TIMEZONE = config.get('timezone', 'Asia/Jakarta')
        tz = pytz.timezone(TIMEZONE)
        
        # Database Config
        HOST = config.get('db_host')
        USER = config.get('db_user')
        PASSWORD = config.get('db_password')
        DATABASE = config.get('db_name')
        PORT = config.get('db_port')
        
        # KLHK config
        FIELDS = config.get('klhk_fields', '').split(',')
        FIELDS = [f.strip() for f in FIELDS]  # Hapus whitespace
        STATUS = config.get('klhk_status', 'inactive')
        API_ENDPOINT = config.get('klhk_api_url')
        API_JWT = config.get('klhk_token_url')
        UID = config.get('klhk_uid')
        MAX_DUP_RETRY = int(config.get('klhk_max_dup_retry', 3))
        TARGET_MINUTE = int(config.get('klhk_target_minute', 10))
        
        # MySQL Config
        MYSQL_CONFIG = {
            'host': HOST,
            'user': USER,
            'password': PASSWORD,
            'database': DATABASE,
            'port': int(PORT) if PORT else 3306
        }
        
        return True
    except Exception as e:
        write_log(f"❌ Error reload config: {e}")
        return False

# Load config saat startup
reload_config()

def write_log(message):
    try:
        timestamp = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    except:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")

def get_jwt_token():
    try:
        response = requests.get(API_JWT, timeout=(5, 15))
        if response.status_code == 200:
            jwt_token = response.text.strip()
            if jwt_token:
                write_log(f"✅ Token JWT didapatkan : {jwt_token}")
                return jwt_token
        write_log(f"❌ Gagal dapatkan token, status code: {response.status_code}")
    except requests.exceptions.RequestException as e:
        write_log(f"❌ Error koneksi token API: {e}")
    return None

def ambil_data():
    global duplicate_attempt, FIELDS, STATUS, MYSQL_CONFIG
    duplicate_attempt = 0  # Reset duplicate attempt setiap kali ambil data
    now = datetime.now(tz)
    
    write_log(f"🚀 Fungsi ambil_data() dipanggil - STATUS: {STATUS}")
    
    # Check if STATUS is active (important for scheduled runs, but manual runs should proceed)
    if STATUS.lower() != "active":
        write_log("⚠️ PERINGATAN: KLHK Retry status tidak aktif, namun melanjutkan karena manual trigger")
    
    grouped_data = defaultdict(list)

    try:
        write_log(f"📡 Menghubungkan ke database...")
        with mysql.connector.connect(**MYSQL_CONFIG) as conn:
            with conn.cursor() as cursor:
                query_fields = ", ".join(["`date`"] + FIELDS)
                query = f"SELECT {query_fields} FROM tmp WHERE status='retry' AND `date` < %s"
                write_log(f"🔍 Mencari data retry dengan query: {query}")
                cursor.execute(query, [now])
                rows = cursor.fetchall()

                write_log(f"📊 Ditemukan {len(rows)} baris data retry")
                if not rows:
                    write_log("ℹ️ Tidak ada data retry untuk dikirim.")
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
                        item = {("debit" if field == "flow" else field): row_dict[field] for field in FIELDS}
                        payload.append(item)
                    write_log(f"📊 Mengumpulkan data Retry jam {start} - {end} dengan {len(payload)} entri")
                    send_data_to_api(payload, start, end)
    except mysql.connector.Error as e:
            write_log(f"❌ DB Error: {e}")
    except Exception as e:
        write_log(f"❌ Error ambil_data: {e}")

def send_data_to_api(data, start, end):
    global duplicate_attempt, FIELDS, MYSQL_CONFIG, API_ENDPOINT, API_JWT, UID, MAX_DUP_RETRY
    if not data:
        return

    write_log(f"🚀 Retry kirim data jam {start} - {end}")
    try:
        key_token = get_jwt_token()

        if not key_token:
            return
        
        payload = {"uid": UID, "data": data}
        jwt_header = {"alg": "HS256", "typ": "JWT"}

        try:
            encoded = jwt.encode(payload, key_token, algorithm='HS256', headers=jwt_header)
            write_log(f"📦 Payload JWT: \n{json.dumps(payload, default=str, indent=4)}")
            write_log(f"🔐 Encoded JWT: {encoded}")
        except AttributeError:
            write_log("❌ Gagal encode JWT. Pastikan gunakan `PyJWT`, bukan `jwt` package lain.")
            return

        headers = {'Authorization': f'Bearer {key_token}', 'Content-Type': 'application/json'}
        response = requests.post(API_ENDPOINT, json={"token": encoded}, headers=headers, timeout=(5, 60))
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
                    insert_data_klhk_success(now, encoded, response.text)
                    write_log("✅ Data berhasil dikirim & diproses.")
                else:
                    desc = result.get("desc", "unknown error")
                    write_log(f"⚠️ Gagal kirim: {desc}")
                    if "duplikasi" in desc.lower():
                        duplicate_attempt += 1
                        if duplicate_attempt >= MAX_DUP_RETRY:
                            cursor.execute("UPDATE tmp SET status='Duplikasi', keterangan='Manual check' WHERE `date` >=%s AND `date` <=%s", [start, end])
                            conn.commit()
                            write_log("⚠️ Duplikasi berulang. Pengiriman dihentikan.")
                            return

                        for ts in result.get("data", []):
                            cursor.execute("DELETE FROM tmp WHERE `date` = %s", [ts])
                            write_log(f"🗑️ Hapus duplikat: {ts}")
                        conn.commit()

                        # Re-fetch & resend
                        cursor.execute(f"SELECT {', '.join(FIELDS)} FROM tmp WHERE `date` >=%s AND `date` <=%s", [start, end])
                        rows = cursor.fetchall()
                        if rows:
                            data_cleaned = [dict(zip(FIELDS, row)) for row in rows]
                            send_data_to_api(data_cleaned, start, end)
                        else:
                            write_log("ℹ️ Tidak ada data tersisa setelah hapus duplikat.")
                    else:
                        cursor.execute("UPDATE tmp SET status='retry', keterangan=%s WHERE `date` >=%s AND `date` <=%s", [desc, start, end])
                        conn.commit()

    except Exception as e:
        write_log(f"❌ Error kirim data: {e}")

def scheduler():
    write_log(f"⏱️ Service aktif. Menunggu eksekusi scheduler.")
    last_run = None
    try:
        while True:
            now = datetime.now(tz)
            if now.minute == TARGET_MINUTE and now.second == 0:
                run_time = now.replace(minute=TARGET_MINUTE, second=0, microsecond=0)
                if last_run != run_time:
                    # Reload config setiap kali sebelum eksekusi
                    reload_config()
                    if STATUS.lower() != "active":
                        write_log("ℹ️ Module KLHK Retry tidak aktif. Melewati eksekusi.")
                    else:   
                        write_log(f"⏳ Menjalankan scheduler pada {now}")
                        ambil_data() 
                        
                    last_run = run_time
            time.sleep(1)
    except KeyboardInterrupt:
        write_log("🛑 Service dihentikan manual.")

if __name__ == "__main__":
    scheduler()
    #ambil_data()  # Uncomment jika ingin satu kali jalan
