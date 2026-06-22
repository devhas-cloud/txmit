import time
import os
import sys
import json
import pytz
import jwt  # Pastikan ini adalah PyJWT
import requests
import mysql.connector
from datetime import datetime
from collections import defaultdict
from config import loadConfig, mysqlConfig

# Initialize timezone early (before any function that uses write_log)
tz = pytz.timezone('Asia/Jakarta')

def write_log(message):
    """Log message with timestamp"""
    timestamp = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}")


# Global configuration parameters
def initConfig():
    """Initialize global configuration from config.db"""
    global STATUS, TIMEZONE, API_ENDPOINT, TOKEN_API, FIELDS, DEVICE_ID, MYSQL_CONFIG, tz
    
    try:
        config = loadConfig()
        
        # Load configuration values
        STATUS = config.get('has_status', 'inactive')
        TIMEZONE = config.get('timezone', 'Asia/Jakarta')
        API_ENDPOINT = config.get('has_api_url')
        TOKEN_API = config.get('has_token_api')
        DEVICE_ID = config.get('device_id')
        
        # Parse FIELDS from comma-separated string
        FIELDS = [field.strip() for field in config.get('has_fields', '').split(',') if field.strip()]
        
        # Set timezone
        tz = pytz.timezone(TIMEZONE)
        
        # Get MySQL configuration
        MYSQL_CONFIG = mysqlConfig()
        
        # Validasi TOKEN_API
        if not TOKEN_API:
            write_log(f"Error: HAS_TOKEN_API tidak diset di config.db")
            return False
        
        # Validasi FIELDS
        if not FIELDS or len(FIELDS) == 0:
            write_log(f"Error: HAS_FIELDS tidak diset atau kosong di config.db")
            return False
        
        return True
        
    except Exception as e:
        write_log(f"❌ Error saat inisialisasi konfigurasi: {e}")
        return False

# Initialize configuration at startup
# if not initConfig():
#     exit(1)


def refreshConfig():
    """Refresh configuration from config.db - useful for dynamic reloading"""
    global STATUS, TIMEZONE, API_ENDPOINT, TOKEN_API, FIELDS, DEVICE_ID, MYSQL_CONFIG, tz
    
    if not initConfig():
        write_log(f"⚠️ Gagal me-refresh konfigurasi")
        return False
    
    write_log(f"✅ Konfigurasi berhasil dimuat ulang dari config.db")
    return True


def ambil_data(fields, date):
    """Ambil data dari tabel 'data' yang belum dikirim (has = '0')"""
    try:
        with mysql.connector.connect(**MYSQL_CONFIG) as conn:
            with conn.cursor() as cursor:
                # Gunakan parameterized query untuk mencegah SQL injection
                field_str = ', '.join(fields)
                query = f"SELECT {field_str} FROM data WHERE has = '0' AND `date`  <= %s ORDER BY `date` ASC LIMIT 1000"
                cursor.execute(query, (date,))
                rows = cursor.fetchall()
                
                if rows:
                    return rows
                else:
                    return None
                
    except mysql.connector.Error as e:
        write_log(f"❌ DB Error: {e}")
        return None
    except Exception as e:
        write_log(f"❌ Error ambil_data: {e}")
        return None



def ambil_tmp(fields, date):
    """Ambil data dari tabel 'tmp' yang belum dikirim (has = '0')"""
    try:
        with mysql.connector.connect(**MYSQL_CONFIG) as conn:
            with conn.cursor() as cursor:
                # Gunakan parameterized query untuk mencegah SQL injection
                field_str = ', '.join(fields)
                query = f"SELECT {field_str} FROM tmp WHERE has = '0' AND `date`  <= %s ORDER BY `date` ASC LIMIT 1000"
                cursor.execute(query, (date,))
                rows = cursor.fetchall()
                
                if rows:
                    return rows
                else:
                    return None
                
    except mysql.connector.Error as e:
        write_log(f"❌ DB Error: {e}")
        return None
    except Exception as e:
        write_log(f"❌ Error ambil_tmp: {e}")
        return None


