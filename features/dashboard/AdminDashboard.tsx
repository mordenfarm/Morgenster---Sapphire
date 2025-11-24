import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Settings, Activity, ShieldAlert, Database, HeartPulse, BedDouble, LogOut, Search, Mail, Briefcase, Phone, Calendar, Hash, ArrowRight, Bell } from 'lucide-react';
import { db } from '../../services/firebase';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
import { UserProfile, Patient, Ward } from '../../types';
import { useAuth } from '../../context/AuthContext';
import BedOccupancy from './BedOccupancy';
import WardDetailsModal from './WardDetailsModal';
import UserActivityModal from '../admin/UserActivityModal';

interface AdminStats {
  totalUsers: number;
  allUsers: UserProfile[];
  admittedPatientsCount: number;
  allPatients: Patient[];
  pendingDischarge: number;
  recentNotifications: any[];
}

const AdminDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    allUsers: [],
    admittedPatientsCount: 0,
    allPatients: [],
    pendingDischarge: 0,
    recentNotifications: []
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);
  const [isActivityModalOpen, setActivityModalOpen] = useState(false);
  const [selectedUserForActivity, setSelectedUserForActivity] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        // Parallel fetching
        const usersPromise = db.collection('users').get();
        const patientsPromise = db.collection('patients').get();
        
        // Fetch notifications specifically for this admin/user
        const notificationsPromise = db.collection('notifications')
            .where('recipientId', '==', currentUser.uid)
            .limit(20) 
            .get();

        const [usersSnap, patientsSnap, notifSnap] = await Promise.all([
          usersPromise,
          patientsPromise,
          notificationsPromise
        ]);

        // Process Users
        const allUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
        
        // Process Patients
        const allPatients = patientsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        let admittedPatientsCount = 0;
        let pendingDischargeCount = 0;

        allPatients.forEach(p => {
             if (p.status === 'Admitted') admittedPatientsCount++;
             if (p.status === 'PendingDischarge') pendingDischargeCount++;
        });

        // Client-side sorting for notifications
        const notifications = notifSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
        notifications.sort((a, b) => {
             const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
             const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
             return dateB - dateA;
        });

        setStats({
          totalUsers: usersSnap.size,
          allUsers,
          admittedPatientsCount,
          allPatients,
          pendingDischarge: pendingDischargeCount,
          recentNotifications: notifications.slice(0, 5)
        });

      } catch (error) {
        console.error("Error fetching admin stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentUser]);

  const filteredData = stats.allUsers.filter(user => 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.surname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.department.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleViewActivity = (user: UserProfile) => {
    setSelectedUserForActivity(user);
    setActivityModalOpen(true);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
        {/* Welcome Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <h2 className="text-2xl font-bold text-white">Admin Dashboard</h2>
                <p className="text-gray-400">Monitor system status and manage resources.</p>
            </div>
        </div>
        
        {/* Quick Actions */}
        <div className="bg-[#161B22] border border-gray-700 p-6 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 <Link to="/admin/users" className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex flex-col items-center justify-center text-center gap-2 group">
                    <Users className="text-sky-400 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm text-gray-300 font-medium">Manage Users</span>
                 </Link>
                 <Link to="/accounts/patients" className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex flex-col items-center justify-center text-center gap-2 group">
                    <HeartPulse className="text-green-400 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm text-gray-300 font-medium">Manage Patients</span>
                 </Link>
                 <Link to="/settings" className="p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex flex-col items-center justify-center text-center gap-2 group">
                    <Settings className="text-purple-400 group-hover:scale-110 transition-transform" size={24} />
                    <span className="text-sm text-gray-300 font-medium">System Settings</span>
                 </Link>
                 <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg flex flex-col items-center justify-center text-center gap-2 opacity-75">
                     <Database className="text-gray-400" size={24} />
                     <span className="text-sm text-gray-300 font-medium">Data Backups</span>
                 </div>
            </div>
        </div>

        {/* Live Bed Occupancy */}
        <div>
            <h3 className="text-lg font-semibold text-white mb-3">Live Bed Occupancy</h3>
            <BedOccupancy onWardClick={setSelectedWard} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dynamic List Container (System Users) */}
            <div className="lg:col-span-2 bg-[#161B22] border border-gray-700 p-6 rounded-xl shadow-sm h-full flex flex-col transition-all duration-300">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Users size={20} className="text-sky-400" />
                        System Users
                        <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full">{stats.totalUsers}</span>
                    </h3>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                            type="text" 
                            placeholder={"Filter users..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                        />
                    </div>
                </div>
                
                <div className="flex-1 overflow-hidden rounded-lg border border-gray-700/50">
                    <div className="overflow-y-auto max-h-[400px]">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-800/50 sticky top-0 backdrop-blur-sm">
                                <tr>
                                    <th className="p-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-700">Name</th>
                                    <th className="p-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-700">Role</th>
                                    <th className="p-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-700 hidden sm:table-cell">Department</th>
                                    <th className="p-3 text-xs font-medium text-gray-400 uppercase tracking-wider border-b border-gray-700 hidden md:table-cell">Email</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {filteredData.length > 0 ? (
                                    filteredData.map((item: UserProfile) => (
                                        <tr 
                                            key={item.id} 
                                            className="hover:bg-gray-800/30 transition-colors group cursor-pointer"
                                            onClick={() => handleViewActivity(item)}
                                        >
                                            <td className="p-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-sky-900/50 flex items-center justify-center text-sky-400 font-semibold text-xs border border-sky-800">
                                                        {item.name.charAt(0)}{item.surname.charAt(0)}
                                                    </div>
                                                    <span className="font-medium text-gray-200">{item.name} {item.surname}</span>
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-800 text-sky-300 border border-gray-700">
                                                    {item.role}
                                                </span>
                                            </td>
                                            <td className="p-3 text-sm text-gray-400 hidden sm:table-cell">
                                                <div className="flex items-center gap-2">
                                                    <Briefcase size={14} className="text-gray-600" />
                                                    {item.department}
                                                </div>
                                            </td>
                                            <td className="p-3 text-sm text-gray-500 hidden md:table-cell font-mono text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Mail size={14} className="text-gray-600" />
                                                    {item.email}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-gray-500">
                                            No users found matching "{searchQuery}"
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Recent Notifications */}
            <div className="bg-[#161B22] border border-gray-700 p-6 rounded-xl shadow-sm">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-white">My Notifications</h3>
                     <Link to="/notifications" className="text-xs text-sky-500 hover:underline">View All</Link>
                </div>
                {stats.recentNotifications.length > 0 ? (
                    <div className="space-y-3">
                        {stats.recentNotifications.map((notif: any) => (
                            <div key={notif.id} className={`flex gap-3 p-3 bg-gray-800/30 border ${notif.read ? 'border-gray-700/50' : 'border-sky-900/50 bg-sky-900/10'} rounded-lg items-start`}>
                                <Bell className={`${notif.read ? 'text-gray-500' : 'text-sky-500'} flex-shrink-0 mt-0.5`} size={16} />
                                <div>
                                    <p className={`text-sm font-medium ${notif.read ? 'text-gray-400' : 'text-gray-200'}`}>{notif.title}</p>
                                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{notif.message}</p>
                                    <p className="text-[10px] text-gray-600 mt-1">
                                        {notif.createdAt?.toDate ? notif.createdAt.toDate().toLocaleString() : 'Just now'}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6 text-gray-500 bg-gray-800/30 rounded-lg">
                        <Bell className="mx-auto mb-2 opacity-50" size={24} />
                        <p className="text-sm">No recent notifications.</p>
                    </div>
                )}
            </div>
        </div>
        {selectedWard && <WardDetailsModal ward={selectedWard} onClose={() => setSelectedWard(null)} />}
        
        {selectedUserForActivity && (
            <UserActivityModal 
                isOpen={isActivityModalOpen} 
                onClose={() => setActivityModalOpen(false)} 
                user={selectedUserForActivity} 
            />
        )}
    </div>
  );
};

export default AdminDashboard;
