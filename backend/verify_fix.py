import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth.models import User

email = 'rajeshmojumder123@gmail.com'
try:
    user = User.objects.get(email=email)
    user.set_password('password123')
    user.save()
    print(f"Password confirmed/reset for user: {user.username}")
except User.DoesNotExist:
    print("User not found (Verification failed)")
except Exception as e:
    print(f"Error: {e}")