def proses_data(rows):
    """
    Proses data dari database ke format yang sesuai dengan API HAS.
    Contoh output yang diharapkan:
    [
        {
            "recorded_at": "2024-12-14T10:30:00Z",
            "timestamp": 1702548600,
            "parameter_name": "temperature",
            "value": 25.5
        },
        ...
    ]
    """
    data_list = []
    if not rows:
        return data_list
    
    for row in rows:
        recorded_at = None
        timestamp = None
        
        # First pass: extract unix_time and convert to recorded_at
        for idx, field in enumerate(FIELDS):
            field = field.strip()
            if field == 'unix_time':
                timestamp = row[idx]
                recorded_at = datetime.fromtimestamp(timestamp, tz).isoformat()
                break
        
        # Second pass: create records for each parameter
        for idx, field in enumerate(FIELDS):
            field = field.strip()
            if field != 'unix_time':
                record = {
                    'recorded_at': recorded_at,
                    'timestamp': timestamp,
                    'parameter_name': field,
                    'value': row[idx]
                }
                data_list.append(record)
    
    return data_list

def send_data_to_api(date):
    """Kirim data ke HAS API menggunakan token API dan konfigurasi global"""
    date_str = date.strftime("%Y-%m-%d %H:%M")
    
    headers = {
        "X-API-Key": TOKEN_API,
        "Content-Type": "application/json"
    }
    
    # Ambil dan proses data dari kedua tabel
    data_rows = ambil_data(FIELDS, date_str)
    payloadData = proses_data(data_rows) if data_rows else []
    
    tmp_rows = ambil_tmp(FIELDS, date_str)
    payloadTmp = proses_data(tmp_rows) if tmp_rows else []
    
    # Gabungkan data dari kedua tabel
    payload = {
        "device_id": DEVICE_ID,
        "data": payloadData + payloadTmp
    }

    if not payload["data"]:
        write_log(f"ℹ️ Tidak ada data baru untuk dikirim ke HAS API pada tanggal {date_str}.")
        return False

    try:
        response = requests.post(API_ENDPOINT, headers=headers, json=payload,timeout=(29, 59))
        write_log(f"Payload:\n{json.dumps(payload, indent=4, sort_keys=False)}")

        if response.status_code in [200, 201]:  # 200 OK atau 201 Created
            write_log(f"✅ Data untuk tanggal {date_str} berhasil dikirim ke HAS API.")
            
            # Update status 'has' di database
            try:
                with mysql.connector.connect(**MYSQL_CONFIG) as conn:
                    with conn.cursor() as cursor:
                        # Gunakan parameterized query
                        cursor.execute(
                            "UPDATE data SET has = '1' WHERE `date`  <= %s",
                            (date_str,)
                        )
                        data_updated = cursor.rowcount
                        
                        cursor.execute(
                            "UPDATE tmp SET has = '1' WHERE `date`  <= %s",
                            (date_str,)
                        )
                        tmp_updated = cursor.rowcount
                        
                        conn.commit()
                        write_log(f"✅ Status 'has' diperbarui: {data_updated} rows di 'data', {tmp_updated} rows di 'tmp' untuk tanggal {date_str}")
            except mysql.connector.Error as e:
                write_log(f"❌ DB Error saat memperbarui status 'has': {e}")
            except Exception as e:
                write_log(f"❌ Error saat memperbarui status 'has': {e}")
            return True
        else:
            write_log(f"❌ Gagal mengirim data untuk tanggal {date_str}. Status Code: {response.status_code}, Response: {response.text}")
            return False
    except requests.RequestException as e:
        write_log(f"❌ Error saat mengirim data ke HAS API: {e}")
        return False


def scheduler():
    """Jalankan scheduler untuk mengirim data ke HAS API setiap menit tepat di detik 0, efisien CPU"""
    write_log(f"⏱️ Service HAS aktif. Menunggu jadwal pengiriman data ke HAS API...")

    try:
        while True:
            now = datetime.now(tz)
            
            # Hitung detik tersisa sampai detik 0 menit berikutnya
            seconds_until_next_minute = 60 - now.second - now.microsecond / 1_000_000
            time.sleep(seconds_until_next_minute)
            
            # Saat ini sudah tepat di awal menit
            DATE = datetime.now(tz).replace(second=0, microsecond=0)
            refreshConfig()
            
            if STATUS.lower() == 'active':
                send_data_to_api(DATE)
            else:
                write_log(f"⚠️ Service HAS tidak aktif. Lewati pengiriman data.")
            
    except KeyboardInterrupt:
        write_log(f"🛑 Service HAS dihentikan manual.")

if __name__ == "__main__":
    scheduler()
    """Jalankan proses pembacaan file CSV dari HAS"""
