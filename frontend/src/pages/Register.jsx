import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    age: 18,
    gender: '',
    interestedIn: ''
  });
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const ageNum = parseInt(formData.age, 10);
    
    if (isNaN(ageNum) || ageNum < 18) {
      toast.error('Please enter a valid age (18 or older)');
      return;
    }
    
    if (!formData.name.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (!formData.email.trim()) {
      toast.error('Please enter your email');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setLoading(true);
    
    const dataToSend = {
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      password: formData.password,
      age: ageNum,
      gender: formData.gender || null,
      interestedIn: formData.interestedIn || null
    };
    
    try {
      await register(dataToSend);
      toast.success('Account created successfully!');
      navigate('/');
    } catch (error) {
      console.error('Registration error:', error);
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
          <div className="text-4xl sm:text-5xl mb-3">🌸</div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Create Account
          </h1>
          <p className={`mt-2 text-sm ${subtitleColor}`}>Join our community</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-3.5 sm:space-y-4">
          {/* Name */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
              placeholder="Your name"
              required
            />
          </div>
          
          {/* Email */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
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
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
              placeholder="Min 6 characters"
              required
              minLength={6}
            />
          </div>
          
          {/* Age */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Age (18+)</label>
            <input
              type="number"
              value={formData.age}
              onChange={(e) => setFormData({...formData, age: parseInt(e.target.value, 10)})}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
              placeholder="18"
              required
              min="18"
              max="120"
            />
          </div>
          
          {/* Gender */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Gender</label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({...formData, gender: e.target.value})}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          {/* Interested In */}
          <div>
            <label className={`block mb-1.5 text-sm font-medium ${labelColor}`}>Interested In</label>
            <select
              value={formData.interestedIn}
              onChange={(e) => setFormData({...formData, interestedIn: e.target.value})}
              className={`w-full px-4 py-2.5 rounded-xl transition text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent ${inputBorder}`}
            >
              <option value="">Select</option>
              <option value="male">Men</option>
              <option value="female">Women</option>
              <option value="both">Both</option>
            </select>
          </div>
          
          {/* Submit Button */}
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
                Creating account...
              </span>
            ) : 'Sign Up'}
          </button>
        </form>
        
        {/* Footer */}
        <p className={`text-center text-sm mt-6 ${footerText}`}>
          Already have an account?{' '}
          <Link to="/login" className={`${linkColor} font-semibold hover:underline transition`}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}