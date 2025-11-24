import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { Patient } from '../../types';
import { Search, X } from 'lucide-react';
import firebase from 'firebase/compat/app';

const PatientSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const navigate = useNavigate();
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const handleSearch = useCallback(async (searchQuery: string) => {
        if (searchQuery.trim().length < 2) {
            setResults([]);
            return;
        }
        setLoading(true);

        try {
            const capitalizedQuery = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
            
            // Queries
            const nameQuery = db.collection('patients').where('name', '>=', capitalizedQuery).where('name', '<=', capitalizedQuery + '\uf8ff').limit(3);
            const surnameQuery = db.collection('patients').where('surname', '>=', capitalizedQuery).where('surname', '<=', capitalizedQuery + '\uf8ff').limit(3);
            const hospitalNumberQuery = db.collection('patients').where('hospitalNumber', '>=', searchQuery.toUpperCase()).where('hospitalNumber', '<=', searchQuery.toUpperCase() + '\uf8ff').limit(3);
            
            const [nameSnap, surnameSnap, hospitalNumSnap] = await Promise.all([
                nameQuery.get(),
                surnameQuery.get(),
                hospitalNumberQuery.get()
            ]);

            const resultsMap = new Map<string, Patient>();
            const processSnap = (snap: firebase.firestore.QuerySnapshot) => {
                snap.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() } as Patient));
            };

            processSnap(nameSnap);
            processSnap(surnameSnap);
            processSnap(hospitalNumSnap);

            setResults(Array.from(resultsMap.values()));

        } catch (error) {
            console.error("Error searching for patients:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const handler = (event: MouseEvent) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setIsFocused(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelectPatient = (patientId: string) => {
        setQuery('');
        setResults([]);
        setIsFocused(false);
        navigate(`/patients/${patientId}`);
    };

    return (
        <div className="patient-search-container" ref={searchContainerRef}>
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        handleSearch(e.target.value);
                    }}
                    onFocus={() => setIsFocused(true)}
                    placeholder="Search for a patient by name or hospital number..."
                    className="patient-search-input"
                />
                {query && (
                    <button onClick={() => { setQuery(''); setResults([]); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                        <X size={18} />
                    </button>
                )}
            </div>
            <div className={`patient-search-results ${isFocused && query.length > 0 ? 'visible' : ''}`}>
                {loading ? (
                    <div className="p-4 text-center text-gray-400">Searching...</div>
                ) : results.length > 0 ? (
                    results.map(patient => (
                        <div key={patient.id} onClick={() => handleSelectPatient(patient.id!)} className="patient-search-item">
                            <div>
                                <p className="font-semibold text-white">{patient.name} {patient.surname}</p>
                                <p className="text-xs text-gray-400">Hospital No: {patient.hospitalNumber}</p>
                            </div>
                            <span className="text-xs px-2 py-1 bg-gray-700 rounded-full">{patient.status}</span>
                        </div>
                    ))
                ) : query.length > 1 ? (
                    <div className="p-4 text-center text-gray-500">No patients found.</div>
                ) : null}
            </div>
        </div>
    );
};

export default PatientSearch;
