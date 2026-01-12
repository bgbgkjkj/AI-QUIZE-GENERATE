import requests
import json
import time

try:
    print("Testing connection to Ollama...")
    start = time.time()
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3", 
            "prompt": "Why is the sky blue?",
            "stream": False
        },
        timeout=60 # Longer timeout for cold start
    )
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        print("Success!")
        print(response.json().get("response", "")[:50])
    else:
        print(f"Error: {response.text}")
    print(f"Time taken: {time.time() - start:.2f}s")

except Exception as e:
    print(f"Connection failed: {e}")
