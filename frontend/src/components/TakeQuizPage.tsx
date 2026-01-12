import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Code2,
  Briefcase,
  ChevronRight,
  Target,
  Brain,
  Cpu,
  Flame,
  Trophy,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Clock,
  BarChart3,
  Award,
  Sparkles,
  Zap,
  Pause,
} from 'lucide-react';
import { quizAPI, categoryAPI } from '../services/api';
import { saveQuizState, loadQuizState, clearQuizState, QuizState } from '../lib/quizPersistence';

interface TakeQuizPageProps {
  onBack: () => void;
}


type Step = 'category' | 'subcategory' | 'subject' | 'configure' | 'quiz' | 'results';

interface Category {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}
export function TakeQuizPage({ onBack }: TakeQuizPageProps) {
  const navigate = useNavigate();
  const { quizId: quizIdFromUrl } = useParams();
  const preselectedQuizId = quizIdFromUrl ? parseInt(quizIdFromUrl) : null;
  const [currentStep, setCurrentStep] = useState<Step>('category');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [numQuestions, setNumQuestions] = useState<string>('10');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Quiz state
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loadedQuiz, setLoadedQuiz] = useState<any>(null);
  const [isLoadingQuiz, setIsLoadingQuiz] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);

  // API data state
  const [categories, setCategories] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [quizResults, setQuizResults] = useState<any>(null);
  const [recommendedQuizzes, setRecommendedQuizzes] = useState<any[]>([]);
  const [streakInfo, setStreakInfo] = useState<{ lost: boolean, current: number } | null>(null);

  // Load recommended quizzes on mount
  useEffect(() => {
    const fetchRecommendedQuizzes = async () => {
      try {
        const data = await quizAPI.getRecommendedQuizzes();
        setRecommendedQuizzes(data);
      } catch (error) {
        console.error('Failed to load recommended quizzes:', error);
      }
    };

    fetchRecommendedQuizzes();
  }, []);

  // Load categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setIsLoading(true);
        console.log('Fetching categories...');
        const data = await categoryAPI.getCategories();
        console.log('Categories loaded:', data);
        setCategories(data);
      } catch (error) {
        console.error('Failed to load categories:', error);
        // Don't show alert on mount, just log the error
        // User can still use file upload flow
      } finally {
        setIsLoading(false);
      }
    };

    if (currentStep === 'category') {
      fetchCategories();
    }
  }, [currentStep]);
  // If a quiz ID is preselected, check for saved state or load the quiz
  useEffect(() => {
    const initializeQuiz = async () => {
      if (preselectedQuizId && preselectedQuizId > 0) {
        const savedState = loadQuizState();

        // If there's a saved state for this specific quiz, restore it
        if (savedState && savedState.quizId === preselectedQuizId) {
          console.log('Restoring saved quiz state:', savedState);
          setLoadedQuiz({ id: savedState.quizId }); // Initially set ID to trigger loading
          await loadQuizById(savedState.quizId, savedState);
        } else {
          // Otherwise, load the quiz from scratch
          console.log('Loading preselected quiz from scratch:', preselectedQuizId);
          await loadQuizById(preselectedQuizId);
        }
      } else {
        console.log('No preselected quiz, showing category selection');
        setCurrentStep('category');
      }
    };

    initializeQuiz();
  }, [preselectedQuizId]);

  // Timer countdown logic
  useEffect(() => {
    if (currentStep === 'quiz' && loadedQuiz && !quizCompleted && !isPaused) {
      if (timeLeft <= 0) {
        handleSubmitQuiz();
        return;
      }

      const timerId = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
      }, 1000);

      return () => clearInterval(timerId);
    }
  }, [currentStep, loadedQuiz, quizCompleted, timeLeft, isPaused]);

  // Save quiz state on page unload
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (currentStep === 'quiz' && loadedQuiz && !quizCompleted) {
        saveQuizState({
          quizId: loadedQuiz.id,
          currentQuestionIndex,
          selectedAnswers,
          remainingTime: timeLeft,
          attemptId,
        });
        // Note: Most modern browsers don't show this message
        event.returnValue = 'Your quiz progress will be saved.';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentStep, loadedQuiz, quizCompleted, currentQuestionIndex, selectedAnswers, timeLeft, attemptId]);

  const loadQuizById = async (quizId: number, restoredState: QuizState | null = null) => {
    try {
      setIsLoadingQuiz(true);
      const quizData = await quizAPI.getQuizToTake(quizId);
      setLoadedQuiz(quizData);

      // Set metadata for navigation and display
      setSelectedCategory(quizData.category.toString());
      setSelectedSubcategory(quizData.level.toString());
      setSelectedSubject(quizData.subject.toString());

      if (restoredState) {
        // If we are restoring from a saved state
        setTimeLeft(restoredState.remainingTime);
        setSelectedAnswers(restoredState.selectedAnswers);
        setCurrentQuestionIndex(restoredState.currentQuestionIndex);
        setAttemptId(restoredState.attemptId);
      } else {
        // If starting a new quiz, initialize state
        const newAttempt = await quizAPI.startQuiz(quizId);
        setAttemptId(newAttempt.id);
        setTimeLeft(quizData.time_limit || 600);
        setSelectedAnswers({});
        setCurrentQuestionIndex(0);
        clearQuizState(); // Clear any previous state
      }

      setCurrentStep('quiz');
      setIsPaused(false); // Ensure quiz is not paused on load
    } catch (error) {
      console.error('Failed to load quiz:', error);
      alert('Failed to load quiz. Please try again.');
      if (currentStep !== 'quiz') {
        onBack();
      }
    } finally {
      setIsLoadingQuiz(false);
    }
  };

  // Load levels when a category is selected
  useEffect(() => {
    if (selectedCategory) {
      const fetchLevels = async () => {
        try {
          setIsLoading(true);
          const categoryId = parseInt(selectedCategory);
          const data = await categoryAPI.getLevels(categoryId);
          setLevels(data);
        } catch (error) {
          console.error('Failed to load levels:', error);
          alert('Failed to load levels. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchLevels();
    }
  }, [selectedCategory]);

  // Load subjects when a level is selected
  useEffect(() => {
    if (selectedSubcategory) {
      const fetchSubjects = async () => {
        try {
          setIsLoading(true);
          const levelId = parseInt(selectedSubcategory);
          const data = await categoryAPI.getSubjects(levelId);
          setSubjects(data);
        } catch (error) {
          console.error('Failed to load subjects:', error);
          alert('Failed to load subjects. Please try again.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchSubjects();
    }
  }, [selectedSubcategory]);

  const subcategories: Record<string, { id: string; name: string; subjects: string[] }[]> = {
    academics: [
      {
        id: '10th',
        name: '10th Grade',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology']
      },
      {
        id: '12th',
        name: '12th Grade',
        subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology']
      }
    ],
    cse: [
      {
        id: 'core',
        name: 'Core Subjects',
        subjects: ['Data Structures', 'Algorithms', 'Database Management', 'Operating Systems', 'Computer Networks']
      },
      {
        id: 'programming',
        name: 'Programming',
        subjects: ['C/C++', 'Java', 'Python', 'Web Development', 'Object Oriented Programming']
      }
    ],
    government: [
      {
        id: 'national',
        name: 'National Level',
        subjects: ['UPSC Civil Services', 'SSC CGL', 'SSC CHSL', 'Railway Exams', 'Banking Exams']
      },
      {
        id: 'state',
        name: 'State Level',
        subjects: ['State PSC', 'Police Exams', 'Teaching Exams', 'Clerk Exams', 'Other State Exams']
      }
    ]
  };

  // Comprehensive question bank organized by subject
  const questionBank: Record<string, QuizQuestion[]> = {
    // ACADEMICS - 10th Grade Physics (CBSE: Light, Human Eye, Electricity, Magnetic Effects)
    'Physics-10th': [
      { id: 1, question: 'An object is placed at the centre of curvature of a concave mirror. The image formed is:', options: ['Magnified and real', 'Diminished and real', 'Same size and real', 'Same size and virtual'], correctAnswer: 2 },
      { id: 2, question: 'The twinkling of stars is due to:', options: ['Reflection of light', 'Atmospheric refraction', 'Scattering of light', 'Dispersion of light'], correctAnswer: 1 },
      { id: 3, question: 'To increase the resistance in a circuit, resistors should be connected in:', options: ['Series', 'Parallel', 'Both series and parallel', 'None of these'], correctAnswer: 0 },
      { id: 4, question: 'The magnetic field inside a long straight solenoid-carrying current is:', options: ['Zero', 'Decreases as we move towards its end', 'Increases as we move towards its end', 'Is the same at all points'], correctAnswer: 3 },
      { id: 5, question: 'Which of the following terms does not represent electrical power in a circuit?', options: ['I²R', 'IR²', 'VI', 'V²/R'], correctAnswer: 1 },
      { id: 6, question: 'The focal length of a plane mirror is:', options: ['Zero', 'Infinity', '25 cm', '-25 cm'], correctAnswer: 1 },
      { id: 7, question: 'The human eye forms the image of an object at its:', options: ['Cornea', 'Iris', 'Pupil', 'Retina'], correctAnswer: 3 },
      { id: 8, question: 'Commercial unit of electrical energy is:', options: ['Watt', 'Watt-hour', 'Kilowatt-hour', 'Joule'], correctAnswer: 2 },
      { id: 9, question: 'Fleming’s Left-Hand Rule is used to find the direction of:', options: ['Electric field', 'Magnetic field', 'induced current', 'Force on a current carrying conductor'], correctAnswer: 3 },
      { id: 10, question: 'Which color of light scatters the most in the atmosphere?', options: ['Red', 'Blue/Violet', 'Yellow', 'Green'], correctAnswer: 1 }
    ],

    // ACADEMICS - 10th Grade Chemistry (CBSE: Reactions, Acids/Bases, Metals, Carbon, Periodic)
    'Chemistry-10th': [
      { id: 1, question: 'The reaction of H₂ + Cl₂ → 2HCl is an example of:', options: ['Decomposition reaction', 'Combination reaction', 'Displacement reaction', 'Double displacement reaction'], correctAnswer: 1 },
      { id: 2, question: 'Which of the following is an olfactory indicator?', options: ['Litmus', 'Vanilla essence', 'Turmeric', 'Phenolphthalein'], correctAnswer: 1 },
      { id: 3, question: 'Metals generally react with acids to produce ________ gas.', options: ['Oxygen', 'Chlorine', 'Hydrogen', 'Carbon dioxide'], correctAnswer: 2 },
      { id: 4, question: 'The functional group present in propanal is:', options: ['-OH', '-COOH', '-CHO', '-CO-'], correctAnswer: 2 },
      { id: 5, question: 'Which element has 2 shells, both of which are completely filled?', options: ['Helium', 'Neon', 'Argon', 'Carbon'], correctAnswer: 1 },
      { id: 6, question: 'Plaster of Paris is obtained by heating:', options: ['Gypsum', 'Limestone', 'Soda Ash', 'Calcium Carbonate'], correctAnswer: 0 },
      { id: 7, question: 'Cinnabar is an ore of:', options: ['Copper', 'Zinc', 'Mercury', 'Lead'], correctAnswer: 2 },
      { id: 8, question: 'The general formula for alkanes is:', options: ['CnH2n', 'CnH2n+2', 'CnH2n-2', 'CnHn'], correctAnswer: 1 },
      { id: 9, question: 'Mendeleev\'s Periodic Table was based on:', options: ['Atomic Number', 'Atomic Mass', 'Electronic Configuration', 'Atomic Radius'], correctAnswer: 1 },
      { id: 10, question: 'Vinegar is a solution of:', options: ['50-60% acetic acid in water', '5-8% acetic acid in water', '5-8% HCl in water', '100% acetic acid'], correctAnswer: 1 }
    ],

    // ACADEMICS - 10th Grade Mathematics (CBSE: Real No, Poly, Linear Eq, Quad, AP, Triangles, Trig, Stats)
    'Mathematics-10th': [
      { id: 1, question: 'The HCF of 96 and 404 is:', options: ['4', '12', '8', '2'], correctAnswer: 0 },
      { id: 2, question: 'If α and β are zeros of x² - 2x - 8, then α + β is:', options: ['-2', '2', '8', '-8'], correctAnswer: 1 },
      { id: 3, question: 'For what value of k will the lines x + 2y + 7 = 0 and 2x + ky + 14 = 0 be coincident?', options: ['2', '3', '4', '5'], correctAnswer: 2 },
      { id: 4, question: 'The discriminant of the quadratic equation 2x² - 4x + 3 = 0 is:', options: ['-4', '8', '-8', '12'], correctAnswer: 2 },
      { id: 5, question: 'The 10th term of the AP: 2, 7, 12... is:', options: ['45', '47', '49', '50'], correctAnswer: 1 },
      { id: 6, question: 'In ΔABC, if DE || BC, AD=1.5, DB=3, AE=1. By BPT, EC is:', options: ['1.5', '2', '3', '2.5'], correctAnswer: 1 },
      { id: 7, question: 'The distance between points (0, 6) and (0, -2) is:', options: ['6', '8', '4', '2'], correctAnswer: 1 },
      { id: 8, question: 'The value of (sin 30° + cos 30°) - (sin 60° + cos 60°) is:', options: ['-1', '0', '1', '2'], correctAnswer: 1 },
      { id: 9, question: 'The length of tangent drawn from an external point to a circle are:', options: ['Equal', 'Not equal', 'Parallel', 'Perpendicular'], correctAnswer: 0 },
      { id: 10, question: 'The relationship between Mean, Median and Mode is:', options: ['Mode = 3Median - 2Mean', 'Mode = 3Mean - 2Median', 'Mean = 3Median - 2Mode', 'Median = 3Mode - 2Mean'], correctAnswer: 0 }
    ],

    // ACADEMICS - 10th Grade Biology (CBSE: Life Proc, Control, Repro, Heredity, Env)
    'Biology-10th': [
      { id: 1, question: 'The breakdown of pyruvate to give carbon dioxide, water and energy takes place in:', options: ['Cytoplasm', 'Mitochondria', 'Chloroplast', 'Nucleus'], correctAnswer: 1 },
      { id: 2, question: 'The gap between two neurons is called a:', options: ['Dendrite', 'Synapse', 'Axon', 'Impulse'], correctAnswer: 1 },
      { id: 3, question: 'Which of the following is a plant hormone?', options: ['Insulin', 'Thyroxin', 'Oestrogen', 'Cytokinin'], correctAnswer: 3 },
      { id: 4, question: 'The anther contains:', options: ['Sepals', 'Ovules', 'Pistil', 'Pollen grains'], correctAnswer: 3 },
      { id: 5, question: 'In human males, the testes lie in the scrotum because it helps in the:', options: ['Process of mating', 'Formation of sperm', 'Easy transfer of gametes', 'Secretion of estrogen'], correctAnswer: 1 },
      { id: 6, question: 'A Mendelian experiment consisted of breeding tall pea plants bearing violet flowers with short pea plants bearing white flowers. The progeny all bore violet flowers, but almost half of them were short. The genetic makeup of the tall parent can be depicted as:', options: ['TTWW', 'TTww', 'TtWW', 'TtWw'], correctAnswer: 2 },
      { id: 7, question: 'Homologous organs are organs that have:', options: ['Same structure, different function', 'Different structure, same function', 'Same structure, same function', 'Different structure, different function'], correctAnswer: 0 },
      { id: 8, question: 'Which of the following is a biodegradable waste?', options: ['Plastic', 'Glass', 'Peels of vegetables', 'Aluminium foil'], correctAnswer: 2 },
      { id: 9, question: 'The 10% law of energy transfer in a food chain was given by:', options: ['Lindeman', 'Mendel', 'Darwin', 'Morgan'], correctAnswer: 0 },
      { id: 10, question: 'The xylem in plants are responsible for:', options: ['Transport of water', 'Transport of food', 'Transport of amino acids', 'Transport of oxygen'], correctAnswer: 0 }
    ],

    // ACADEMICS - 12th Grade Physics (CBSE: Electrostatics, Current, Mag, EMI, AC, Optics, Modern)
    'Physics-12th': [
      { id: 1, question: 'Two point charges q₁ and q₂ are placed at a distance r. The force between them is proportional to:', options: ['r', '1/r', '1/r²', 'r²'], correctAnswer: 2 },
      { id: 2, question: 'Equipotential surfaces separate by distance dr. The electric field E at that point is:', options: ['E = dV/dr', 'E = -dV/dr', 'E = V/r', 'E = Vr'], correctAnswer: 1 },
      { id: 3, question: 'Kirchhoff’s first rule (Junction rule) is based on the law of conservation of:', options: ['Energy', 'Charge', 'Momentum', 'Mass'], correctAnswer: 1 },
      { id: 4, question: 'A charged particle moving in a magnetic field experiences a force given by:', options: ['F = qvB', 'F = q(v × B)', 'F = q(B × v)', 'F = qv/B'], correctAnswer: 1 },
      { id: 5, question: 'The phase difference between voltage and current in a purely capacitive AC circuit is:', options: ['0', 'π/2', 'π', '-π/2'], correctAnswer: 1 },
      { id: 6, question: 'Which phenomenon confirms the transverse nature of electromagnetic waves?', options: ['Interference', 'Diffraction', 'Polarization', 'Refraction'], correctAnswer: 2 },
      { id: 7, question: 'What is the condition for Total Internal Reflection?', options: ['Light goes from rarer to denser', 'Angle of incidence < Critical angle', 'Light goes from denser to rarer', 'Refractive index is 1'], correctAnswer: 2 },
      { id: 8, question: 'The de-Broglie wavelength of a particle of mass m moving with velocity v is:', options: ['h/mv', 'mv/h', 'hm/v', 'm/hv'], correctAnswer: 0 },
      { id: 9, question: 'In a p-type semiconductor, the majority charge carriers are:', options: ['Electrons', 'Holes', 'Neutrons', 'Protons'], correctAnswer: 1 },
      { id: 10, question: 'Nuclear fusion reaction takes place at:', options: ['Low temperature', 'Very high temperature', 'Room temperature', 'Absolute zero'], correctAnswer: 1 }
    ],

    // ACADEMICS - 12th Grade Chemistry (CBSE: Solutions, Electrochem, Kinetics, d-f block, Coord, Organics)
    'Chemistry-12th': [
      { id: 1, question: 'Henry’s law constant K_H increases with:', options: ['Increase in Temperature', 'Decrease in Temperature', 'Increase in Pressure', 'Decrease in Pressure'], correctAnswer: 0 },
      { id: 2, question: 'The unit of rate constant for a zero order reaction is:', options: ['s⁻¹', 'mol L⁻¹ s⁻¹', 'L mol⁻¹ s⁻¹', 'Dimensionless'], correctAnswer: 1 },
      { id: 3, question: 'Which of the following is a transition element?', options: ['Zn', 'Sc', 'Cd', 'Hg'], correctAnswer: 1 },
      { id: 4, question: 'The oxidation state of Ni in [Ni(CO)₄] is:', options: ['+2', '+4', '0', '-2'], correctAnswer: 2 },
      { id: 5, question: 'Which alkyl halide has the highest boiling point?', options: ['CH₃Cl', 'CH₃Br', 'CH₃I', 'CH₃F'], correctAnswer: 2 },
      { id: 6, question: 'The product formed when phenol is treated with Bromine water is:', options: ['o-Bromophenol', 'p-Bromophenol', '2,4,6-Tribromophenol', 'm-Bromophenol'], correctAnswer: 2 },
      { id: 7, question: 'Which test is used to distinguish between aldehydes and ketones?', options: ['Lucas Test', 'Tollens Test', 'Biuret Test', 'Flame Test'], correctAnswer: 1 },
      { id: 8, question: 'The deficiency of Vitamin C causes:', options: ['Scurvy', 'Rickets', 'Beriberi', 'Night blindness'], correctAnswer: 0 },
      { id: 9, question: 'Which of the following is a biodegradable polymer?', options: ['Nylon-6,6', 'Polythene', 'PHBV', 'Bakelite'], correctAnswer: 2 },
      { id: 10, question: 'Colligative properties depend on:', options: ['Nature of solute', 'Number of solute particles', 'Physical state of solute', 'Color of solute'], correctAnswer: 1 }
    ],

    // ACADEMICS - 12th Grade Mathematics (CBSE: Rel&Func, Matrices, Calculus, Vectors, 3D, Prob)
    'Mathematics-12th': [
      { id: 1, question: 'Let R be a relation in set N given by R = {(a, b) : a = b - 2, b > 6}. Choose the correct answer:', options: ['(2, 4) ∈ R', '(3, 8) ∈ R', '(6, 8) ∈ R', '(8, 7) ∈ R'], correctAnswer: 2 },
      { id: 2, question: 'If A is a square matrix such that A² = A, then (I + A)³ - 7A is equal to:', options: ['A', 'I - A', 'I', '3A'], correctAnswer: 2 },
      { id: 3, question: 'The function f(x) = |x| is:', options: ['Continuous and Differentiable at x=0', 'Continuous but not Differentiable at x=0', 'Differentiable but not Continuous at x=0', 'Neither Continuous nor Differentiable at x=0'], correctAnswer: 1 },
      { id: 4, question: 'The slope of the tangent to the curve y = x³ - x at x = 2 is:', options: ['12', '11', '10', '2'], correctAnswer: 1 },
      { id: 5, question: '∫ e^x (tan x + sec² x) dx is equal to:', options: ['e^x tan x + C', 'e^x sec x + C', 'e^x cot x + C', 'e^x log(sec x) + C'], correctAnswer: 0 },
      { id: 6, question: 'Order and Degree of the differential equation (d²y/dx²)³ + (dy/dx)² + sin(dy/dx) + 1 = 0 is:', options: ['Order=2, Degree=3', 'Order=2, Degree=Undefined', 'Order=2, Degree=2', 'Order=1, Degree=1'], correctAnswer: 1 },
      { id: 7, question: 'If vector a = 2i + j + 3k and b = 3i + 5j - 2k, then |a × b| is:', options: ['√507', '√400', '√300', '√250'], correctAnswer: 0 },
      { id: 8, question: 'The angle between two lines whose direction ratios are proportional to 1, 1, 2 and (√3-1), (-√3-1), 4 is:', options: ['45°', '60°', '30°', '90°'], correctAnswer: 1 },
      { id: 9, question: 'If P(A) = 1/2, P(B) = 0, then P(A|B) is:', options: ['0', '1/2', 'Not defined', '1'], correctAnswer: 2 },
      { id: 10, question: 'Which of the following is an objective function in a Linear Programming Problem?', options: ['A constraint', 'Variable to be maximized/minimized', 'A graphical region', 'A constant'], correctAnswer: 1 }
    ],

    // ACADEMICS - 12th Grade Biology (CBSE: Repro, Genetics, Biotech, Human Welfare, Ecology)
    'Biology-12th': [
      { id: 1, question: 'In angiosperms, the functional megaspore develops into:', options: ['Embryo sac', 'Ovule', 'Endosperm', 'Pollen sac'], correctAnswer: 0 },
      { id: 2, question: 'Sertoli cells are found in:', options: ['Ovaries and secrete progesterone', 'Adrenal cortex and secrete adrenaline', 'Seminiferous tubules and provide nutrition to germ cells', 'Pancreas and secrete insulin'], correctAnswer: 2 },
      { id: 3, question: 'Which of the following is a termination codon?', options: ['AUG', 'UAA', 'AAU', 'UGG'], correctAnswer: 1 },
      { id: 4, question: 'The theory of Natural Selection was given by:', options: ['Lamarck', 'Darwin', 'Mendel', 'Weismann'], correctAnswer: 1 },
      { id: 5, question: 'Which antibody is most abundant in colostrum?', options: ['IgG', 'IgM', 'IgA', 'IgE'], correctAnswer: 2 },
      { id: 6, question: 'Restriction endonucleases are enzymes which:', options: ['Make cuts at specific positions within the DNA molecule', 'Recognize a specific nucleotide sequence for binding of DNA ligase', 'Restrict the action of the enzyme DNA polymerase', 'Remove nucleotides from the ends of the DNA molecule'], correctAnswer: 0 },
      { id: 7, question: 'Golden rice is a transgenic variety of rice known for good content of:', options: ['Vitamin A', 'Vitamin C', 'Vitamin B', 'Vitamin K'], correctAnswer: 0 },
      { id: 8, question: 'Interaction between a clownfish and a sea anemone is an example of:', options: ['Parasitism', 'Commensalism', 'Mutualism', 'Amensalism'], correctAnswer: 1 },
      { id: 9, question: 'Which of the following is an ex-situ conservation method?', options: ['National Parks', 'Sacred Groves', 'Biosphere Reserves', 'Seed Banks'], correctAnswer: 3 },
      { id: 10, question: 'The DNA fragment separated on an agarose gel can be visualized after staining with:', options: ['Acetocarmine', 'Aniline blue', 'Ethidium bromide', 'Bromophenol blue'], correctAnswer: 2 }
    ],

    // COMPUTER SCIENCE - Data Structures
    'Data Structures': [
      { id: 1, question: 'What is the time complexity of binary search?', options: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], correctAnswer: 1 },
      { id: 2, question: 'Which data structure uses LIFO principle?', options: ['Queue', 'Stack', 'Array', 'Tree'], correctAnswer: 1 },
      { id: 3, question: 'In a binary tree, each node can have at most how many children?', options: ['1', '2', '3', 'Unlimited'], correctAnswer: 1 },
      { id: 4, question: 'What is the worst-case time complexity of quicksort?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], correctAnswer: 2 },
      { id: 5, question: 'Which traversal method uses a stack?', options: ['BFS', 'DFS', 'Level Order', 'Spiral'], correctAnswer: 1 },
      { id: 6, question: 'What is a hash collision?', options: ['Two keys mapping to same index', 'Hash function error', 'Memory overflow', 'Key not found'], correctAnswer: 0 },
      { id: 7, question: 'The height of a balanced binary tree with n nodes is:', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], correctAnswer: 1 },
      { id: 8, question: 'Which data structure is used in BFS?', options: ['Stack', 'Queue', 'Heap', 'Tree'], correctAnswer: 1 },
      { id: 9, question: 'What is the space complexity of merge sort?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], correctAnswer: 2 },
      { id: 10, question: 'A linked list is a:', options: ['Linear data structure', 'Non-linear data structure', 'Primitive data type', 'None of these'], correctAnswer: 0 }
    ],

    // COMPUTER SCIENCE - Algorithms
    'Algorithms': [
      { id: 1, question: 'What is the best-case time complexity of bubble sort?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], correctAnswer: 0 },
      { id: 2, question: 'Which algorithm uses divide and conquer?', options: ['Bubble sort', 'Merge sort', 'Selection sort', 'Insertion sort'], correctAnswer: 1 },
      { id: 3, question: 'Dijkstra\'s algorithm is used for:', options: ['Sorting', 'Shortest path', 'Pattern matching', 'Searching'], correctAnswer: 1 },
      { id: 4, question: 'What is the time complexity of linear search?', options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], correctAnswer: 2 },
      { id: 5, question: 'Which sorting algorithm is most efficient for small datasets?', options: ['Quick sort', 'Merge sort', 'Insertion sort', 'Heap sort'], correctAnswer: 2 },
      { id: 6, question: 'Dynamic programming is based on:', options: ['Greedy approach', 'Divide and conquer', 'Memoization', 'Backtracking'], correctAnswer: 2 },
      { id: 7, question: 'What does NP stand for in computational complexity?', options: ['Not Polynomial', 'Nondeterministic Polynomial', 'New Problem', 'Non-Practical'], correctAnswer: 1 },
      { id: 8, question: 'Which algorithm is used for finding minimum spanning tree?', options: ['Dijkstra', 'Kruskal', 'Floyd-Warshall', 'Bellman-Ford'], correctAnswer: 1 },
      { id: 9, question: 'The Tower of Hanoi problem can be solved using:', options: ['Iteration', 'Recursion', 'Greedy method', 'Dynamic programming'], correctAnswer: 1 },
      { id: 10, question: 'What is the average case time complexity of QuickSort?', options: ['O(n)', 'O(n log n)', 'O(n²)', 'O(log n)'], correctAnswer: 1 }
    ],

    // COMPUTER SCIENCE - Database Management
    'Database Management': [
      { id: 1, question: 'What does SQL stand for?', options: ['Structured Query Language', 'Simple Query Language', 'Standard Query Language', 'Sequential Query Language'], correctAnswer: 0 },
      { id: 2, question: 'Which key uniquely identifies a record in a table?', options: ['Foreign Key', 'Primary Key', 'Candidate Key', 'Super Key'], correctAnswer: 1 },
      { id: 3, question: 'What is normalization in databases?', options: ['Deleting data', 'Organizing data to reduce redundancy', 'Encrypting data', 'Backing up data'], correctAnswer: 1 },
      { id: 4, question: 'Which SQL command is used to retrieve data?', options: ['INSERT', 'UPDATE', 'SELECT', 'DELETE'], correctAnswer: 2 },
      { id: 5, question: 'ACID properties ensure:', options: ['Data security', 'Transaction reliability', 'Fast queries', 'Data compression'], correctAnswer: 1 },
      { id: 6, question: 'What is a foreign key?', options: ['A unique identifier', 'A reference to primary key in another table', 'An encrypted key', 'A duplicate key'], correctAnswer: 1 },
      { id: 7, question: 'Which normal form eliminates transitive dependency?', options: ['1NF', '2NF', '3NF', 'BCNF'], correctAnswer: 2 },
      { id: 8, question: 'What does DDL stand for?', options: ['Data Definition Language', 'Data Delete Language', 'Database Definition Language', 'Data Description Language'], correctAnswer: 0 },
      { id: 9, question: 'JOIN operation is used to:', options: ['Delete records', 'Combine rows from two tables', 'Update records', 'Create tables'], correctAnswer: 1 },
      { id: 10, question: 'Which is NOT a type of database model?', options: ['Relational', 'Hierarchical', 'Network', 'Sequential'], correctAnswer: 3 }
    ],

    // COMPUTER SCIENCE - Python
    'Python': [
      { id: 1, question: 'What is the correct file extension for Python files?', options: ['.python', '.py', '.pt', '.pyt'], correctAnswer: 1 },
      { id: 2, question: 'Which keyword is used to define a function in Python?', options: ['function', 'def', 'func', 'define'], correctAnswer: 1 },
      { id: 3, question: 'What is the output of print(2 ** 3)?', options: ['5', '6', '8', '9'], correctAnswer: 2 },
      { id: 4, question: 'Which of these is a mutable data type in Python?', options: ['tuple', 'string', 'list', 'int'], correctAnswer: 2 },
      { id: 5, question: 'What does PEP stand for?', options: ['Python Enhancement Proposal', 'Python Execution Plan', 'Python Error Protocol', 'Python Extension Package'], correctAnswer: 0 },
      { id: 6, question: 'Which method is used to add an element to a list?', options: ['add()', 'append()', 'insert()', 'push()'], correctAnswer: 1 },
      { id: 7, question: 'What is the correct syntax for a comment in Python?', options: ['// comment', '/* comment */', '# comment', '<!-- comment -->'], correctAnswer: 2 },
      { id: 8, question: 'Which of these is used for exception handling?', options: ['if-else', 'try-except', 'switch-case', 'while-do'], correctAnswer: 1 },
      { id: 9, question: 'What is the output of len([1, 2, 3])?', options: ['1', '2', '3', '4'], correctAnswer: 2 },
      { id: 10, question: 'Which operator is used for floor division?', options: ['/', '//', '%', '**'], correctAnswer: 1 }
    ],

    // COMPUTER SCIENCE - Java
    'Java': [
      { id: 1, question: 'What is the extension of Java bytecode files?', options: ['.java', '.class', '.jar', '.exe'], correctAnswer: 1 },
      { id: 2, question: 'Which keyword is used to inherit a class in Java?', options: ['inherits', 'extends', 'implements', 'super'], correctAnswer: 1 },
      { id: 3, question: 'What is the size of int in Java?', options: ['2 bytes', '4 bytes', '8 bytes', '16 bytes'], correctAnswer: 1 },
      { id: 4, question: 'Which method is the entry point of a Java program?', options: ['start()', 'run()', 'main()', 'execute()'], correctAnswer: 2 },
      { id: 5, question: 'What is encapsulation?', options: ['Wrapping data and code together', 'Multiple inheritance', 'Method overloading', 'Type casting'], correctAnswer: 0 },
      { id: 6, question: 'Which package is automatically imported in Java?', options: ['java.util', 'java.io', 'java.lang', 'java.net'], correctAnswer: 2 },
      { id: 7, question: 'What is the default value of a boolean variable?', options: ['true', 'false', '0', 'null'], correctAnswer: 1 },
      { id: 8, question: 'Which keyword is used to prevent method overriding?', options: ['static', 'final', 'abstract', 'const'], correctAnswer: 1 },
      { id: 9, question: 'What does JVM stand for?', options: ['Java Virtual Machine', 'Java Variable Method', 'Java Version Manager', 'Java Visual Mode'], correctAnswer: 0 },
      { id: 10, question: 'Which collection does not allow duplicate elements?', options: ['List', 'Set', 'Map', 'Queue'], correctAnswer: 1 }
    ],

    // GOVERNMENT EXAMS - UPSC Civil Services
    'UPSC Civil Services': [
      { id: 1, question: 'The Constitution of India was adopted on:', options: ['26 Jan 1950', '26 Nov 1949', '15 Aug 1947', '26 Jan 1949'], correctAnswer: 1 },
      { id: 2, question: 'Who is known as the Father of the Indian Constitution?', options: ['Mahatma Gandhi', 'B.R. Ambedkar', 'Jawaharlal Nehru', 'Sardar Patel'], correctAnswer: 1 },
      { id: 3, question: 'The President of India is elected by:', options: ['Direct election', 'Electoral College', 'Parliament', 'Prime Minister'], correctAnswer: 1 },
      { id: 4, question: 'Which article of the Constitution deals with Right to Education?', options: ['Article 19', 'Article 21A', 'Article 32', 'Article 14'], correctAnswer: 1 },
      { id: 5, question: 'The term of Lok Sabha is:', options: ['4 years', '5 years', '6 years', '7 years'], correctAnswer: 1 },
      { id: 6, question: 'Which is the highest civilian award in India?', options: ['Padma Bhushan', 'Bharat Ratna', 'Padma Vibhushan', 'Padma Shri'], correctAnswer: 1 },
      { id: 7, question: 'The Supreme Court of India was established in:', options: ['1947', '1949', '1950', '1952'], correctAnswer: 2 },
      { id: 8, question: 'Who appoints the Chief Justice of India?', options: ['Prime Minister', 'President', 'Parliament', 'Law Minister'], correctAnswer: 1 },
      { id: 9, question: 'The Planning Commission was replaced by:', options: ['NITI Aayog', 'Finance Commission', 'Election Commission', 'Law Commission'], correctAnswer: 0 },
      { id: 10, question: 'Which state has the largest number of Lok Sabha seats?', options: ['Maharashtra', 'Bihar', 'Uttar Pradesh', 'West Bengal'], correctAnswer: 2 }
    ],

    // GOVERNMENT EXAMS - SSC CGL
    'SSC CGL': [
      { id: 1, question: 'Who was the first President of India?', options: ['Dr. Rajendra Prasad', 'Dr. S. Radhakrishnan', 'Jawaharlal Nehru', 'Sardar Patel'], correctAnswer: 0 },
      { id: 2, question: 'The Reserve Bank of India was nationalized in:', options: ['1947', '1949', '1950', '1935'], correctAnswer: 1 },
      { id: 3, question: 'Which river is known as the Sorrow of Bihar?', options: ['Ganga', 'Kosi', 'Yamuna', 'Gandak'], correctAnswer: 1 },
      { id: 4, question: 'The Battle of Plassey was fought in:', options: ['1757', '1764', '1765', '1772'], correctAnswer: 0 },
      { id: 5, question: 'Who is known as the Iron Man of India?', options: ['Mahatma Gandhi', 'Sardar Patel', 'Subhas Chandra Bose', 'Bhagat Singh'], correctAnswer: 1 },
      { id: 6, question: 'The headquarters of RBI is located in:', options: ['New Delhi', 'Kolkata', 'Mumbai', 'Chennai'], correctAnswer: 2 },
      { id: 7, question: 'Who wrote the National Anthem of India?', options: ['Bankim Chandra Chatterjee', 'Rabindranath Tagore', 'Sarojini Naidu', 'Muhammad Iqbal'], correctAnswer: 1 },
      { id: 8, question: 'The first Five Year Plan was launched in:', options: ['1947', '1950', '1951', '1956'], correctAnswer: 2 },
      { id: 9, question: 'Which gas is most abundant in Earth\'s atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctAnswer: 1 },
      { id: 10, question: 'The Red Fort was built by:', options: ['Akbar', 'Shah Jahan', 'Aurangzeb', 'Humayun'], correctAnswer: 1 }
    ]
  };

  // Get questions based on selected subject and configuration
  const getQuizQuestions = (): QuizQuestion[] => {
    // Resolve subject ID to name
    const subjectObj = subjects.find(s => s.id.toString() === selectedSubject);
    const subjectName = subjectObj ? subjectObj.name : selectedSubject;

    // Build the key based on subject and subcategory (grade level)
    let key = subjectName;

    // For academic subjects, append the grade level
    // Note: We need to check if selectedCategory is 'academics' based on ID or name
    // Since we're in mixed mode (API + Local), this is tricky. 
    // Best effort mapping:
    const isAcademics = categories.find(c => c.id.toString() === selectedCategory && c.name.toLowerCase() === 'academics');

    if (isAcademics || selectedCategory === 'academics') {
      if (['Physics', 'Chemistry', 'Mathematics', 'Biology'].includes(subjectName)) {
        // Find level name
        const levelObj = levels.find(l => l.id.toString() === selectedSubcategory);
        const levelName = levelObj ? levelObj.name : selectedSubcategory;
        key = `${subjectName}-${levelName.replace(' Grade', '')}`; // e.g. Physics-10th
      }
    }

    const availableQuestions = questionBank[key] || [];
    const requestedCount = parseInt(numQuestions) || 10;

    // Safety check: If no local questions found, return generic ones
    if (availableQuestions.length === 0) {
      console.warn(`No local questions found for key: ${key}. Using generic fallback.`);
      return Array.from({ length: requestedCount }).map((_, idx) => ({
        id: idx + 1,
        question: `Sample Question ${idx + 1} for ${subjectName}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 0
      }));
    }

    // Shuffle available questions
    const shuffledQuestions = [...availableQuestions].sort(() => Math.random() - 0.5);

    // Return requested number of questions (cycle if needed)
    const questions: QuizQuestion[] = [];
    for (let i = 0; i < requestedCount; i++) {
      // Use modulo to cycle through available questions if we requested more than we have
      questions.push(shuffledQuestions[i % shuffledQuestions.length]);
    }

    return questions.map((q, idx) => ({ ...q, id: idx + 1 }));
  };

  const quizQuestions = useMemo(() => {
    // Use loaded quiz if available, otherwise use hardcoded questions
    const questionsFromLoaded = (loadedQuiz?.questions || []).map((q: any, idx: number) => ({
      id: q.id || idx + 1,
      question: q.question_text || q.question || 'Question text missing',
      options: q.options || [],
      correctAnswer: q.correct_answer || 0
    }));

    if (loadedQuiz && questionsFromLoaded.length > 0) {
      return questionsFromLoaded;
    }

    return getQuizQuestions();
  }, [loadedQuiz, selectedSubject, selectedCategory, selectedSubcategory, numQuestions]);



  const handleCategorySelect = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setCurrentStep('subcategory');
  };

  const handleSubcategorySelect = (subcategoryId: string) => {
    setSelectedSubcategory(subcategoryId);
    setCurrentStep('subject');
  };

  const handleSubjectSelect = (subject: string) => {
    setSelectedSubject(subject);
    setCurrentStep('configure');
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
    setQuizCompleted(false);
  };

  const handleGenerateQuiz = async () => {
    if (!selectedSubject || !numQuestions || parseInt(numQuestions) < 5 || parseInt(numQuestions) > 100) {
      return;
    }

    try {
      setIsGeneratingQuiz(true);
      const subjectId = parseInt(selectedSubject);

      console.log('Generating quiz with params:', {
        subjectId,
        difficulty,
        numQuestions: parseInt(numQuestions)
      });

      const result = await quizAPI.generateQuizFromSubject(
        subjectId,
        difficulty,
        parseInt(numQuestions)
      );



      // Load the generated quiz
      if (result.quiz_id) {
        // Before loading a new quiz, check if another is in progress
        const ongoingQuiz = loadQuizState();
        if (ongoingQuiz) {
          alert('You have an ongoing quiz. Please complete it before starting a new one.');
          // Optionally, navigate to the ongoing quiz
          // navigate(`/take-quiz/${ongoingQuiz.quizId}`);
          return;
        }

        await loadQuizById(result.quiz_id);
      } else {
        throw new Error('No quiz_id returned from server');
      }
    } catch (error: any) {
      console.error('Failed to generate quiz:', error);
      alert(`Failed to generate quiz: ${error.message}`);
      setCurrentStep('configure'); // Go back to configure on error
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handlePauseQuiz = () => {
    if (!loadedQuiz) return;

    saveQuizState({
      quizId: loadedQuiz.id,
      currentQuestionIndex,
      selectedAnswers,
      remainingTime: timeLeft,
      attemptId,
    });

    setIsPaused(true);
    // onBack(); // or navigate to a specific "paused" screen
    navigate('/');
    alert('Quiz paused. You can resume it from the homepage.');
  };

  const handleAnswerSelect = (optionIndex: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: optionIndex
    });
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleSubmitQuiz = async () => {
    if (!loadedQuiz || !attemptId) return;
    const answers = Object.keys(selectedAnswers).map(questionIndex => ({
      question_id: quizQuestions[parseInt(questionIndex)].id,
      selected_option: selectedAnswers[parseInt(questionIndex)]
    }));

    try {
      const results = await quizAPI.submitQuiz(attemptId, answers);
      setQuizResults(results);
      if (results.streak_lost !== undefined) {
        setStreakInfo({ lost: results.streak_lost, current: results.current_streak });
      }
      setCurrentStep('results');
      setQuizCompleted(true);
      clearQuizState(); // Quiz finished, clear the saved state
    } catch (error) {
      console.error('Failed to submit quiz:', error);
      alert('Failed to submit quiz. Please try again.');
    }
  };

  const handleBackNavigation = () => {
    if (currentStep === 'category') {
      onBack();
    } else if (currentStep === 'subcategory') {
      setCurrentStep('category');
      setSelectedCategory('');
    } else if (currentStep === 'subject') {
      setCurrentStep('subcategory');
      setSelectedSubcategory('');
    } else if (currentStep === 'configure') {
      setCurrentStep('subject');
      setSelectedSubject('');
    } else if (currentStep === 'quiz') {
      setCurrentStep('configure');
    } else if (currentStep === 'results') {
      onBack();
    }
  };

  // Recommended Quizzes View
  const renderRecommendedQuizzes = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto mb-16"
    >
      <div className="text-center mb-12">
        <h1 className="text-[#003B73] dark:text-blue-100">Recommended For You</h1>
        <p className="text-[#003B73] dark:text-blue-100/70 max-w-2xl mx-auto">
          Quizzes tailored to your preferences and recent activity
        </p>
      </div>
      {recommendedQuizzes.length > 0 ? (
        <div className="grid md:grid-cols-3 gap-8">
          {(recommendedQuizzes || []).map((quiz, index) => (
            <motion.div
              key={quiz.id}
              onClick={() => loadQuizById(quiz.id)}
              className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border-2 border-[#003B73]/10 dark:border-white/10 shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
              whileHover={{ y: -8, scale: 1.03 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="relative z-10">
                <h2 className="text-[#003B73] dark:text-blue-100 text-center mb-3">{quiz.title}</h2>
                <p className="text-[#003B73] dark:text-blue-100/70 text-center mb-4">
                  {quiz.category_details?.name} - {quiz.difficulty}
                </p>
                <div className="flex justify-center">
                  <motion.div
                    className="flex items-center gap-2 text-[#003B73] dark:text-blue-100"
                    whileHover={{ x: 5 }}
                  >
                    <span>Take Quiz</span>
                    <ChevronRight className="w-4 h-4" />
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-[#003B73] dark:text-blue-100/70">
            No recommendations yet. Set your preferred categories in your profile for personalized suggestions!
          </p>
        </div>
      )}
    </motion.div>
  );

  // Category Selection View
  const renderCategorySelection = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto"
    >
      <div className="text-center mb-12">
        <motion.div
          className="inline-flex items-center gap-2 mb-4"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Target className="w-8 h-8 text-[#003B73] dark:text-blue-100" />
          <h1 className="text-[#003B73] dark:text-blue-100">Choose Your Category</h1>
        </motion.div>
        <p className="text-[#003B73] dark:text-blue-100/70 max-w-2xl mx-auto">
          Select a category to begin your learning journey
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {isLoading ? (
          <div className="col-span-3 text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73] mx-auto"></div>
            <p className="mt-4 text-[#003B73] dark:text-blue-100/70">Loading categories...</p>
          </div>
        ) : categories.length === 0 ? (
          <div className="col-span-3 text-center py-12">
            <p className="text-[#003B73] dark:text-blue-100/70">No categories available</p>
          </div>
        ) : (
          (categories || []).map((category, index) => {
            // Map icon based on category name
            const getIcon = (name: string) => {
              if (name.toLowerCase().includes('computer') || name.toLowerCase().includes('cs')) return Code2;
              if (name.toLowerCase().includes('government') || name.toLowerCase().includes('exam')) return Briefcase;
              return GraduationCap;
            };
            const IconComponent = getIcon(category.name);

            return (
              <motion.div
                key={category.id}
                onClick={() => handleCategorySelect(category.id.toString())}
                className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 border-2 border-[#003B73]/10 dark:border-white/10 shadow-xl hover:shadow-2xl transition-all cursor-pointer overflow-hidden"
                whileHover={{ y: -8, scale: 1.03 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-[#003B73]/5 to-[#B9E7FF]/20 opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className="relative z-10">
                  <motion.div
                    className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg mx-auto"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                  >
                    <IconComponent className="w-10 h-10 text-white" />
                  </motion.div>

                  <h2 className="text-[#003B73] dark:text-blue-100 text-center mb-3">{category.name}</h2>
                  <p className="text-[#003B73] dark:text-blue-100/70 text-center mb-4">
                    {category.description || 'Explore this category'}
                  </p>

                  <div className="flex justify-center">
                    <motion.div
                      className="flex items-center gap-2 text-[#003B73] dark:text-blue-100"
                      whileHover={{ x: 5 }}
                    >
                      <span>Explore</span>
                      <ChevronRight className="w-4 h-4" />
                    </motion.div>
                  </div>
                </div>

                <motion.div
                  className="absolute -bottom-4 -right-4 w-32 h-32 bg-[#003B73]/5 rounded-full blur-2xl"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              </motion.div>
            );
          })
        )}
      </div>
    </motion.div>
  );

  // Subcategory Selection View
  const renderSubcategorySelection = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-5xl mx-auto"
      >
        <div className="text-center mb-12">
          <h1 className="text-[#003B73] dark:text-blue-100 mb-3">Select Level</h1>
          <p className="text-[#003B73] dark:text-blue-100/70">
            Choose your preferred level
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {isLoading ? (
            <div className="col-span-2 text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73] mx-auto"></div>
              <p className="mt-4 text-[#003B73] dark:text-blue-100/70">Loading levels...</p>
            </div>
          ) : levels.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <p className="text-[#003B73] dark:text-blue-100/70">No levels available for this category</p>
            </div>
          ) : (
            (levels || []).map((level, index) => (
              <motion.div
                key={level.id}
                onClick={() => handleSubcategorySelect(level.id.toString())}
                className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 border-2 border-[#003B73]/10 dark:border-white/10 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                whileHover={{ y: -5, scale: 1.02 }}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-[#003B73] dark:text-blue-100 mb-2">{level.name}</h3>
                    <p className="text-[#003B73] dark:text-blue-100/60">
                      {level.description || 'Explore this level'}
                    </p>
                  </div>
                  <motion.div
                    className="w-12 h-12 bg-gradient-to-br from-[#B9E7FF] to-[#003B73]/20 rounded-xl flex items-center justify-center"
                    whileHover={{ rotate: 90 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronRight className="w-6 h-6 text-[#003B73] dark:text-blue-100" />
                  </motion.div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    );
  };

  // Subject Selection View
  const renderSubjectSelection = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-5xl mx-auto"
      >
        <div className="text-center mb-12">
          <h1 className="text-[#003B73] dark:text-blue-100 mb-3">Choose Subject</h1>
          <p className="text-[#003B73] dark:text-blue-100/70">
            Select a subject to start your quiz
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {isLoading ? (
            <div className="col-span-3 text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#003B73] mx-auto"></div>
              <p className="mt-4 text-[#003B73] dark:text-blue-100/70">Loading subjects...</p>
            </div>
          ) : subjects.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <p className="text-[#003B73] dark:text-blue-100/70">No subjects available for this level</p>
            </div>
          ) : (
            (subjects || []).map((subject, index) => (
              <motion.div
                key={subject.id}
                onClick={() => handleSubjectSelect(subject.id.toString())}
                className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 border-2 border-[#003B73]/10 dark:border-white/10 shadow-lg hover:shadow-xl transition-all cursor-pointer"
                whileHover={{ y: -5, scale: 1.05 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <motion.div
                  className="w-16 h-16 bg-gradient-to-br from-[#003B73] to-[#0056A8] rounded-2xl flex items-center justify-center mb-4 mx-auto"
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.6 }}
                >
                  <BookOpen className="w-8 h-8 text-white" />
                </motion.div>

                <h3 className="text-[#003B73] dark:text-blue-100 text-center mb-2">{subject.name}</h3>
                <p className="text-[#003B73] dark:text-blue-100/60 text-center mb-4">
                  {subject.description || 'Start learning'}
                </p>

                <div className="flex justify-center gap-2">
                  <span className="px-2 py-1 bg-[#DFF4FF] dark:bg-slate-800 text-[#003B73] dark:text-blue-100 rounded-lg border border-[#003B73]/10 dark:border-white/10">
                    Medium
                  </span>
                  <span className="px-2 py-1 bg-[#DFF4FF] dark:bg-slate-800 text-[#003B73] dark:text-blue-100 rounded-lg border border-[#003B73]/10 dark:border-white/10 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    10 min
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    );
  };

  // Quiz Configuration View
  const renderQuizConfig = () => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="max-w-3xl mx-auto"
      >
        <div className="text-center mb-12">
          <motion.div
            className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Sparkles className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-[#003B73] dark:text-blue-100 mb-3">Configure Your Quiz</h1>
          <p className="text-[#003B73] dark:text-blue-100/70">
            Customize your quiz settings before you begin
          </p>
        </div>

        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl p-8 shadow-xl border border-[#003B73]/10 dark:border-white/10 space-y-8">
          {/* Number of Questions */}
          <div>
            <label className="block text-[#003B73] dark:text-blue-100 mb-3">Number of Questions (5-100)</label>
            <input
              type="number"
              min="5"
              max="100"
              value={numQuestions}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || (parseInt(val) >= 5 && parseInt(val) <= 100)) {
                  setNumQuestions(val);
                }
              }}
              placeholder="Enter number of questions"
              className="w-full px-6 py-4 bg-gradient-to-r from-[#DFF4FF]/50 to-white dark:from-slate-800 dark:to-slate-900 border-2 border-[#003B73]/10 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#003B73]/20 focus:border-[#003B73]/30 transition-all text-[#003B73] dark:text-blue-100"
            />
            <p className="text-[#003B73] dark:text-blue-100/60 mt-2">Choose between 5 and 100 questions</p>
          </div>

          {/* Difficulty Level */}
          <div>
            <label className="block text-[#003B73] dark:text-blue-100 mb-3">Difficulty Level</label>
            <div className="grid grid-cols-3 gap-4">
              {(['easy', 'medium', 'hard'] as const).map((level) => (
                <motion.button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  className={`py-4 rounded-2xl transition-all ${difficulty === level
                    ? 'bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white shadow-lg border-2 border-[#003B73]'
                    : 'bg-white dark:bg-slate-900 border-2 border-[#003B73]/20 dark:border-white/10 text-[#003B73] dark:text-blue-100 hover:border-[#003B73]/40 hover:shadow-md'
                    }`}
                  whileHover={{ scale: 1.05, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="flex flex-col items-center gap-2">
                    {level === 'easy' && (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${difficulty === level ? 'bg-white/20' : 'bg-green-100'
                        }`}>
                        <span className={difficulty === level ? 'text-white' : 'text-green-600'}>😊</span>
                      </div>
                    )}
                    {level === 'medium' && (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${difficulty === level ? 'bg-white/20' : 'bg-yellow-100'
                        }`}>
                        <span className={difficulty === level ? 'text-white' : 'text-yellow-600'}>🤔</span>
                      </div>
                    )}
                    {level === 'hard' && (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${difficulty === level ? 'bg-white/20' : 'bg-red-100'
                        }`}>
                        <span className={difficulty === level ? 'text-white' : 'text-red-600'}>🔥</span>
                      </div>
                    )}
                    <span className="font-medium">{level.charAt(0).toUpperCase() + level.slice(1)}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Quiz Summary */}
          <div className="p-6 bg-gradient-to-r from-[#DFF4FF]/50 to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl border-2 border-[#003B73]/10 dark:border-white/10">
            <h4 className="text-[#003B73] dark:text-blue-100 mb-4">Quiz Summary</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-[#003B73] to-[#0056A8] rounded-lg flex items-center justify-center">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[#003B73] dark:text-blue-100/60">Subject</p>
                  <p className="text-[#003B73] dark:text-blue-100">{selectedSubject}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[#003B73] dark:text-blue-100/60">Questions</p>
                  <p className="text-[#003B73] dark:text-blue-100">{numQuestions || '10'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[#003B73] dark:text-blue-100/60">Difficulty</p>
                  <p className="text-[#003B73] dark:text-blue-100">{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-[#003B73] dark:text-blue-100/60">Estimated Time</p>
                  <p className="text-[#003B73] dark:text-blue-100">{numQuestions ? Math.ceil(parseInt(numQuestions) * 1) : 10} min</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Start Quiz Button */}
        <div className="flex justify-center mt-8 gap-4">
          <motion.button
            onClick={handleGenerateQuiz}
            disabled={isGeneratingQuiz || !numQuestions || parseInt(numQuestions) < 5 || parseInt(numQuestions) > 100}
            className={`flex items-center gap-3 px-10 py-5 rounded-2xl shadow-lg transition-all ${!isGeneratingQuiz && numQuestions && parseInt(numQuestions) >= 5 && parseInt(numQuestions) <= 100
              ? 'bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white hover:shadow-xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            whileHover={!isGeneratingQuiz && numQuestions && parseInt(numQuestions) >= 5 && parseInt(numQuestions) <= 100 ? { scale: 1.05 } : {}}
            whileTap={!isGeneratingQuiz && numQuestions && parseInt(numQuestions) >= 5 && parseInt(numQuestions) <= 100 ? { scale: 0.95 } : {}}
          >
            {isGeneratingQuiz ? (
              <>
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                <span>Generating Quiz...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-6 h-6" />
                <span>Start Quiz</span>
                <ChevronRight className="w-6 h-6" />
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    );
  };

  // Quiz View
  const renderQuiz = () => {
    if (!quizQuestions || quizQuestions.length === 0) {
      return (
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-[#003B73]/10 dark:border-white/10">
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-[#003B73] dark:text-blue-100 text-2xl mb-2">No Questions Available</h2>
            <p className="text-[#003B73] dark:text-blue-100/70 mb-6">
              We couldn't generate questions for this quiz. This might be due to a server issue or missing AI configuration.
            </p>
            <button
              onClick={onBack}
              className="px-8 py-3 bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    const currentQuestion = quizQuestions[currentQuestionIndex];
    const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Quiz Header */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-[#003B73]/10 dark:border-white/10 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-[#003B73] to-[#0056A8] rounded-xl flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-[#003B73] dark:text-blue-100">
                  {loadedQuiz?.title || subjects.find(s => s.id.toString() === selectedSubject)?.name || 'Quiz'}
                </h2>
                <p className="text-[#003B73] dark:text-blue-100/60">
                  Question {currentQuestionIndex + 1} of {quizQuestions.length}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-[#DFF4FF] dark:bg-slate-800 rounded-xl border border-[#003B73]/10 dark:border-white/10">
                <Clock className="w-5 h-5 text-[#003B73] dark:text-blue-100" />
                <span className="text-[#003B73] dark:text-blue-100">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-600 rounded-xl shadow-md">
                <Flame className="w-5 h-5 text-white" />
                <span className="text-white">
                  {Object.keys(selectedAnswers).length}/{quizQuestions.length}
                </span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 bg-[#DFF4FF] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-[#003B73] to-[#0056A8]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Question Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQuestionIndex}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-[#003B73]/10 dark:border-white/10 mb-8"
          >
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-br from-[#B9E7FF] to-[#DFF4FF] dark:from-slate-800 dark:to-slate-800 rounded-lg flex items-center justify-center">
                  <span className="text-[#003B73] dark:text-blue-100">Q{currentQuestionIndex + 1}</span>
                </div>
                <h3 className="text-[#003B73] dark:text-blue-100 flex-1">{currentQuestion.question}</h3>
              </div>
            </div>

            {/* Options */}
            <div className="space-y-4">
              {(currentQuestion.options || []).map((option: string, index: number) => {
                const isSelected = selectedAnswers[currentQuestionIndex] === index;

                return (
                  <motion.button
                    key={index}
                    onClick={() => handleAnswerSelect(index)}
                    className={`w-full p-6 rounded-2xl border-2 transition-all text-left ${isSelected
                      ? 'bg-gradient-to-r from-[#003B73] to-[#0056A8] border-[#003B73] text-white shadow-lg'
                      : 'bg-white/50 dark:bg-slate-800/50 border-[#003B73]/10 dark:border-white/10 text-[#003B73] dark:text-blue-100 hover:border-[#003B73]/30 hover:shadow-md'
                      }`}
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-white bg-white/20' : 'border-[#003B73]/30'
                        }`}>
                        <span className={isSelected ? 'text-white' : 'text-[#003B73] dark:text-blue-100/60'}>
                          {String.fromCharCode(65 + index)}
                        </span>
                      </div>
                      <span>{option}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          <motion.button
            onClick={handlePreviousQuestion}
            disabled={currentQuestionIndex === 0}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${currentQuestionIndex === 0
              ? 'bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-slate-600 cursor-not-allowed'
              : 'bg-white dark:bg-slate-900 text-[#003B73] dark:text-blue-100 border-2 border-[#003B73]/20 hover:shadow-lg'
              }`}
            whileHover={currentQuestionIndex > 0 ? { scale: 1.05 } : {}}
            whileTap={currentQuestionIndex > 0 ? { scale: 0.95 } : {}}
          >
            <ArrowLeft className="w-5 h-5" />
            Previous
          </motion.button>

          <div className="flex gap-3">
            <motion.button
              onClick={handlePauseQuiz}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Pause className="w-5 h-5" />
              Pause
            </motion.button>
            {currentQuestionIndex === quizQuestions.length - 1 ? (
              <motion.button
                onClick={handleSubmitQuiz}
                disabled={Object.keys(selectedAnswers).length !== quizQuestions.length}
                className={`flex items-center gap-2 px-8 py-3 rounded-xl shadow-lg transition-all ${Object.keys(selectedAnswers).length === quizQuestions.length
                  ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-xl'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                whileHover={Object.keys(selectedAnswers).length === quizQuestions.length ? { scale: 1.05 } : {}}
                whileTap={Object.keys(selectedAnswers).length === quizQuestions.length ? { scale: 0.95 } : {}}
              >
                <CheckCircle2 className="w-5 h-5" />
                Submit Quiz
              </motion.button>
            ) : (
              <motion.button
                onClick={handleNextQuestion}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white rounded-xl shadow-lg hover:shadow-xl transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Next
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            )}
          </div>
        </div>

        {/* Question Navigator */}
        <div className="mt-8 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-[#003B73]/10 dark:border-white/10">
          <h4 className="text-[#003B73] dark:text-blue-100 mb-4">Question Navigator</h4>
          <div className="grid grid-cols-10 gap-2">
            {(quizQuestions || []).map((_: any, index: number) => {
              const isAnswered = selectedAnswers[index] !== undefined;
              const isCurrent = index === currentQuestionIndex;

              return (
                <motion.button
                  key={index}
                  onClick={() => setCurrentQuestionIndex(index)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${isCurrent
                    ? 'bg-gradient-to-br from-[#003B73] to-[#0056A8] border-[#003B73] text-white shadow-md'
                    : isAnswered
                      ? 'bg-green-100 border-green-300 text-green-700'
                      : 'bg-white dark:bg-slate-800 border-[#003B73]/20 dark:border-white/10 text-[#003B73] dark:text-blue-100/60 hover:border-[#003B73]/40'
                    }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  {index + 1}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  };

  // Results View
  const renderResults = () => {
    if (!quizResults) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-[#003B73] border-t-transparent rounded-full mb-4"
          />
          <p className="text-[#003B73] dark:text-blue-100 text-lg">Calculating your results...</p>
        </div>
      );
    }

    const { attempt, quiz } = quizResults;
    const isPassed = attempt.score_percentage >= 60;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        className="max-w-4xl mx-auto"
      >
        {/* Results Header */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mb-6"
          >
            <div className={`w-32 h-32 mx-auto rounded-full flex items-center justify-center shadow-2xl ${isPassed
              ? 'bg-gradient-to-br from-green-400 to-green-600'
              : 'bg-gradient-to-br from-orange-400 to-orange-600'
              }`}>
              {isPassed ? (
                <Trophy className="w-16 h-16 text-white" />
              ) : (
                <Target className="w-16 h-16 text-white" />
              )}
            </div>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-[#003B73] dark:text-blue-100 mb-3"
          >
            {isPassed ? 'Congratulations!' : 'Good Effort!'}
          </motion.h1>

          {streakInfo && streakInfo.lost && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-[#003B73] dark:text-blue-100/70">
              You lost your previous streak, but you've started a new one of {streakInfo.current} day!
            </motion.p>
          )}
          {streakInfo && !streakInfo.lost && streakInfo.current > 1 && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="text-[#003B73] dark:text-blue-100/70">
              You've extended your streak to {streakInfo.current} days! Keep it up!
            </motion.p>
          )}

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[#003B73] dark:text-blue-100/70"
          >
            {isPassed
              ? 'You passed the quiz! Keep up the excellent work.'
              : 'Keep practicing to improve your score.'}
          </motion.p>
        </div>

        {/* Score Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-[#003B73]/10 dark:border-white/10 text-center"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-[#003B73] dark:text-blue-100 mb-2">Score</h3>
            <p className="text-4xl text-[#003B73] dark:text-blue-100">{attempt.formatted_score_percentage}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-[#003B73]/10 dark:border-white/10 text-center"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-[#003B73] dark:text-blue-100 mb-2">Correct Answers</h3>
            <p className="text-4xl text-[#003B73] dark:text-blue-100">{attempt.correct_answers}/{attempt.total_questions}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-lg border border-[#003B73]/10 dark:border-white/10 text-center"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-purple-400 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-[#003B73] dark:text-blue-100 mb-2">XP Earned</h3>
            <p className="text-4xl text-[#003B73] dark:text-blue-100">+{attempt.xp_earned}</p>
          </motion.div>
        </div>

        {/* Review Answers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-2xl p-8 shadow-lg border border-[#003B73]/10 dark:border-white/10 mb-8"
        >
          <h3 className="text-[#003B73] dark:text-blue-100 mb-6">Answer Review</h3>
          <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
            {(quiz.questions || []).map((question: any, index: number) => {
              const userAnswer = attempt.answers.find((a: any) => a.question === question.id);
              const isCorrect = userAnswer?.is_correct;

              return (
                <div
                  key={question.id}
                  className={`p-4 rounded-xl border-2 ${isCorrect
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-900'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900'
                    }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isCorrect ? 'bg-green-500' : 'bg-red-500'
                      }`}>
                      {isCorrect ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <XCircle className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[#003B73] dark:text-blue-100 mb-2">
                        <span className="font-semibold">Q{index + 1}:</span> {question.question_text}
                      </p>
                      {isCorrect ? (
                        <p className="text-green-700 dark:text-green-400">Correct ✔️</p>
                      ) : (
                        <>
                          <p className="text-red-700 dark:text-red-400">
                            Your answer: {userAnswer ? question.options[userAnswer.selected_option] : "Not answered"}
                          </p>
                          <p className="text-green-700 dark:text-green-400 mt-1">
                            Correct answer: {question.options[question.correct_answer]}
                          </p>
                          {question.explanation && (
                            <div className="mt-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border-l-4 border-yellow-400">
                              <p className="text-yellow-800 dark:text-yellow-300 text-sm">{question.explanation}</p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <motion.button
            onClick={() => {
              // Reset state for a new quiz
              setCurrentStep('category'); // Go back to the beginning
              setSelectedCategory('');
              setSelectedSubcategory('');
              setSelectedSubject('');
              setLoadedQuiz(null);
              setQuizResults(null);
              setQuizCompleted(false);
              setCurrentQuestionIndex(0);
              setSelectedAnswers({});
              clearQuizState(); // Make sure no state persists
            }}
            className="flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white rounded-2xl shadow-lg hover:shadow-xl transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Target className="w-5 h-5" />
            Try Another Quiz
          </motion.button>

          <motion.button
            onClick={onBack}
            className="flex items-center gap-2 px-8 py-4 bg-white dark:bg-slate-900 border-2 border-[#003B73] dark:border-blue-100/20 text-[#003B73] dark:text-blue-100 rounded-2xl shadow-md hover:shadow-lg transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Back to Home
          </motion.button>
        </div>
      </motion.div >
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-[#DFF4FF] to-[#B9E7FF] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Navigation Bar */}
      <nav className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-[#003B73]/10 dark:border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <motion.button
              onClick={handleBackNavigation}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-xl shadow-md border border-[#003B73]/10 dark:border-white/10 hover:shadow-lg transition-all text-[#003B73] dark:text-blue-100"
              whileHover={{ scale: 1.05, x: -3 }}
              whileTap={{ scale: 0.95 }}
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </motion.button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#B9E7FF] to-[#003B73] rounded-xl flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-[#003B73] dark:text-blue-100">Take Quiz</div>
                <p className="text-[#003B73] dark:text-blue-100/60">Test Your Knowledge</p>
              </div>
            </div>

            {currentStep !== 'quiz' && currentStep !== 'results' && (
              <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-400 to-orange-600 rounded-xl shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
                <span className="text-white">Ready to Learn</span>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {isLoadingQuiz ? (
            <div className="flex flex-col items-center justify-center min-h-[400px]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 border-4 border-[#003B73] border-t-transparent rounded-full mb-4"
              />
              <p className="text-[#003B73] dark:text-blue-100 text-lg">Loading your quiz...</p>
            </div>
          ) : (
            <>
              {currentStep === 'category' && recommendedQuizzes.length > 0 && renderRecommendedQuizzes()}
              {currentStep === 'category' && renderCategorySelection()}
              {currentStep === 'subcategory' && renderSubcategorySelection()}
              {currentStep === 'subject' && renderSubjectSelection()}
              {currentStep === 'configure' && renderQuizConfig()}
              {currentStep === 'quiz' && renderQuiz()}
              {currentStep === 'results' && renderResults()}
            </>
          )}
        </AnimatePresence>
      </main>    </div>
  );
}
