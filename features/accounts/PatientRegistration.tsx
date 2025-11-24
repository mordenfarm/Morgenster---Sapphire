import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Patient, Role } from '../../types';
import { User, PlusCircle } from 'lucide-react';
import LoadingSpinner from '../../components/utils/LoadingSpinner';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h2 className="text-xl font-semibold text-sky-400 border-b-2 border-sky-500 pb-2 mb-4 flex items-center">
      <User className="mr-3 text-white" size={24} strokeWidth={2.5} /> {title}
    </h2>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {children}
    </div>
  </div>
);

const InputField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; type?: string; required?: boolean; }> = 
({ label, name, value, onChange, type = 'text', required = false }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-300">{label}</label>
    <input type={type} name={name} id={name} value={value} onChange={onChange} required={required}
           className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 px-3 py-2" />
  </div>
);

const SelectField: React.FC<{ label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void; options: string[]; required?: boolean; }> = 
({ label, name, value, onChange, options, required = false }) => (
    <div>
        <label htmlFor={name} className="block text-sm font-medium text-gray-300">{label}</label>
        <select name={name} id={name} value={value} onChange={onChange} required={required}
                className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 px-3 py-2">
            <option value="">Select...</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
    </div>
);


const PatientRegistration: React.FC = () => {
    const { userProfile, loading: authLoading } = useAuth();
    const { addNotification } = useNotification();
    const navigate = useNavigate();
    const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'success'>('idle');

    const isAuthorized = useMemo(() => {
        if (!userProfile) return false;
        return [Role.Accountant, Role.AccountsAssistant, Role.AccountsClerk].includes(userProfile.role);
    }, [userProfile]);

    useEffect(() => {
        if (!authLoading && !isAuthorized) {
            addNotification('You do not have permission to access this page.', 'error');
            navigate('/');
        }
    }, [authLoading, isAuthorized, navigate, addNotification]);

    const initialFormState = {
        name: '', surname: '', dateOfBirth: '', maritalStatus: '', gender: '', countryOfBirth: 'Zimbabwe',
        phoneNumber: '', residentialAddress: '', nokName: '', nokSurname: '', nokPhoneNumber: '', nokAddress: ''
    };
    const [formData, setFormData] = useState(initialFormState);

    const age = useMemo(() => {
        if (!formData.dateOfBirth) return 0;
        const birthDate = new Date(formData.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }, [formData.dateOfBirth]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const generateHospitalNumber = async (): Promise<string> => {
        const counterRef = db.collection('counters').doc('patients');
        try {
            return await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(counterRef);
                let nextNumber = 1;
                if (doc.exists) {
                    const lastNumber = doc.data()?.lastNumber ?? 0;
                    nextNumber = lastNumber + 1;
                    transaction.update(counterRef, { lastNumber: nextNumber });
                } else {
                    transaction.set(counterRef, { lastNumber: 1 });
                }
                return `MH${String(nextNumber).padStart(4, '0')}`;
            });
        } catch (error) {
            console.error("Hospital number generation failed: ", error);
            addNotification('Could not generate hospital number. Please try again.', 'error');
            throw new Error("Could not generate hospital number.");
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userProfile) {
            addNotification('Cannot register patient without a logged in user.', 'error');
            return;
        }
        setFormStatus('loading');

        try {
            const hospitalNumber = await generateHospitalNumber();
            const newPatient: Omit<Patient, 'id'> = {
                hospitalNumber,
                name: formData.name,
                surname: formData.surname,
                dateOfBirth: formData.dateOfBirth,
                age: age,
                maritalStatus: formData.maritalStatus,
                gender: formData.gender as 'Male' | 'Female' | 'Other',
                countryOfBirth: formData.countryOfBirth,
                phoneNumber: formData.phoneNumber,
                residentialAddress: formData.residentialAddress,
                nokName: formData.nokName,
                nokSurname: formData.nokSurname,
                nokPhoneNumber: formData.nokPhoneNumber,
                nokAddress: formData.nokAddress,
                registeredBy: userProfile.id,
                registrationDate: new Date().toISOString(),
                status: 'Discharged',
                financials: { totalBill: 0, amountPaid: 0, balance: 0 }
            };

            await db.collection('patients').add(newPatient);
            addNotification(`Patient ${formData.name} ${formData.surname} registered successfully with Hospital No: ${hospitalNumber}`, 'success');
            setFormStatus('success');
            setTimeout(() => {
                setFormData(initialFormState); // Reset form
                setFormStatus('idle');
            }, 2000);

        } catch (error) {
            console.error("Error registering patient: ", error);
            addNotification('Failed to register patient.', 'error');
            setFormStatus('idle');
        }
    };
    
    const getButtonText = () => {
        switch (formStatus) {
            case 'loading': return 'Registering...';
            case 'success': return 'Patient Registered!';
            default: return 'Register Patient';
        }
    };

    if (authLoading || !isAuthorized) {
        return <LoadingSpinner />;
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Patient Registration</h1>
            <form onSubmit={handleSubmit}>
                <div className="bg-[#161B22] border border-gray-700 p-6 rounded-lg shadow-md text-gray-300">
                    <Section title="Personal Details">
                        <InputField label="First Name" name="name" value={formData.name} onChange={handleChange} required />
                        <InputField label="Last Name" name="surname" value={formData.surname} onChange={handleChange} required />
                        <InputField label="Date of Birth" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} type="date" required />
                        <div>
                            <label className="block text-sm font-medium text-gray-300">Age</label>
                            <span className="mt-1 block w-full p-2 rounded-md bg-gray-900 text-gray-400 sm:text-sm">{age > 0 ? age : '...'}</span>
                        </div>
                        <SelectField label="Gender" name="gender" value={formData.gender} onChange={handleChange} options={['Male', 'Female', 'Other']} required />
                        <SelectField label="Marital Status" name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} options={['Single', 'Married', 'Divorced', 'Widowed']} required />
                        <InputField label="Country of Birth" name="countryOfBirth" value={formData.countryOfBirth} onChange={handleChange} required />
                    </Section>

                    <Section title="Contact Information">
                        <InputField label="Phone Number" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} required />
                        <InputField label="Residential Address" name="residentialAddress" value={formData.residentialAddress} onChange={handleChange} required />
                    </Section>

                    <Section title="Next of Kin Details">
                        <InputField label="NOK First Name" name="nokName" value={formData.nokName} onChange={handleChange} required />
                        <InputField label="NOK Last Name" name="nokSurname" value={formData.nokSurname} onChange={handleChange} required />
                        <InputField label="NOK Phone Number" name="nokPhoneNumber" value={formData.nokPhoneNumber} onChange={handleChange} required />
                        <InputField label="NOK Address" name="nokAddress" value={formData.nokAddress} onChange={handleChange} required />
                    </Section>

                    <div className="mt-8 flex justify-end">
                        <button type="submit" disabled={formStatus !== 'idle'}
                            className="inline-flex items-center justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 disabled:bg-sky-800 disabled:cursor-not-allowed">
                            <PlusCircle className="mr-2" size={20} />
                            {getButtonText()}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default PatientRegistration;