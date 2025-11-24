import React, { useState, useEffect } from 'react';
import Modal from '../../components/utils/Modal';
import { useNotification } from '../../context/NotificationContext';
import { db } from '../../services/firebase';
import { InventoryItem } from '../../types';
import firebase from 'firebase/compat/app';

interface AddEditInventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: InventoryItem | null;
}

const AddEditInventoryItemModal: React.FC<AddEditInventoryItemModalProps> = ({ isOpen, onClose, onSuccess, item }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    quantity: '',
    unitPrice: '',
    lowStockThreshold: '',
    supplier: '',
  });
  const [loading, setLoading] = useState(false);
  const { addNotification } = useNotification();

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        category: item.category,
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        lowStockThreshold: item.lowStockThreshold.toString(),
        supplier: item.supplier || '',
      });
    } else {
      setFormData({
        name: '',
        category: '',
        quantity: '',
        unitPrice: '',
        lowStockThreshold: '10', // Default value
        supplier: '',
      });
    }
  }, [item, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(formData.quantity);
    const unitPrice = parseFloat(formData.unitPrice);
    const lowStockThreshold = parseInt(formData.lowStockThreshold);

    if (isNaN(quantity) || quantity < 0) {
      addNotification('Please enter a valid quantity.', 'warning');
      return;
    }
    if (isNaN(unitPrice) || unitPrice < 0) {
      addNotification('Please enter a valid unit price.', 'warning');
      return;
    }
     if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      addNotification('Please enter a valid low stock threshold.', 'warning');
      return;
    }

    setLoading(true);
    try {
      const itemData = {
        name: formData.name,
        category: formData.category,
        quantity,
        unitPrice,
        lowStockThreshold,
        supplier: formData.supplier,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };

      if (item) {
        await db.collection('inventory').doc(item.id!).update(itemData);
        addNotification('Item updated successfully!', 'success');
      } else {
        await db.collection('inventory').add({
            ...itemData,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
        addNotification('Item added successfully!', 'success');
      }
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error saving inventory item:", error);
      addNotification('Failed to save item.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white modern-input";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={item ? 'Edit Inventory Item' : 'Add New Inventory Item'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="name" placeholder="Item Name" value={formData.name} onChange={handleChange} required className={inputClass} />
        <input type="text" name="category" placeholder="Category (e.g., Antibiotic)" value={formData.category} onChange={handleChange} required className={inputClass} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="number" name="quantity" placeholder="Quantity in Stock" value={formData.quantity} onChange={handleChange} required min="0" className={inputClass} />
            <input type="number" name="unitPrice" placeholder="Unit Price ($)" value={formData.unitPrice} onChange={handleChange} required min="0" step="0.01" className={inputClass} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <input type="number" name="lowStockThreshold" placeholder="Low Stock Alert At" value={formData.lowStockThreshold} onChange={handleChange} required min="0" className={inputClass} />
             <input type="text" name="supplier" placeholder="Supplier (Optional)" value={formData.supplier} onChange={handleChange} className={inputClass} />
        </div>
        <div className="flex justify-end space-x-4 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
          <button type="submit" disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-md hover:bg-sky-700 disabled:bg-sky-800">
            {loading ? 'Saving...' : 'Save Item'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AddEditInventoryItemModal;