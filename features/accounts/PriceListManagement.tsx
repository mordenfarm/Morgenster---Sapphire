
import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../services/firebase';
import { PriceListItem } from '../../types';
import LoadingSpinner from '../../components/utils/LoadingSpinner';
import { Edit, Plus, Search, Trash2, Building } from 'lucide-react';
import { useNotification } from '../../context/NotificationContext';
import AddPriceListItemModal from './AddPriceListItemModal';
import EditPriceListItemModal from './EditPriceListItemModal';
import Modal from '../../components/utils/Modal';

const PriceListManagement: React.FC = () => {
    const [items, setItems] = useState<PriceListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    const [isAddModalOpen, setAddModalOpen] = useState(false);
    const [isEditModalOpen, setEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setDeleteModalOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<PriceListItem | null>(null);
    const { addNotification } = useNotification();

    const fetchItems = async () => {
        setLoading(true);
        try {
            const snapshot = await db.collection('priceList').get();
            const itemList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PriceListItem));
            
            itemList.sort((a, b) => {
                const deptComp = a.department.localeCompare(b.department);
                if (deptComp !== 0) return deptComp;
                return a.name.localeCompare(b.name);
            });

            setItems(itemList);
        } catch (error) {
            console.error("Error fetching price list:", error);
            addNotification('Failed to fetch price list.', 'error');
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
            item.department.toLowerCase().includes(lowercasedQuery)
        );
    }, [searchQuery, items]);

    const handleEdit = (item: PriceListItem) => {
        setSelectedItem(item);
        setEditModalOpen(true);
    };

    const handleDelete = (item: PriceListItem) => {
        setSelectedItem(item);
        setDeleteModalOpen(true);
    }
    
    const confirmDelete = async () => {
        if (!selectedItem) return;
        try {
            await db.collection('priceList').doc(selectedItem.id!).delete();
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
                <h1 className="text-3xl font-bold text-white">Price List Management</h1>
                <div className="flex items-center gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input type="text" placeholder="Search items..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <button onClick={() => setAddModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-sky-600 text-white rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500">
                        <Plus size={18} />
                        <span className="hidden sm:inline">Add Item</span>
                    </button>
                </div>
            </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredItems.map(item => (
                    <div key={item.id} className="bg-[#161B22] border border-gray-700 rounded-lg shadow-md flex flex-col justify-between p-6 transition-all hover:shadow-sky-500/20 hover:border-sky-700">
                        <div>
                            <h3 className="text-lg font-semibold text-white truncate">{item.name}</h3>
                            <p className="flex items-center text-sm text-gray-400 mt-2"><Building size={14} className="mr-2 text-gray-500" />{item.department}</p>
                            <p className="text-2xl font-bold text-sky-400 mt-4">${item.unitPrice.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center justify-end space-x-2 mt-6 pt-4 border-t border-gray-700">
                            <button onClick={() => handleEdit(item)} className="p-2 text-gray-400 hover:text-sky-500" aria-label={`Edit ${item.name}`}><Edit size={18} /></button>
                            <button onClick={() => handleDelete(item)} className="p-2 text-gray-400 hover:text-red-500" aria-label={`Delete ${item.name}`}><Trash2 size={18} /></button>
                        </div>
                    </div>
                ))}
            </div>
            
            <AddPriceListItemModal isOpen={isAddModalOpen} onClose={() => setAddModalOpen(false)} onItemAdded={fetchItems} />
            {selectedItem && <EditPriceListItemModal isOpen={isEditModalOpen} onClose={() => setEditModalOpen(false)} item={selectedItem} onItemUpdated={fetchItems} />}
            {selectedItem && (
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

export default PriceListManagement;
