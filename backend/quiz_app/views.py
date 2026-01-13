import random
import json
import io
import traceback
from datetime import datetime, timedelta
from django.utils import timezone
from django.conf import settings
from django.contrib.auth.models import User
from django.db.models import Q, Count, Avg, Max
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, generics, viewsets
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from openai import OpenAI
from groq import Groq
import requests

from .models import (
    Category, Level, Subject, QuizConfig, Quiz, Question,
    QuizAttempt, Answer, UserProfile, Achievement, UserAchievement, QuizAnalytics
)
# from .hardcoded_questions import HARDCODED_QUESTIONS  <-- Removed import
from .serializers import (
    CategorySerializer, LevelSerializer, SubjectSerializer, QuizConfigSerializer,
    QuizSerializer, QuizListSerializer, QuizTakeSerializer, QuestionSerializer,
    UserSerializer, UserProfileSerializer, QuizAttemptSerializer, AnswerSerializer,
    QuizSubmitSerializer, AchievementSerializer, UserAchievementSerializer,
    QuizAnalyticsSerializer, RecentActivitySerializer, QuizResultSerializer
)

# Configure OpenAI client lazily to avoid initialization errors
_openai_client = None

def get_openai_client():
    """Lazy initialization of OpenAI client"""
    global _openai_client
    if _openai_client is None:
        try:
            _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
            # Try a simple request to validate the key
            _openai_client.models.list()
        except Exception as e:
            # More specific error for API key issue
            if "api_key" in str(e).lower():
                 raise ValueError("The OpenAI API key is invalid or not set. Please check your .env file.")
            raise e # Re-raise other exceptions
    return _openai_client

def _try_ollama(prompt):
    """Helper to generate with Ollama"""
    print("DEBUG: Attempting to use Local LLM (Ollama)...")
    # import requests removed
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": "llama3", 
            "prompt": f"System: You are an expert quiz generator. Return valid JSON only.\nUser: {prompt}",
            "stream": False,
            "format": "json"
        },
        timeout=300
    )
    if response.status_code == 200:
        print("DEBUG: Ollama generation successful.")
        return response.json().get("response", "")
    else:
        print(f"Ollama Error: {response.status_code} - {response.text}")
        raise ValueError(f"Ollama API returned {response.status_code}")

