import mysql.connector
import sqlite3
import os
import pytz
import time
from datetime import datetime

CONFIG_DIR = "/app/config"
CONFIG_DB_NAME = "config.db"
CONFIG_DB_PATH = os.path.join(CONFIG_DIR, CONFIG_DB_NAME)


def defaultConfig():
    config_dir = CONFIG_DIR
    db_path = CONFIG_DB_PATH

    # Pastikan folder config ada
    os.makedirs(config_dir, exist_ok=True)

    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Buat tabel config
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS config (
            id INTEGER PRIMARY KEY,

            -- general
            port_number_app TEXT,
            port_number_log TEXT,
            timezone TEXT,

            -- database
            db_host TEXT,
            db_port TEXT,
            db_name TEXT,
            db_user TEXT,
            db_password TEXT,

            -- klhk api
            klhk_status TEXT,
            klhk_api_url TEXT,
            klhk_token_url TEXT,
            klhk_uid TEXT,
            klhk_fields TEXT,
            klhk_max_dup_retry TEXT,
            klhk_target_minute TEXT,

            -- has api
            has_status TEXT,
            has_api_url TEXT,
            has_token_api TEXT,
            has_fields TEXT,

            -- has logs
            has_logs_api_url TEXT,
            has_logs_token_api TEXT,

            -- dashboard/web
            parameters TEXT,
            gap_web TEXT,
            web_title TEXT,
            web_name TEXT,

            -- device info
            device_id TEXT,
            location_name TEXT,
            software_version TEXT,
            geo_latitude TEXT,
            geo_longitude TEXT
        )
        """)

        configurations = {
            # general
            "port_number_app": "5010",
            "port_number_log": "3000",
            "timezone": "Asia/Jakarta",

            # database
            "db_host": "127.0.0.1",
            "db_port": "3306",
            "db_name": "logix",
            "db_user": "logix",
            "db_password": "logix",

            # klhk api
            "klhk_status": "inactive",
            "klhk_api_url": "https://sparing.kemenlh.go.id/api/send-hourly-vendor",
            "klhk_token_url": "https://sparing.kemenlh.go.id/api/secret-sensor",
            "klhk_uid": "",
            "klhk_fields": "datetime,pH,cod,tss,nh3n,flow",
            "klhk_max_dup_retry": "3",
            "klhk_target_minute": "10",

            # has api
            "has_status": "inactive",
            "has_api_url": "https://api.hasportal.com/api/v1/data",
            "has_token_api": "",
            "has_fields": "datetime,pH,cod,tss,nh3n,flow,wtemp,orp,turb,tds,conduct,do,depth,bod,wpress",

            # has logs
            "has_logs_api_url": "https://api.hasportal.com/api/v1/logs",
            "has_logs_token_api": "",

            # dashboard/web
            "parameters": "pH,cod,tss,nh3n,flow,wtemp,orp,turb,tds,conduct,do,depth,bod,wpress",
            "gap_web": "3",
            "web_title": "WQMS",
            "web_name": "Water Quality Monitoring System",

            # device info
            "device_id": "HSP-xxxxxx",
            "location_name": "PT. Has Environmental",
            "software_version": "1.0.0",
            "geo_latitude": "-6.5224399",
            "geo_longitude": "106.8384747"
        }

        # Check if config with id=1 already exists
        cursor.execute("SELECT COUNT(*) as count FROM config WHERE id=1")
        exists = cursor.fetchone()[0] > 0
        
        # Only insert default values if config doesn't exist
        if not exists:
            columns = ", ".join(configurations.keys())
            placeholders = ", ".join(["?"] * len(configurations))
            values = list(configurations.values())

            cursor.execute(f"""
            INSERT INTO config (id, {columns})
            VALUES (1, {placeholders})
            """, values)

        conn.commit()

    except Exception as e:
        print("Error pada defaultConfig:", e)

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def loadConfig():
    defaultConfig()
    conn = sqlite3.connect(CONFIG_DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM config WHERE id=1")
    row = cursor.fetchone()
    columns = [desc[0] for desc in cursor.description]
    config = dict(zip(columns, row))
    cursor.close()
    conn.close()
    return config

def mysqlConfig():
    config = loadConfig()
    HOST = config['db_host']
    USER = config['db_user']
    PASSWORD = config['db_password']
    DATABASE = config['db_name']
    PORT = config['db_port']
    
    
    # MySQL connection configuration
    MYSQL_CONFIG = {
        'host': HOST,
        'user': USER,
        'password': PASSWORD,
        'database': DATABASE,
        'port': PORT
    }

    return MYSQL_CONFIG

def ambilDateAll():
    tz = loadConfig()['timezone']
    tz = pytz.timezone(tz)
    timestamp = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    return timestamp

def ambilDate():
    tz = loadConfig()['timezone']
    tz = pytz.timezone(tz)
    date = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    return date

def ambilDateTime():
    tz = loadConfig()['timezone']
    tz = pytz.timezone(tz)
    Interval_Timestamp = datetime.strptime(ambilDateAll(), '%Y-%m-%d %H:%M:%S')
    unix_dt = int(time.mktime(Interval_Timestamp.timetuple()))
    return unix_dt
      
def cekTable():
    try:
        MYSQL_CONFIG = mysqlConfig()
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        # Buat tabel jika belum ada
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS data (
                id INT AUTO_INCREMENT PRIMARY KEY,
                device TEXT,
                `date` DATETIME,
                datetime BIGINT DEFAULT 0,
                pH FLOAT DEFAULT 0,
                orp FLOAT DEFAULT 0,
                tds FLOAT DEFAULT 0,
                conduct FLOAT DEFAULT 0,
                do FLOAT DEFAULT 0,
                salinity FLOAT DEFAULT 0,
                nh3n FLOAT DEFAULT 0,
                battery FLOAT DEFAULT 0,
                depth FLOAT DEFAULT 0,
                flow FLOAT DEFAULT 0,
                tflow FLOAT DEFAULT 0,
                turb FLOAT DEFAULT 0,
                tss FLOAT DEFAULT 0,
                cod FLOAT DEFAULT 0,
                bod FLOAT DEFAULT 0,
                no3 FLOAT DEFAULT 0,
                wtemp FLOAT DEFAULT 0,
                wpress FLOAT DEFAULT 0,
                status TEXT,
                keterangan TEXT,
                dateterkirim DATETIME,
                has INT DEFAULT 0 
            )
        ''')
        conn.commit()

        cursor.execute('''
           CREATE TABLE IF NOT EXISTS tmp (
                id INT AUTO_INCREMENT PRIMARY KEY,
                device TEXT,
                `date` DATETIME,
                datetime BIGINT DEFAULT 0,
                pH FLOAT DEFAULT 0,
                orp FLOAT DEFAULT 0,
                tds FLOAT DEFAULT 0,
                conduct FLOAT DEFAULT 0,
                do FLOAT DEFAULT 0,
                salinity FLOAT DEFAULT 0,
                nh3n FLOAT DEFAULT 0,
                battery FLOAT DEFAULT 0,
                depth FLOAT DEFAULT 0,
                flow FLOAT DEFAULT 0,
                tflow FLOAT DEFAULT 0,
                turb FLOAT DEFAULT 0,
                tss FLOAT DEFAULT 0,
                cod FLOAT DEFAULT 0,
                bod FLOAT DEFAULT 0,
                no3 FLOAT DEFAULT 0,
                wtemp FLOAT DEFAULT 0,
                wpress FLOAT DEFAULT 0,
                status TEXT,
                keterangan TEXT,
                dateterkirim DATETIME,
                has INT DEFAULT 0 
            )
        ''')
        conn.commit()


        #buat tabel  klhk json encode sukses
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS klhk_json_encode_success (
                id INT AUTO_INCREMENT PRIMARY KEY,
                timestamp DATETIME,
                payload TEXT,
                response TEXT,
                date_send TEXT DEFAULT NULL,
                row_send INT DEFAULT 0,
                status BOOLEAN DEFAULT 0

            )
        ''')
        conn.commit()
        
    except Exception as e:
        print(f"[{datetime.now()}] Error pada koneksi database: {e}")
        return    

def check_duplicate_data(device, date, table='tmp'):
    """
    Cek apakah data dengan device dan date yang sama sudah ada di database.
    Mengabaikan detik dalam perbandingan (hanya membandingkan sampai menit).
    
    Args:
        device: ID device
        date: Datetime object atau string dalam format '%Y-%m-%d %H:%M:%S'
        table: Nama tabel yang akan dicek ('tmp' atau 'data')
    
    Returns:
        True jika data sudah ada, False jika belum ada
    """
    try:
        MYSQL_CONFIG = mysqlConfig()
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()
        
        # Cek di tabel tmp dan data
        for tbl in ['tmp', 'data']:
            query = f"""
                SELECT COUNT(*) FROM {tbl}
                WHERE device = %s AND DATE_FORMAT(date, '%Y-%m-%d %H:%i') = DATE_FORMAT(%s, '%Y-%m-%d %H:%i')
            """
            cursor.execute(query, (device, date))
            result = cursor.fetchone()
            
            if result and result[0] > 0:
                cursor.close()
                conn.close()
                return True
        
        cursor.close()
        conn.close()
        return False
        
    except Exception as e:
        print(f"[ERROR] Gagal mengecek duplicate data: {e}")
        return False


def insert_data(date, datetime, ph, orp, tds, conduct, do, salinity, nh3n, battery, depth, flow, tflow, turb, tss, cod, bod, no3, wtemp, wpress):
    """
    Insert data ke database tmp table.
    Jika device dan date yang sama sudah ada, maka skip insertion.
    
    Args:
        date: Datetime object atau string
        datetime: Unix timestamp
        ph, orp, tds, ... : parameter sensor
        
    Returns:
        True jika data berhasil diinsert, False jika duplicate/gagal
    """
    
    device = loadConfig()['device_id']
    cekTable()
    
    # Cek apakah data dengan device dan date yang sama sudah ada
    if check_duplicate_data(device, date):
        print(f"[SKIP] Data dengan device '{device}' dan date '{date}' sudah ada di database. Pembacaan dilewati.")
        return False
    
    query = """
        INSERT INTO tmp (device, date, datetime, ph, orp, tds, conduct, do, salinity, nh3n, battery, depth, flow, tflow, turb, tss, cod, bod, no3, wtemp, wpress)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
    try:
        MYSQL_CONFIG = mysqlConfig()
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()

        values = (
            device,
            date, datetime,
            ph, orp, tds, conduct, do, salinity, nh3n, battery, depth, flow, tflow, turb, tss, cod, bod, no3, wtemp, wpress
        )
        
        cursor.execute(query, values)
        conn.commit()

        print(f"[INFO] Data berhasil dimasukkan: device='{device}', date='{date}'")
        return True
        
    except Exception as e:
        print(f"[ERROR] Gagal memasukkan data ke database: {e}")
        return False
        
    finally:
        # Tutup koneksi
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()

