#!/bin/bash
cd "$(dirname "$0")"
echo "Öffne im Browser: http://localhost:8081/"
python3 -m http.server 8081