def _try_groq(prompt, max_tokens):
    """Helper to generate with Groq"""
    groq_key = getattr(settings, 'GROQ_API_KEY', None)
    if not groq_key:
        raise ValueError("GROQ_API_KEY not set")
        
    print("DEBUG: Attempting to use Groq...")
    client = Groq(api_key=groq_key)
    completion = client.chat.completions.create(
        model="llama3-70b-8192", 
        messages=[
            {"role": "system", "content": "You are an expert quiz generator. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=max_tokens,
    )
    print("DEBUG: Groq generation successful.")
    return completion.choices[0].message.content

def _try_gemini(prompt):
    """Helper to generate with Gemini"""
    gemini_key = getattr(settings, 'GEMINI_API_KEY', None)
    if not gemini_key:
        raise ValueError("GEMINI_API_KEY not set")

    print("DEBUG: Attempting to use Gemini...")
    import google.generativeai as genai
    genai.configure(api_key=gemini_key)
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content(prompt)
    print("DEBUG: Gemini generation successful.")
    return response.text

def _try_openai(prompt, max_tokens):
    """Helper to generate with OpenAI"""
    openai_key = getattr(settings, 'OPENAI_API_KEY', None)
    if not openai_key:
        raise ValueError("OPENAI_API_KEY not set")

    print("DEBUG: Attempting to use OpenAI...")
    client = OpenAI(api_key=openai_key)
    completion = client.chat.completions.create(
        model="gpt-3.5-turbo", 
        messages=[
            {"role": "system", "content": "You are an expert quiz generator. Return valid JSON only."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7,
        max_tokens=max_tokens,
    )
    print("DEBUG: OpenAI generation successful.")
    return completion.choices[0].message.content

def generate_ai_response(prompt, max_tokens=2000):
    """
    Generate response using the configured LLM provider.
    """
    provider = getattr(settings, 'LLM_PROVIDER', 'auto').lower()
    print(f"DEBUG: Active LLM Provider: {provider}")

    try:
        # Strategy: Try selected provider first.
        if provider == 'ollama':
            try:
                return _try_ollama(prompt)
            except Exception as e:
                print(f"Ollama failed: {e}")
                if provider != 'auto': raise e
                pass 

        elif provider == 'groq':
            try:
                return _try_groq(prompt, max_tokens)
            except Exception as e:
                print(f"Groq failed: {e}")
                if provider != 'auto': raise e
                pass

        elif provider == 'gemini':
            try:
                return _try_gemini(prompt)
            except Exception as e:
                print(f"Gemini failed: {e}")
                if provider != 'auto': raise e
                pass
        
        elif provider == 'openai':
            try:
                return _try_openai(prompt, max_tokens)
            except Exception as e:
                print(f"OpenAI failed: {e}")
                if provider != 'auto': raise e
                pass

        # If explicit attempt failed or provider is 'auto', run through priority list
        print("DEBUG: Entering fallback/auto mode...")
        
        # 1. Ollama
        try:
             return _try_ollama(prompt)
        except Exception:
             pass
        
        # 2. Groq
        try:
            return _try_groq(prompt, max_tokens)
        except Exception:
            pass

        # 3. Gemini
        try:
            return _try_gemini(prompt)
        except Exception:
            pass
        
        # 4. OpenAI
        try:
            return _try_openai(prompt, max_tokens)
        except Exception:
            pass

        raise ValueError("No valid AI provider available. Please configure Ollama, Groq, Gemini, or OpenAI.")
    
    except Exception as e:
        print(f"CRITICAL ERROR in generate_ai_response: {e}")
        traceback.print_exc()
        raise ValueError(f"Failed to get response from any AI service: {e}")


def extract_text_from_file(file):
    """Extract text content from uploaded files (PDF, DOCX, TXT)"""
    filename = file.name.lower()
    content = ""
    
    print(f"DEBUG extract_text_from_file: Processing file '{file.name}'")
    print(f"DEBUG extract_text_from_file: File size: {file.size} bytes")
    
    try:
        if filename.endswith('.pdf'):
            # Handle PDF files
            print("DEBUG: Processing as PDF")
            try:
                from PyPDF2 import PdfReader
                pdf_reader = PdfReader(io.BytesIO(file.read()))
                for page in pdf_reader.pages:
                    content += page.extract_text() or ""
            except ImportError:
                raise ValueError("PDF support not installed. Run: pip install PyPDF2")
        
        elif filename.endswith('.docx'):
            # Handle Word documents
            print("DEBUG: Processing as DOCX")
            try:
                from docx import Document
                doc = Document(io.BytesIO(file.read()))
                for para in doc.paragraphs:
                    content += para.text + "\n"
            except ImportError:
                raise ValueError("DOCX support not installed. Run: pip install python-docx")
        
        elif filename.endswith('.doc'):
            raise ValueError("Legacy .doc files are not supported. Please convert to .docx or .pdf")
        
        elif filename.endswith('.txt'):
            # Handle text files
            print("DEBUG: Processing as TXT")
            content = file.read().decode('utf-8')
            print(f"DEBUG: TXT file content length: {len(content)}")
        
        else:
            # Try to read as text
            print("DEBUG: Attempting to process as generic text")
            content = file.read().decode('utf-8')
        
        # Reset file pointer for saving
        file.seek(0)
        
        # Limit content length for API
        final_content = content[:5000] if content else ""
        print(f"DEBUG: Final content length: {len(final_content)}")
        return final_content
    
    except UnicodeDecodeError:
        raise ValueError("Unable to read file. Please ensure it's a valid text, PDF, or DOCX file.")
    except Exception as e:
        print(f"DEBUG: Exception in extract_text_from_file: {e}")
        import traceback
        traceback.print_exc()
        raise ValueError(f"Error reading file: {str(e)}")

# ==================== AUTHENTICATION VIEWS ====================

class RegisterView(APIView):
    """User registration endpoint"""
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'username': user.username,
                'email': user.email,
                'message': 'User registered successfully'
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(ObtainAuthToken):
    """User login endpoint"""
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.serializer_class(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        token, created = Token.objects.get_or_create(user=user)
        
        # Update user profile activity
        profile = user.profile
        profile.check_streak()
        
        return Response({
            'token': token.key,
            'user_id': user.pk,
            'username': user.username,
            'email': user.email,
            'level': profile.level,
            'xp': profile.xp
        })

class LogoutView(APIView):
    """User logout endpoint"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        request.user.auth_token.delete()
        return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)

class ChangePasswordView(APIView):
    """Change user password endpoint"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        confirm_password = request.data.get('confirm_password')
        
        # Validate inputs
        if not old_password or not new_password or not confirm_password:
            return Response(
                {'error': 'All fields (old_password, new_password, confirm_password) are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if old password is correct
        if not user.check_password(old_password):
            return Response(
                {'error': 'Old password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if new passwords match
        if new_password != confirm_password:
            return Response(
                {'error': 'New password and confirm password do not match'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if new password is same as old
        if user.check_password(new_password):
            return Response(
                {'error': 'New password must be different from old password'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate password strength (minimum 8 characters)
        if len(new_password) < 8:
            return Response(
                {'error': 'New password must be at least 8 characters long'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update password
        user.set_password(new_password)
        user.save()
        
        # Delete existing token to force re-login
        user.auth_token.delete()
        
        return Response({
            'message': 'Password changed successfully. Please login again.',
            'status': 'success'
        }, status=status.HTTP_200_OK)

class PasswordResetRequestView(APIView):
    """
    Request password reset email.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # For security, don't reveal if user exists
            return Response({'message': 'If an account exists with this email, a reset link has been sent.'})

        # Generate token
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_encode
        from django.utils.encoding import force_bytes

        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # Use frontend URL from settings
        reset_link = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
        
        # Send email
        from django.core.mail import send_mail
        try:
            send_mail(
                subject='Password Reset Request',
                message=f'Click the following link to reset your password: {reset_link}',
                from_email=settings.DEFAULT_FROM_EMAIL or 'noreply@example.com',
                recipient_list=[email],
                fail_silently=False,
            )
        except Exception as e:
            print(f"Failed to send email: {e}")
            return Response({'error': 'Failed to send reset email'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({'message': 'If an account exists with this email, a reset link has been sent.'})

class PasswordResetConfirmView(APIView):
    """
    Confirm password reset with token and new password.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        uidb64 = request.data.get('uid')
        token = request.data.get('token')
        new_password = request.data.get('new_password')
        
        if not uidb64 or not token or not new_password:
             return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.contrib.auth.tokens import default_token_generator
        from django.utils.http import urlsafe_base64_decode
        from django.utils.encoding import force_str
        
        try:
            uid = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({'error': 'Invalid reset link'}, status=status.HTTP_400_BAD_REQUEST)
            
        if not default_token_generator.check_token(user, token):
            return Response({'error': 'Invalid or expired reset link'}, status=status.HTTP_400_BAD_REQUEST)
            
        if len(new_password) < 8:
            return Response({'error': 'Password must be at least 8 characters'}, status=status.HTTP_400_BAD_REQUEST)
            
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password has been reset successfully'})

# ==================== CATEGORY HIERARCHY VIEWS ====================

class CategoryListView(APIView):
    """List all categories"""
    permission_classes = [AllowAny]

    def get(self, request):
        categories = Category.objects.all()
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

class LevelListView(APIView):
    """List levels by category"""
    permission_classes = [AllowAny]

    def get(self, request):
        category_name = request.query_params.get('category')
        category_id = request.query_params.get('category_id')
        
        if category_id:
            levels = Level.objects.filter(category_id=category_id)
        elif category_name:
            try:
                category = Category.objects.get(name=category_name)
                levels = Level.objects.filter(category=category)
            except Category.DoesNotExist:
                return Response({'error': 'Category not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            levels = Level.objects.all()
        
        serializer = LevelSerializer(levels, many=True)
        return Response(serializer.data)

class SubjectListView(APIView):
    """List subjects by level"""
    permission_classes = [AllowAny]

    def get(self, request):
        level_name = request.query_params.get('level')
        level_id = request.query_params.get('level_id')
        
        if level_id:
            subjects = Subject.objects.filter(level_id=level_id)
        elif level_name:
            try:
                level = Level.objects.get(name=level_name)
                subjects = Subject.objects.filter(level=level)
            except Level.DoesNotExist:
                return Response({'error': 'Level not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            subjects = Subject.objects.all()
        
        serializer = SubjectSerializer(subjects, many=True)
        return Response(serializer.data)

# ==================== USER PROFILE VIEWS ====================

class UserProfileView(APIView):
    """Get and update user profile"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        try:
            profile = request.user.profile
            profile.check_streak()
            serializer = UserProfileSerializer(profile)
            return Response(serializer.data)
        except UserProfile.DoesNotExist:
            # Create profile if doesn't exist
            profile = UserProfile.objects.create(user=request.user)
            serializer = UserProfileSerializer(profile)
            return Response(serializer.data)

    def patch(self, request):
        profile = request.user.profile
        serializer = UserProfileSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ==================== QUIZ CONFIGURATION VIEWS ====================

class QuizConfigView(APIView):
    """Create and retrieve quiz configurations"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Accept both id and name for category, level, subject
        data = request.data.copy()
        
        # Handle category
        if 'category' in data and isinstance(data['category'], str):
            try:
                category = Category.objects.get(name=data['category'])
                data['category'] = category.id
            except Category.DoesNotExist:
                return Response({'error': f'Category "{data["category"]}" not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle level
        if 'level' in data and isinstance(data['level'], str):
            try:
                level = Level.objects.get(name=data['level'])
                data['level'] = level.id
            except Level.DoesNotExist:
                return Response({'error': f'Level "{data["level"]}" not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Handle subject
        if 'subject' in data and isinstance(data['subject'], str):
            try:
                subject = Subject.objects.get(name=data['subject'])
                data['subject'] = subject.id
            except Subject.DoesNotExist:
                return Response({'error': f'Subject "{data["subject"]}" not found'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = QuizConfigSerializer(data=data)
        if serializer.is_valid():
            config = serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request):
        configs = QuizConfig.objects.filter(user=request.user)
        serializer = QuizConfigSerializer(configs, many=True)
        return Response(serializer.data)

# ==================== AI QUIZ GENERATION VIEWS ====================

# ... (imports)

# Define topic constraints for Class 10 Mathematics
TOPIC_MAP = {
    "Academics": {
        "10th Grade": {
            "Mathematics": {
                "easy": [
                    "Real Numbers: Euclid Division Lemma basics",
                    "Real Numbers: HCF and LCM, Terminating decimals",
                    "Polynomials: Factorization, Zeros of quadratic polynomials",
                    "Polynomials: Basic identity relations",
                    "Linear Equations: Graphical solutions, Substitution & elimination methods",
                    "Quadratic Equations: Factorization, Middle term splitting",
                    "Arithmetic Progressions: nth term, Sum of first n terms",
                    "Geometry: Basic Proportionality Theorem, Similarity, Basic angle properties",
                    "Coordinate Geometry: Distance formula, Midpoint formula",
                    "Trigonometry: Trigonometric ratios (0°–90°), Identity proofs",
                    "Circles: Tangent theorem, Properties of tangents",
                    "Statistics: Mean of ungrouped data, Frequency distribution (basic)",
                    "Linear Equations: Substitution method (easy)",
                    "Coordinate Geometry: Midpoint and section formula",
                    "Triangles: Area of triangle using coordinates",
                    "Coordinate Geometry: Slope of line and equations of lines",
                    "Surface Areas & Volumes: Cylinder/Cone/Sphere (direct problems)",
                    "Trigonometry: Values of sin, cos, tan for specific angles",
                    "Surface Areas & Volumes: Volume of cylinder and cone",
                    "Probability: Simple probability problems with dice/coin"
                ],
                "medium": [
                    "Real Numbers: Fundamental Theorem of Arithmetic, HCF/LCM via prime factorization",
                    "Polynomials: Polynomial division, Factor theorem, Word problems",
                    "Linear Equations: Consistency cases, Cross-multiplication method",
                    "Quadratic Equations: Word problems, Discriminant analysis",
                    "Arithmetic Progressions: Word problems, Sum of n terms in a given sequence",
                    "Geometry: Proof of similarity, Advanced BPT applications",
                    "Coordinate Geometry: Area of triangle using coordinates, Section formula",
                    "Trigonometry: Trigonometric identities, Equations with multiple steps",
                    "Circles: Secants and tangents, Angle properties in circles",
                    "Statistics: Median and Mode, Cumulative frequency",
                    "Coordinate Geometry: Finding the equation of a line",
                    "Linear Equations: Word problems with money/speed/age",
                    "Surface Areas & Volumes: Combination of solids, mixed TSA/volume",
                    "Trigonometry: Prove identities with multiple terms",
                    "Triangles: Advanced similarity problems",
                    "Probability: Conditional probability, Random variable problems",
                    "Coordinate Geometry: Equation of straight lines",
                    "Polynomials: Advanced factorization problems",
                    "Surface Areas & Volumes: Volume of frustum",
                    "Statistics: Variance and standard deviation"
                ],
                "hard": [
                    "Real Numbers: Proof of irrationality using Euclid’s algorithm",
                    "Polynomials: Advanced factorization, Polynomial equations with parameters",
                    "Linear Equations: Complex word problems with constraints, Advanced consistency",
                    "Quadratic Equations: Advanced parameter-based problems, Roots and nature of roots",
                    "Arithmetic Progressions: Mixed problems with conditions",
                    "Geometry: Full similarity proof problems, Pythagoras converse",
                    "Coordinate Geometry: Coordinate geometry with proofs, Area and section formula",
                    "Trigonometry: Complex identities, Solving trigonometric equations",
                    "Circles: Proofs related to angles in cyclic quadrilaterals, Tangent-secant theorem",
                    "Statistics: Box plot construction, Combined mean/median/mode problems",
                    "Probability: Multi-step counting, tricky sample space problems",
                    "Surface Areas & Volumes: Recasting/melting combined solids",
                    "Coordinate Geometry: Finding area of triangle from coordinates",
                    "Polynomials: Long division, Parameterized polynomials",
                    "Linear Equations: Systems of equations with inequalities",
                    "Statistics: Advanced regression problems",
                    "Surface Areas & Volumes: Volume of frustum and complex solids",
                    "Trigonometry: Solving for multiple unknowns in identity proofs",
                    "Circles: Angle between two tangents from external point",
                    "Coordinate Geometry: Proofs with locus of points"
                ]
            },
            "Physics": {
                "easy": [
                    "Light: Reflection and refraction basics, Concave/convex mirrors",
                    "Human Eye: Structure and function, Myopia/Hypermetropia",
                    "Electricity: Ohm's law, Resistance, Series and parallel circuits",
                    "Magnetic Effects: Magnetic field lines, Right-hand thumb rule",
                    "Sources of Energy: Renewable and non-renewable sources"
                ],
                "medium": [
                    "Light: Lens formula, Power of a lens, Image formation by lenses",
                    "Human Eye: Atmospheric refraction, Scattering of light (Tyndall effect)",
                    "Electricity: Heating effect of current, Electric power calculation",
                    "Magnetic Effects: Force on a current-carrying conductor, Fleming's left-hand rule",
                    "Sources of Energy: Solar energy, Wind energy, Nuclear energy"
                ],
                "hard": [
                    "Light: Advanced problems on spherical mirrors and lenses",
                    "Human Eye: Complex problems on vision defects and correction",
                    "Electricity: Combination of resistors, Power dissipation problems",
                    "Magnetic Effects: Electromagnetic induction, AC/DC generators",
                    "Sources of Energy: Environmental consequences of energy usage"
                ]
            },
            "Chemistry": {
                "easy": [
                    "Chemical Reactions: Balancing equations, Types of reactions (combination, decomposition)",
                    "Acids, Bases and Salts: pH scale basics, Common acids and bases",
                    "Metals and Non-metals: Physical properties, Reactivity series",
                    "Carbon and its Compounds: Covalent bonding, Allotropes of carbon",
                    "Periodic Classification: Mendeleev's periodic table, Modern periodic law"
                ],
                "medium": [
                    "Chemical Reactions: Redox reactions, Corrosion and rancidity",
                    "Acids, Bases and Salts: Preparation and uses of salts, Neutralization",
                    "Metals and Non-metals: Extraction of metals, Ionic compounds",
                    "Carbon and its Compounds: Homologous series, IUPAC nomenclature of simple compounds",
                    "Periodic Classification: Trends in the modern periodic table (valency, atomic size)"
                ],
                "hard": [
                    "Chemical Reactions: Advanced balancing, Stoichiometry problems",
                    "Acids, Bases and Salts: Advanced pH calculations, Titration concepts",
                    "Metals and Non-metals: Metallurgy processes, Refining of metals",
                    "Carbon and its Compounds: Isomerism, Functional groups, Soaps and detergents",
                    "Periodic Classification: Detailed trends (metallic character, electronegativity)"
                ]
            },
            "Biology": {
                "easy": [
                    "Life Processes: Nutrition in plants and animals, Respiration basics",
                    "Control and Coordination: Human brain structure, Reflex action",
                    "How do Organisms Reproduce?: Asexual and sexual reproduction in plants",
                    "Heredity and Evolution: Mendel's experiments, Dominant and recessive traits",
                    "Our Environment: Food chains, Ozone depletion"
                ],
                "medium": [
                    "Life Processes: Human respiratory system, Human circulatory system (heart)",
                    "Control and Coordination: Plant hormones, Endocrine glands in humans",
                    "How do Organisms Reproduce?: Human reproductive system, Pollination",
                    "Heredity and Evolution: Sex determination, Speciation",
                    "Our Environment: Biological magnification, Waste management"
                ],
                "hard": [
                    "Life Processes: Excretion in humans (nephron), Double circulation",
                    "Control and Coordination: Nerve impulse transmission, Tropic movements in plants",
                    "How do Organisms Reproduce?: Reproductive health, Population control methods",
                    "Heredity and Evolution: Homologous and analogous organs, Fossil evidence",
                    "Our Environment: Ecosystems, 10% law of energy transfer"
                ]
            }
        },
        "12th Grade": {
            "Mathematics": {
                "easy": [
                    "Differentiation: Basic derivatives (power rule, product rule)",
                    "Matrices: Determinants, Basic operations",
                    "Vectors: Addition, Subtraction, Scalar multiplication",
                    "Probability: Simple events, Conditional probability",
                    "Differential Equations: First-order linear equations",
                    "Relations and Functions: Domain, Range, Types of functions",
                    "Permutations & Combinations: Basic counting techniques",
                    "Trigonometry: Standard angles, Simple identities",
                    "Coordinate Geometry: Line equation, Circle equation basics",
                    "Calculus: Limits and continuity"
                ],
                "medium": [
                    "Differentiation: Application of derivatives, Maxima and minima",
                    "Matrices: Inverse of matrices, Cramer’s Rule",
                    "Vectors: Dot product, Cross product",
                    "Probability: Binomial distribution, Poisson distribution",
                    "Differential Equations: Second-order equations, Applications",
                    "Relations and Functions: Composition, Inverse of functions",
                    "Permutations & Combinations: Advanced counting problems",
                    "Trigonometry: Prove and apply identities, Angle transformations",
                    "Coordinate Geometry: Conic sections, Hyperbola, Parabola equations",
                    "Calculus: Integration by parts"
                ],
                "hard": [
                    "Differentiation: Implicit differentiation, Higher-order derivatives",
                    "Matrices: Eigenvalues, Eigenvectors",
                    "Vectors: Vector calculus, Applications in 3D geometry",
                    "Probability: Advanced combinatorial probability, Random variables",
                    "Differential Equations: Non-homogeneous equations, Complex solutions",
                    "Relations and Functions: Proofs of inverse relations, Limit applications",
                    "Permutations & Combinations: Advanced theorems and proofs",
                    "Trigonometry: Complex identities, Multiple-angle formulas",
                    "Coordinate Geometry: Parametric equations of conics",
                    "Calculus: Advanced integration techniques, Improper integrals"
                ]
            },
            "Physics": {
                "easy": [
                    "Electrostatics: Coulomb's law, Electric field",
                    "Current Electricity: Ohm's law, Kirchhoff's laws",
                    "Magnetic Effects of Current: Biot-Savart law, Ampere's law",
                    "Electromagnetic Induction: Faraday's law, Lenz's law",
                    "Optics: Reflection, Refraction, Lenses"
                ],
                "medium": [
                    "Electrostatics: Gauss's theorem, Electric potential",
                    "Current Electricity: Potentiometer, Meter bridge",
                    "Magnetic Effects of Current: Force on a moving charge, Torque on a current loop",
                    "Electromagnetic Induction: AC generator, Transformers",
                    "Optics: Interference, Diffraction, Polarization"
                ],
                "hard": [
                    "Electrostatics: Capacitors, Dielectrics",
                    "Current Electricity: Complex circuits, RC circuits",
                    "Magnetic Effects of Current: Cyclotron, Galvanometer",
                    "Electromagnetic Induction: LC oscillations, Maxwell's equations",
                    "Optics: Wave optics, Dual nature of radiation"
                ]
            },
            "Chemistry": {
                "easy": [
                    "Solid State: Crystalline and amorphous solids, Unit cells",
                    "Solutions: Concentration units, Colligative properties",
                    "Electrochemistry: Nernst equation, Galvanic cells",
                    "Chemical Kinetics: Rate of a reaction, Order of a reaction",
                    "p-Block Elements: Group 15, 16, 17, 18 elements"
                ],
                "medium": [
                    "Solid State: Packing efficiency, Voids, Crystal defects",
                    "Solutions: Raoult's law, Ideal and non-ideal solutions",
                    "Electrochemistry: Electrolytic cells, Kohlrausch's law",
                    "Chemical Kinetics: Integrated rate equations, Arrhenius equation",
                    "d- and f-Block Elements: General properties, Lanthanoids, Actinoids"
                ],
                "hard": [
                    "Solid State: Electrical and magnetic properties of solids",
                    "Solutions: Van't Hoff factor, Abnormal molar mass",
                    "Electrochemistry: Batteries, Corrosion",
                    "Chemical Kinetics: Collision theory, Activation energy",
                    "Coordination Compounds: IUPAC nomenclature, Isomerism, VBT, CFT"
                ]
            },
            "Biology": {
                "easy": [
                    "Reproduction in Organisms: Asexual and sexual reproduction",
                    "Sexual Reproduction in Flowering Plants: Flower structure, Pollination",
                    "Human Reproduction: Male and female reproductive systems",
                    "Biotechnology: Principles and processes",
                    "Ecosystem: Structure and function"
                ],
                "medium": [
                    "Reproduction in Organisms: Gametogenesis, Fertilization",
                    "Sexual Reproduction in Flowering Plants: Double fertilization, Post-fertilization events",
                    "Human Reproduction: Menstrual cycle, Embryonic development",
                    "Biotechnology and its Applications: Genetically modified organisms, Gene therapy",
                    "Biodiversity and Conservation: Patterns of biodiversity, Biodiversity conservation"
                ],
                "hard": [
                    "Reproduction in Organisms: Parthenogenesis, Apomixis",
                    "Sexual Reproduction in Flowering Plants: Apomixis and polyembryony",
                    "Human Reproduction: Hormonal control of reproduction",
                    "Biotechnology: Molecular diagnosis, Transgenic animals",
                    "Environmental Issues: Air pollution, Water pollution, Climate change"
                ]
            },
            "Computer Science": {
                "easy": [
                    "Programming in Python: Functions, File handling",
                    "Data Structures: Stacks, Queues",
                    "Database Management Systems: SQL queries",
                    "Computer Networks: Network topologies, Network devices"
                ],
                "medium": [
                    "Programming in Python: Recursion, Exception handling",
                    "Data Structures: Linked lists, Trees",
                    "Database Management Systems: Normalization, Joins",
                    "Computer Networks: TCP/IP model, OSI model"
                ],
                "hard": [
                    "Programming in Python: Object-oriented programming",
                    "Data Structures: Graphs, Heaps",
                    "Database Management Systems: Transaction management, Concurrency control",
                    "Computer Networks: Routing algorithms, Network security"
                ]
            }
        }
    },
    "Computer Science": {
        "easy": [
            "Data Structures: Arrays, Linked Lists",
            "Algorithms: Sorting algorithms (Bubble, Merge)",
            "Object-Oriented Programming: Classes and objects",
            "Operating Systems: Processes, Threads",
            "Networking: OSI model basics",
            "SQL: Select queries, Joins",
            "Python: Variables, Loops, Functions",
            "Java: Classes and Methods",
            "C++: Arrays, Functions",
            "Web Development: HTML, CSS"
        ],
        "medium": [
            "Data Structures: Trees, Heaps, Hashmaps",
            "Algorithms: Quick Sort, Merge Sort, Binary Search",
            "Object-Oriented Programming: Inheritance, Polymorphism",
            "Operating Systems: Memory management, File systems",
            "Networking: TCP/IP, Routing algorithms",
            "SQL: Subqueries, Joins, Aggregates",
            "Python: Libraries (NumPy, Pandas)",
            "Java: Exception handling, Multithreading",
            "C++: OOP, Standard Template Library",
            "Web Development: AJAX, Node.js"
        ],
        "hard": [
            "Data Structures: Graphs, Advanced tree operations",
            "Algorithms: Dynamic programming, Greedy algorithms",
            "Object-Oriented Programming: Design patterns",
            "Operating Systems: Virtual memory, Deadlock prevention",
            "Networking: Advanced protocols, Network design",
            "SQL: Normalization, Advanced queries",
            "Python: Generators, Decorators",
            "Java: Streams, Lambda functions",
            "C++: Memory management, Pointers",
            "Web Development: Full-stack development, React"
        ]
    },
    "Government Exams": {
        "easy": [
            "General Knowledge: History basics, Important dates",
            "Current Affairs: Prime Minister, President",
            "English: Vocabulary, Synonyms, Antonyms",
            "Mathematics: Basic arithmetic, Percentage",
            "General Science: Basic physics, chemistry, biology"
        ],
        "medium": [
            "General Knowledge: Freedom Struggle, Ancient and Medieval India",
            "Current Affairs: National and international issues",
            "English: Sentence correction, Error spotting",
            "General Science: Physics laws, Chemical reactions",
            "Mathematics: Time and work, Speed, Distance"
        ],
        "hard": [
            "General Knowledge: Indian polity, Indian constitution",
            "Current Affairs: International relations, Government schemes",
            "English: Reading comprehension, Idioms/Phrases",
            "Mathematics: Data interpretation, Advanced algebra",
            "General Science: Environmental Science, Advanced Physics"
        ]
    }
}

class QuizGenerateView(APIView):
    """Generate quiz using OpenAI based on configuration"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            return self._internal_post(request)
        except Exception as e:
            print(f"CRITICAL ERROR in QuizGenerateView: {e}")
            traceback.print_exc()
            return Response({
                'error': f"Internal Server Error: {str(e)}", 
                'details': traceback.format_exc()
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _internal_post(self, request):
        # ... (rest of the code for getting config)
        config_id = request.data.get('config_id')
        
        if config_id:
            # Config-based generation
            try:
                config = QuizConfig.objects.get(id=config_id, user=request.user)
                category = config.category
                level = config.level
                subject = config.subject
                difficulty = config.difficulty
                num_questions = config.number_of_questions
                custom_title = request.data.get('title', '')
            except QuizConfig.DoesNotExist:
                return Response({'error': 'Quiz configuration not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Direct parameter-based generation
            subject_id = request.data.get('subject_id')
            difficulty = request.data.get('difficulty', 'medium')
            num_questions = int(request.data.get('num_questions', 10))
            if num_questions > 100:
                num_questions = 100
            custom_title = request.data.get('title', '')
            
            if not subject_id:
                return Response({'error': 'subject_id is required'}, status=status.HTTP_400_BAD_REQUEST)
            
            try:
                subject = Subject.objects.get(id=subject_id)
                level = subject.level
                category = level.category
            except Subject.DoesNotExist:
                return Response({'error': 'Subject not found'}, status=status.HTTP_404_NOT_FOUND)

        topic_list = []
        try:
            topic_list = TOPIC_MAP.get(category.name, {}).get(level.name, {}).get(subject.name, {}).get(difficulty, [])
        except KeyError:
            pass

        if not topic_list:
            topic_list = [subject.name]
            
        # Shuffle topics to ensure variety each time
        random.shuffle(topic_list)

        all_questions_data = []
        last_error = None
        
        # Consolidate topics into a single list for the prompt
        topics_str = ", ".join(topic_list)

        prompt = f"""Generate {num_questions} UNIQUE, DIVERSE, and NON-REPETITIVE multiple-choice questions for a quiz covering the following topics: '{topics_str}' 
        (Subject: {subject.name}, Category: {category.name}, Level: {level.name}).

        Difficulty: {difficulty}
        Standard: CBSE (India) curriculum
        Random Seed: {random.randint(1, 100000)} (Use this to vary questions from previous requests)

        Return ONLY a valid JSON array with this exact structure:
        [
            {{
                "question": "Question text here?",
                "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                "correct_answer": 0,
                "explanation": "Explanation of the correct answer"
            }}
        ]

        Important:
        - Each question must have exactly 4 options
        - correct_answer must be the index (0-3) of the correct option
        - Make questions relevant to {difficulty} difficulty level
        - Provide clear explanations
        - Do NOT repeat questions from the same session.
        - Distribute the questions evenly across the topics: {topics_str}.
        """
        
        try:
            # Increased max_tokens for a single large request
            max_tokens_per_question = 350 
            max_tokens = min(num_questions * max_tokens_per_question, 8000)

            ai_content = generate_ai_response(prompt, max_tokens=max_tokens)
            
            # Clean up the response
            if '```json' in ai_content:
                ai_content = ai_content.split('```json')[1].split('```')[0]
            elif ai_content.startswith('```'):
                ai_content = ai_content.split('```')[1]
            
            start_index = ai_content.find('[')
            end_index = ai_content.rfind(']')

            if start_index != -1 and end_index != -1:
                ai_content = ai_content[start_index:end_index+1]
            
            all_questions_data = json.loads(ai_content)

        except Exception as e:
            last_error = e
            print(f"DEBUG: Exception in single-shot quiz generation: {e}")
            traceback.print_exc()

        # If no questions generated, return an error
        if not all_questions_data:
            print(f"DEBUG: AI generation failed completely.")
            error_message = "Failed to generate questions. Please check the API Key configuration or try again."
            if last_error:
                error_message = f"Failed to generate questions: {last_error}"
            raise ValueError(error_message)
        
        random.shuffle(all_questions_data)

        # Create Quiz
        quiz_title = custom_title or f"{subject.name} - {difficulty.capitalize()} Quiz"
        quiz = Quiz.objects.create(
            title=quiz_title,
            category=category,
            level=level,
            subject=subject,
            difficulty=difficulty,
            quiz_type='ai_generated',
            is_ai_generated=True,
            is_published=True,
            created_by=request.user,
            time_limit=num_questions * 60  # 60 seconds per question
        )

        
        # Create Questions
        for idx, q_data in enumerate(all_questions_data):
            Question.objects.create(
                quiz=quiz,
                question_text=q_data['question'],
                options=q_data['options'],
                correct_answer=q_data['correct_answer'],
                explanation=q_data.get('explanation', ''),
                order=idx + 1
            )
        
        # Update user profile
        profile = request.user.profile
        profile.total_quizzes_created += 1
        profile.save()
        
        serializer = QuizSerializer(quiz)
        return Response({
            'message': 'Quiz generated successfully',
            'quiz_id': quiz.id,
            'title': quiz.title,
            'questions_count': quiz.questions.count(),
            'difficulty': quiz.difficulty,
            'quiz': serializer.data
        }, status=status.HTTP_201_CREATED)

class QuizGenerateFromFileView(APIView):
    """Generate quiz from uploaded file (PDF, DOCX, TXT)"""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get('file')
        title = request.data.get('title', 'Untitled Quiz')
        num_questions = int(request.data.get('num_questions', 10))
        if num_questions > 100:
            num_questions = 100
        difficulty = request.data.get('difficulty', 'medium')
        category_id = request.data.get('category_id')
        level_id = request.data.get('level_id')
        subject_id = request.data.get('subject_id')
        
        if not file:
            return Response({'error': 'File is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate required metadata fields
        if not category_id:
            return Response({'error': 'Category is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not level_id:
            return Response({'error': 'Level is required'}, status=status.HTTP_400_BAD_REQUEST)
        if not subject_id:
            return Response({'error': 'Subject is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate that category, level, and subject exist
        try:
            category = Category.objects.get(pk=category_id)
        except Category.DoesNotExist:
            return Response({'error': f'Category with ID {category_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            level = Level.objects.get(pk=level_id)
        except Level.DoesNotExist:
            return Response({'error': f'Level with ID {level_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        
        try:
            subject = Subject.objects.get(pk=subject_id)
        except Subject.DoesNotExist:
            return Response({'error': f'Subject with ID {subject_id} not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Validate file size (max 50MB)
        if file.size > 50 * 1024 * 1024:
            return Response({'error': 'File size must be less than 50MB'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Validate file type
        allowed_extensions = ['.pdf', '.docx', '.txt', '.doc']
        file_ext = '.' + file.name.split('.')[-1].lower() if '.' in file.name else ''
        if file_ext not in allowed_extensions:
            return Response({
                'error': f'Invalid file type. Allowed types: PDF, DOCX, TXT'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Extract text from file
        try:
            file_content = extract_text_from_file(file)
            print(f"DEBUG: Extracted {len(file_content)} characters from file")
            print(f"DEBUG: First 200 chars: {file_content[:200]}")
            if not file_content or len(file_content.strip()) < 50:
                return Response({
                    'error': 'Could not extract enough text from the file. Please ensure the file contains readable text.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            print(f"DEBUG: ValueError in extraction: {e}")
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"DEBUG: Exception in extraction: {e}")
            return Response({'error': f'Unable to read file: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Prepare OpenAI prompt
        print(f"DEBUG: Preparing OpenAI prompt with {len(file_content)} characters of file content.")
        print(f"DEBUG: File content (first 500 chars): {file_content[:500]}...")
        
        # Define smart instructions based on difficulty
        difficulty_instructions = {
            'easy': "Focus on basic facts, definitions, and simple recall. Questions should be direct and encouraging.",
            'medium': "Focus on understanding and application. clearly test if the user grasps the core concepts. Mix straightforward questions with some that require thought.",
            'hard': "GENERATE SUPER SMART QUESTIONS. Focus on deep analysis, critical thinking, and synthesis of multiple concepts. Avoid simple recall. Ask 'Why', 'How', and 'What if' questions. Test the user's ability to apply knowledge in complex or novel scenarios. Make distractors (wrong options) plausible and tricky."
        }
        instruction = difficulty_instructions.get(difficulty, difficulty_instructions['medium'])

        prompt = f"""Based on the following study material, generate {num_questions} multiple-choice questions.
        
        Difficulty Level: {difficulty.upper()}
        Specific Instructions: {instruction}
        
        Study Material:
        {file_content}
        
        Return ONLY a valid JSON array with this structure:
        [
            {{
                "question": "Question text?",
                "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
                "correct_answer": 0,
                "explanation": "Explanation"
            }}
        ]
        """
        
        try:
            ai_content = generate_ai_response(prompt)
            print(f"DEBUG: Raw AI response content (first 500 chars): {ai_content[:500]}...")

            # Try to extract JSON if wrapped in markdown
            if '```json' in ai_content:
                ai_content = ai_content.split('```json')[1]
                ai_content = ai_content.split('```')[0]
            elif ai_content.startswith('```'):
                ai_content = ai_content.split('```')[1]

            # Find the start and end of the JSON array
            start_index = ai_content.find('[')
            end_index = ai_content.rfind(']')

            if start_index != -1 and end_index != -1:
                ai_content = ai_content[start_index:end_index+1]
            
            print(f"DEBUG: AI response content after extraction attempts (first 500 chars): {ai_content[:500]}...")

            questions_data = json.loads(ai_content)
            
            # Create Quiz with foreign key assignments
            quiz = Quiz(
                title=title,
                difficulty=difficulty,
                quiz_type='file_upload',
                is_ai_generated=True,
                is_published=True,  # Explicitly set to ensure quiz is accessible
                is_temporary=False, # Allow stats for file-generated quizzes
                created_by=request.user,
                uploaded_file=file,
                time_limit=num_questions * 60  # 1 minute per question
            )
            # Assign foreign keys using validated objects
            quiz.category = category
            quiz.level = level
            quiz.subject = subject
            quiz.save()
            
            for idx, q_data in enumerate(questions_data):
                Question.objects.create(
                    quiz=quiz,
                    question_text=q_data['question'],
                    options=q_data['options'],
                    correct_answer=q_data['correct_answer'],
                    explanation=q_data.get('explanation', ''),
                    order=idx + 1
                )
            
            profile = request.user.profile
            profile.total_quizzes_created += 1
            profile.save()
            
            serializer = QuizSerializer(quiz)
            return Response({
                'message': 'Quiz generated from file successfully',
                'quiz_id': quiz.id,
                'title': quiz.title,
                'questions_count': quiz.questions.count(),
                'difficulty': quiz.difficulty,
                'quiz': serializer.data
            }, status=status.HTTP_201_CREATED)
            
        except json.JSONDecodeError as e:
            # JSON parsing error from AI response
            traceback.print_exc()
            return Response({
                'error': 'Failed to parse AI response',
                'details': f'The AI generated invalid JSON: {str(e)}',
                'type': 'JSONDecodeError'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except KeyError as e:
            # Missing required field in AI response
            traceback.print_exc()
            return Response({
                'error': 'Invalid question format from AI',
                'details': f'Missing required field in AI response: {str(e)}',
                'type': 'KeyError'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        except Exception as e:
            # Print full traceback for debugging
            traceback.print_exc()
            return Response({
                'error': 'Failed to generate quiz from file',
                'details': str(e),
                'type': type(e).__name__
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ==================== QUIZ MANAGEMENT VIEWS ====================

class RecommendedQuizzes(APIView):
    """
    Generate personalized quiz recommendations for the logged-in user.
    Recommendations are based on preferred categories, attempt history, and popularity.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            user = request.user
            profile = user.profile
        except UserProfile.DoesNotExist:
            return Response({"error": "User profile not found."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Fetch user's preferred categories and recent activity
        preferred_category_names = [cat.strip() for cat in profile.category_preference.split(',') if cat.strip()]
        
        # Get the most recent category from the user's last 5 attempts
        recent_attempts = QuizAttempt.objects.filter(user=user, status='completed').order_by('-completed_at').select_related('quiz__category', 'quiz__subject')[:5]
        
        recent_categories = [attempt.quiz.category.name for attempt in recent_attempts if attempt.quiz.category]
        most_recent_category = recent_categories[0] if recent_categories else None

        recent_subjects = [attempt.quiz.subject.name for attempt in recent_attempts if attempt.quiz.subject]
        most_recent_subject = recent_subjects[0] if recent_subjects else None

        # If user has no preferences or recent activity, return empty list (don't trigger recommendations)
        if not preferred_category_names and not recent_subjects:
            return Response([])

        # 2. Fetch all quizzes and user's recent attempts
        # STRICT MODE: Only fetch quizzes that match the user's recent SUBJECTS.
        # This prevents "Chemistry" from showing up when user did "Biology".
        all_quizzes = list(Quiz.objects.filter(
            is_published=True,
            is_temporary=False,
            subject__name__in=recent_subjects # STRICT FILTER
        ).select_related('category', 'subject'))
        
        attempted_quizzes_map = {attempt.quiz_id: attempt.completed_at for attempt in recent_attempts}

        # 3. Score each quiz
        scored_quizzes = []
        for quiz in all_quizzes:
            score = 0
            
            # Rule 1: Prioritize preferred categories (Keep as tie-breaker)
            if quiz.category.name in preferred_category_names:
                score += 10
            
            # Rule 2: Boost for MOST recent subject
            if quiz.subject.name == most_recent_subject:
                score += 50 
            
            # Rule 3: Factor in popularity
            score += quiz.popularity_score
            
            # Rule 4: Deprioritize recently attempted quizzes
            if quiz.id in attempted_quizzes_map:
                days_since_attempt = (timezone.now() - attempted_quizzes_map[quiz.id]).days
                if days_since_attempt <= 1:
                    score -= 50
                elif days_since_attempt <= 7:
                    score -= 20
                else:
                    score -= 5
            else:
                score += 10 # Bonus for unattempted quizzes
            
            scored_quizzes.append({'quiz': quiz, 'score': score})

        # 4. Sort quizzes by score
        scored_quizzes.sort(key=lambda x: x['score'], reverse=True)
        
        # 5. Build the final list of recommendations
        final_recommendations = []
        recommended_ids = set()
        recommended_combos = set()

        # Add from scored quizzes first
        for item in scored_quizzes:
            if len(final_recommendations) >= 5:
                break
            quiz = item['quiz']
            combo = (quiz.category.id, quiz.level.id, quiz.difficulty)
            if quiz.id not in recommended_ids and combo not in recommended_combos:
                final_recommendations.append(quiz)
                recommended_ids.add(quiz.id)
                recommended_combos.add(combo)
        
        # If still fewer than 5, add trending quizzes
        if len(final_recommendations) < 5:
            trending_quizzes = Quiz.objects.filter(is_published=True) \
                .exclude(id__in=recommended_ids) \
                .order_by('-popularity_score')[:10]
            
            for quiz in trending_quizzes:
                if len(final_recommendations) >= 5:
                    break
                combo = (quiz.category.id, quiz.level.id, quiz.difficulty)
                if quiz.id not in recommended_ids and combo not in recommended_combos:
                    final_recommendations.append(quiz)
                    recommended_ids.add(quiz.id)
                    recommended_combos.add(combo)

        # 6. Return the final list
        serializer = QuizListSerializer(final_recommendations, many=True)
        return Response(serializer.data)

class QuizListView(APIView):
    """List all published quizzes"""
    permission_classes = [AllowAny]

    def get(self, request):
        quizzes = Quiz.objects.filter(is_published=True).select_related(
            'category', 'level', 'subject', 'created_by'
        )
        
        # Filter by query params
        category = request.query_params.get('category')
        level = request.query_params.get('level')
        subject = request.query_params.get('subject')
        difficulty = request.query_params.get('difficulty')
        
        if category:
            quizzes = quizzes.filter(category__name=category)
        if level:
            quizzes = quizzes.filter(level__name=level)
        if subject:
            quizzes = quizzes.filter(subject__name=subject)
        if difficulty:
            quizzes = quizzes.filter(difficulty=difficulty)
        
        serializer = QuizListSerializer(quizzes, many=True)
        return Response(serializer.data)

class QuizDetailView(APIView):
    """Get quiz details (for quiz creator/admin)"""
    permission_classes = [IsAuthenticated]

    def get(self, request, quiz_id):
        try:
            quiz = Quiz.objects.get(id=quiz_id)
            serializer = QuizSerializer(quiz)
            return Response(serializer.data)
        except Quiz.DoesNotExist:
            return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)

class QuizTakeView(APIView):
    """
    Get quiz for taking.
    - If user has an 'in_progress' attempt, questions are returned in original order.
    - If user is starting a new quiz, questions are shuffled.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, quiz_id):
        try:
            quiz = Quiz.objects.get(id=quiz_id, is_published=True)
            
            # Check for an existing 'in_progress' attempt
            in_progress_attempt = QuizAttempt.objects.filter(
                quiz=quiz,
                user=request.user,
                status='in_progress'
            ).first()
            
            if not in_progress_attempt:
                # User is starting a new quiz, so shuffle questions
                questions = list(quiz.questions.all())
                random.shuffle(questions)
                # Attach shuffled questions to the quiz object for the serializer
                quiz.questions_for_serializer = questions
            
            # If resuming, serializer will use default ordered questions
            serializer = QuizTakeSerializer(quiz)
            return Response(serializer.data)
            
        except Quiz.DoesNotExist:
            return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)

# ==================== QUIZ ATTEMPT VIEWS ====================

class QuizStartView(APIView):
    """Start a new quiz attempt"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        quiz_id = request.data.get('quiz_id')
        
        try:
            quiz = Quiz.objects.get(id=quiz_id, is_published=True)
        except Quiz.DoesNotExist:
            return Response({'error': 'Quiz not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Create quiz attempt
        attempt = QuizAttempt.objects.create(
            user=request.user,
            quiz=quiz,
            total_questions=quiz.total_questions,
            status='in_progress'
        )
        
        serializer = QuizAttemptSerializer(attempt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class QuizSubmitView(APIView):
    """Submit quiz answers and get results"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = QuizSubmitSerializer(data=request.data)
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        attempt_id = serializer.validated_data['attempt_id']
        answers_data = serializer.validated_data['answers']
        time_taken = serializer.validated_data.get('time_taken', 0)
        
        try:
            attempt = QuizAttempt.objects.get(id=attempt_id, user=request.user, status='in_progress')
        except QuizAttempt.DoesNotExist:
            return Response({'error': 'Active quiz attempt not found'}, status=status.HTTP_404_NOT_FOUND)
            
        quiz = attempt.quiz

        # Update attempt details
        attempt.time_taken = time_taken
        attempt.status = 'completed'
        attempt.completed_at = timezone.now()
        
        # Save answers
        for answer_data in answers_data:
            try:
                question = Question.objects.get(id=answer_data['question_id'], quiz=quiz)
                Answer.objects.create(
                    attempt=attempt,
                    question=question,
                    selected_option=answer_data['selected_option']
                )
            except Question.DoesNotExist:
                continue
        
        # Calculate score
        attempt.calculate_score()
        
        # If the quiz is temporary, don't update user profile stats
        streak_lost = False
        if not quiz.is_temporary:
            # Update user profile
            profile = request.user.profile
            profile.total_quizzes_taken += 1
            profile.total_questions_answered += attempt.total_questions
            profile.total_correct_answers += attempt.correct_answers
            profile.add_xp(attempt.xp_earned)
            profile.update_streak()
            
            # Save profile to ensure stats are updated before signal handlers run
            profile.save()
            
            streak_lost = getattr(profile, 'streak_was_just_reset', False)
            
            # Update analytics
            analytics, created = QuizAnalytics.objects.get_or_create(user=request.user)
            analytics.total_quizzes_taken += 1
            analytics.total_questions_answered += attempt.total_questions
            analytics.total_correct_answers += attempt.correct_answers
            
            if quiz.difficulty == 'easy':
                analytics.easy_quizzes_taken += 1
            elif quiz.difficulty == 'medium':
                analytics.medium_quizzes_taken += 1
            else:
                analytics.hard_quizzes_taken += 1
            
            analytics.total_time_spent += time_taken
            if analytics.total_quizzes_taken > 0:
                analytics.average_quiz_time = analytics.total_time_spent // analytics.total_quizzes_taken
            
            analytics.save()
        else:
            profile = request.user.profile
            streak_lost = False # Default value for temporary quizzes

        # Save attempt (Triggers post_save signal for achievements)
        # We do this AFTER profile update so checks see correct stats
        attempt.save()

        # Return results
        attempt_serializer = QuizAttemptSerializer(attempt)
        quiz_serializer = QuizResultSerializer(quiz)
        return Response({
            'message': 'Quiz submitted successfully',
            'attempt': attempt_serializer.data,
            'quiz': quiz_serializer.data,
            'xp_earned': attempt.xp_earned,
            'new_level': profile.level,
            'new_xp': profile.xp,
            'streak_lost': streak_lost,
            'current_streak': profile.current_streak,
            'longest_streak': profile.longest_streak
        }, status=status.HTTP_200_OK)

class QuizAttemptDetailView(APIView):
    """Get details of a specific quiz attempt"""
    permission_classes = [IsAuthenticated]

    def get(self, request, attempt_id):
        try:
            attempt = QuizAttempt.objects.get(id=attempt_id, user=request.user)
            serializer = QuizAttemptSerializer(attempt)
            return Response(serializer.data)
        except QuizAttempt.DoesNotExist:
            return Response({'error': 'Attempt not found'}, status=status.HTTP_404_NOT_FOUND)

class UserQuizHistoryView(APIView):
    """Get user's quiz attempt history"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        attempts = QuizAttempt.objects.filter(user=request.user, quiz__is_temporary=False).select_related('quiz', 'quiz__category')
        serializer = QuizAttemptSerializer(attempts, many=True)
        return Response(serializer.data)

# ==================== ANALYTICS VIEWS ====================

class UserAnalyticsView(APIView):
    """Get user analytics including streak and activity history"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = user.profile
        
        # 1. Update/Check Streak
        profile.check_streak()
        
        # 2. Get Analytics Base Data
        analytics, created = QuizAnalytics.objects.get_or_create(user=user)
        base_serializer = QuizAnalyticsSerializer(analytics)
        
        # 3. Get Activity History
        from django.db.models.functions import TruncDate
        activity_dates = QuizAttempt.objects.filter(
            user=user, 
            status='completed'
        ).annotate(
            date=TruncDate('completed_at')
        ).values('date').distinct().order_by('-date')
        
        activity_history = [
            item['date'].strftime('%Y-%m-%d') 
            for item in activity_dates 
            if item['date']
        ]

        # 4. Combine Data
        data = base_serializer.data
        data.update({
            'streak_days': profile.current_streak,
            'longest_streak': profile.longest_streak,
            'activity_history': activity_history
        })
        
        return Response(data)

class UserPerformanceView(APIView):
    """Get user performance data"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        profile = user.profile
        analytics, created = QuizAnalytics.objects.get_or_create(user=user)

        total_quizzes_attempted = QuizAttempt.objects.filter(user=user).count()
        total_quizzes_completed = QuizAttempt.objects.filter(user=user, status='completed').count()
        
        total_correct_answers = analytics.total_correct_answers
        total_questions_answered = analytics.total_questions_answered
        total_incorrect_answers = total_questions_answered - total_correct_answers
        
        accuracy = (total_correct_answers / total_questions_answered * 100) if total_questions_answered > 0 else 0

        # Category-wise performance for the most recent quiz in each specified category
        categories_to_check = ["Academics", "Computer Engineering", "Government Exams"]
        category_performance_list = []
        
        for cat_name in categories_to_check:
            last_attempt_in_cat = QuizAttempt.objects.filter(
                user=user, 
                status='completed', 
                quiz__category__name=cat_name
            ).order_by('-completed_at').first()
            
            if last_attempt_in_cat:
                category_performance_list.append({
                    'category': cat_name,
                    'average_score': last_attempt_in_cat.score_percentage
                })

        category_wise_performance = {
            'most_recent_quiz': {
                'quiz_title': 'Most Recent Quizzes by Category',
                'categories': category_performance_list
            }
        } if category_performance_list else None


        # Subject-wise performance based on the category of the last quiz
        last_attempt = QuizAttempt.objects.filter(user=user, status='completed').order_by('-completed_at').first()
        subject_wise_performance = None

        if last_attempt:
            last_quiz_category = last_attempt.quiz.category
            subjects_in_category = Subject.objects.filter(level__category=last_quiz_category)
            
            subject_performance_list = []
            for subject in subjects_in_category:
                last_attempt_for_subject = QuizAttempt.objects.filter(
                    user=user,
                    status='completed',
                    quiz__subject=subject
                ).order_by('-completed_at').first()

                if last_attempt_for_subject:
                    subject_performance_list.append({
                        'subject': subject.name,
                        'score': last_attempt_for_subject.score_percentage
                    })

            subject_wise_performance = {
                'most_recent_quiz': {
                    'quiz_title': f'Performance in {last_quiz_category.name}',
                    'subjects': subject_performance_list
                }
            }


        # Get activity history (dates of completed quizzes)
        from django.db.models.functions import TruncDate
        
        activity_dates = QuizAttempt.objects.filter(
            user=user, 
            status='completed'
        ).annotate(
            date=TruncDate('completed_at')
        ).values('date').distinct().order_by('-date')
        
        # Convert to list of strings "YYYY-MM-DD"
        activity_history = [
            item['date'].strftime('%Y-%m-%d') 
            for item in activity_dates 
            if item['date']
        ]

        data = {
            'overall': {
                'total_quizzes_attempted': total_quizzes_attempted,
                'total_quizzes_completed': total_quizzes_completed,
                'total_correct_answers': total_correct_answers,
                'total_incorrect_answers': total_incorrect_answers,
                'accuracy': accuracy,
                'average_score': profile.average_score,
                'highest_score': QuizAttempt.objects.filter(user=user, status='completed').aggregate(Avg('score_percentage'))['score_percentage__avg'] or 0,
            },
            'category_wise_performance': category_wise_performance,
            'subject_wise_performance': subject_wise_performance,
            'activity_history': activity_history,
            'streak_days': profile.current_streak,
            'longest_streak': profile.longest_streak,
        }
        return Response(data)

# ==================== PERFORMANCE DASHBOARD VIEWS ====================

class OverallPerformanceMetricsView(APIView):
    """Get overall performance metrics for the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        completed_attempts = QuizAttempt.objects.filter(user=user, status='completed')

        if not completed_attempts.exists():
            return Response({
                'average_score': 0,
                'highest_score': 0,
            })

        aggregates = completed_attempts.aggregate(
            average_score=Avg('score_percentage'),
            highest_score=Max('score_percentage')
        )

        return Response({
            'average_score': aggregates['average_score'] or 0,
            'highest_score': aggregates['highest_score'] or 0,
        })

class CategoryDistributionView(APIView):
    """Get the distribution of quizzes played across different categories."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        category_data = QuizAttempt.objects.filter(user=user, status='completed') \
            .values('quiz__category__name') \
            .annotate(quiz_count=Count('id')) \
            .order_by('-quiz_count')

        # Rename keys for consistency
        data = [{'category': item['quiz__category__name'], 'quiz_count': item['quiz_count']} for item in category_data if item['quiz__category__name']]
        
        return Response(data)

class PerformanceByCategoryView(APIView):
    """Get average and highest scores for each quiz category."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        performance_data = QuizAttempt.objects.filter(user=user, status='completed') \
            .values('quiz__category__name') \
            .annotate(
                average_score=Avg('score_percentage'),
                highest_score=Max('score_percentage')
            ) \
            .order_by('quiz__category__name')

        # Rename key for consistency
        data = [
            {
                'category': item['quiz__category__name'],
                'average_score': item['average_score'],
                'highest_score': item['highest_score']
            } for item in performance_data if item['quiz__category__name']
        ]

        return Response(data)

class PerformanceBySubjectView(APIView):
    """Get average and highest scores for each quiz subject (topic)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        performance_data = QuizAttempt.objects.filter(user=user, status='completed') \
            .values('quiz__subject__name') \
            .annotate(
                average_score=Avg('score_percentage'),
                quiz_count=Count('id')
            ) \
            .order_by('quiz__subject__name')

        # Rename key for consistency
        data = [
            {
                'subject': item['quiz__subject__name'],
                'average_score': item['average_score'],
                'quiz_count': item['quiz_count']
            } for item in performance_data if item['quiz__subject__name']
        ]

        return Response(data)

class UserProgressView(APIView):
    """Get user's score progression over the last 15 quizzes."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        progress_data = QuizAttempt.objects.filter(user=user, status='completed') \
            .order_by('-completed_at')[:15] \
            .values('quiz__title', 'score_percentage', 'completed_at')

        # Reverse the data to show chronological order
        data = sorted(progress_data, key=lambda x: x['completed_at'])

        # Format the data for the chart
        formatted_data = [
            {
                'quiz_name': item['quiz__title'],
                'score': item['score_percentage'],
                'date': item['completed_at'].strftime('%Y-%m-%d')
            } for item in data
        ]

        return Response(formatted_data)

class RecentActivityView(APIView):
    """Get recent user activity"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        now = timezone.now()
        
        activities = []

        # 1. Recent quiz attempts
        # Added select_related for performance and to ensure related objects are loaded
        recent_attempts = QuizAttempt.objects.filter(user=user, status='completed') \
            .select_related('quiz', 'quiz__category', 'quiz__subject') \
            .order_by('-completed_at')[:7]
            
        for attempt in recent_attempts:
            try:
                # Safely access related objects
                quiz_title = attempt.quiz.title if attempt.quiz else "Unknown Quiz"
                category_name = attempt.quiz.category.name if attempt.quiz and attempt.quiz.category else "General"
                subject_name = attempt.quiz.subject.name if attempt.quiz and attempt.quiz.subject else "General"
                
                activities.append({
                    'id': f"attempt-{attempt.id}",
                    'type': 'quiz_taken',
                    'title': quiz_title,
                    'score': attempt.score_percentage,
                    'date_obj': attempt.completed_at,
                    'xp': attempt.xp_earned,
                    'category': category_name,
                    'subject': subject_name,
                })
            except Exception as e:
                print(f"Error processing attempt {attempt.id}: {e}")
                continue

        # 2. Recent quizzes created
        # Added select_related
        recent_quizzes_created = Quiz.objects.filter(created_by=user) \
            .select_related('category', 'subject') \
            .order_by('-created_at')[:7]
            
        for quiz in recent_quizzes_created:
            try:
                # Safely access related objects
                category_name = quiz.category.name if quiz.category else "General"
                subject_name = quiz.subject.name if quiz.subject else "General"
                
                activities.append({
                    'id': f"quiz-{quiz.id}",
                    'type': 'quiz_created',
                    'title': quiz.title,
                    'date_obj': quiz.created_at,
                    'xp': 100,  # Fixed XP for creating a quiz
                    'category': category_name,
                    'subject': subject_name,
                })
            except Exception as e:
                print(f"Error processing quiz {quiz.id}: {e}")
                continue
            
        # 3. Recent achievements unlocked
        # Added select_related
        recent_achievements = UserAchievement.objects.filter(user=user) \
            .select_related('achievement') \
            .order_by('-unlocked_at')[:7]
            
        for ua in recent_achievements:
            try:
                activities.append({
                    'id': f"achieve-{ua.id}",
                    'type': 'achievement',
                    'title': f"{ua.achievement.title} Unlocked",
                    'date_obj': ua.unlocked_at,
                    'xp': 100,  # Fixed XP for unlocking an achievement
                })
            except Exception as e:
                print(f"Error processing achievement {ua.id}: {e}")
                continue

        # Sort all activities by date
        # Filter out activities with no date_obj just in case
        activities = [a for a in activities if a.get('date_obj')]
        
        try:
            activities.sort(key=lambda x: x['date_obj'], reverse=True)
        except Exception as e:
            print(f"Error sorting activities: {e}")
        
        # Take the top 7 most recent activities
        recent_activities = activities[:7]
        
        # Format date for display
        for activity in recent_activities:
            try:
                date_obj = activity['date_obj']
                if timezone.is_naive(date_obj):
                    date_obj = timezone.make_aware(date_obj)
                
                time_diff = now - date_obj
                
                if time_diff.days > 0:
                    activity['date'] = f"{time_diff.days} days ago"
                elif time_diff.seconds // 3600 > 0:
                    activity['date'] = f"{time_diff.seconds // 3600} hours ago"
                elif time_diff.seconds // 60 > 0:
                    activity['date'] = f"{time_diff.seconds // 60} minutes ago"
                else:
                    activity['date'] = "Just now"
            except Exception as e:
                 print(f"Error formatting date for activity {activity.get('id')}: {e}")
                 activity['date'] = "Unknown date"

            if 'date_obj' in activity:
                del activity['date_obj']  # Remove temporary date object

        serializer = RecentActivitySerializer(recent_activities, many=True)
        return Response(serializer.data)

# ==================== ACHIEVEMENT VIEWS ====================

class AchievementListView(APIView):
    """List all achievements"""
    permission_classes = [AllowAny]

    def get(self, request):
        achievements = Achievement.objects.all()
        serializer = AchievementSerializer(achievements, many=True)
        return Response(serializer.data)

class UserAchievementsView(APIView):
    """Get user's unlocked achievements"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_achievements = UserAchievement.objects.filter(user=request.user)
        serializer = UserAchievementSerializer(user_achievements, many=True)
        return Response(serializer.data)

class QuizMetadataView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        categories = Category.objects.all()
        data = []
        for category in categories:
            cat_data = {
                'id': category.id,
                'name': category.name,
                'levels': []
            }
            levels = Level.objects.filter(category=category)
            for level in levels:
                lvl_data = {
                    'id': level.id,
                    'name': level.name,
                    'subjects': []
                }
                subjects = Subject.objects.filter(level=level)
                for subject in subjects:
                    lvl_data['subjects'].append({
                        'id': subject.id,
                        'name': subject.name
                    })
                cat_data['levels'].append(lvl_data)
            data.append(cat_data)
        return Response(data)

from rest_framework import status

class DeleteAccountView(APIView):
    """Delete user account"""
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        user = request.user
        user.delete()
        return Response({"message": "Account deleted successfully"}, status=status.HTTP_204_NO_CONTENT)

class LeaderboardView(APIView):
    """Get global leaderboard"""
    def get(self, request):
        # Top 10 users by XP, only showing public profiles
        top_users = User.objects.filter(profile__is_public_profile=True).select_related('profile').order_by('-profile__xp')[:10]
        data = []
        for user in top_users:
            profile_picture = None
            if user.profile.profile_picture:
                profile_picture = request.build_absolute_uri(user.profile.profile_picture.url)
            
            data.append({
                'id': user.id,
                'username': user.username,
                'xp': user.profile.xp,
                'avatar': user.username[:2].upper(),
                'level': user.profile.xp // 100 + 1,
                'profile_picture': profile_picture
            })
        return Response(data)
