import React, { useEffect, useState } from 'react';
import { userAPI } from '../services/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { CheckCircle, Zap, Target } from 'lucide-react';

// Define data types
interface OverallPerformance {
  average_score: number;
  highest_score: number;
}

interface CategoryDistribution {
  category: string;
  quiz_count: number;
}

interface PerformanceBySubject {
  subject: string;
  average_score: number;
  quiz_count: number;
}

interface UserProgress {
  quiz_name: string;
  score: number;
  date: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF', '#FF1919'];

const improvementTips: { [key: string]: string[] } = {
  default: [
    "Review the fundamental concepts of the topic.",
    "Take more practice quizzes to identify weak areas.",
    "Focus on understanding why your incorrect answers were wrong."
  ],
  "Data Structures": [
    "Practice implementing common data structures like linked lists, trees, and graphs.",
    "Understand the time and space complexity of different operations."
  ],
  "Algorithms": [
    "Work through classic algorithm problems on platforms like LeetCode or HackerRank.",
    "Draw out the steps of an algorithm to visualize how it works."
  ]
};

const PerformanceDashboard: React.FC = () => {
  const [overallPerformance, setOverallPerformance] = useState<OverallPerformance | null>(null);
  const [categoryDistribution, setCategoryDistribution] = useState<CategoryDistribution[]>([]);
  const [performanceBySubject, setPerformanceBySubject] = useState<PerformanceBySubject[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [
          overallPerf,
          catDist,
          perfBySub,
          userProg
        ] = await Promise.all([
          userAPI.getOverallPerformance(),
          userAPI.getCategoryDistribution(),
          userAPI.getPerformanceBySubject(),
          userAPI.getUserProgress()
        ]);
        setOverallPerformance(overallPerf);
        setCategoryDistribution(catDist);
        setPerformanceBySubject(perfBySub);
        setUserProgress(userProg);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch performance data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const strongTopics = performanceBySubject.filter(s => s.average_score >= 60);
  const weakTopics = performanceBySubject.filter(s => s.average_score < 60);

  if (loading) {
    return <div>Loading performance data...</div>;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div className="p-4 md:p-6 bg-gray-50 dark:bg-gray-900 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Performance Dashboard</h2>

      {/* Overall Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm text-center">
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">Overall Average Score</h3>
          <p className="text-4xl font-bold text-blue-500 mt-2">{overallPerformance?.average_score.toFixed(1)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm text-center">
          <h3 className="text-lg font-semibold text-gray-600 dark:text-gray-300">Overall Highest Score</h3>
          <p className="text-4xl font-bold text-green-500 mt-2">{overallPerformance?.highest_score.toFixed(1)}%</p>
        </div>
      </div>

      {/* Performance Analysis */}
      <div className="mb-8">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Performance Analysis</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-lg font-semibold text-green-600 dark:text-green-400 mb-3">Topics You Perform Well In</h4>
            <div className="space-y-4">
              {strongTopics.length > 0 ? (
                strongTopics.map(topic => (
                  <div key={topic.subject} className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex items-center gap-4">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    <div>
                      <p className="font-semibold text-gray-800 dark:text-white">{topic.subject}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Average Score: {topic.average_score.toFixed(1)}%</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No strong topics identified yet. Keep practicing!</p>
              )}
            </div>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-3">Topics to Improve</h4>
            <div className="space-y-4">
              {weakTopics.length > 0 ? (
                weakTopics.map(topic => (
                  <div key={topic.subject} className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                    <div className="flex items-center gap-4 mb-2">
                      <Zap className="w-6 h-6 text-red-500" />
                      <div>
                        <p className="font-semibold text-gray-800 dark:text-white">{topic.subject}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Average Score: {topic.average_score.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="border-t border-red-200 dark:border-red-800 pt-2 mt-2">
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Tips to improve:</p>
                      <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        {(improvementTips[topic.subject] || improvementTips.default).map((tip, i) => (
                          <li key={i}>{tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">No specific areas for improvement identified right now. Great job!</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Overall Performance Pie Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Quiz Distribution by Category</h3>
          {categoryDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryDistribution}
                  dataKey="quiz_count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value, name) => [`${value} quizzes`, name]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No quiz data available yet.
            </div>
          )}
        </div>

        {/* Performance by Subject */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Performance by Subject</h3>
          {performanceBySubject.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={performanceBySubject}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" label={{ value: 'Average Score (%)', angle: -90, position: 'insideLeft' }} />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" label={{ value: 'Quiz Count', angle: -90, position: 'insideRight' }} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="average_score" fill="#8884d8" name="Average Score" />
                <Bar yAxisId="right" dataKey="quiz_count" fill="#82ca9d" name="Quizzes Taken" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Complete quizzes to see subject performance.
            </div>
          )}
        </div>

        {/* User Progress Rate Chart */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm col-span-1 xl:col-span-2">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-200 mb-4">Recent Quiz Performance</h3>
          {userProgress.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={userProgress}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="score" stroke="#8884d8" activeDot={{ r: 8 }} name="Quiz Score" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              Track your progress by taking more quizzes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerformanceDashboard;
