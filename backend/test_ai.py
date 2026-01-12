import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from quiz_app.views import generate_ai_response
from django.conf import settings

print(f"DEBUG: OpenAI Key configured: {'Yes' if settings.OPENAI_API_KEY else 'No'}")
print(f"DEBUG: Gemini Key configured: {'Yes' if settings.GEMINI_API_KEY else 'No'}")

try:
    print("Testing AI Generation...")
    # Simple prompt
    prompt = "Generate 1 multiple choice question about Python."
    result = generate_ai_response(prompt, max_tokens=200)
    print("\n--- Result ---")
    print(result)
    print("--- End Result ---")
    print("Success!")
except Exception as e:
    print("\nFAILED with error:")
    print(e)
    import traceback
    traceback.print_exc()