def ambilDataTerakhir(param_field):
    
    # Pastikan nama kolom hanya 1 (bukan daftar), karena kamu pakai untuk filter != NULL
    query = f"""
        SELECT {param_field}
        FROM (
            SELECT {param_field}, date FROM data
            UNION ALL
            SELECT {param_field}, date FROM tmp
        ) AS combined
        WHERE {param_field} IS NOT NULL
        ORDER BY date DESC
        LIMIT 1
    """
    
    MYSQL_CONFIG = mysqlConfig()
    conn = mysql.connector.connect(**MYSQL_CONFIG)
    cursor = conn.cursor()
    cursor.execute(query)
    row = cursor.fetchone()  # ambil satu hasil, bukan semua
    cursor.close()
    conn.close()
    
    return row[0]

def insert_data_klhk_success(timestamp, payload, response, date_send=None, row_send=0, status=False):
    try:
        MYSQL_CONFIG = mysqlConfig()
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cursor = conn.cursor()

        query = """
        INSERT INTO klhk_json_encode_success (timestamp, payload, response, date_send, row_send, status)
        VALUES (%s, %s, %s, %s, %s, %s);
        """

        values = (timestamp, payload, response, date_send, row_send, status)
        cursor.execute(query, values)
        conn.commit()

    except Exception as e:
        print(f"[ERROR] Gagal memasukkan data ke klhk_json_encode_success: {e}")
    finally:
        if 'cursor' in locals(): cursor.close()
        if 'conn' in locals(): conn.close()
        