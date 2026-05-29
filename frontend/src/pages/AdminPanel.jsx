import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('users');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    fetchUsers();
    fetchReports();
    fetchStats();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/users`);
      setUsers(res.data);
    } catch (error) {
      toast.error('Failed to fetch users');
    }
  };

  const fetchReports = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/reports`);
      setReports(res.data);
    } catch (error) {
      toast.error('Failed to fetch reports');
    }
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/admin/stats`);
      setStats(res.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleBanUser = async (userId) => {
    if (confirm('Are you sure you want to ban this user?')) {
      try {
        await axios.post(`${import.meta.env.VITE_API_URL}/admin/ban-user`, { userId });
        toast.success('User banned successfully');
        fetchUsers();
      } catch (error) {
        toast.error('Failed to ban user');
      }
    }
  };

  const handleUnbanUser = async (userId) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/unban-user`, { userId });
      toast.success('User unbanned successfully');
      fetchUsers();
    } catch (error) {
      toast.error('Failed to unban user');
    }
  };

  const handleResolveReport = async (reportId, action) => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/admin/resolve-report`, { reportId, action });
      toast.success('Report resolved');
      fetchReports();
    } catch (error) {
      toast.error('Failed to resolve report');
    }
  };

  // Theme classes
  const pageBg = isDark ? 'bg-[#0a0a0a]' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white';
  const titleColor = isDark ? 'text-white' : 'text-gray-800';
  const statLabel = isDark ? 'text-gray-400' : 'text-gray-500';
  const statValue = isDark ? 'text-white' : 'text-gray-800';
  const tabInactive = isDark ? 'text-gray-400 hover:text-pink-400' : 'text-gray-600 hover:text-pink-500';
  const tabActive = 'border-b-2 border-pink-500 text-pink-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const theadBg = isDark ? 'bg-gray-700' : 'bg-gray-50';
  const theadText = isDark ? 'text-gray-300' : 'text-gray-500';
  const tbodyDivider = isDark ? 'divide-gray-700' : 'divide-gray-200';
  const rowText = isDark ? 'text-gray-200' : 'text-gray-900';
  const rowSubText = isDark ? 'text-gray-400' : 'text-gray-600';
  const reportCardBg = isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white';
  const reportTitle = isDark ? 'text-white' : 'text-gray-800';
  const reportText = isDark ? 'text-gray-300' : 'text-gray-700';
  const reportSubText = isDark ? 'text-gray-400' : 'text-gray-500';
  const emptyBg = isDark ? 'bg-gray-800' : 'bg-white';
  const emptyText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderTop = isDark ? 'border-gray-700' : 'border-gray-200';

  // Stats cards data
  const statsCards = [
    { label: 'Total Users', value: stats?.totalusers, icon: '👥', color: 'from-blue-500 to-cyan-500' },
    { label: 'Premium Users', value: stats?.premiumusers, icon: '⭐', color: 'from-yellow-500 to-amber-500' },
    { label: 'Banned Users', value: stats?.bannedusers, icon: '🚫', color: 'from-red-500 to-rose-500' },
    { label: 'Pending Reports', value: stats?.pendingreports, icon: '📋', color: 'from-orange-500 to-amber-500' },
    { label: 'Total Matches', value: stats?.totalmatches, icon: '💕', color: 'from-pink-500 to-rose-500' },
    { label: 'Total Revenue', value: stats?.totalrevenue, icon: '💰', color: 'from-green-500 to-emerald-500', isCurrency: true },
  ];

  return (
    <div className={`min-h-screen ${pageBg} transition-colors duration-300`}>
      <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5 sm:mb-8">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-bold ${titleColor}`}>Admin Dashboard</h1>
            <p className={`text-sm ${statLabel} mt-0.5`}>Manage users, reports, and view statistics</p>
          </div>
          {stats && (
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${isDark ? 'bg-gray-800 text-gray-400 border border-gray-700' : 'bg-gray-100 text-gray-600'}`}>
              {stats.totalusers} total users
            </div>
          )}
        </div>
        
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3 lg:gap-4 mb-5 sm:mb-8">
            {statsCards.map((card, idx) => (
              <div key={idx} className={`${cardBg} rounded-xl shadow-sm hover:shadow-md transition-all duration-200 p-3 sm:p-4 relative overflow-hidden group`}>
                <div className={`absolute top-0 right-0 w-16 h-16 bg-gradient-to-br ${card.color} opacity-10 rounded-bl-3xl group-hover:opacity-20 transition-opacity`}></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-base sm:text-lg">{card.icon}</span>
                    <p className={`text-[10px] sm:text-xs font-medium ${statLabel} truncate`}>{card.label}</p>
                  </div>
                  <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${statValue}`}>
                    {card.isCurrency ? '$' : ''}{card.value?.toLocaleString() || 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Tabs */}
        <div className={`flex gap-1 sm:gap-4 mb-5 sm:mb-6 border-b ${borderColor} overflow-x-auto scrollbar-hide`}>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm transition whitespace-nowrap ${
              activeTab === 'users' ? tabActive : tabInactive
            }`}
          >
            👥 Users Management
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-3 sm:px-4 py-2.5 sm:py-3 font-semibold text-xs sm:text-sm transition whitespace-nowrap ${
              activeTab === 'reports' ? tabActive : tabInactive
            }`}
          >
            📋 Reports
            {reports.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-pink-500 text-white">
                {reports.length}
              </span>
            )}
          </button>
        </div>
        
        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className={`${cardBg} rounded-xl shadow-sm overflow-hidden`}>
            {/* Mobile Card View */}
            <div className="block sm:hidden divide-y divide-gray-700">
              {users.map(user => (
                <div key={user.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`font-medium text-sm ${rowText}`}>{user.name}</p>
                      <p className={`text-xs ${rowSubText}`}>{user.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{user.age}y</span>
                      {user.is_banned ? (
                        <span className="px-2 py-0.5 text-[10px] bg-red-500/20 text-red-400 rounded-full">Banned</span>
                      ) : (
                        <span className="px-2 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full">Active</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    {user.is_banned ? (
                      <button onClick={() => handleUnbanUser(user.id)} className="text-green-400 hover:text-green-300 text-xs font-medium px-3 py-1 rounded-full bg-green-500/10 hover:bg-green-500/20 transition">
                        Unban
                      </button>
                    ) : (
                      <button onClick={() => handleBanUser(user.id)} className="text-red-400 hover:text-red-300 text-xs font-medium px-3 py-1 rounded-full bg-red-500/10 hover:bg-red-500/20 transition">
                        Ban
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full">
                <thead className={theadBg}>
                  <tr>
                    <th className={`px-4 lg:px-6 py-3 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider ${theadText}`}>User</th>
                    <th className={`px-4 lg:px-6 py-3 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider ${theadText}`}>Email</th>
                    <th className={`px-4 lg:px-6 py-3 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider ${theadText}`}>Age</th>
                    <th className={`px-4 lg:px-6 py-3 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider ${theadText}`}>Status</th>
                    <th className={`px-4 lg:px-6 py-3 text-left text-[10px] sm:text-xs font-medium uppercase tracking-wider ${theadText}`}>Actions</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${tbodyDivider}`}>
                  {users.map(user => (
                    <tr key={user.id} className={`${isDark ? 'hover:bg-gray-700/50' : 'hover:bg-gray-50'} transition-colors`}>
                      <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                        <div className={`font-medium text-sm ${rowText}`}>{user.name}</div>
                      </td>
                      <td className={`px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-sm ${rowSubText}`}>{user.email}</td>
                      <td className={`px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap text-sm ${rowSubText}`}>{user.age}</td>
                      <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                        {user.is_banned ? (
                          <span className="px-2.5 py-1 text-[10px] sm:text-xs bg-red-500/20 text-red-400 rounded-full font-medium">Banned</span>
                        ) : (
                          <span className="px-2.5 py-1 text-[10px] sm:text-xs bg-green-500/20 text-green-400 rounded-full font-medium">Active</span>
                        )}
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-4 whitespace-nowrap">
                        {user.is_banned ? (
                          <button onClick={() => handleUnbanUser(user.id)} className="text-green-400 hover:text-green-300 text-xs sm:text-sm font-semibold transition px-3 py-1.5 rounded-lg hover:bg-green-500/10">
                            Unban
                          </button>
                        ) : (
                          <button onClick={() => handleBanUser(user.id)} className="text-red-400 hover:text-red-300 text-xs sm:text-sm font-semibold transition px-3 py-1.5 rounded-lg hover:bg-red-500/10">
                            Ban
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {users.length === 0 && (
              <div className="text-center py-12">
                <p className={emptyText}>No users found</p>
              </div>
            )}
          </div>
        )}
        
        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-3 sm:space-y-4">
            {reports.length === 0 ? (
              <div className={`text-center py-12 sm:py-16 ${emptyBg} rounded-xl`}>
                <div className="text-4xl mb-3">📋</div>
                <p className={`text-sm ${emptyText}`}>No pending reports</p>
              </div>
            ) : (
              reports.map(report => (
                <div key={report.id} className={`${reportCardBg} rounded-xl shadow-sm p-4 sm:p-6 transition-all hover:shadow-md`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className={`font-semibold text-base sm:text-lg ${reportTitle}`}>Report #{report.id}</h3>
                        <span className="px-2 py-0.5 text-[10px] bg-orange-500/20 text-orange-400 rounded-full font-medium">Pending</span>
                      </div>
                      <p className={`text-xs sm:text-sm ${reportSubText}`}>
                        Reported by: <span className="font-medium">{report.reporter_name}</span> • {new Date(report.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleResolveReport(report.id, 'ban')}
                        className="px-3 sm:px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-xs sm:text-sm font-medium transition active:scale-95 shadow-sm"
                      >
                        Ban User
                      </button>
                      <button
                        onClick={() => handleResolveReport(report.id, 'dismiss')}
                        className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition active:scale-95 shadow-sm ${
                          isDark ? 'bg-gray-600 hover:bg-gray-500 text-white' : 'bg-gray-500 hover:bg-gray-600 text-white'
                        }`}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                  <div className={`border-t ${borderTop} pt-3 sm:pt-4 space-y-2`}>
                    <p className={`text-sm ${reportText}`}>
                      <span className="font-semibold">Reported User:</span> {report.reported_name}
                    </p>
                    <p className={`text-sm ${reportText}`}>
                      <span className="font-semibold">Reason:</span> {report.reason || 'No reason provided'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}