import React, { useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import { Bill, Payment, UserProfile, Patient } from '../../types';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
// FIX: Updated react-router-dom import for v5 compatibility.
import { Link } from 'react-router-dom';
import { DollarSign, FileText, Clock, UserPlus } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import firebase from 'firebase/compat/app';

interface Activity {
  id: string;
  type: 'Bill' | 'Payment' | 'Registration';
  date: Date;
  patientName: string;
  patientId: string;
  processedByName: string;
  amount?: number;
  originalId: string;
}

const DepartmentActivity: React.FC = () => {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const { addNotification } = useNotification();
    
    useEffect(() => {
        const fetchActivities = async () => {
            setLoading(true);
            try {
                // 1. Fetch Accounts department users to map IDs to names
                const usersSnapshot = await db.collection('users').where('department', '==', 'Accounts').get();
                const usersMap = new Map<string, string>();
                usersSnapshot.docs.forEach(doc => {
                    const user = doc.data() as UserProfile;
                    usersMap.set(doc.id, `${user.name} ${user.surname}`);
                });

                // 2. Fetch recent bills
                const billsSnapshot = await db.collection('bills').orderBy('date', 'desc').limit(10).get();
                const billActivities: Activity[] = billsSnapshot.docs.map(doc => {
                    const bill = { id: doc.id, ...doc.data() } as Bill;
                    return {
                        id: `bill-${bill.id}`,
                        type: 'Bill',
                        date: new Date(bill.date),
                        patientName: bill.patientName,
                        patientId: bill.patientId,
                        processedByName: usersMap.get(bill.processedBy) || 'Unknown Clerk',
                        amount: bill.totalBill,
                        originalId: bill.id!,
                    };
                });
                
                // 3. Fetch recent payments
                const paymentsSnapshot = await db.collection('payments').orderBy('date', 'desc').limit(10).get();
                const paymentActivities: Activity[] = paymentsSnapshot.docs.map(doc => {
                    const payment = { id: doc.id, ...doc.data() } as Payment;
                    return {
                        id: `payment-${payment.id}`,
                        type: 'Payment',
                        date: new Date(payment.date),
                        patientName: '...', // Placeholder, will be fetched next
                        patientId: payment.patientId,
                        processedByName: payment.processedByName,
                        amount: payment.amount,
                        originalId: payment.id!,
                    };
                });
                
                // 4. Fetch recent patient registrations
                const patientsSnapshot = await db.collection('patients').orderBy('registrationDate', 'desc').limit(10).get();
                const registrationActivities: Activity[] = patientsSnapshot.docs.map(doc => {
                    const patient = { id: doc.id, ...doc.data() } as Patient;
                    return {
                        id: `reg-${patient.id}`,
                        type: 'Registration',
                        date: new Date(patient.registrationDate),
                        patientName: `${patient.name} ${patient.surname}`,
                        patientId: patient.id!,
                        processedByName: usersMap.get(patient.registeredBy) || 'Unknown Clerk',
                        originalId: patient.id!,
                    };
                });

                // 5. Combine and sort all activities
                let combined = [...billActivities, ...paymentActivities, ...registrationActivities];
                combined.sort((a, b) => b.date.getTime() - a.date.getTime());
                combined = combined.slice(0, 15); // Limit to latest 15 overall

                // 6. Post-process to fetch patient names for payments
                const patientIdsForPayments = paymentActivities.map(p => p.patientId).filter((id, index, self) => self.indexOf(id) === index);
                if(patientIdsForPayments.length > 0) {
                    const patientDocs = await Promise.all(patientIdsForPayments.map(id => db.collection('patients').doc(id).get()));
                    const patientNamesMap = new Map<string, string>();
                    patientDocs.forEach(doc => {
                        if (doc.exists) {
                            const p = doc.data() as Patient;
                            patientNamesMap.set(doc.id, `${p.name} ${p.surname}`);
                        }
                    });
                    combined.forEach(activity => {
                        if (activity.type === 'Payment' && patientNamesMap.has(activity.patientId)) {
                            activity.patientName = patientNamesMap.get(activity.patientId)!;
                        }
                    });
                }
                
                setActivities(combined);

            } catch (error) {
                console.error("Error fetching department activity:", error);
                addNotification('Failed to load department activity.', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchActivities();
    }, [addNotification]);
    
    const ActivityIcon = ({ type }: { type: Activity['type']}) => {
        switch (type) {
            case 'Bill':
                return <div className="dept-activity-icon bg-blue-900/50 text-blue-400"><FileText size={16} /></div>;
            case 'Payment':
                return <div className="dept-activity-icon bg-green-900/50 text-green-400"><DollarSign size={16} /></div>;
            case 'Registration':
                return <div className="dept-activity-icon bg-purple-900/50 text-purple-400"><UserPlus size={16} /></div>;
            default: return null;
        }
    }
    
    if (loading) return <LoadingSpinner />;

    return (
        <div className="bg-[#161B22] border border-gray-700 p-6 rounded-lg shadow-md">
            <div className="overflow-x-auto">
                <ul className="space-y-4">
                    {activities.map(activity => (
                        <li key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-gray-800/50 transition-colors">
                            <ActivityIcon type={activity.type} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-white">
                                    {activity.type === 'Bill' && `New bill for `}
                                    {activity.type === 'Payment' && `Payment received from `}
                                    {activity.type === 'Registration' && `New patient registered: `}
                                    <Link to={`/patients/${activity.patientId}`} className="font-semibold hover:underline">{activity.patientName}</Link>
                                    {activity.type !== 'Registration' && ` for $${activity.amount?.toFixed(2)}`}
                                </p>
                                <p className="text-xs text-gray-400">
                                    <span className="flex items-center"><Clock size={12} className="mr-1.5" /> {activity.date.toLocaleString()} by {activity.processedByName}</span>
                                </p>
                            </div>
                            {activity.type === 'Bill' && <Link to={`/bills/${activity.originalId}`} className="text-xs text-sky-500 hover:underline">View Bill</Link>}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

// FIX: Added default export for the component.
export default DepartmentActivity;