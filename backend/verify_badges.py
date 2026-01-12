import os
import django
import sys
from datetime import timedelta

# Setup Django environment
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quiz_backend.settings')
django.setup()

from django.contrib.auth.models import User
from quiz_app.models import Achievement, UserAchievement, Quiz, Category, Level, Subject, UserProfile

def verify_system():
    print("--- Verifying Badge System ---")
    
    # 1. Verify Badges Exist
    badges_count = Achievement.objects.count()
    print(f"Total Badges Found: {badges_count}")
    if badges_count < 8:
        print("FAIL: Expected at least 8 badges. Did seed_badges.py run?")
        return
    else:
        print("PASS: Badges are seeded.")

    # 2. Setup Test User
    username = "badge_tester"
    try:
        user = User.objects.get(username=username)
        user.delete()
        print(f"Cleaned up existing user {username}")
    except User.DoesNotExist:
        pass
    
    user = User.objects.create_user(username=username, password="password123")
    print(f"Created test user: {username}")
    
    # ensure profile exists
    UserProfile.objects.get_or_create(user=user)

    # 3. Test 'First Steps' (Complete 1 Quiz)
    # We need to simulate the signal triggers.
    # The signal 'quiz_completed' is triggered when QuizAttempt is saved with status='completed'
    # For simplicity, we can directly call check_achievements like the signal does, or create an attempt.
    # Let's use the service function directly to isolate the logic.
    from quiz_app.services import check_achievements
    
    print("\nTesting 'First Steps' Badge...")
    # Manually set the stat
    user.profile.total_quizzes_taken = 1
    user.profile.save()
    
    new_badges = check_achievements(user, 'quiz_completed')
    if any(b.title == 'First Steps' for b in new_badges):
        print("PASS: 'First Steps' badge awarded.")
    else:
        print(f"FAIL: 'First Steps' badge NOT awarded. New badges: {[b.title for b in new_badges]}")

    # 4. Test 'Quiz Master' (Create 10 Quizzes)
    print("\nTesting 'Quiz Master' Badge...")
    user.profile.total_quizzes_created = 10
    user.profile.save()
    
    new_badges = check_achievements(user, 'quiz_created')
    if any(b.title == 'Quiz Master' for b in new_badges):
        print("PASS: 'Quiz Master' badge awarded.")
    else:
         print(f"FAIL: 'Quiz Master' badge NOT awarded. New badges: {[b.title for b in new_badges]}")

    # 5. Check User Achievements Count
    count = UserAchievement.objects.filter(user=user).count()
    print(f"\nTotal User Badges: {count}")
    
    if count >= 2:
        print("OVERALL STATUS: SUCCESS")
    else:
        print("OVERALL STATUS: FAILURE")
        
    # Cleanup
    # user.delete() 
    # keep user for manual inspection if needed, or delete

if __name__ == "__main__":
    try:
        verify_system()
    except Exception as e:
        print(f"An error occurred: {e}")
        import traceback
        traceback.print_exc()
