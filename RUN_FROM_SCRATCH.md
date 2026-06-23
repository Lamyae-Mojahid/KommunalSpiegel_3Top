# KommunalSpiegel V7 ausführbar starten

```bash
cd ~/Downloads
rm -rf KommunalSpiegel_v6_API_TRANSPORT_V7
unzip -o KommunalSpiegel_v6_API_TRANSPORT_V7_EXECUTABLE_FIXED.zip
cd KommunalSpiegel_v6_API_TRANSPORT_V7
pip install -r requirements.txt
export GOOGLE_MAPS_API_KEY="AIza..."
bash RUN_SICHT3_LEUNA_500.sh
bash START_WEBSITE.sh
```

Browser: http://localhost:8081/

Die Website-Dateien sind jetzt enthalten:
- index.html
- KommScan_v3_API_TRANSPORT_V1_2.html

Sicht 3 zeigt die neuen Felder:
- coverage_of_checked_percent als Hauptwert
- extrapolated_percent als Hochrechnung
- covered_percent nur konservativ/intern
