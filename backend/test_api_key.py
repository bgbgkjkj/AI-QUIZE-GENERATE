
import os
import sys
from dotenv import load_dotenv
from openai import OpenAI

# Load .env explicitly
load_dotenv('.env')

api_key = os.getenv('OPENAI_API_KEY')

print(f"DEBUG: Read API Key: {api_key[:5]}...{api_key[-4:] if api_key else 'None'}")

if not api_key:
    print("ERROR: OPENAI_API_KEY not found in environment or .env file.")
    sys.exit(1)

if api_key == 'your-actual-openai-api-key-here' or api_key == 'your-api-key-here':
    print("ERROR: OPENAI_API_KEY is still set to the placeholder value.")
    sys.exit(1)

try:
    client = OpenAI(api_key=api_key)
    # Simple list models call to check auth
    print("Attempting to connect to OpenAI...")
    client.models.list()
    print("SUCCESS: OpenAI API Key is valid and connection established.")
except Exception as e:
    print(f"ERROR: Failed to connect to OpenAI. Reason: {e}")
    sys.exit(1)
