#!/usr/bin/env python3
"""
Log cleanup daemon
Membersihkan log 1x sehari
Menyisakan N baris terakhir
"""
import os
import time
from datetime import datetime

LOG_FILES = {
    'web': '/app/logs/web.log',
    'main': '/app/logs/main.log',
    'send': '/app/logs/send.log',
    'retry': '/app/logs/retry.log',
    'has': '/app/logs/has-send.log',
    'cleanup': '/app/logs/cleanup.log',
    'supervisord': '/app/logs/supervisord.log',
}

MAX_LINES = 1000
INTERVAL_SECONDS = 24 * 60 * 60  # 1 hari

def cleanup_backup_files(filepath):
    """Hapus file backup seperti has-send.log.1, has-send.log.2, dst"""
    try:
        log_dir = os.path.dirname(filepath)
        log_filename = os.path.basename(filepath)
        
        # Cari semua file backup
        backup_files = []
        for filename in os.listdir(log_dir):
            if filename.startswith(log_filename + '.') and filename[len(log_filename)+1:].isdigit():
                backup_path = os.path.join(log_dir, filename)
                backup_files.append(backup_path)
        
        # Hapus semua file backup yang ditemukan
        for backup_file in backup_files:
            try:
                os.remove(backup_file)
                print(f"[{datetime.now()}] removed backup file: {backup_file}")
            except Exception as e:
                print(f"[{datetime.now()}] error removing {backup_file}: {e}")
        
        if backup_files:
            print(f"[{datetime.now()}] cleaned {len(backup_files)} backup file(s) for {filepath}")
    
    except Exception as e:
        print(f"[{datetime.now()}] error cleanup backups for {filepath}: {e}")

def cleanup_log_file(filepath, max_lines):
    if not os.path.exists(filepath):
        return

    try:
        with open(filepath, 'r') as f:
            lines = f.readlines()

        if len(lines) <= max_lines:
            return

        with open(filepath, 'w') as f:
            f.writelines(lines[-max_lines:])

        print(f"[{datetime.now()}] cleaned {filepath}")

    except Exception as e:
        print(f"[{datetime.now()}] error {filepath}: {e}")

def main():
    print(f"[{datetime.now()}] 🚀 log cleanup daemon started")

    while True:
        for filepath in LOG_FILES.values():
            cleanup_log_file(filepath, MAX_LINES)
            cleanup_backup_files(filepath)

        print(f"[{datetime.now()}] 💤 sleep 24 hours")
        time.sleep(INTERVAL_SECONDS)

if __name__ == '__main__':
    main()
