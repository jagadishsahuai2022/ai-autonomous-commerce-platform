'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, FolderHeart, Plus, X, Check, Sparkles } from 'lucide-react';
import { useWishlistStore, WishlistCollectionData } from '@/lib/store/wishlist.store';

interface WishlistPickerModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: { id: string; name: string; price?: number; imageUrl?: string };
    onComplete?: (action: 'added' | 'removed', collectionName?: string) => void;
}

export function WishlistPickerModal({ isOpen, onClose, product, onComplete }: WishlistPickerModalProps) {
    const { collections, items, fetchWishlists, addItem, removeItem, createCollection, loaded } = useWishlistStore();
    const [showNewInput, setShowNewInput] = useState(false);
    const [newName, setNewName] = useState('');
    const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);
    const [processing, setProcessing] = useState(false);

    const isWishlisted = items.some(i => String(i.productId) === String(product.id));
    const currentCollectionId = items.find(i => String(i.productId) === String(product.id))?.collectionId;

    useEffect(() => {
        if (isOpen && !loaded) {
            fetchWishlists();
        }
    }, [isOpen, loaded, fetchWishlists]);

    useEffect(() => {
        if (isOpen && currentCollectionId) {
            setSelectedCollectionId(currentCollectionId);
        } else if (isOpen && collections.length > 0) {
            const def = collections.find(c => c.isDefault);
            setSelectedCollectionId(def?.id || collections[0].id);
        }
    }, [isOpen, collections, currentCollectionId]);

    const handleAddToWishlist = async () => {
        if (!selectedCollectionId) return;
        setProcessing(true);
        await addItem(product, selectedCollectionId);
        const colName = collections.find(c => c.id === selectedCollectionId)?.name || 'Wishlist';
        setProcessing(false);
        onComplete?.('added', colName);
        onClose();
    };

    const handleRemoveFromWishlist = async () => {
        setProcessing(true);
        await removeItem(String(product.id));
        setProcessing(false);
        onComplete?.('removed');
        onClose();
    };

    const handleCreateAndSelect = async () => {
        const name = newName.trim();
        if (!name) return;
        setProcessing(true);
        const col = await createCollection(name);
        if (col) {
            setSelectedCollectionId(col.id);
        }
        setNewName('');
        setShowNewInput(false);
        setProcessing(false);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="relative px-5 pt-5 pb-3">
                        <button onClick={onClose} className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <X size={18} className="text-gray-400" />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${isWishlisted ? 'bg-red-50 dark:bg-red-900/20' : 'bg-violet-50 dark:bg-violet-900/20'}`}>
                                <Heart size={20} className={isWishlisted ? 'fill-red-500 text-red-500' : 'text-violet-600 dark:text-violet-400'} />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                                    {isWishlisted ? 'Update Wishlist' : 'Save to Wishlist'}
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{product.name}</p>
                            </div>
                        </div>
                    </div>

                    {/* Collection List */}
                    <div className="px-5 pb-2 max-h-52 overflow-y-auto">
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Choose a collection</p>
                        <div className="space-y-1.5">
                            {collections.map(col => (
                                <button
                                    key={col.id}
                                    onClick={() => setSelectedCollectionId(col.id)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${selectedCollectionId === col.id
                                            ? 'bg-violet-50 dark:bg-violet-900/30 border-2 border-violet-400 dark:border-violet-600 text-violet-700 dark:text-violet-300'
                                            : 'bg-gray-50 dark:bg-gray-800 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                        }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${col.isDefault ? 'bg-pink-100 dark:bg-pink-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
                                        }`}>
                                        {col.isDefault
                                            ? <Heart size={14} className="text-pink-500" />
                                            : <FolderHeart size={14} className="text-blue-500" />}
                                    </div>
                                    <div className="flex-1 text-left min-w-0">
                                        <span className="font-medium truncate block">{col.name}</span>
                                        <span className="text-[10px] text-gray-400">
                                            {items.filter(i => i.collectionId === col.id).length} items
                                        </span>
                                    </div>
                                    {selectedCollectionId === col.id && (
                                        <Check size={16} className="text-violet-500 flex-shrink-0" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Create New Collection */}
                    <div className="px-5 pb-3">
                        {showNewInput ? (
                            <div className="flex items-center gap-2 mt-1">
                                <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                                    <Sparkles size={14} className="text-violet-500 flex-shrink-0" />
                                    <input
                                        value={newName}
                                        onChange={e => setNewName(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleCreateAndSelect()}
                                        placeholder="e.g., Birthday Ideas"
                                        className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    onClick={handleCreateAndSelect}
                                    disabled={!newName.trim() || processing}
                                    className="px-3 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 rounded-lg transition-colors"
                                >
                                    Create
                                </button>
                                <button onClick={() => { setShowNewInput(false); setNewName(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowNewInput(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-xl text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50/50 dark:bg-violet-900/10 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors border border-dashed border-violet-200 dark:border-violet-800"
                            >
                                <Plus size={14} />
                                Create New Wishlist
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="px-5 pb-5 flex gap-2">
                        {isWishlisted && (
                            <button
                                onClick={handleRemoveFromWishlist}
                                disabled={processing}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                            >
                                Remove
                            </button>
                        )}
                        <button
                            onClick={handleAddToWishlist}
                            disabled={!selectedCollectionId || processing}
                            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 shadow-lg shadow-violet-200/50 dark:shadow-violet-900/30"
                        >
                            {processing ? 'Saving...' : isWishlisted ? 'Move to Selected' : 'Save to Wishlist'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
