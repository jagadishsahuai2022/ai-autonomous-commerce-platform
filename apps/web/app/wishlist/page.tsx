'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ShoppingCart, Trash2, ArrowLeft, Plus, FolderHeart, ChevronDown, Pencil, X, Check, Heart } from 'lucide-react';
import Link from 'next/link';
import { useWishlistStore, WishlistItemData, WishlistCollectionData } from '@/lib/store/wishlist.store';

function addItemToCart(item: { id: string; name: string; price: number; image?: string; inStock?: boolean }) {
  try {
    const raw = localStorage.getItem('cart');
    const cart: any[] = raw ? JSON.parse(raw) : [];
    const existing = cart.find((i) => i.productId === item.id);
    if (existing) {
      existing.quantity = (existing.quantity || 1) + 1;
    } else {
      cart.push({
        id: `cart-${item.id}-${Date.now()}`,
        productId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        image: item.image,
        stock: 99,
      });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    window.dispatchEvent(new Event('cartUpdated'));
  } catch { }
}

function WishlistProductCard({
  product,
  onRemove,
  onAddToCart,
  selected,
  onSelect,
  collections,
  currentCollectionId,
  onMoveToCollection,
}: {
  product: WishlistItemData;
  onRemove: () => void;
  onAddToCart: () => void;
  selected: boolean;
  onSelect: () => void;
  collections: WishlistCollectionData[];
  currentCollectionId: number;
  onMoveToCollection: (collectionId: number) => void;
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden group relative">
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10">
        <input type="checkbox" checked={selected} onChange={onSelect} className="w-4 h-4 cursor-pointer" />
        <div className="flex items-center gap-1">
          {collections.length > 0 && (
            <div className="relative">
              <button
                onClick={(e) => { e.preventDefault(); setShowMoveMenu(!showMoveMenu); }}
                className="p-1 bg-white dark:bg-gray-800 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="Move to collection"
              >
                <FolderHeart size={14} className="text-blue-600 dark:text-blue-400" />
              </button>
              {showMoveMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[140px] z-20">
                  {collections.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { onMoveToCollection(c.id); setShowMoveMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={(e) => { e.preventDefault(); onRemove(); }}
            className="p-1 bg-white dark:bg-gray-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 size={14} className="text-red-600 dark:text-red-400" />
          </button>
        </div>
      </div>

      <Link href={`/products/${product.productId}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl || '/product-placeholder.svg'}
          alt={product.productName}
          className="w-full h-36 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = '/product-placeholder.svg'; }}
        />
      </Link>

      <div className="p-3">
        <Link href={`/products/${product.productId}`}>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 mb-1 hover:text-blue-600 transition-colors">{product.productName}</h3>
        </Link>

        <div className="flex items-baseline gap-1.5 mb-3">
          <span className="text-base font-bold text-gray-900 dark:text-white">
            {product.price != null ? `₹${product.price.toLocaleString('en-IN')}` : '—'}
          </span>
        </div>

        <button
          onClick={onAddToCart}
          className="w-full py-1.5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 text-xs font-semibold rounded flex items-center justify-center gap-1.5 transition-colors"
        >
          <ShoppingCart size={13} />
          Add to Cart
        </button>
      </div>
    </div>
  );
}

export default function WishlistPage() {
  const {
    collections, items, loaded, loading,
    fetchWishlists, removeItem, removeItemById, moveItem,
    createCollection, renameCollection, deleteCollection,
    getCollectionItems,
  } = useWishlistStore();

  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [editingCollectionId, setEditingCollectionId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (!loaded) fetchWishlists();
  }, [loaded, fetchWishlists]);

  // Auto-select first collection when loaded
  useEffect(() => {
    if (loaded && collections.length > 0 && activeCollectionId === null) {
      const def = collections.find(c => c.isDefault);
      setActiveCollectionId(def?.id ?? collections[0].id);
    }
  }, [loaded, collections, activeCollectionId]);

  const activeCollection = useMemo(
    () => collections.find(c => c.id === activeCollectionId) || collections[0],
    [collections, activeCollectionId]
  );

  const wishlistItems = useMemo(
    () => activeCollectionId != null ? getCollectionItems(activeCollectionId) : [],
    [activeCollectionId, getCollectionItems, items]
  );

  const handleSetActiveCollection = (id: number) => {
    setActiveCollectionId(id);
    setSelectedItems(new Set());
  };

  const handleCreateCollection = async () => {
    const name = newCollectionName.trim();
    if (!name) return;
    const coll = await createCollection(name);
    if (coll) setActiveCollectionId(coll.id);
    setNewCollectionName('');
    setShowNewCollection(false);
    setSelectedItems(new Set());
  };

  const handleRenameCollection = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    await renameCollection(id, name);
    setEditingCollectionId(null);
  };

  const handleDeleteCollection = async (id: number) => {
    const coll = collections.find(c => c.id === id);
    if (coll?.isDefault) return;
    await deleteCollection(id);
    if (activeCollectionId === id) {
      const def = collections.find(c => c.isDefault);
      setActiveCollectionId(def?.id ?? collections[0]?.id ?? null);
    }
    setSelectedItems(new Set());
  };

  const handleRemoveItem = async (item: WishlistItemData) => {
    await removeItemById(item.id);
    setSelectedItems(prev => { const next = new Set(prev); next.delete(item.id); return next; });
    window.dispatchEvent(new Event('wishlistUpdated'));
  };

  const handleSelectItem = (id: number) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMoveToCart = async (item: WishlistItemData) => {
    addItemToCart({
      id: item.productId,
      name: item.productName,
      price: item.price ?? 0,
      image: item.imageUrl ?? undefined,
    });
    await removeItemById(item.id);
    window.dispatchEvent(new Event('wishlistUpdated'));
  };

  const handleMoveSelectedToCart = async () => {
    const itemsToMove = selectedItems.size === 0
      ? wishlistItems
      : wishlistItems.filter(item => selectedItems.has(item.id));
    for (const item of itemsToMove) {
      addItemToCart({
        id: item.productId,
        name: item.productName,
        price: item.price ?? 0,
        image: item.imageUrl ?? undefined,
      });
      await removeItemById(item.id);
    }
    setSelectedItems(new Set());
    window.dispatchEvent(new Event('wishlistUpdated'));
  };

  const handleMoveToCollection = async (itemId: number, targetCollectionId: number) => {
    if (targetCollectionId === activeCollectionId) return;
    await moveItem(itemId, targetCollectionId);
  };

  const totalPrice = wishlistItems.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const totalAllCollections = items.length;

  if (!loaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 text-sm">Loading wishlists...</p>
        </div>
      </div>
    );
  }

  if (collections.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">💔</div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Your wishlist is empty</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Save items you love to find them easily later.</p>
          <Link href="/products" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-full mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Link href="/products" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
                <ArrowLeft size={20} className="text-gray-700 dark:text-gray-300" />
              </Link>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                My Wishlists ({totalAllCollections})
              </h1>
            </div>
            <button
              onClick={() => setShowNewCollection(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
            >
              <Plus size={14} />
              New Wishlist
            </button>
          </div>

          {/* Collection tabs */}
          <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
            {collections.map(c => (
              <div key={c.id} className="flex-shrink-0 relative group">
                {editingCollectionId === c.id ? (
                  <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-violet-300 rounded-lg px-2 py-1">
                    <input
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleRenameCollection(c.id)}
                      className="text-xs bg-transparent outline-none w-24 text-gray-900 dark:text-white"
                      autoFocus
                    />
                    <button onClick={() => handleRenameCollection(c.id)} className="p-0.5 text-green-600"><Check size={12} /></button>
                    <button onClick={() => setEditingCollectionId(null)} className="p-0.5 text-gray-400"><X size={12} /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSetActiveCollection(c.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${c.id === activeCollectionId
                      ? 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border border-violet-300 dark:border-violet-700'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent'
                      }`}
                  >
                    {c.isDefault ? <Heart size={12} className="text-pink-500" /> : <FolderHeart size={12} />}
                    {c.name}
                    <span className="text-[10px] opacity-60">({getCollectionItems(c.id).length})</span>
                  </button>
                )}
                {/* Edit/Delete options on hover — not for default */}
                {!c.isDefault && editingCollectionId !== c.id && c.id === activeCollectionId && (
                  <div className="absolute -top-1 -right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCollectionId(c.id); setEditName(c.name); }}
                      className="p-0.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 shadow-sm hover:bg-blue-50"
                    >
                      <Pencil size={9} className="text-blue-600" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteCollection(c.id); }}
                      className="p-0.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 shadow-sm hover:bg-red-50"
                    >
                      <X size={9} className="text-red-500" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* New collection input */}
          <AnimatePresence>
            {showNewCollection && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 mt-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <FolderHeart size={16} className="text-violet-500 flex-shrink-0" />
                  <input
                    value={newCollectionName}
                    onChange={e => setNewCollectionName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCreateCollection()}
                    placeholder="Wishlist name (e.g., Birthday Ideas)"
                    className="flex-1 text-sm bg-transparent outline-none text-gray-900 dark:text-white placeholder-gray-400"
                    autoFocus
                  />
                  <button onClick={handleCreateCollection} disabled={!newCollectionName.trim()} className="px-3 py-1 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 disabled:bg-gray-300 rounded-lg transition-colors">
                    Create
                  </button>
                  <button onClick={() => { setShowNewCollection(false); setNewCollectionName(''); }} className="p-1 text-gray-400 hover:text-gray-600">
                    <X size={16} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {wishlistItems.length > 0 ? (
              <><strong>{activeCollection.name}</strong> — {selectedItems.size} of {wishlistItems.length} item{wishlistItems.length !== 1 ? 's' : ''} selected</>
            ) : (
              <><strong>{activeCollection.name}</strong> is empty</>
            )}
          </p>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 py-6">
        {wishlistItems.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
            <div className="text-6xl mb-4">💔</div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{activeCollection.name} is empty</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Add items to this wishlist to save them for later</p>
            <Link href="/products" className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors">
              Start Shopping
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {wishlistItems.map((product) => (
                  <motion.div key={product.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <WishlistProductCard
                      product={product}
                      onRemove={() => handleRemoveItem(product)}
                      onAddToCart={() => handleMoveToCart(product)}
                      selected={selectedItems.has(product.id)}
                      onSelect={() => handleSelectItem(product.id)}
                      collections={collections.filter(c => c.id !== activeCollectionId)}
                      currentCollectionId={activeCollectionId!}
                      onMoveToCollection={(collId) => handleMoveToCollection(product.id, collId)}
                    />
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-1">
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="sticky top-24 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 space-y-4"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Price Details — {activeCollection.name}</h3>
                  <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    <div className="flex justify-between">
                      <span>Total Items:</span>
                      <span className="font-medium">{wishlistItems.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Selected:</span>
                      <span className="font-medium">{selectedItems.size}</span>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-1 mt-1">
                      <div className="flex justify-between font-semibold text-gray-900 dark:text-white">
                        <span>Total Price:</span>
                        <span>₹{totalPrice.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    onClick={handleMoveSelectedToCart}
                    disabled={wishlistItems.length === 0}
                    className={`w-full py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${wishlistItems.length === 0
                      ? 'bg-gray-200 dark:bg-gray-800 text-gray-500 cursor-not-allowed'
                      : 'bg-yellow-400 hover:bg-yellow-500 text-gray-900'
                      }`}
                  >
                    <ShoppingCart size={16} />
                    {selectedItems.size > 0
                      ? `Move to Cart (${selectedItems.size})`
                      : `Move All to Cart (${wishlistItems.length})`}
                  </button>

                  <Link
                    href="/products"
                    className="block w-full py-2 rounded-lg font-semibold text-sm text-center bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 transition-colors"
                  >
                    Continue Shopping
                  </Link>
                </div>

                {/* All collections summary */}
                {collections.length > 1 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                    <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-2">All Wishlists</p>
                    <div className="space-y-1">
                      {collections.map(c => (
                        <button
                          key={c.id}
                          onClick={() => handleSetActiveCollection(c.id)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-xs transition-colors ${c.id === activeCollectionId ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
                        >
                          <span className="truncate">{c.name}</span>
                          <span className="text-[10px] opacity-60 flex-shrink-0 ml-2">{getCollectionItems(c.id).length} items</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                  💡 Tip: Create multiple wishlists to organize your favorites by occasion, category, or priority
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
