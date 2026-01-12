import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth.models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes

email = 'rajeshmojumder123@gmail.com'

try:
    user = User.objects.get(email=email)
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    reset_link = f"http://localhost:3002/reset-password/{uid}/{token}" # Port 3002 based on user context
    print(f"RESET_LINK:{reset_link}")
except User.DoesNotExist:
    print(f"User with email {email} does not exist.")
except Exception as e:
    print(f"Error: {e}")
