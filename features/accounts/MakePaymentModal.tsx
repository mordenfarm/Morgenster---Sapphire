import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Modal from '../../components/utils/Modal';
import { useNotification } from '../../context/NotificationContext';
import { db } from '../../services/firebase';
import firebase from 'firebase/compat/app';
import { Patient, Payment, PriceListItem, BillItem, Bill } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Search, X } from 'lucide-react';

interface MakePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
  onPaymentSuccess: () => void;
}

const MakePaymentModal: React.FC<MakePaymentModalProps> = ({ isOpen, onClose, patient, onPaymentSuccess }) => {
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'EFT' | 'Mixed'>('CASH');
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();
  const { userProfile } = useAuth();

  const [itemSearch, setItemSearch] = useState('');
  const [itemResults, setItemResults] = useState<PriceListItem[]>([]);
  const [billItems, setBillItems] = useState<BillItem[]>([]);

  const totalBill = useMemo(() => billItems.reduce((sum, item) => sum + item.totalPrice, 0), [billItems]);

  useEffect(() => {
    if (isOpen) {
        if (totalBill > 0) {
            setAmountPaid(totalBill.toFixed(2));
        } else if (patient.financials.balance > 0) {
            setAmountPaid(patient.financials.balance.toFixed(2));
        }
        else {
            setAmountPaid('');
        }
    }
  }, [isOpen, totalBill, patient.financials.balance]);

  const handleItemSearch = useCallback(async (query: string) => {
      setItemSearch(query);
      if (query.length < 2) {
          setItemResults([]);
          return;
      }
      try {
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

  const addItem = (item: PriceListItem) => {
      const newItem: BillItem = {
          id: item.id!,
          description: item.name,
          quantity: 1,
          unitPrice: item.unitPrice,
          totalPrice: item.unitPrice,
      };
      setBillItems(prevItems => [...prevItems, newItem]);
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


  const handleClose = () => {
      setBillItems([]);
      setItemSearch('');
      setAmountPaid('');
      setItemResults([]);
      onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const paymentAmount = parseFloat(amountPaid);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      addNotification('Please enter a valid payment amount.', 'warning');
      return;
    }
    if (!userProfile) {
        addNotification('Could not identify billing clerk.', 'error');
        return;
    }

    setLoading(true);
    try {
        const batch = db.batch();
        const patientRef = db.collection('patients').doc(patient.id!);

        // Always create a payment record
        const paymentRef = db.collection('payments').doc();
        const newPayment: Omit<Payment, 'id'> = {
            patientId: patient.id!,
            amount: paymentAmount,
            paymentMethod,
            date: new Date().toISOString(),
            processedBy: userProfile.id,
            processedByName: `${userProfile.name} ${userProfile.surname}`,
        };
        batch.set(paymentRef, newPayment);
        
        // If there are new items, create a bill and update total bill
        if (billItems.length > 0) {
            const billRef = db.collection('bills').doc();
            const newBillTotal = totalBill; 
            
            const balance = newBillTotal - paymentAmount;
            let status: Bill['status'];
            if (balance > 0) {
                status = 'Partially Paid';
            } else {
                status = 'Paid';
            }
            
            // FIX: Add missing 'status' property to the billData object.
            const billData: Omit<Bill, 'id'> = {
                patientId: patient.id!,
                patientName: `${patient.name} ${patient.surname}`,
                patientHospitalNumber: patient.hospitalNumber,
                items: billItems,
                totalBill: newBillTotal,
                amountPaidAtTimeOfBill: paymentAmount,
                balance: balance,
                paymentMethod,
                date: new Date().toISOString(),
                processedBy: userProfile.id,
                status,
            };
            batch.set(billRef, billData);

            // Update patient financials considering the new bill
            batch.update(patientRef, {
                'financials.totalBill': firebase.firestore.FieldValue.increment(newBillTotal),
                'financials.amountPaid': firebase.firestore.FieldValue.increment(paymentAmount),
                'financials.balance': firebase.firestore.FieldValue.increment(newBillTotal - paymentAmount),
            });
        } else {
            // No new items, just paying off existing balance
            batch.update(patientRef, {
                'financials.amountPaid': firebase.firestore.FieldValue.increment(paymentAmount),
                'financials.balance': firebase.firestore.FieldValue.increment(-paymentAmount),
            });
        }

        await batch.commit();
      
        addNotification('Payment recorded successfully!', 'success');
        onPaymentSuccess();
        handleClose();

    } catch (error) {
        console.error("Error processing payment:", error);
        addNotification('Failed to process payment.', 'error');
    } finally {
        setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Make Payment for ${patient.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
            <label htmlFor="itemSearch" className="block text-sm font-medium text-gray-300">Add Service/Item to Bill (Optional)</label>
            <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                    type="text" 
                    name="itemSearch" 
                    id="itemSearch"
                    placeholder="Search to create a quick bill..." 
                    value={itemSearch} 
                    onChange={(e) => handleItemSearch(e.target.value)} 
                    autoComplete="off"
                    className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white" 
                />
            </div>
            {itemResults.length > 0 && (
                <ul className="absolute z-10 w-full bg-gray-900 border border-gray-600 rounded-md mt-1 shadow-lg max-h-40 overflow-auto">
                    {itemResults.map(item => (
                        <li key={item.id} onClick={() => addItem(item)} className="cursor-pointer select-none relative py-2 px-4 text-white hover:bg-sky-700">
                            <span className="font-normal block truncate">{item.name} (${item.unitPrice.toFixed(2)})</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        
        {billItems.length > 0 && (
            <div className="my-4 max-h-48 overflow-y-auto border border-gray-700 rounded-lg">
                <table className="w-full text-sm text-left text-gray-400">
                    <thead className="text-xs text-gray-400 uppercase bg-gray-700/50 sticky top-0">
                        <tr>
                            <th className="px-2 py-2 w-2/4">Item</th>
                            <th className="px-2 py-2 text-center">Qty</th>
                            <th className="px-2 py-2 text-right">Total</th>
                            <th className="px-2 py-2 text-center"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {billItems.map((item, index) => (
                            <tr key={index} className="border-t border-gray-700">
                                <td className="px-2 py-2 font-medium text-white text-xs">{item.description}</td>
                                <td className="px-2 py-2">
                                    <input type="number" value={item.quantity} min="1" onChange={e => updateItemQuantity(index, parseInt(e.target.value) || 1)}
                                           className="w-14 text-center rounded border-gray-600 bg-gray-900 text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm" />
                                </td>
                                <td className="px-2 py-2 text-right font-semibold text-white text-xs">${item.totalPrice.toFixed(2)}</td>
                                <td className="px-2 py-2 text-center">
                                    <button type="button" onClick={() => removeItem(index)} className="text-red-500 hover:text-red-400"><X size={16} /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
        
        {billItems.length > 0 && (
            <div className="flex justify-end mt-2 mb-4">
                <div className="w-full max-w-xs bg-gray-800 p-3 rounded-lg">
                    <div className="flex justify-between text-lg">
                        <span className="font-bold text-sky-400">New Bill Total:</span>
                        <span className="font-extrabold text-white">${totalBill.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        )}

        <div>
            <label htmlFor="amountPaid" className="block text-sm font-medium text-gray-300">Amount to Pay ($)</label>
            <input 
                type="number" 
                name="amountPaid" 
                id="amountPaid"
                placeholder="0.00" 
                value={amountPaid} 
                onChange={(e) => setAmountPaid(e.target.value)} 
                required 
                min="0.01" 
                step="0.01" 
                className="w-full mt-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white" 
            />
        </div>
        <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-300">Payment Method</label>
            <select 
                name="paymentMethod" 
                id="paymentMethod"
                value={paymentMethod} 
                onChange={(e) => setPaymentMethod(e.target.value as any)} 
                required 
                className="w-full mt-1 px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
            >
                <option value="CASH">CASH</option>
                <option value="EFT">EFT</option>
                <option value="Mixed">Mixed</option>
            </select>
        </div>
        <div className="flex justify-end space-x-4 pt-2">
          <button type="button" onClick={handleClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-800">
            {loading ? 'Processing...' : 'Confirm Payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default MakePaymentModal;
