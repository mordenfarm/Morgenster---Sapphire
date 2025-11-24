
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../services/firebase';
import { Patient } from '../../types';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
import { Search, FileText, User, Calendar, Hash, Bed } from 'lucide-react';
// FIX: Updated react-router-dom import for v5 compatibility.
import { Link } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';

const PatientManagement: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const { addNotification } = useNotification();

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const snapshot = await db.collection('patients').orderBy('surname').get();
        const patientList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Patient));
        setPatients(patientList);
      } catch (error) {
        console.error("Error fetching patients:", error);
        addNotification('Failed to fetch patient list.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [addNotification]);

  const filteredPatients = useMemo(() => {
    if (!searchQuery) return patients;
    const lowercasedQuery = searchQuery.toLowerCase();
    return patients.filter(p =>
      p.name.toLowerCase().includes(lowercasedQuery) ||
      p.surname.toLowerCase().includes(lowercasedQuery) ||
      p.hospitalNumber.toLowerCase().includes(lowercasedQuery)
    );
  }, [searchQuery, patients]);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-white">All Patients</h1>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search by name or hospital no..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPatients.map(patient => (
          <div key={patient.id} className="bg-[#161B22] border border-gray-700 rounded-lg shadow-md flex flex-col justify-between p-6 transition-all hover:shadow-sky-500/20 hover:border-sky-700">
            <div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{patient.name} {patient.surname}</h3>
                  <p className="text-sky-400 text-sm">{patient.gender}, {patient.age} years</p>
                </div>
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                  patient.status === 'Admitted' ? 'bg-blue-900 text-blue-300' :
                  patient.status === 'PendingDischarge' ? 'bg-yellow-900 text-yellow-300' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {patient.status}
                </span>
              </div>
              <div className="mt-4 space-y-3 text-sm text-gray-400">
                 <p className="flex items-center"><Hash size={14} className="mr-3 text-gray-500" /> {patient.hospitalNumber}</p>
                 <p className="flex items-center"><Calendar size={14} className="mr-3 text-gray-500" /> DOB: {patient.dateOfBirth}</p>
                 {patient.status === 'Admitted' && patient.currentWardName && (
                    <p className="flex items-center font-semibold text-gray-300"><Bed size={14} className="mr-3 text-gray-500" /> {patient.currentWardName} - Bed {patient.currentBedNumber}</p>
                 )}
              </div>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-700">
              <Link to={`/patients/${patient.id}`} className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
                <FileText size={16} />
                View Profile
              </Link>
            </div>
          </div>
        ))}
      </div>
       {filteredPatients.length === 0 && (
          <div className="text-center py-12 bg-[#161B22] border border-gray-700 rounded-lg col-span-full">
            <p className="text-gray-400">No patients found matching your search.</p>
          </div>
        )}
    </div>
  );
};

export default PatientManagement;
