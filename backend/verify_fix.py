import os
import sys
import django
from pathlib import Path

# Setup Django environment
sys.path.append(str(Path(__file__).resolve().parent))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.conf import settings
from groq import Groq

def test_keys():
    print("--- Environment Debug ---")
    print(f"GROQ_API_KEY in settings: {settings.GROQ_API_KEY}")
    print(f"OPENAI_API_KEY in settings: {settings.OPENAI_API_KEY}")
    print(f"GEMINI_API_KEY in settings: {settings.GEMINI_API_KEY}")
    
    if not settings.GROQ_API_KEY:
        print("ERROR: GROQ_API_KEY is missing!")
        return

    print("\n--- Testing Groq API ---")
    try:
        client = Groq(api_key=settings.GROQ_API_KEY)
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": "Say hello",
                }
            ],
            model="llama-3.3-70b-versatile",
        )
        print("Success! Response from Groq:")
        print(chat_completion.choices[0].message.content)
    except Exception as e:
        print(f"FAILED to call Groq API: {e}")

if __name__ == "__main__":
    test_keys()
