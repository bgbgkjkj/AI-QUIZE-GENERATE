import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Mail, KeyRound, Sparkles, CheckCircle } from "lucide-react";
import { authAPI } from "../services/api";
import { AuthFooter } from "../components/AuthFooter";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsLoading(true);
        setError("");

        try {
            await authAPI.requestPasswordReset(email);
            setIsSent(true);
        } catch (err: any) {
            setError(err.message || "Failed to send reset link.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-white via-[#DFF4FF] to-[#B9E7FF] dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 relative overflow-hidden flex flex-col">
            {/* Decorative Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute top-20 left-10 w-64 h-64 bg-[#003B73]/5 rounded-full blur-3xl"
                    animate={{
                        scale: [1, 1.2, 1],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 8, repeat: Infinity }}
                />
                <motion.div
                    className="absolute bottom-20 right-10 w-96 h-96 bg-[#B9E7FF]/30 rounded-full blur-3xl"
                    animate={{
                        scale: [1.2, 1, 1.2],
                        opacity: [0.3, 0.5, 0.3]
                    }}
                    transition={{ duration: 10, repeat: Infinity }}
                />
            </div>

            <div className="flex-1 flex items-center justify-center p-4 w-full">
                <motion.div
                    className="w-full max-w-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Back to Login Link */}
                    <div className="mb-6">
                        <Link
                            to="/login"
                            className="inline-flex items-center text-[#003B73] dark:text-blue-100 hover:text-[#003B73]/70 dark:hover:text-blue-100/70 transition-colors font-medium"
                        >
                            <ArrowLeft size={20} className="mr-2" />
                            Back to Login
                        </Link>
                    </div>

                    <motion.div
                        className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-xl border border-[#003B73]/10 dark:border-white/10 p-8"
                        whileHover={{ boxShadow: "0 25px 50px -12px rgba(0, 59, 115, 0.15)" }}
                        transition={{ duration: 0.3 }}
                    >
                        {/* Header Icon */}
                        <div className="text-center mb-8">
                            <motion.div
                                className="inline-flex items-center justify-center w-20 h-20 mb-4 bg-gradient-to-br from-[#B9E7FF] to-white dark:from-slate-800 dark:to-slate-900 rounded-2xl shadow-lg border border-[#003B73]/10 dark:border-white/10 relative"
                                animate={{ rotate: [0, 5, -5, 0] }}
                                transition={{ duration: 4, repeat: Infinity }}
                            >
                                <KeyRound className="w-10 h-10 !text-[#003B73] dark:!text-blue-100" />
                                <motion.div
                                    className="absolute -top-2 -right-2"
                                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <Sparkles className="w-5 h-5 text-[#003B73]/40 dark:text-blue-100/40" />
                                </motion.div>
                            </motion.div>
                            <h1 className="text-2xl font-bold text-[#003B73] dark:text-blue-100 mb-2">Forgot Password?</h1>
                            <p className="text-[#003B73]/60 dark:text-blue-100/60">Enter your email and we'll send you a link to reset your password.</p>
                        </div>

                        {isSent ? (
                            <div className="text-center py-4">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"
                                >
                                    <CheckCircle size={32} />
                                </motion.div>
                                <h3 className="text-xl font-semibold text-[#003B73] dark:text-blue-100 mb-2">Check your email</h3>
                                <p className="text-[#003B73]/70 dark:text-blue-100/70 mb-6">
                                    We have sent a password reset link to <span className="font-semibold text-[#003B73] dark:text-blue-100">{email}</span>
                                </p>
                                <button
                                    onClick={() => setIsSent(false)}
                                    className="text-[#003B73] dark:text-blue-100 hover:text-[#003B73]/70 dark:hover:text-blue-100/70 font-medium transition-colors underline decoration-[#003B73]/30 dark:decoration-blue-100/30 underline-offset-4"
                                >
                                    Use a different email
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="p-4 bg-red-50 border border-red-200 rounded-2xl"
                                    >
                                        <p className="text-red-600 text-sm">{error}</p>
                                    </motion.div>
                                )}

                                <div>
                                    <label htmlFor="email" className="block text-[#003B73] dark:text-blue-100 font-medium mb-2 text-sm">
                                        Email Address
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                                            <Mail className="h-5 w-5 text-[#003B73]/40 dark:text-blue-100/40" />
                                        </div>
                                        <input
                                            id="email"
                                            type="email"
                                            required
                                            className="w-full pl-12 pr-4 py-3.5 bg-gradient-to-r from-[#DFF4FF]/50 to-white dark:from-slate-800 dark:to-slate-900 border border-[#003B73]/10 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#003B73]/20 focus:border-[#003B73]/30 transition-all text-[#003B73] dark:text-blue-100 placeholder-[#003B73]/40 dark:placeholder-blue-100/40"
                                            placeholder="Enter your email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <motion.button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-4 bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                                    whileHover={!isLoading ? { scale: 1.02 } : {}}
                                    whileTap={!isLoading ? { scale: 0.98 } : {}}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 size={20} className="animate-spin mr-2" />
                                            Sending...
                                        </>
                                    ) : (
                                        "Send Reset Link"
                                    )}
                                </motion.button>
                            </form>
                        )}
                    </motion.div>

                    <motion.div
                        className="mt-6 text-center text-[#003B73]/40 dark:text-blue-100/40 text-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                    >
                        <p>Secure password reset powered by AI Intelligence</p>
                    </motion.div>
                </motion.div>
            </div>
            <AuthFooter />
        </div>
    );
}
