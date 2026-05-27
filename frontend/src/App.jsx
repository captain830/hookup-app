import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Protected route that checks if profile is completed
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
  
  // If user hasn't completed profile, redirect to setup page
  if (!user.profile_completed) {
    return <Navigate to="/setup-profile" />;
  }
  
  return children;
};

function AppContent() {
  const { user } = useAuth();
  const [globalIncomingCall, setGlobalIncomingCall] = useState(null);
  const [socket, setSocket] = useState(null);

  // Setup socket for global incoming calls
  useEffect(() => {
    if (!user) return;
    
    const newSocket = io('http://localhost:5000');
    setSocket(newSocket);
    
    newSocket.on('incoming-call', (call) => {
      console.log('Global incoming call:', call);
      setGlobalIncomingCall(call);
    });
    
    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <>
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
      
      {/* Global Incoming Call Modal */}
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
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppContent />
          <Toaster position="top-right" toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
              borderRadius: '12px',
            },
            success: {
              iconTheme: {
                primary: '#10B981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#EF4444',
                secondary: '#fff',
              },
            },
          }} />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;