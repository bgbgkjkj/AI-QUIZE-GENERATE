import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth.models import User
from quiz_app.models import UserProfile

email = 'rajeshmojumder9832@gmail.com'
username = 'rajeshmojumder9832'
password = 'password123'

if not User.objects.filter(email=email).exists():
    user = User.objects.create_user(username=username, email=email, password=password)
    # Create profile if it doesn't exist (triggers signal usually, but good to be safe)
    UserProfile.objects.get_or_create(user=user)
    print(f"User {username} created successfully.")
else:
    print(f"User with email {email} already exists.")
