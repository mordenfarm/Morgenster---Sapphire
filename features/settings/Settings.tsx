import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { db, auth } from '../../services/firebase';
import { Role } from '../../types';
import firebase from 'firebase/compat/app';

const Settings: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const { addNotification } = useNotification();
  
  const [formData, setFormData] = useState({ name: '', surname: '', phone: '', address: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        surname: userProfile.surname || '',
        phone: userProfile.phone || '',
        address: userProfile.address || ''
      });
    }
  }, [userProfile]);
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      addNotification('You must be logged in to update your profile.', 'error');
      return;
    }
    setProfileLoading(true);
    try {
      const userDocRef = db.collection('users').doc(currentUser.uid);
      await userDocRef.update({ ...formData });
      addNotification('Profile updated successfully!', 'success');
    } catch (error) {
      console.error("Error updating profile: ", error);
      addNotification('Failed to update profile.', 'error');
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) {
      addNotification('You must be logged in.', 'error');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      addNotification('New passwords do not match.', 'warning');
      return;
    }
    if (passwordData.newPassword.length < 6) {
        addNotification('Password should be at least 6 characters long.', 'warning');
        return;
    }

    setPasswordLoading(true);
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email!, passwordData.currentPassword);
        await currentUser.reauthenticateWithCredential(credential);

        await currentUser.updatePassword(passwordData.newPassword);
        
        // Send notification to all admins
        const adminsSnapshot = await db.collection('users').where('role', '==', Role.Admin).get();
        if (!adminsSnapshot.empty) {
            const batch = db.batch();
            adminsSnapshot.forEach(adminDoc => {
                const notificationRef = db.collection('notifications').doc();
                batch.set(notificationRef, {
                    recipientId: adminDoc.id,
                    senderId: userProfile.id,
                    senderName: `${userProfile.name} ${userProfile.surname}`,
                    title: 'User Password Changed',
                    message: `User ${userProfile.name} ${userProfile.surname} (${userProfile.role}) has updated their password.`,
                    type: 'password_change',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    read: false,
                });
            });
            await batch.commit();
        }

        addNotification('Password updated successfully!', 'success');
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

    } catch (error: any) {
        console.error("Error updating password: ", error);
        let message = 'Failed to update password.';
        if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            message = 'Incorrect current password.';
        }
        addNotification(message, 'error');
    } finally {
        setPasswordLoading(false);
    }
  }

  if (!userProfile) {
    return <div className="text-white">Loading profile...</div>;
  }

  const inputStyles = "mt-1 block w-full rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 px-4 py-3";

  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
      
      {/* Profile Settings */}
      <div className="bg-[#161B22] border border-gray-700 p-8 rounded-lg shadow-md max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-white mb-2">Update Your Profile</h2>
        <p className="text-sm text-gray-400 mb-6">This information can be seen by administrators.</p>
        <form onSubmit={handleProfileSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300">First Name</label>
              <input type="text" name="name" id="name" value={formData.name} onChange={handleProfileChange} className={inputStyles} />
            </div>
            <div>
              <label htmlFor="surname" className="block text-sm font-medium text-gray-300">Last Name</label>
              <input type="text" name="surname" id="surname" value={formData.surname} onChange={handleProfileChange} className={inputStyles} />
            </div>
          </div>
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-300">Phone Number</label>
            <input type="tel" name="phone" id="phone" value={formData.phone} onChange={handleProfileChange} className={inputStyles} />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-300">Address</label>
            <textarea name="address" id="address" rows={3} value={formData.address} onChange={handleProfileChange} className={inputStyles as any}></textarea>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={profileLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 disabled:bg-sky-800 disabled:cursor-not-allowed">
              {profileLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Settings */}
      <div className="bg-[#161B22] border border-gray-700 p-8 rounded-lg shadow-md max-w-3xl mx-auto mt-8">
        <h2 className="text-xl font-semibold text-white mb-2">Change Password</h2>
        <p className="text-sm text-gray-400 mb-6">Choose a strong password that you're not using anywhere else.</p>
        <form onSubmit={handlePasswordSubmit} className="space-y-6">
           <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-300">Current Password</label>
              <input type="password" name="currentPassword" id="currentPassword" value={passwordData.currentPassword} onChange={handlePasswordChange} required className={inputStyles} />
            </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-300">New Password</label>
              <input type="password" name="newPassword" id="newPassword" value={passwordData.newPassword} onChange={handlePasswordChange} required className={inputStyles} />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">Confirm New Password</label>
              <input type="password" name="confirmPassword" id="confirmPassword" value={passwordData.confirmPassword} onChange={handlePasswordChange} required className={inputStyles} />
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={passwordLoading} className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 disabled:bg-sky-800 disabled:cursor-not-allowed">
              {passwordLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Settings;