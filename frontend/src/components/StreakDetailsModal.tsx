import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, X, Calendar as CalendarIcon, Trophy, ChevronLeft, ChevronRight } from 'lucide-react';
import { userAPI } from '../services/api';

interface StreakDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface AnalyticsData {
    streak_days: number;
    longest_streak: number;
    activity_history: string[]; // YYYY-MM-DD
}

export function StreakDetailsModal({ isOpen, onClose }: StreakDetailsModalProps) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewDate, setViewDate] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date()); // Track real-time date

    useEffect(() => {
        if (isOpen) {
            fetchAnalytics();
            setViewDate(new Date()); // Reset to current month on open
        }
    }, [isOpen]);

    // Update current date periodically to handle date changes (e.g. midnight) while modal is open
    useEffect(() => {
        const timer = setInterval(() => setCurrentDate(new Date()), 60000); // Check every minute
        return () => clearInterval(timer);
    }, []);

    const fetchAnalytics = async () => {
        try {
            setLoading(true);
            const analytics = await userAPI.getUserAnalytics();
            setData(analytics);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const days = [];

        for (let d = 1; d <= lastDay.getDate(); d++) {
            days.push(new Date(year, month, d));
        }
        return { days, firstDayWeekday: firstDay.getDay() };
    };

    const changeMonth = (delta: number) => {
        const newDate = new Date(viewDate);
        newDate.setMonth(newDate.getMonth() + delta);
        setViewDate(newDate);
    };

    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isActiveDay = (date: Date) => {
        if (!data?.activity_history) return false;
        const dateStr = formatDate(date);
        return data.activity_history.includes(dateStr);
    };

    const { days, firstDayWeekday } = getDaysInMonth(viewDate);
    const monthName = viewDate.toLocaleString('default', { month: 'long', year: 'numeric' });

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.05
            }
        }
    };

    const item = {
        hidden: { opacity: 0, scale: 0.5 },
        show: { opacity: 1, scale: 1 }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop with blur */}
                    <motion.div
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />

                    {/* Modal Content - Premium Glass Effect */}
                    <motion.div
                        className="relative w-full max-w-lg md:max-w-4xl overflow-hidden max-h-[90vh] flex flex-col md:flex-row
                                 bg-white dark:bg-slate-950 
                                 rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ duration: 0.3, type: "spring", bounce: 0.3 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Decorative Background Gradients (Dark Mode) */}
                        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-500/5 to-transparent dark:from-blue-500/10 pointer-events-none" />
                        <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-[-50px] left-[-50px] w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* LEFT COLUMN: Header & Stats */}
                        <div className="p-6 md:p-8 flex flex-col gap-6 md:w-2/5 border-b md:border-b-0 md:border-r border-gray-100 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 relative z-10">
                            {/* Header */}
                            <div className="flex items-center justify-between md:justify-start gap-4">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-orange-500 blur-md opacity-20 rounded-2xl" />
                                    <div className="relative w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 ring-1 ring-white/20">
                                        <Flame className="w-7 h-7 text-white fill-white/20" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight leading-none mb-1">Streak Details</h2>
                                    <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Keep the fire burning! 🔥</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    type="button"
                                    className="md:hidden p-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-all text-slate-500 dark:text-slate-400"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Stats Cards */}
                            {!loading && (
                                <div className="flex flex-col gap-4 flex-1 justify-center">
                                    <div className="relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-900 border border-orange-100 dark:border-white/10 group shadow-sm hover:shadow-md transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400">
                                                <Flame className="w-4 h-4 fill-current" />
                                                <span className="text-sm font-bold uppercase tracking-wider opacity-80">Current Streak</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                                                    {data?.streak_days || 0}
                                                </span>
                                                <span className="text-slate-500 dark:text-slate-500 font-medium">days</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="relative overflow-hidden p-5 rounded-2xl bg-white dark:bg-slate-900 border border-blue-100 dark:border-white/10 group shadow-sm hover:shadow-md transition-all">
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                        <div className="relative z-10">
                                            <div className="flex items-center gap-2 mb-2 text-blue-600 dark:text-blue-400">
                                                <Trophy className="w-4 h-4 fill-current" />
                                                <span className="text-sm font-bold uppercase tracking-wider opacity-80">Best Streak</span>
                                            </div>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-extrabold text-slate-800 dark:text-white tracking-tight">
                                                    {data?.longest_streak || 0}
                                                </span>
                                                <span className="text-slate-500 dark:text-slate-500 font-medium">days</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT COLUMN: Calendar */}
                        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">

                            {/* Desktop Close Button */}
                            <button
                                onClick={onClose}
                                type="button"
                                className="hidden md:flex absolute top-6 right-6 p-2.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-all text-slate-500 dark:text-slate-400 hover:scale-105 active:scale-95 z-20"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {loading ? (
                                <div className="flex justify-center py-12 h-full items-center">
                                    <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                </div>
                            ) : (
                                <div className="h-full flex flex-col justify-center">
                                    {/* Calendar View */}
                                    <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-inner">
                                        <div className="flex items-center justify-between mb-6">
                                            <div className="flex items-center gap-2 text-slate-800 dark:text-white">
                                                <CalendarIcon className="w-5 h-5 text-blue-500" />
                                                <h3 className="font-bold text-lg capitalize">{monthName}</h3>
                                            </div>
                                            <div className="flex gap-1 bg-white dark:bg-black/20 p-1 rounded-xl border border-gray-100 dark:border-white/5">
                                                <button
                                                    onClick={() => changeMonth(-1)}
                                                    type="button"
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                                                >
                                                    <ChevronLeft className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => changeMonth(1)}
                                                    type="button"
                                                    className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <motion.div
                                            className="grid gap-3"
                                            style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
                                            variants={container}
                                            initial="hidden"
                                            animate="show"
                                            key={viewDate.toISOString()} // Trigger animation on month change
                                        >
                                            {/* Day Headers */}
                                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                                                <div key={day} className="text-center text-xs font-bold text-slate-400 dark:text-slate-500">
                                                    {day}
                                                </div>
                                            ))}

                                            {/* Padding */}
                                            {Array(firstDayWeekday).fill(null).map((_, i) => (
                                                <div key={`pad-${i}`} />
                                            ))}

                                            {/* Date Cells */}
                                            {days.map((date, i) => {
                                                const active = isActiveDay(date);
                                                const isToday = date.getDate() === currentDate.getDate() &&
                                                    date.getMonth() === currentDate.getMonth() &&
                                                    date.getFullYear() === currentDate.getFullYear();

                                                // Check if the date is in the past and was not active (Absent)
                                                // We compare timestamps to ignore time of day for the "today" check logic properly if needed,
                                                // but simple date comparison works if we set hours to 0.
                                                const dateSet = new Date(date);
                                                dateSet.setHours(0, 0, 0, 0);
                                                const todaySet = new Date(currentDate);
                                                todaySet.setHours(0, 0, 0, 0);

                                                const isPast = dateSet < todaySet;
                                                const isAbsent = isPast && !active;

                                                return (
                                                    <motion.div
                                                        key={i}
                                                        variants={item}
                                                        className={`
                                                            aspect-square flex items-center justify-center text-sm font-semibold relative group rounded-xl transition-all cursor-default
                                                            ${isToday
                                                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400/30'
                                                                : active
                                                                    ? 'bg-gradient-to-br from-orange-400 to-orange-500 text-white shadow-md shadow-orange-500/20'
                                                                    : isAbsent
                                                                        ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400 ring-1 ring-red-500/20'
                                                                        : 'text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-white/10 hover:shadow-sm'
                                                            }
                                                        `}
                                                        marginBottom={isToday ? "2px" : "0"}
                                                        animate={isToday ? {
                                                            scale: [1, 1.05, 1],
                                                            boxShadow: [
                                                                "0 4px 6px -1px rgba(59, 130, 246, 0.3)",
                                                                "0 10px 15px -3px rgba(59, 130, 246, 0.5)",
                                                                "0 4px 6px -1px rgba(59, 130, 246, 0.3)"
                                                            ]
                                                        } : undefined}
                                                        transition={isToday ? {
                                                            duration: 2,
                                                            repeat: Infinity,
                                                            ease: "easeInOut"
                                                        } : undefined}
                                                        whileHover={{ scale: 1.1, translateY: -2, zIndex: 10 }}
                                                    >
                                                        {date.getDate()}

                                                        {active && !isToday && (
                                                            <div className="absolute bottom-1 w-1 h-1 bg-white/50 rounded-full" />
                                                        )}
                                                        {isAbsent && (
                                                            <div className="absolute bottom-1 w-1 h-1 bg-red-500/50 rounded-full" />
                                                        )}
                                                    </motion.div>
                                                );
                                            })}
                                        </motion.div>
                                    </div>

                                    <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-6 font-medium">
                                        ✨ Consistency is key! Come back tomorrow.
                                    </p>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
