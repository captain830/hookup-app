import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import SetupProfile from './pages/SetupProfile';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import Matches from './pages/Matches';
import Messages from './pages/Messages';
import AdminPanel from './pages/AdminPanel';
import Chats from './pages/Chats';
import CallModal from './components/CallModal';
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProfileRequiredRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }
  
  if (!user) return <Navigate to="/login" />;
  if (!user.profile_completed) return <Navigate to="/setup-profile" />;
  
  return children;
};

function AppContent() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [globalIncomingCall, setGlobalIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) return;
    
    const newSocket = io(SOCKET_URL);
    setSocket(newSocket);
    
    newSocket.on('incoming-call', (call) => {
      console.log('Global incoming call:', call);
      setGlobalIncomingCall(call);
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  // Apply theme to body background
  useEffect(() => {
    document.body.style.backgroundColor = theme === 'dark' ? '#111827' : '#f9fafb';
  }, [theme]);

  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      {user && user.profile_completed && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/setup-profile" element={<PrivateRoute><SetupProfile /></PrivateRoute>} />
        <Route path="/" element={<ProfileRequiredRoute><Dashboard /></ProfileRequiredRoute>} />
        <Route path="/chats" element={<ProfileRequiredRoute><Chats /></ProfileRequiredRoute>} />
        <Route path="/profile" element={<ProfileRequiredRoute><Profile /></ProfileRequiredRoute>} />
        <Route path="/matches" element={<ProfileRequiredRoute><Matches /></ProfileRequiredRoute>} />
        <Route path="/messages/:userId" element={<ProfileRequiredRoute><Messages /></ProfileRequiredRoute>} />
        <Route path="/admin" element={<PrivateRoute adminOnly><AdminPanel /></PrivateRoute>} />
      </Routes>
      
      {globalIncomingCall && user && (
        <CallModal
          isVideo={globalIncomingCall.isVideo}
          onClose={() => setGlobalIncomingCall(null)}
          otherUserId={globalIncomingCall.from}
          otherUserName={globalIncomingCall.fromName || 'User'}
          otherUserPhoto={null}
          currentUserId={user.id}
          isIncoming={true}
          incomingSignal={globalIncomingCall.signal}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <AppContent />
            <Toaster position="top-right" toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
                borderRadius: '12px',
              },
            }} />
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;