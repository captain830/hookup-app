import { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

export default function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('users');

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

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Admin Dashboard</h1>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-500 text-sm">Total Users</p>
            <p className="text-2xl font-bold">{stats.totalusers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-500 text-sm">Premium Users</p>
            <p className="text-2xl font-bold">{stats.premiumusers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-500 text-sm">Banned Users</p>
            <p className="text-2xl font-bold">{stats.bannedusers}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-500 text-sm">Pending Reports</p>
            <p className="text-2xl font-bold">{stats.pendingreports}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-500 text-sm">Total Matches</p>
            <p className="text-2xl font-bold">{stats.totalmatches}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-gray-500 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold">${stats.totalrevenue}</p>
          </div>
        </div>
      )}
      
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'users'
              ? 'border-b-2 border-pink-500 text-pink-500'
              : 'text-gray-600 hover:text-pink-500'
          }`}
        >
          Users Management
        </button>
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-4 py-2 font-semibold transition ${
            activeTab === 'reports'
              ? 'border-b-2 border-pink-500 text-pink-500'
              : 'text-gray-600 hover:text-pink-500'
          }`}
        >
          Reports
        </button>
      </div>
      
      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Age</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{user.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600">{user.age}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_banned ? (
                      <span className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded-full">Banned</span>
                    ) : (
                      <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">Active</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.is_banned ? (
                      <button
                        onClick={() => handleUnbanUser(user.id)}
                        className="text-green-600 hover:text-green-800 text-sm font-semibold"
                      >
                        Unban
                      </button>
                    ) : (
                      <button
                        onClick={() => handleBanUser(user.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                      >
                        Ban
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="text-center py-8 bg-white rounded-lg">
              <p className="text-gray-500">No pending reports</p>
            </div>
          ) : (
            reports.map(report => (
              <div key={report.id} className="bg-white rounded-lg shadow-md p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">Report #{report.id}</h3>
                    <p className="text-sm text-gray-500">
                      Reported by: {report.reporter_name} • {new Date(report.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolveReport(report.id, 'ban')}
                      className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition text-sm"
                    >
                      Ban User
                    </button>
                    <button
                      onClick={() => handleResolveReport(report.id, 'dismiss')}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition text-sm"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
                <div className="border-t pt-4">
                  <p className="text-gray-700">
                    <span className="font-semibold">Reported User:</span> {report.reported_name}
                  </p>
                  <p className="text-gray-700 mt-2">
                    <span className="font-semibold">Reason:</span> {report.reason || 'No reason provided'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}