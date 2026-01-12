import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth.models import User

email = 'rajeshmojumder123@gmail.com'
users = User.objects.filter(email=email)

print(f"Found {users.count()} users with email {email}")

if users.count() > 1:
    print("Duplicates found. Cleaning up...")
    # Keep the most recently active or created one, or just the first one
    # Let's keep the first one and delete the rest
    users_to_keep = users.first()
    print(f"Keeping user: {users_to_keep.username} (ID: {users_to_keep.id})")
    
    for u in users.exclude(id=users_to_keep.id):
        print(f"Deleting duplicate user: {u.username} (ID: {u.id})")
        u.delete()
        
    print("Cleanup complete.")
else:
    print("No duplicates found.")
