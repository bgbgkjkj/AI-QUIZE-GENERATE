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
    print(f"User found: {user.username} ({user.email})")
    user.set_password('password123')
    user.save()
    print("Password reset to: password123")
except User.DoesNotExist:
    print(f"User with email {email} NOT found.")
