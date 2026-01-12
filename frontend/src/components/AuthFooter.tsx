import { Brain } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AuthFooter() {
    return (
        <footer className="w-full py-6 px-4 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
                {/* Copyright */}
                <div className="flex items-center gap-2 text-[#003B73]/60 dark:text-blue-100/60">
                    <Brain className="w-4 h-4" />
                    <p>© 2025 QuizAI. Powered by AI Intelligence.</p>
                </div>

                {/* Links */}
                <div className="flex items-center gap-6">
                    <Link to="#" className="text-[#003B73]/60 dark:text-blue-100/60 hover:text-[#003B73] dark:hover:text-blue-100 transition-colors">
                        About
                    </Link>
                    <Link to="#" className="text-[#003B73]/60 dark:text-blue-100/60 hover:text-[#003B73] dark:hover:text-blue-100 transition-colors">
                        Privacy
                    </Link>
                    <Link to="#" className="text-[#003B73]/60 dark:text-blue-100/60 hover:text-[#003B73] dark:hover:text-blue-100 transition-colors">
                        Terms
                    </Link>
                    <Link to="#" className="text-[#003B73]/60 dark:text-blue-100/60 hover:text-[#003B73] dark:hover:text-blue-100 transition-colors">
                        Support
                    </Link>
                </div>
            </div>
        </footer>
    );
}
