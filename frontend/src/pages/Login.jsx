import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (error) {
      // Error handled in auth context
    } finally {
      setLoading(false);
    }
  };

  // Theme classes
  const cardBg = isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white';
  const labelColor = isDark ? 'text-gray-200' : 'text-gray-700';
  const inputBorder = isDark ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400' : 'border-gray-300 bg-white text-gray-800';
  const subtitleColor = isDark ? 'text-gray-400' : 'text-gray-600';
  const linkColor = isDark ? 'text-pink-400 hover:text-pink-300' : 'text-pink-500 hover:text-pink-600';
  const footerText = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className={`min-h-screen transition-colors duration-300 flex items-center justify-center p-4 ${
      theme === 'dark' 
        ? 'bg-gradient-to-br from-gray-900 to-gray-800' 
        : 'bg-gradient-to-br from-pink-100 to-purple-100'
    }`}>
      <div className={`${cardBg} rounded-2xl shadow-xl max-w-md w-full p-6 sm:p-8 transition-colors duration-300`}>
        
        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-4xl sm:text-5xl mb-3">❤️</div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className={`mt-2 text-sm ${subtitleColor}`}>Sign in to continue</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {/* Email */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
              placeholder="you@example.com"
              required
            />
          </div>
          
          {/* Password */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
              placeholder="Enter your password"
              required
            />
          </div>
          
          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white py-2.5 sm:py-3 rounded-xl font-semibold text-sm hover:opacity-90 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Signing in...
              </span>
            ) : 'Sign In'}
          </button>
        </form>
        
        <p className={`text-center text-sm mt-6 ${footerText}`}>
          Don't have an account?{' '}
          <Link to="/register" className={`${linkColor} font-semibold hover:underline transition`}>
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}