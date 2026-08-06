import os
import csv
import time
import math
import pytz
from datetime import datetime
from config import loadConfig, mysqlConfig, insert_data, ambilDate, ambilDateTime

# ==============================
# DEFAULT PARAMETER
# ==============================
ph, orp, tds, conduct, do, salinity, nh3n, battery, depth, flow, tflow, turb, tss, cod, bod, no3, wtemp, wpress = (None,) * 18

# ==============================
# TIMEZONE CONFIGURATION
# ==============================
# Default timezone - akan di-reload setiap iterasi scheduler
TIMEZONE = "Asia/Jakarta"
tz = pytz.timezone(TIMEZONE)
klhk_timezone = "Asia/Jakarta"


# fungsi logs
def write_log(message):
    """Log message with timestamp"""
    timestamp = datetime.now(tz).strftime("%Y-%m-%d %H:%M:%S")
    log_message = f"[{timestamp}] {message}"
    print(log_message)
 


# ==============================
# NORMALIZE HEADER (CASE-INSENSITIVE)
# ==============================
def normalize_header(text: str) -> str:
    return (
        text.lower()
        .strip()
    )

# ==============================
# CSV COLUMN → INTERNAL PARAMETER MAP
# ==============================
# kiri name concube : kanan real db column
COLUMN_MAP = {

    "measurement interval": "Interval_Timestamp",

    "ph - measured": "ph",
    "orp - measured": "orp",
    "tds - measured": "tds",

    "conduct - measured": "conduct",
    "conductivity - measured": "conduct",


    "do - measured": "do",
    "dissolved oxygen - measured": "do",

    "salinity - measured": "salinity",

    "nh3n - measured": "nh3n",
    "nh3-n - measured": "nh3n",
    "ammonium - measured": "nh3n",
    "amonia - measured": "nh3n",
    "ammonia - measured": "nh3n",

    "battery - measured": "battery",

    "depth - measured": "depth",
    'kedalaman - measured': "depth",

    "debit - measured": "flow",
    "flowrate - measured": "flow",

    "total flow - measured": "tflow",
    "tflow - measured" : "tflow",

    "turbidity - measured": "turb",
    "turbidit - measured": "turb",

    "tss - measured": "tss",
    "tsseq - measured": "tss",


    "cod - measured": "cod",
    "codeq - measured": "cod",

    "bod - measured": "bod",
    "bodeq - measured": "bod",

    "no3 - measured": "no3",
    "no3eq - measured": "no3",
    "nitrat - measured": "no3",

    "temperature - measured": "wtemp",
    "temperatur - measured": "wtemp",
    "temperat - measured": "wtemp",
    "temperature": "wtemp",
    "suhu - measured": "wtemp",

    "wpress - measured": "wpress",
    

     

}

# ==============================
# HELPER
# ==============================

def to_float(val):
    try:
        result = float(val)
        if math.isnan(result):
            return None
        return result
    except:
        return None

def replace_nan(val):
    if isinstance(val, float) and math.isnan(val):
        return None
    return val

