import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth.models import User

def create_admin():
    if not User.objects.filter(username='testadmin').exists():
        User.objects.create_superuser('testadmin', 'admin@example.com', 'testpass123')
        print("Superuser created.")
    else:
        u = User.objects.get(username='testadmin')
        u.set_password('testpass123')
        u.save()
        print("Superuser exists, password updated.")

if __name__ == "__main__":
    create_admin()
