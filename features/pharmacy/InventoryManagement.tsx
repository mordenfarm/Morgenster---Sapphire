import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../services/firebase';
import { InventoryItem, Role } from '../../types';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
import { Edit, Plus, Search, Trash2, Pill, AlertTriangle, Package, DollarSign } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import Modal from '../../components/utils/Modal';
import AddEditInventoryItemModal from './AddEditInventoryItemModal';
import { useAuth } from '../../context/AuthContext';

const InventoryManagement: React.FC = () => {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isAddEditModalOpen, setAddEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const { addNotification } = useNotification();
    const { userProfile } = useAuth();

    const canEdit = useMemo(() => userProfile?.role === Role.Accountant, [userProfile]);

    const fetchItems = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('inventory').orderBy('name').get();
            const itemList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
            setItems(itemList);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            addNotification('Failed to fetch inventory.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItems();
    }, []);

    const filteredItems = useMemo(() => {
        if (!searchQuery) return items;
        const lowercasedQuery = searchQuery.toLowerCase();
        return items.filter(item =>
            item.name.toLowerCase().includes(lowercasedQuery) ||
            item.category.toLowerCase().includes(lowercasedQuery)
        );
    }, [searchQuery, items]);

    const handleAdd = () => {
        setSelectedItem(null);
        setAddEditModalOpen(true);
    };

    const handleEdit = (item: InventoryItem) => {
        setSelectedItem(item);
        setAddEditModalOpen(true);
    };

    const handleDelete = (item: InventoryItem) => {
        setSelectedItem(item);
        setDeleteModalOpen(true);
    }
    
    const confirmDelete = async () => {
        if (!selectedItem) return;
        try {
            await db.collection('inventory').doc(selectedItem.id!).delete();
            addNotification('Item deleted successfully.', 'success');
            setDeleteModalOpen(false);
            setSelectedItem(null);
            fetchItems(); // Refetch
        } catch (error) {
            addNotification('Failed to delete item.', 'error');
        }
    }

    if (loading) return <LoadingSpinner />;

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Pharmacy Inventory</h1>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    {canEdit && (
                        <button onClick={handleAdd} className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
                            <Plus size={18} />
                            <span className="hidden sm:inline">Add Item</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => {
                    const isLowStock = item.quantity <= item.lowStockThreshold;
                    return (
                        <div key={item.id} className={`bg-[#161B22] border rounded-lg shadow-md flex flex-col justify-between p-6 transition-all hover:shadow-sky-500/20 ${isLowStock ? 'border-red-700/50' : 'border-gray-700 hover:border-sky-700'}`}>
                            <div>
                                {isLowStock && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-red-400 mb-3 bg-red-900/20 px-2 py-1 rounded-md">
                                        <AlertTriangle size={14} />
                                        LOW STOCK
                                    </div>
                                )}
                                <h3 className="text-lg font-semibold text-white truncate">{item.name}</h3>
                                <p className="flex items-center text-sm text-gray-400 mt-2"><Pill size={14} className="mr-2 text-gray-500" />{item.category}</p>
                                
                                <div className="mt-4 grid grid-cols-2 gap-4">
                                     <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                                        <p className="text-xs text-gray-400 flex items-center gap-2"><Package size={14}/> Quantity</p>
                                        <p className={`text-xl font-bold ${isLowStock ? 'text-red-400' : 'text-white'}`}>{item.quantity}</p>
                                    </div>
                                     <div className="bg-gray-800/50 p-3 rounded-md border border-gray-700/50">
                                        <p className="text-xs text-gray-400 flex items-center gap-2"><DollarSign size={14}/> Price</p>
                                        <p className="text-xl font-bold text-green-400">${item.unitPrice.toFixed(2)}</p>
                                    </div>
                                </div>
                            </div>
                            {canEdit && (
                                <div className="flex items-center justify-end space-x-2 mt-6 pt-4 border-t border-gray-700">
                                    <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-sky-500" aria-label={`Edit ${item.name}`}><Edit size={18} /></button>
                                    <button onClick={() => handleDelete(item)} className="p-2 text-gray-400 hover:text-red-500" aria-label={`Delete ${item.name}`}><Trash2 size={18} /></button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            
            {canEdit && <AddEditInventoryItemModal 
                isOpen={isAddEditModalOpen} 
                onClose={() => setAddEditModalOpen(false)} 
                onSuccess={fetchItems} 
                item={selectedItem} 
            />}

            {selectedItem && canEdit && (
                <Modal isOpen={isDeleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Confirm Delete">
                    <p className="text-gray-400">Are you sure you want to delete <span className="font-bold text-white">{selectedItem.name}</span>? This action is permanent.</p>
                    <div className="mt-6 flex justify-end space-x-4">
                        <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600">Cancel</button>
                        <button onClick={confirmDelete} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700">Delete</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default InventoryManagement;