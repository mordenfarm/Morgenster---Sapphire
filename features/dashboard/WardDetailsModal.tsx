import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../../services/firebase';
import { Ward, Patient, AdmissionRecord } from '../../types';
import Modal from '../../components/utils/Modal';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
import { Bed, Clock, User } from 'lucide-react';

interface WardDetailsModalProps {
  ward: Ward;
  onClose: () => void;
}

interface OccupiedBedInfo {
  patient: Patient;
  admissionDate: Date | null;
}

const WardDetailsModal: React.FC<WardDetailsModalProps> = ({ ward, onClose }) => {
  const [beds, setBeds] = useState<Map<number, OccupiedBedInfo>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ward) return;

    const fetchBedDetails = async () => {
      setLoading(true);
      try {
        const patientsSnapshot = await db.collection('patients')
          .where('currentWardId', '==', ward.id)
          .where('status', 'in', ['Admitted', 'PendingDischarge'])
          .get();

        const bedMap = new Map<number, OccupiedBedInfo>();
        
        for (const doc of patientsSnapshot.docs) {
          const patient = { id: doc.id, ...doc.data() } as Patient;
          if (patient.currentBedNumber) {
            // Fetch the latest admission record for admission date
            const admissionSnapshot = await db.collection('patients').doc(patient.id!)
              .collection('admissionHistory').orderBy('admissionDate', 'desc').limit(1).get();
            
            let admissionDate = null;
            if (!admissionSnapshot.empty) {
              const admissionRecord = admissionSnapshot.docs[0].data() as AdmissionRecord;
              admissionDate = admissionRecord.admissionDate.toDate();
            }

            bedMap.set(patient.currentBedNumber, { patient, admissionDate });
          }
        }
        setBeds(bedMap);
      } catch (error) {
        console.error("Error fetching bed details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBedDetails();
  }, [ward]);
  
  if (!ward) return null;

  return (
    <Modal isOpen={true} onClose={onClose} title={`Ward Details: ${ward.name}`}>
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: ward.totalBeds }, (_, i) => i + 1).map((bedNumber) => {
                const bedInfo = beds.get(bedNumber);
                const isOccupied = !!bedInfo;

                return (
                <div key={bedNumber} className={`p-4 rounded-lg border-2 ${isOccupied ? 'border-sky-700 bg-gray-800' : 'border-gray-700 bg-gray-900/50'}`}>
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-lg text-white">Bed {bedNumber}</h4>
                        <Bed size={20} className={isOccupied ? 'text-sky-400' : 'text-gray-500'} />
                    </div>
                    {isOccupied ? (
                    <div className="mt-2 text-sm">
                        <p className="text-xs text-gray-400 mb-1">Occupied by:</p>
                        <Link to={`/patients/${bedInfo.patient.id}`} className="font-semibold text-sky-400 hover:underline flex items-center gap-2" onClick={onClose}>
                           <User size={14}/> {bedInfo.patient.name} {bedInfo.patient.surname}
                        </Link>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                           <Clock size={12}/> Admitted: {bedInfo.admissionDate ? bedInfo.admissionDate.toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                    ) : (
                    <p className="mt-2 text-sm text-green-400">Available</p>
                    )}
                </div>
                );
            })}
            </div>
        </div>
      )}
    </Modal>
  );
};

export default WardDetailsModal;