# ==============================
# PROCESS CSV FILES
# ==============================
def prosesCsv():
    folder = "/app/csv"

    try:
        files = os.listdir(folder)
    except Exception as e:
        write_log(f"Gagal membuka folder CSV: {e}")
        return

    # Ambil file baru (.csv) + file retry (.csv.processing)
    csv_files = [
        f for f in files
        if f.lower().endswith(".csv") or f.lower().endswith(".csv.processing")
    ]

    if not csv_files:
        write_log("Tidak ada file CSV.")
        return

    for filename in csv_files:

        original_path = os.path.join(folder, filename)

        # =============================
        # TENTUKAN PATH PROCESSING
        # =============================
        if filename.lower().endswith(".csv"):
            # File baru → rename lock
            processing_path = original_path + ".processing"

            try:
                os.rename(original_path, processing_path)
            except OSError:
                write_log(f"{filename} sedang digunakan / belum selesai ditulis → dilewati")
                continue

            display_name = filename

        else:
            # File retry (.processing)
            processing_path = original_path
            display_name = filename.replace(".processing", "")
            write_log(f"Retry file: {display_name}")

        write_log(f"\nMemproses file: {display_name}")

        processed_ok = True

        # =============================
        # PROSES FILE
        # =============================
        try:
            with open(processing_path, newline="", encoding="utf-8") as f:
                reader = csv.reader(f, delimiter=";")

                # Skip baris pertama
                try:
                    next(reader)
                except StopIteration:
                    write_log("File kosong.")
                    processed_ok = False
                    continue

                # ==============================
                # DETEKSI HEADER
                # ==============================
                original_headers = next(reader)
                write_log(f"Header asli: {original_headers}")

                normalized_headers = [normalize_header(h) for h in original_headers]

                header_index = {}
                for idx, h in enumerate(normalized_headers):
                    for key, target in COLUMN_MAP.items():
                        if key in h:
                            header_index[target] = idx

                write_log(f"Header terdeteksi: {header_index}")

                # ==============================
                # PROCESS DATA ROWS
                # ==============================
                for index, row in enumerate(reader):

                    try:
                        def get_value(key):
                            idx = header_index.get(key)
                            if idx is None or idx >= len(row):
                                return None
                            val = row[idx].strip()
                            return val if val != "" else None

                        # TIMESTAMP
                        Interval_Timestamp = None
                        unix_dt = 0

                        ts_val = get_value("Interval_Timestamp")

                        if ts_val:
                            
                            # unix time untuk klhk (sesuai kebijakan klhk, harus sesuai timezone yang ditentukan di config)
                            try:
                                klhk_tz = pytz.timezone(klhk_timezone)

                                # parse string → naive datetime
                                dt = datetime.strptime(ts_val, "%Y-%m-%d %H:%M:%S")

                                # jadikan timezone-aware
                                Interval_Timestamp = klhk_tz.localize(dt)

                                # convert ke unix timestamp
                                unix_dt = int(Interval_Timestamp.timestamp())

                            except Exception as e:
                                write_log(f"Row {index}: gagal parse waktu → {e}")

                            # unix time global UTC
                            try:
                                # parse string → naive datetime
                                dt = datetime.strptime(ts_val, "%Y-%m-%d %H:%M:%S")

                                # jadikan timezone-aware dengan timezone alat
                                local_dt = tz.localize(dt)

                                # convert ke UTC
                                utc_dt = local_dt.astimezone(pytz.utc)

                                # unix timestamp UTC
                                unix_dt_utc = int(utc_dt.timestamp())
                            except Exception as e:
                                write_log(f"Row {index}: gagal parse waktu UTC → {e}")

                        # PARAMETER
                        ph = to_float(get_value("ph"))
                        orp = to_float(get_value("orp"))
                        tds = to_float(get_value("tds"))
                        conduct = to_float(get_value("conduct"))
                        do = to_float(get_value("do"))
                        salinity = to_float(get_value("salinity"))
                        nh3n = to_float(get_value("nh3n"))
                        battery = to_float(get_value("battery"))
                        depth = to_float(get_value("depth"))
                        flow = to_float(get_value("flow"))
                        tflow = to_float(get_value("tflow"))
                        turb = to_float(get_value("turb"))
                        tss = to_float(get_value("tss"))
                        cod = to_float(get_value("cod"))
                        bod = to_float(get_value("bod"))
                        no3 = to_float(get_value("no3"))
                        wtemp = to_float(get_value("wtemp"))
                        wpress = to_float(get_value("wpress"))

                        # ==============================
                        # FILTER + INSERT
                        # ==============================
                        if Interval_Timestamp and Interval_Timestamp.minute % 2 == 0:

                            result = insert_data(
                                Interval_Timestamp, unix_dt, unix_dt_utc,
                                ph, orp, tds, conduct, do, salinity,
                                nh3n, battery, depth, flow, tflow,
                                turb, tss, cod, bod, no3, wtemp, wpress
                            )

                            if result:
                                write_log(f"Row {index}: OK")
                            else:
                                processed_ok = False
                                write_log(f"Row {index}: dilewati / duplikat")

                    except Exception as e:
                        processed_ok = False
                        write_log(f"Error row {index}: {e}")

        except Exception as e:
            processed_ok = False
            write_log(f"Gagal membaca {display_name}: {e}")

        # =============================
        # HAPUS FILE JIKA SUKSES
        # =============================
        if processed_ok:
            try:
                os.remove(processing_path)
                write_log(f"File {display_name} selesai diproses & dihapus.")
            except Exception as e:
                write_log(f"Gagal menghapus {display_name}: {e}")
        else:
            os.remove(processing_path)
            #write_log(f"File {display_name} gagal diproses → tetap disimpan untuk retry.")


# ======================================================
#jalankan tiap 1 menit
def scheduler():
    """Jalankan scheduler untuk pembacaan CSV setiap menit tepat di detik 0, efisien CPU"""
    global TIMEZONE, tz, klhk_timezone
    
    write_log("⏱️ Service CSV aktif. Menunggu jadwal pembacaan file CSV...")

    try:
        while True:
            # =============================
            # RELOAD CONFIG SETIAP ITERASI
            # =============================
            try:
                config = loadConfig()
                TIMEZONE = config.get("timezone", "Asia/Jakarta")
                tz = pytz.timezone(TIMEZONE)
                klhk_timezone = config.get("klhk_timezone", "Asia/Jakarta")
            except Exception as e:
                write_log(f"⚠️ Gagal reload config: {e}")
                # Tetap gunakan config yang ada jika gagal reload
            
            now = datetime.now(tz)
            
            # Hitung detik tersisa sampai detik 0 menit berikutnya
            seconds_until_next_minute = 60 - now.second - now.microsecond / 1_000_000
            time.sleep(seconds_until_next_minute)
            
            # Sekarang waktunya tepat di detik 0
            DATE = datetime.now(tz).replace(second=0, microsecond=0)
            prosesCsv()

    except KeyboardInterrupt:
        write_log("🛑 Service CSV dihentikan manual.")

if __name__ == "__main__":
    scheduler()
