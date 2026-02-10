#!/bin/bash
# Build image txmit tanpa cache
docker-compose build --no-cache txmit

# Start semua service di background
docker-compose up -d

sleep 5
docker exec -it db_txmit service mysql start