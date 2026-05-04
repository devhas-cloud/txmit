import os
import subprocess
import time
import json
from datetime import datetime, timedelta
import mysql.connector
from mysql.connector import Error
from config import loadConfig
import pytz

# === Load configuration from SQLite ===
CONFIG_DB = loadConfig()

# === Path Konfigurasi ===
BACKUP_DIR = "/app/database/backup"
STATE_FILE = "/app/database/backup_state.json"

# === Konfigurasi MySQL ===
HOST = CONFIG_DB.get('db_host', '127.0.0.1')
USER = CONFIG_DB.get('db_user', 'logix')
PASSWORD = CONFIG_DB.get('db_password', 'logix')
DATABASE = CONFIG_DB.get('db_name', 'logix')
PORT = CONFIG_DB.get('db_port', '3306')

# === Timezone ===
TIMEZONE = CONFIG_DB.get('timezone', 'Asia/Jakarta')
tz = pytz.timezone(TIMEZONE)

# === MySQL Config ===
MYSQL_CONFIG = {
    'host': HOST,
    'user': USER,
    'password': PASSWORD,
    'database': DATABASE,
    'port': PORT
}

# === Ensure backup dir exists ===
os.makedirs(BACKUP_DIR, exist_ok=True)


# ================= UTIL =================
def get_now():
    return datetime.now(tz)


def log(msg):
    print(f"[{get_now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}")


def seconds_to_next_window(now):
    """
    Hitung detik menuju window 00:00–01:00 berikutnya
    """
    if 0 <= now.hour < 1:
        return 0

    next_midnight = datetime.combine(now.date(), datetime.min.time()).replace(tzinfo=tz)

    if now.hour >= 1:
        next_midnight += timedelta(days=1)

    return (next_midnight - now).total_seconds()


# ================= STATE =================
def load_state():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r') as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_state(state):
    try:
        with open(STATE_FILE, 'w') as f:
            json.dump(state, f)
    except Exception as e:
        log(f"Gagal menyimpan state: {e}")


# ================= BACKUP =================
def backup_database():
    today_str = get_now().strftime('%Y-%m-%d')
    sql_filename = f"txmit_db_{today_str}.sql"
    sql_path = os.path.join(BACKUP_DIR, sql_filename)
    gz_path = sql_path + ".gz"

    if os.path.exists(gz_path):
        log("Backup hari ini sudah ada.")
        return False

    try:
        dump_cmd = [
            "mysqldump",
            "-h", MYSQL_CONFIG["host"],
            "-u", MYSQL_CONFIG["user"],
            f"-p{MYSQL_CONFIG['password']}",
            "--skip-ssl",
            MYSQL_CONFIG["database"]
        ]

        with open(sql_path, "w") as f:
            subprocess.run(dump_cmd, stdout=f, check=True)

        subprocess.run(["gzip", sql_path], check=True)

        log(f"Backup berhasil dibuat: {gz_path}")
        return True

    except subprocess.CalledProcessError as e:
        log(f"Gagal backup database: {e}")
        return False


# ================= CLEANUP =================
def cleanup_old_backups():
    cutoff = get_now() - timedelta(days=30)

    for fname in os.listdir(BACKUP_DIR):
        if fname.startswith("txmit_db_") and fname.endswith(".sql.gz"):
            try:
                date_str = fname.replace("txmit_db_", "").replace(".sql.gz", "")
                file_date = datetime.strptime(date_str, "%Y-%m-%d")

                if file_date < cutoff.replace(tzinfo=None):
                    os.remove(os.path.join(BACKUP_DIR, fname))
                    log(f"Backup lama dihapus: {fname}")

            except Exception as e:
                log(f"Tidak bisa memproses backup: {fname} => {e}")


# ================= OPTIMIZE =================
def optimize_database():
    try:
        conn = mysql.connector.connect(**MYSQL_CONFIG)
        cur = conn.cursor()

        cutoff = (get_now() - timedelta(days=396)).strftime('%Y-%m-%d %H:%M:%S')

        cur.execute("DELETE FROM data WHERE date < %s", (cutoff,))
        deleted = cur.rowcount

        log(f"Menghapus {deleted} baris data lebih dari 13 bulan.")

        conn.commit()
        cur.close()
        conn.close()

        log("Database dioptimasi (tanpa VACUUM untuk MySQL).")

    except Error as e:
        log(f"Gagal optimasi database: {e}")


# ================= MAIN LOOP =================
def main_loop():
    log("Memulai background backup mingguan (malam hari)...")
    state = load_state()

    while True:
        now = get_now()
        today_str = now.strftime('%Y-%m-%d')

        # === Cek apakah sudah 7 hari ===
        last_backup_str = state.get("last_backup")
        do_backup = False

        if last_backup_str:
            try:
                last_backup_date = datetime.strptime(last_backup_str, "%Y-%m-%d")
                if now - last_backup_date >= timedelta(days=7):
                    do_backup = True
            except Exception as e:
                log(f"Format last_backup salah: {e}")
                do_backup = True
        else:
            do_backup = True

        # === Window 00:00–01:00 ===
        if 0 <= now.hour < 1:
            if do_backup:
                log("Malam hari & waktunya backup mingguan. Menjalankan proses...")

                if backup_database():
                    state["last_backup"] = today_str
                    save_state(state)

                    cleanup_old_backups()
                    optimize_database()
                else:
                    log("Backup gagal.")
            else:
                log("Belum waktunya backup mingguan.")

            # cek ulang tiap 5 menit selama window
            time.sleep(300)

        else:
            sleep_sec = seconds_to_next_window(now)
            log(f"Bukan jam backup. Tidur {int(sleep_sec)} detik sampai window berikutnya.")
            time.sleep(max(sleep_sec, 60))


# ================= ENTRY =================
if __name__ == "__main__":
    try:
        main_loop()
    except KeyboardInterrupt:
        log("Dihentikan oleh pengguna.")
    except Exception as e:
        log(f"Fatal error: {e}")