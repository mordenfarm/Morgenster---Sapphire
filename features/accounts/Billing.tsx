
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { db } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { Patient, PriceListItem, BillItem, Bill } from '../../types';
import { Search, X, PlusCircle, DollarSign, FileText, User, CreditCard } from 'lucide-react';
// FIX: Updated react-router-dom import for v5 compatibility.
import { Link } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import Modal from '../../components/utils/Modal';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    totalBill: number;
    billItems: BillItem[];
    patient: Patient;
    onSuccess: () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, totalBill, billItems, patient, onSuccess }) => {
    const { userProfile } = useAuth();
    const { addNotification } = useNotification();
    const [loading, setLoading] = useState(false);
    const [amountPaid, setAmountPaid] = useState<number>(0);
    const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'EFT' | 'Mixed'>('CASH');

    useEffect(() => {
        if (isOpen) {
            setAmountPaid(totalBill);
        }
    }, [isOpen, totalBill]);

    const balance = useMemo(() => totalBill - amountPaid, [totalBill, amountPaid]);

    const handleProcessBill = async () => {
        if (!userProfile) {
            addNotification('Cannot process bill without a logged in user.', 'warning');
            return;
        }
        setLoading(true);

        const balance = totalBill - amountPaid;
        let status: Bill['status'];
        if (amountPaid <= 0) {
            status = 'Unpaid';
        } else if (balance > 0) {
            status = 'Partially Paid';
        } else {
            status = 'Paid';
        }

        const billData = {
            patientId: patient.id!,
            patientName: `${patient.name} ${patient.surname}`,
            patientHospitalNumber: patient.hospitalNumber,
            items: billItems,
            totalBill,
            amountPaidAtTimeOfBill: amountPaid,
            balance,
            paymentMethod,
            date: new Date().toISOString(),
            processedBy: userProfile.id,
            status,
        };

        try {
            const batch = db.batch();
            
            const billRef = db.collection('bills').doc();
            batch.set(billRef, billData);

            const patientRef = db.collection('patients').doc(patient.id!);
            batch.update(patientRef, {
                'financials.totalBill': firebase.firestore.FieldValue.increment(totalBill),
                'financials.amountPaid': firebase.firestore.FieldValue.increment(amountPaid),
                'financials.balance': firebase.firestore.FieldValue.increment(balance),
            });
            
            await batch.commit();
            addNotification('Bill processed successfully!', 'success');
            onSuccess();
            onClose();

        } catch (error) {
            console.error("Error processing bill:", error);
            addNotification('Failed to process bill.', 'error');
        } finally {
            setLoading(false);
        }
    };
    
    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Process Payment">
            <div className="space-y-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="flex justify-between text-2xl">
                        <span className="font-bold text-sky-400">Total Bill:</span>
                        <span className="font-extrabold text-white">${totalBill.toFixed(2)}</span>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300">Amount to Pay ($)</label>
                    <input type="number" value={amountPaid} onChange={e => setAmountPaid(parseFloat(e.target.value) || 0)}
                           className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300">Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as any)}
                            className="mt-1 block w-full rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm">
                        <option>CASH</option>
                        <option>EFT</option>
                        <option>Mixed</option>
                    </select>
                </div>
                
                <div className="bg-gray-800 p-4 rounded-lg space-y-3">
                    <div className="flex justify-between text-lg">
                        <span className="font-medium text-gray-300">Amount Paid:</span>
                        <span className="font-bold text-green-400">${amountPaid.toFixed(2)}</span>
                    </div>
                    <hr className="border-gray-600" />
                    <div className="flex justify-between text-2xl">
                        <span className="font-bold text-sky-400">Balance Due:</span>
                        <span className={`font-extrabold ${balance > 0 ? 'text-red-400' : 'text-green-400'}`}>${balance.toFixed(2)}</span>
                    </div>
                </div>
            </div>
            <div className="mt-6 flex justify-end space-x-4">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
                <button onClick={handleProcessBill} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50">
                    {loading ? 'Processing...' : 'Confirm & Process Bill'}
                </button>
            </div>
        </Modal>
    );
}

