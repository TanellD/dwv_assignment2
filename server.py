from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import json
from datetime import datetime, timedelta
import threading
import time

app = Flask(__name__)
CORS(app)

# Data storage
df = pd.DataFrame(columns=['ip', 'lat', 'lon', 'timestamp', 'suspicious'])
buffer = []
buffer_size = 10
data_lock = threading.Lock()
last_update_time = datetime.now()

@app.route("/", methods=['GET', 'POST'])
def receive_from_senders():
    global df, last_update_time, buffer, buffer_size
    
    if request.method == 'POST':
        try:
            json_data = request.get_json()
            vals = json.loads(json_data) if isinstance(json_data, str) else json_data
                
            if not isinstance(vals, list):
                return jsonify({"error": "Invalid data format"}), 400
                
            with data_lock:
                buffer_entry = []
                for entry in vals:
                    processed_entry = {
                        'ip': entry.get('ip address', entry.get('ip', '')),
                        'lat': float(entry.get('Latitude', entry.get('lat', 0))),
                        'lon': float(entry.get('Longitude', entry.get('lon', 0))),
                        'timestamp': entry.get('Timestamp', entry.get('timestamp', datetime.utcnow().isoformat())),
                        'suspicious': int(entry.get('suspicious', 0))
                    }
                    df.loc[len(df)] = processed_entry
                    buffer_entry.append(processed_entry)
                buffer.append(buffer_entry)
                if len(buffer) > buffer_size:
                    buffer.pop(0)
                last_update_time = datetime.now()
                print(f"Received {len(vals)} entries. Total: {len(df)}")
                
            return jsonify({"status": "success", "received": len(vals)})
            
        except Exception as e:
            return jsonify({"error": str(e)}), 400
            
    return "Flask server is running"

@app.route('/api/ipdata')
def get_ip_data():
    with data_lock:
        return jsonify(df.to_dict('records'))

@app.route('/api/recent')
def get_recent_data():
    global buffer
    with data_lock:
        flattened_events = [ev for events in buffer for ev in events]
        return jsonify(flattened_events)

@app.route('/dashboard')
def dashboard():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)