import { useState } from "react";
import { motion } from "motion/react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  Brain,
  Trophy,
  Target,
  Sparkles,
  ArrowRight,
  Rocket,
  BarChart3,
  Plus,
  PlayCircle,
  X,
  GraduationCap,
  Lightbulb,
  Code,
  FileText,
  Users,
  Moon,
  Sun,
} from "lucide-react";

import "./LandingPage.css";
import { AuthFooter } from "./AuthFooter";

const ROUTES = {
  login: "/login",
  signup: "/signup",
} as const;

export function LandingPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const navigate = useNavigate();

  const { theme, resolvedTheme, setTheme } = useTheme();
  const currentTheme = (resolvedTheme || theme) as "light" | "dark" | undefined;

  const toggleTheme = () => {
    setTheme(currentTheme === "dark" ? "light" : "dark");
  };

  // ✅ Dedicated navigation functions (clean + reusable)
  const goTo = (path: string) => navigate(path);
  const goLogin = () => goTo(ROUTES.login);
  const goSignup = () => goTo(ROUTES.signup);

  const openAuthModal = () => setShowAuthModal(true);
  const closeAuthModal = () => setShowAuthModal(false);

  const scrollToDemo = () => {
    const el = document.getElementById("lp-features");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Generation",
      description:
        "Upload PDFs, DOCs, or TXT files and watch AI create intelligent quizzes in seconds",
      tone: "blue",
    },
    {
      icon: Target,
      title: "Adaptive Learning",
      description:
        "Personalized difficulty levels and smart question selection tailored to your progress",
      tone: "green",
    },
    {
      icon: Trophy,
      title: "Gamified Experience",
      description:
        "Earn XP, unlock achievements, maintain streaks, and climb the leaderboard",
      tone: "amber",
    },
    {
      icon: BarChart3,
      title: "Progress Analytics",
      description:
        "Comprehensive insights with charts, stats, and detailed performance tracking",
      tone: "purple",
    },
    {
      icon: Users,
      title: "Multi-Category Support",
      description: "Academics, Computer Science, Government Exams - all in one platform",
      tone: "pink",
    },
    {
      icon: Lightbulb,
      title: "Instant Feedback",
      description: "Get immediate explanations and learn from your mistakes in real-time",
      tone: "indigo",
    },
  ] as const;

  const categories = [
    { name: "Academics", icon: GraduationCap, count: "10+ Topics", description: "10th & 12th Grade", tone: "blue" },
    { name: "CSE", icon: Code, count: "10+ Topics", description: "Computer Science", tone: "magenta" },
    { name: "Gov Exams", icon: FileText, count: "10+ Topics", description: "Competitive Exams", tone: "orange" },
  ] as const;

  return (
    <div className="lp-root">
      {/* NAV */}
      <nav className="lp-nav">
        <div className="lp-container lp-nav-inner">
          <motion.div className="lp-logo" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="lp-logo-badge">
              <Brain className="lp-ic-24" aria-hidden="true" />
            </div>
            <div className="lp-brand">QuizAI Pro</div>
          </motion.div>

          <motion.div className="lp-nav-center" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <motion.button
              onClick={openAuthModal}
              className="lp-navbtn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
            >
              <Plus className="lp-ic-18" aria-hidden="true" />
              <span>Create Quiz</span>
            </motion.button>

            <motion.button
              onClick={openAuthModal}
              className="lp-navbtn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
            >
              <PlayCircle className="lp-ic-18" aria-hidden="true" />
              <span>Take Quiz</span>
            </motion.button>
          </motion.div>

          <motion.div className="lp-nav-right" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {/* ✅ Theme Toggle Button (matches your screenshots) */}
            <motion.button
              className="lp-themebtn"
              onClick={toggleTheme}
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {currentTheme === "dark" ? (
                <Sun className="lp-ic-20 lp-sun" aria-hidden="true" />
              ) : (
                <Moon className="lp-ic-20" aria-hidden="true" />
              )}
            </motion.button>

            <motion.button
              onClick={goLogin}
              className="lp-linkbtn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
            >
              Login
            </motion.button>

            <motion.button
              onClick={goSignup}
              className="lp-primarybtn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
            >
              Get Started
            </motion.button>
          </motion.div>
        </div>
      </nav>

      {/* HERO */}
      <section className="lp-hero">
        <div className="lp-container">
          <div className="lp-hero-center">
            <motion.div className="lp-pill" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
              <Sparkles className="lp-ic-16" aria-hidden="true" />
              <span>Powered by Advanced AI Technology</span>
            </motion.div>

            <motion.h1
              className="lp-h1"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              Transform Learning with <span className="lp-accent">AI Quizzes</span>
            </motion.h1>

            <motion.p
              className="lp-subtitle"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              Upload your study materials and let our AI create personalized quizzes.
              Track progress, earn rewards, and master any subject with interactive learning.
            </motion.p>

            <motion.div
              className="lp-hero-actions"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.button
                onClick={goSignup}
                className="lp-cta"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                type="button"
              >
                <Rocket className="lp-ic-18" aria-hidden="true" />
                <span>Start Learning Free</span>
                <ArrowRight className="lp-ic-18" aria-hidden="true" />
              </motion.button>

              <motion.button
                onClick={scrollToDemo}
                className="lp-outline"
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                type="button"
              >
                Sign IN
              </motion.button>
            </motion.div>
          </div>

          {/* FEATURES */}
          <div className="lp-section" id="lp-features">
            <div className="lp-section-head">
              <h2 className="lp-h2">
                Powerful Features for <span className="lp-accent">Smarter Learning</span>
              </h2>
              <p className="lp-muted">Everything you need to master any subject</p>
            </div>

            <div className="lp-grid lp-grid-3">
              {features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div
                    key={i}
                    className="lp-card"
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.06 }}
                    whileHover={{ y: -5 }}
                  >
                    <div className={`lp-iconbox lp-tone-${f.tone}`}>
                      <Icon className="lp-ic-22" aria-hidden="true" />
                    </div>
                    <h3 className="lp-card-title">{f.title}</h3>
                    <p className="lp-card-desc">{f.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* CATEGORIES */}
          <div className="lp-section">
            <div className="lp-section-head">
              <h2 className="lp-h2">
                Explore Quiz <span className="lp-accent">Categories</span>
              </h2>
              <p className="lp-muted">Choose from our comprehensive topic library</p>
            </div>

            <div className="lp-grid lp-grid-3">
              {categories.map((c, i) => {
                const Icon = c.icon;
                return (
                  <motion.div
                    key={i}
                    className="lp-card lp-card-center"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.7 + i * 0.08 }}
                    whileHover={{ scale: 1.04, y: -5 }}
                    whileTap={{ scale: 0.98 }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openAuthModal();
                      }
                    }}
                    aria-label={`${c.name} category`}
                    onClick={openAuthModal}
                  >
                    <div className={`lp-catbox lp-cat-${c.tone}`}>
                      <Icon className="lp-ic-30" aria-hidden="true" />
                    </div>
                    <h3 className="lp-cat-title">{c.name}</h3>
                    <p className="lp-cat-desc">{c.description}</p>
                    <div className="lp-chip">{c.count}</div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-container">© 2026 QuizAI Pro. Empowering learners with AI technology.</div>
      </footer>

      {/* MODAL */}
      {showAuthModal && (
        <motion.div
          className="lp-modalOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={closeAuthModal}
          role="dialog"
          aria-modal="true"
          aria-label="Authentication required"
        >
          <motion.div
            className="lp-modal"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="lp-close" onClick={closeAuthModal} type="button" aria-label="Close modal">
              <X className="lp-ic-18" aria-hidden="true" />
            </button>

            <motion.div
              className="lp-modalLogo"
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Brain className="lp-ic-30" aria-hidden="true" />
            </motion.div>

            <h3 className="lp-modalTitle">Login Required</h3>
            <p className="lp-modalDesc">
              Please sign in or create an account to access quiz creation and quiz-taking features.
            </p>

            <div className="lp-modalActions">
              <button
                className="lp-primarybtn lp-full"
                onClick={() => {
                  closeAuthModal();
                  goLogin();
                }}
                type="button"
              >
                Login to Continue
              </button>

              <button
                className="lp-outline lp-full"
                onClick={() => {
                  closeAuthModal();
                  goSignup();
                }}
                type="button"
              >
                Create New Account
              </button>
            </div>

            <div className="lp-note">Join 10,000+ learners and start your journey today!</div>
          </motion.div>
        </motion.div>
      )}
      <AuthFooter />
    </div>
  );
}

export default LandingPage;
