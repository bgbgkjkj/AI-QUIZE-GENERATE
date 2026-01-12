import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, Eye, EyeOff, Loader2, CheckCircle, ArrowLeft, KeyRound, Sparkles } from "lucide-react";
import { authAPI } from "../services/api";
import { AuthFooter } from "../components/AuthFooter";

export default function ResetPasswordPage() {
    const { uid, token } = useParams();
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!uid || !token) {
            setError("Invalid reset link.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            await authAPI.confirmPasswordReset(uid, token, newPassword);
            setIsSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to reset password. The link may have expired.");
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
                            <h1 className="text-2xl font-bold text-[#003B73] dark:text-blue-100 mb-2">
                                Reset Password
                            </h1>
                            <p className="text-[#003B73]/60 dark:text-blue-100/60">
                                Enter your new password below.
                            </p>
                        </div>

                        {isSuccess ? (
                            <div className="text-center py-4">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4"
                                >
                                    <CheckCircle size={32} />
                                </motion.div>
                                <h3 className="text-xl font-semibold text-[#003B73] dark:text-blue-100 mb-2">Success!</h3>
                                <p className="text-[#003B73]/70 dark:text-blue-100/70 mb-6">
                                    Your password has been updated properly. Redirecting to login...
                                </p>
                                <Link
                                    to="/login"
                                    className="inline-block w-full py-3.5 bg-gradient-to-r from-[#003B73] to-[#0056A8] text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl transition-all text-center"
                                >
                                    Login Now
                                </Link>
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
                                    <label className="block text-[#003B73] dark:text-blue-100 font-medium mb-2 text-sm">
                                        New Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-[#003B73]/40 dark:text-blue-100/40" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="w-full pl-12 pr-12 py-3.5 bg-gradient-to-r from-[#DFF4FF]/50 to-white dark:from-slate-800 dark:to-slate-900 border border-[#003B73]/10 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#003B73]/20 focus:border-[#003B73]/30 transition-all text-[#003B73] dark:text-blue-100 placeholder-[#003B73]/40 dark:placeholder-blue-100/40"
                                            placeholder="Enter new password"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            className="absolute inset-y-0 right-0 pr-4 flex items-center text-[#003B73]/40 dark:text-blue-100/40 hover:text-[#003B73] dark:hover:text-blue-100 transition-colors"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[#003B73] dark:text-blue-100 font-medium mb-2 text-sm">
                                        Confirm Password
                                    </label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Lock className="h-5 w-5 text-[#003B73]/40 dark:text-blue-100/40" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            required
                                            className="w-full pl-12 pr-12 py-3.5 bg-gradient-to-r from-[#DFF4FF]/50 to-white dark:from-slate-800 dark:to-slate-900 border border-[#003B73]/10 dark:border-white/10 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#003B73]/20 focus:border-[#003B73]/30 transition-all text-[#003B73] dark:text-blue-100 placeholder-[#003B73]/40 dark:placeholder-blue-100/40"
                                            placeholder="Confirm new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
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
                                            Resetting...
                                        </>
                                    ) : (
                                        "Reset Password"
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
