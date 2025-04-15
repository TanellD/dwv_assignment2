import json
import requests
import pandas as pd
import time

# Sample dataset - replace with your actual data source
dataset = pd.read_csv('ip_addresses.csv')

def send_data():
    package = []
    prev_time_sent = None
    
    for i, row in dataset.iterrows():
        if prev_time_sent is not None and prev_time_sent != row['Timestamp']:
            # Send the accumulated package
            try:
                response = requests.post(
                    'http://webapp:5000/',
                    json=package,
                    headers={'Content-Type': 'application/json'}
                )
                print(f"Sent {len(package)} entries. Response: {response.status_code}")
            except Exception as e:
                print(f"Error sending data: {e}")
            
            package = []
            time.sleep(1)  # Throttle sending
        
        prev_time_sent = row['Timestamp']
        package.append(row.to_dict())
    
    # Send any remaining data
    if package:
        requests.post('http://127.0.0.1:5000/', json=package)

if __name__ == '__main__':
    send_data()