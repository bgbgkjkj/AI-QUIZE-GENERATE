
import os
import sys
from dotenv import load_dotenv
from groq import Groq

# Load .env explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

api_key = os.getenv('GROQ_API_KEY')

print(f"DEBUG: Read API Key: {api_key[:5]}...{api_key[-4:] if api_key else 'None'}")

if not api_key:
    print("ERROR: GROQ_API_KEY not found in environment variables.")
    sys.exit(1)

try:
    client = Groq(api_key=api_key)
    print("Attempting to connect to Groq...")
    chat_completion = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": "Say 'Hello from Groq' if this works.",
            }
        ],
        model="llama-3.3-70b-versatile",
    )
    print(f"SUCCESS: Groq responded: {chat_completion.choices[0].message.content}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"ERROR: Failed to connect to Groq. Reason: {e}")
    sys.exit(1)
