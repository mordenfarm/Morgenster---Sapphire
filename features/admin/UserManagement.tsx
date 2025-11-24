
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../services/firebase';
import { UserProfile } from '../../types';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
import { Edit, Trash2, Send, Plus, Search, Mail, Building, Key, MessageSquare } from 'lucide-react';
import AddUserModal from './AddUserModal';
import EditUserModal from './EditUserModal';
import SendMessageModal from './SendMessageModal';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../../components/utils/Modal';
import ResetPasswordModal from './ResetPasswordModal';
import { useNavigate } from 'react-router-dom';
import { getOrCreateChat } from '../../services/chatService';
import { useAuth } from '../../context/AuthContext';
import UserActivityModal from './UserActivityModal';


const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isAddModalOpen, setAddModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [isSendModalOpen, setSendModalOpen] = useState(false);
  const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isResetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [isActivityModalOpen, setActivityModalOpen] = useState(false);


  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const { addNotification } = useNotification();
  const navigate = useNavigate();
  const { userProfile: currentUserProfile } = useAuth();


  const fetchUsers = async () => {
    setLoading(true);
    try {
      const usersCollection = db.collection('users');
      const userSnapshot = await usersCollection.orderBy('name').get();
      const userList = userSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      setUsers(userList);
    } catch (error) {
      console.error("Error fetching users:", error);
      addNotification('Failed to fetch users.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    return users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.surname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, users]);

  const handleEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setEditModalOpen(true);
  };

  const handleSendMessage = (user: UserProfile) => {
    setSelectedUser(user);
    setSendModalOpen(true);
  };
  
  const handleDelete = (user: UserProfile) => {
    setSelectedUser(user);
    setDeleteModalOpen(true);
  };

  const handleResetPassword = (user: UserProfile) => {
    setSelectedUser(user);
    setResetPasswordModalOpen(true);
  };
  
  const handleViewActivity = (user: UserProfile) => {
    setSelectedUser(user);
    setActivityModalOpen(true);
  };

  const handleStartChat = async (user: UserProfile) => {
    if (!currentUserProfile) {
        addNotification('You must be logged in to start a chat.', 'error');
        return;
    }
    if (currentUserProfile.id === user.id) {
        addNotification("You can't message yourself.", "warning");
        return;
    }
    try {
        const chatId = await getOrCreateChat(currentUserProfile.id, user.id);
        navigate(`/messages/${chatId}`);
    } catch (error) {
        console.error("Error starting chat:", error);
        addNotification('Could not start chat session.', 'error');
    }
  }

  const confirmDelete = async () => {
    if (!selectedUser) return;
    try {
      // Note: This only deletes the user profile from Firestore.
      // The Firebase Auth user is not deleted, as this requires admin privileges
      // or re-authentication, best handled by a cloud function in production.
      await db.collection('users').doc(selectedUser.id).delete();
      addNotification('User deleted successfully.', 'success');
      setDeleteModalOpen(false);
      setSelectedUser(null);
      fetchUsers(); // Refetch users
    } catch (error) {
      console.error("Error deleting user:", error);
      addNotification('Failed to delete user.', 'error');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white">User Management</h1>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <button onClick={() => setAddModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
            <Plus size={18} />
            <span className="hidden sm:inline">Add User</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map(user => (
          <div key={user.id} className="bg-[#161B22] border border-gray-700 rounded-lg shadow-md flex flex-col justify-between p-6 transition-all hover:shadow-sky-500/20 hover:border-sky-700">
            <div
              className="cursor-pointer"
              onClick={() => handleViewActivity(user)}
              aria-label={`View activity for ${user.name}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{user.name} {user.surname}</h3>
                  <p className="text-sky-400 text-sm">{user.role}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-400">
                 <p className="flex items-center"><Mail size={14} className="mr-3 text-gray-500" /> {user.email}</p>
                 <p className="flex items-center"><Building size={14} className="mr-3 text-gray-500" /> {user.department}</p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2 mt-6 pt-4 border-t border-gray-700">
              <button onClick={() => handleSendMessage(user)} className="p-2 text-gray-400 hover:text-green-500" aria-label={`Send message to ${user.name}`}><Send size={18} /></button>
              <button onClick={() => handleStartChat(user)} className="p-2 text-gray-400 hover:text-blue-500" aria-label={`Message ${user.name}`}><MessageSquare size={18} /></button>
              <button onClick={() => handleResetPassword(user)} className="p-2 text-gray-400 hover:text-yellow-500" aria-label={`Reset password for ${user.name}`}><Key size={18} /></button>
              <button onClick={() => handleEdit(user)} className="p-2 text-gray-400 hover:text-sky-500" aria-label={`Edit ${user.name}`}><Edit size={18} /></button>
              <button onClick={() => handleDelete(user)} className="p-2 text-gray-400 hover:text-red-500" aria-label={`Delete ${user.name}`}><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>

      <AddUserModal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} onUserAdded={fetchUsers} />
      {selectedUser && <EditUserModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} user={selectedUser} onUserUpdated={fetchUsers} />}
      {selectedUser && <SendMessageModal isOpen={isSendModalOpen} onClose={() => setSendModalOpen(false)} recipient={selectedUser} />}
      {selectedUser && <ResetPasswordModal isOpen={isResetPasswordModalOpen} onClose={() => setResetPasswordModalOpen(false)} userToReset={selectedUser} />}
      {selectedUser && <UserActivityModal isOpen={isActivityModalOpen} onClose={() => setActivityModalOpen(false)} user={selectedUser} />}
      
      <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirm Delete">
        <p className="text-gray-400">Are you sure you want to delete {selectedUser?.name} {selectedUser?.surname}? This action cannot be undone.</p>
        <div className="mt-6 flex justify-end space-x-4">
          <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
          <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete User</button>
        </div>
      </Modal>

    </div>
  );
};

export default UserManagement;