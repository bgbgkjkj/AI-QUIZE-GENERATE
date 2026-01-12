import os
import django
from django.conf import settings
from django.core.mail import send_mail

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

# Use the email from .env or fallback for testing
recipient_email = os.getenv('EMAIL_HOST_USER') or 'rajeshmojumder9832@gmail.com'

print(f"Attempting to send email to: {recipient_email}")
print(f"Using Backend: {settings.EMAIL_BACKEND}")
print(f"Using Host: {settings.EMAIL_HOST}")
print(f"Using Port: {settings.EMAIL_PORT}")
print(f"Using User: {settings.EMAIL_HOST_USER}")

try:
    send_mail(
        subject='Test Email from Quiz App',
        message='This is a test email to verify SMTP configuration.',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient_email],
        fail_silently=False,
    )
    print("SUCCESS: Email sent successfully!")
except Exception as e:
    print(f"FAILURE: Could not send email. Error: {e}")
