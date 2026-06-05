'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, RotateCcw, ZoomIn, ZoomOut, Sparkles, Image as ImageIcon, User, Shirt } from 'lucide-react';

interface VirtualTryOnProps {
    productImage: string;
    productName: string;
    category?: string;
    onClose?: () => void;
}

type TryOnMode = 'upload' | 'processing' | 'result';

export function VirtualTryOn({ productImage, productName, category, onClose }: VirtualTryOnProps) {
    const [mode, setMode] = useState<TryOnMode>('upload');
    const [userImage, setUserImage] = useState<string | null>(null);
    const [resultImage, setResultImage] = useState<string | null>(null);
    const [opacity, setOpacity] = useState(0.7);
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) return;
        if (file.size > 5 * 1024 * 1024) return; // 5MB limit

        const reader = new FileReader();
        reader.onload = () => {
            setUserImage(reader.result as string);
            setMode('processing');
            // Simulate AI processing (in production, this would call an AI vision API)
            setTimeout(() => {
                setResultImage(reader.result as string);
                setMode('result');
            }, 2000);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = () => {
                setUserImage(reader.result as string);
                setMode('processing');
                setTimeout(() => {
                    setResultImage(reader.result as string);
                    setMode('result');
                }, 2000);
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (mode !== 'result') return;
        setIsDragging(true);
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y,
        });
    };

    const handleMouseUp = () => setIsDragging(false);

    const handleReset = () => {
        setUserImage(null);
        setResultImage(null);
        setMode('upload');
        setOpacity(0.7);
        setScale(1);
        setPosition({ x: 0, y: 0 });
    };

    const getCategoryHint = () => {
        const cat = (category || '').toLowerCase();
        if (cat.includes('fashion') || cat.includes('cloth') || cat.includes('apparel')) return 'Upload a full-body photo for the best try-on experience';
        if (cat.includes('watch') || cat.includes('jewel') || cat.includes('accessor')) return 'Upload a close-up of your wrist or the relevant body area';
        if (cat.includes('furniture') || cat.includes('home') || cat.includes('decor')) return 'Upload a photo of your room or space';
        if (cat.includes('glass') || cat.includes('eyewear') || cat.includes('sunglass')) return 'Upload a selfie for virtual eyewear fitting';
        return 'Upload your photo to visualize this product';
    };

    return (
        <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950 dark:to-indigo-950 rounded-xl border border-violet-200 dark:border-violet-800 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-violet-200 dark:border-violet-800 bg-white/50 dark:bg-black/20">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
                        <Camera className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-violet-800 dark:text-violet-200">Virtual Try-On</h3>
                        <p className="text-[10px] text-violet-500">{productName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {mode === 'result' && (
                        <button onClick={handleReset} className="p-1.5 text-violet-500 hover:bg-violet-100 rounded-lg transition-colors" title="Reset">
                            <RotateCcw className="w-4 h-4" />
                        </button>
                    )}
                    {onClose && (
                        <button onClick={onClose} className="p-1.5 text-violet-500 hover:bg-violet-100 rounded-lg transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            <AnimatePresence mode="wait">
                {/* Upload State */}
                {mode === 'upload' && (
                    <motion.div
                        key="upload"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4"
                    >
                        <p className="text-xs text-violet-600 dark:text-violet-300 mb-3">{getCategoryHint()}</p>
                        <div
                            onDragOver={handleDragOver}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-violet-300 dark:border-violet-600 rounded-xl bg-white/50 dark:bg-black/20 hover:bg-white/80 dark:hover:bg-black/30 cursor-pointer transition-colors group"
                        >
                            <div className="w-14 h-14 rounded-full bg-violet-100 dark:bg-violet-800 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload className="w-6 h-6 text-violet-500" />
                            </div>
                            <span className="text-sm text-violet-700 dark:text-violet-300 font-medium">Upload Photo</span>
                            <span className="text-[11px] text-violet-400 mt-1">Drag & drop or click • JPG, PNG up to 5MB</span>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>
                        <div className="flex items-center gap-3 mt-3">
                            <div className="flex items-center gap-1.5 text-[10px] text-violet-500">
                                <Sparkles className="w-3 h-3" />
                                <span>AI-powered overlay</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-violet-500">
                                <User className="w-3 h-3" />
                                <span>Photos stay on your device</span>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Processing State */}
                {mode === 'processing' && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-8 text-center"
                    >
                        <div className="relative w-20 h-20 mx-auto mb-4">
                            <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                            <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
                            <Shirt className="absolute inset-0 m-auto w-8 h-8 text-violet-500" />
                        </div>
                        <p className="text-sm font-medium text-violet-700 dark:text-violet-300">Processing your photo...</p>
                        <p className="text-[11px] text-violet-400 mt-1">Generating virtual try-on overlay</p>
                    </motion.div>
                )}

                {/* Result State */}
                {mode === 'result' && resultImage && (
                    <motion.div
                        key="result"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-4"
                    >
                        {/* Try-On Canvas */}
                        <div
                            className="relative rounded-lg overflow-hidden bg-white dark:bg-slate-900 aspect-[3/4] max-h-[400px] cursor-move select-none"
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {/* User photo as background */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={resultImage}
                                alt="Your photo"
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Product overlay */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={productImage}
                                alt={productName}
                                className="absolute pointer-events-none"
                                style={{
                                    opacity,
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                                    top: '10%',
                                    left: '15%',
                                    width: '70%',
                                    mixBlendMode: 'multiply',
                                    filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))',
                                }}
                            />
                        </div>

                        {/* Controls */}
                        <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] text-violet-500 font-medium w-16">Opacity</label>
                                <input
                                    type="range"
                                    min={0.1}
                                    max={1}
                                    step={0.05}
                                    value={opacity}
                                    onChange={e => setOpacity(parseFloat(e.target.value))}
                                    className="flex-1 h-1.5 bg-violet-200 rounded-full appearance-none cursor-pointer accent-violet-600"
                                />
                                <span className="text-[10px] text-violet-400 w-8 text-right">{Math.round(opacity * 100)}%</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="text-[10px] text-violet-500 font-medium w-16">Size</label>
                                <div className="flex items-center gap-2 flex-1">
                                    <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-1 bg-violet-100 rounded hover:bg-violet-200 transition-colors">
                                        <ZoomOut className="w-3.5 h-3.5 text-violet-600" />
                                    </button>
                                    <input
                                        type="range"
                                        min={0.3}
                                        max={2}
                                        step={0.05}
                                        value={scale}
                                        onChange={e => setScale(parseFloat(e.target.value))}
                                        className="flex-1 h-1.5 bg-violet-200 rounded-full appearance-none cursor-pointer accent-violet-600"
                                    />
                                    <button onClick={() => setScale(s => Math.min(2, s + 0.1))} className="p-1 bg-violet-100 rounded hover:bg-violet-200 transition-colors">
                                        <ZoomIn className="w-3.5 h-3.5 text-violet-600" />
                                    </button>
                                </div>
                                <span className="text-[10px] text-violet-400 w-8 text-right">{Math.round(scale * 100)}%</span>
                            </div>
                        </div>

                        <p className="text-[10px] text-violet-400 mt-2 text-center">
                            Drag the product overlay to reposition • Use sliders to adjust
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
