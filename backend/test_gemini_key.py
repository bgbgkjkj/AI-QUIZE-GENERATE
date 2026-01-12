
import os
import sys
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env explicitly
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

api_key = os.getenv('GEMINI_API_KEY')

print(f"DEBUG: Read API Key: {api_key[:5]}...{api_key[-4:] if api_key else 'None'}")

if not api_key:
    print("ERROR: GEMINI_API_KEY not found associated in environment variables.")
    sys.exit(1)

try:
    print("Listing available models...")
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
    
    # model = genai.GenerativeModel('gemini-1.5-flash')
    # response = model.generate_content("Say 'Hello' if this works.")
    # print(f"SUCCESS: Gemini responded: {response.text}")
except Exception as e:
    import traceback
    traceback.print_exc()
    print(f"ERROR: Failed to connect to Gemini. Reason: {e}")
    sys.exit(1)
