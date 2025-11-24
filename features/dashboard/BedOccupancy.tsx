import React, { useEffect, useState } from 'react';
import { db } from '../../services/firebase';
import { Ward, Patient } from '../../types';
import { useNotification } from '../../context/NotificationContext';
import { BedDouble } from 'lucide-react';

interface OccupancyData {
  ward: Ward;
  occupied: number;
}

interface BedOccupancyProps {
    onWardClick: (ward: Ward) => void;
}

const BedOccupancy: React.FC<BedOccupancyProps> = ({ onWardClick }) => {
    const [occupancy, setOccupancy] = useState<OccupancyData[]>([]);
    const [loading, setLoading] = useState(true);
    const { addNotification } = useNotification();

    useEffect(() => {
        const fetchOccupancy = async () => {
            setLoading(true);
            try {
                const wardsSnapshot = await db.collection('wards').get();
                const wards = wardsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ward));

                const admittedPatientsSnapshot = await db.collection('patients')
                    .where('status', 'in', ['Admitted', 'PendingDischarge'])
                    .get();
                
                const occupancyMap = new Map<string, number>();
                admittedPatientsSnapshot.docs.forEach(doc => {
                    const patient = doc.data() as Patient;
                    if (patient.currentWardId) {
                        occupancyMap.set(patient.currentWardId, (occupancyMap.get(patient.currentWardId) || 0) + 1);
                    }
                });

                const occupancyData = wards.map(ward => ({
                    ward,
                    occupied: occupancyMap.get(ward.id) || 0
                })).sort((a,b) => a.ward.name.localeCompare(b.ward.name));

                setOccupancy(occupancyData);

            } catch (error) {
                console.error("Error fetching bed occupancy:", error);
                addNotification('Failed to load bed occupancy data.', 'error');
            } finally {
                setLoading(false);
            }
        };

        fetchOccupancy();
    }, [addNotification]);
    
    if (loading) {
        return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="bg-[#161B22] border border-gray-700 p-4 rounded-lg h-24 animate-pulse"></div>)}
        </div>
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {occupancy.map(({ ward, occupied }) => {
                const percentage = ward.totalBeds > 0 ? (occupied / ward.totalBeds) * 100 : 0;
                const isFull = occupied >= ward.totalBeds;
                
                return (
                    <button 
                        key={ward.id} 
                        onClick={() => onWardClick(ward)}
                        className="bg-[#161B22] border border-gray-700 p-4 rounded-lg text-left hover:bg-gray-800 hover:border-sky-700 transition-all focus:outline-none focus:ring-2 focus:ring-sky-500"
                    >
                        <div className="flex justify-between items-center">
                            <h4 className="font-semibold text-white text-sm truncate">{ward.name}</h4>
                             <BedDouble size={16} className={`flex-shrink-0 ${isFull ? 'text-red-500' : 'text-gray-500'}`} />
                        </div>
                        <p className="text-2xl font-bold text-white mt-2">
                            {occupied} <span className="text-lg font-medium text-gray-400">/ {ward.totalBeds}</span>
                        </p>
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-2">
                            <div 
                                className={`h-1.5 rounded-full ${isFull ? 'bg-red-600' : 'bg-sky-600'}`} 
                                style={{ width: `${percentage}%` }}
                            ></div>
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default BedOccupancy;