const Billing: React.FC = () => {
    const { addNotification } = useNotification();
    const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
    
    // Patient Search State
    const [patientSearch, setPatientSearch] = useState('');
    const [patientResults, setPatientResults] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    // Billing State
    const [billItems, setBillItems] = useState<BillItem[]>([]);
    const [itemSearch, setItemSearch] = useState('');
    const [itemResults, setItemResults] = useState<PriceListItem[]>([]);
    
    const [isCreditModalOpen, setCreditModalOpen] = useState(false);
    const [creditLoading, setCreditLoading] = useState(false);
    const { userProfile } = useAuth();

    const handlePatientSearch = useCallback(async (query: string) => {
        setPatientSearch(query);
        if (query.length < 2) {
            setPatientResults([]);
            return;
        }
        try {
            const normalizedQuery = query.charAt(0).toUpperCase() + query.slice(1).toLowerCase();
            const nameQuery = db.collection('patients')
                .where('name', '>=', normalizedQuery)
                .where('name', '<=', normalizedQuery + '\uf8ff').limit(5);
            const surnameQuery = db.collection('patients')
                .where('surname', '>=', normalizedQuery)
                .where('surname', '<=', normalizedQuery + '\uf8ff').limit(5);
            
            const [nameSnapshot, surnameSnapshot] = await Promise.all([nameQuery.get(), surnameQuery.get()]);

            const resultsMap = new Map<string, Patient>();
            nameSnapshot.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() } as Patient));
            surnameSnapshot.docs.forEach(doc => resultsMap.set(doc.id, { id: doc.id, ...doc.data() } as Patient));
            
            setPatientResults(Array.from(resultsMap.values()));
        } catch (error) {
            console.error("Error searching patients:", error);
        }
    }, []);

    const handleItemSearch = useCallback(async (query: string) => {
        setItemSearch(query);
        if (query.length < 2) {
            setItemResults([]);
            return;
        }
        try {
            // Capitalize the first letter of the query to match the likely data format (e.g., "Paracetamol")
            const capitalizedQuery = query.charAt(0).toUpperCase() + query.slice(1);

            const snapshot = await db.collection('priceList')
                .orderBy('name')
                .startAt(capitalizedQuery)
                .endAt(capitalizedQuery + '\uf8ff')
                .limit(5).get();
            
            setItemResults(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceListItem)));
        } catch (error) {
            console.error("Error searching price list:", error);
            addNotification('Error searching for items.', 'error');
        }
    }, [addNotification]);

    const selectPatient = (patient: Patient) => {
        setSelectedPatient(patient);
        setPatientSearch('');
        setPatientResults([]);
    };

    const addItem = (item: PriceListItem) => {
        const newItem: BillItem = {
            id: item.id!,
            description: item.name,
            quantity: 1,
            unitPrice: item.unitPrice,
            totalPrice: item.unitPrice,
        };
        setBillItems([...billItems, newItem]);
        setItemSearch('');
        setItemResults([]);
    };

    const updateItemQuantity = (index: number, quantity: number) => {
        const updatedItems = [...billItems];
        if (quantity > 0) {
            updatedItems[index].quantity = quantity;
            updatedItems[index].totalPrice = quantity * updatedItems[index].unitPrice;
            setBillItems(updatedItems);
        }
    };

    const removeItem = (index: number) => {
        setBillItems(billItems.filter((_, i) => i !== index));
    };

    const totalBill = useMemo(() => billItems.reduce((sum, item) => sum + item.totalPrice, 0), [billItems]);

    const resetBilling = () => {
        setSelectedPatient(null);
        setBillItems([]);
    };

    const handleBillOnCredit = () => {
        if (billItems.length === 0) {
            addNotification('Cannot create an empty bill.', 'warning');
            return;
        }
        setCreditModalOpen(true);
    };

    const confirmBillOnCredit = async () => {
        if (!selectedPatient || !userProfile) {
            addNotification('Patient or user not found.', 'error');
            return;
        }
        setCreditLoading(true);

        const billData = {
            patientId: selectedPatient.id!,
            patientName: `${selectedPatient.name} ${selectedPatient.surname}`,
            patientHospitalNumber: selectedPatient.hospitalNumber,
            items: billItems,
            totalBill,
            amountPaidAtTimeOfBill: 0,
            balance: totalBill,
            paymentMethod: 'Credit' as const,
            date: new Date().toISOString(),
            processedBy: userProfile.id,
            status: 'Unpaid' as const,
        };

        try {
            const batch = db.batch();

            const billRef = db.collection('bills').doc();
            batch.set(billRef, billData);

            const patientRef = db.collection('patients').doc(selectedPatient.id!);
            batch.update(patientRef, {
                'financials.totalBill': firebase.firestore.FieldValue.increment(totalBill),
                'financials.balance': firebase.firestore.FieldValue.increment(totalBill),
            });

            await batch.commit();
            addNotification('Bill successfully added to patient account on credit.', 'success');
            resetBilling();
            setCreditModalOpen(false);

        } catch (error) {
            console.error("Error billing on credit:", error);
            addNotification('Failed to bill on credit.', 'error');
        } finally {
            setCreditLoading(false);
        }
    };


    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Billing & Invoicing</h1>
            
            {!selectedPatient ? (
                <div className="bg-[#161B22] border border-gray-700 p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-sky-400 mb-4">Find Patient to Bill</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Search by name or surname..." value={patientSearch} onChange={e => handlePatientSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        {patientResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-gray-900 border border-gray-600 rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                                {patientResults.map(p => (
                                    <li key={p.id} onClick={() => selectPatient(p)} className="cursor-pointer select-none relative py-2 px-4 text-white hover:bg-sky-700">
                                        <span className="font-normal block truncate">{p.name} {p.surname} - {p.hospitalNumber}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            ) : (
                <div className="bg-[#161B22] border border-gray-700 p-6 rounded-lg shadow-md">
                    {/* Patient Info Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-4 border-b border-gray-700 gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">{selectedPatient.name} {selectedPatient.surname}</h2>
                            <p className="text-sm text-gray-400">Hospital No: {selectedPatient.hospitalNumber} | Age: {selectedPatient.age}</p>
                        </div>
                        <div className="flex items-center gap-4">
                           <Link to={`/patients/${selectedPatient.id}`} className="flex items-center justify-center gap-2 text-sm text-gray-300 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-md">
                             <User size={16} /> View Full Profile
                           </Link>
                           <button onClick={resetBilling} className="text-sm text-sky-500 hover:underline">Change Patient</button>
                        </div>
                    </div>

                    {/* Itemized List Table */}
                    <div className="overflow-x-auto mb-4">
                        <table className="w-full text-sm text-left text-gray-400">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-700">
                                <tr>
                                    <th className="px-4 py-3 w-2/5">Description</th>
                                    <th className="px-4 py-3 w-1/6 text-center">Qty</th>
                                    <th className="px-4 py-3 w-1/6 text-right">Unit Price</th>
                                    <th className="px-4 py-3 w-1/6 text-right">Total Price</th>
                                    <th className="px-4 py-3 w-auto text-center"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {billItems.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-700">
                                        <td className="px-4 py-2 font-medium text-white">{item.description}</td>
                                        <td className="px-4 py-2">
                                            <input type="number" value={item.quantity} min="1" onChange={e => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                                   className="w-20 text-center rounded-md border-gray-600 bg-gray-800 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" />
                                        </td>
                                        <td className="px-4 py-2 text-right">${item.unitPrice.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-white">${item.totalPrice.toFixed(2)}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => removeItem(index)} className="text-red-500 hover:text-red-400"><X size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Add Item Search */}
                    <div className="relative mb-6">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Search for a service or product to add..." value={itemSearch} onChange={e => handleItemSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                        {itemResults.length > 0 && (
                            <ul className="absolute z-10 w-full bg-gray-900 border border-gray-600 rounded-md mt-1 shadow-lg max-h-60 overflow-auto">
                                {itemResults.map(item => (
                                    <li key={item.id} onClick={() => addItem(item)} className="cursor-pointer select-none relative py-2 px-4 text-white hover:bg-sky-700">
                                        <span className="font-normal block truncate">{item.name} (${item.unitPrice.toFixed(2)})</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Financial Summary */}
                     <div className="flex justify-end mt-6">
                        <div className="w-full max-w-sm bg-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between text-2xl">
                                <span className="font-bold text-sky-400">Total Bill:</span>
                                <span className="font-extrabold text-white">${totalBill.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="mt-8 flex justify-end space-x-4">
                        <button 
                            onClick={handleBillOnCredit} 
                            disabled={billItems.length === 0}
                            className="inline-flex items-center justify-center py-2 px-6 border border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-300 bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <CreditCard className="mr-2" size={20} />
                            Bill on Credit
                        </button>
                        <button onClick={() => setPaymentModalOpen(true)} disabled={billItems.length === 0}
                            className="inline-flex items-center justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed">
                            <DollarSign className="mr-2" size={20} />
                            Proceed to Payment
                        </button>
                    </div>
                </div>
            )}
             {selectedPatient && (
                <PaymentModal
                    isOpen={isPaymentModalOpen}
                    onClose={() => setPaymentModalOpen(false)}
                    totalBill={totalBill}
                    billItems={billItems}
                    patient={selectedPatient}
                    onSuccess={resetBilling}
                />
            )}
             <Modal isOpen={isCreditModalOpen} onClose={() => setCreditModalOpen(false)} title="Confirm Bill on Credit">
                <p className="text-gray-400">
                    Are you sure you want to add this bill of <span className="font-bold text-white">${totalBill.toFixed(2)}</span> to the patient's account on credit?
                </p>
                <div className="mt-6 flex justify-end space-x-4">
                    <button onClick={() => setCreditModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
                    <button onClick={confirmBillOnCredit} disabled={creditLoading} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:opacity-50">
                        {creditLoading ? 'Processing...' : 'Confirm'}
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default Billing;
