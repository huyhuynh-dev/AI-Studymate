"use client";

import React, { useRef, useState, DragEvent, ChangeEvent } from "react";
import { Plus, FileText, Image as ImageIcon, ScanText, Sparkles, Brain } from "lucide-react";

export interface DocumentsTabProps {
    /** Callback khi người dùng tải lên file hoặc thả file vào khu vực */
    onUpload?: (files: File[]) => void;
    /** Class tùy chọn cho container ngoài cùng */
    className?: string;
    /** Kích thước file tối đa cho phép (mặc định 50MB) */
    maxSizeMB?: number;
}

export default function DocumentsTab({
    onUpload,
    className = "",
    maxSizeMB = 50,
}: DocumentsTabProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const filesArray = Array.from(e.target.files);
            onUpload?.(filesArray);
            // Reset input value để cho phép chọn lại cùng 1 file
            e.target.value = "";
        }
    };

    const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const filesArray = Array.from(e.dataTransfer.files);
            onUpload?.(filesArray);
        }
    };

    const handleTriggerUpload = () => {
        fileInputRef.current?.click();
    };

    return (
        <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative flex w-full flex-col items-center justify-center rounded-3xl border transition-all duration-200 select-none ${isDragging
                ? "border-indigo-400 bg-indigo-50/70 ring-4 ring-indigo-100"
                : "border-blue-100/80 bg-[#F4F7FF]"
                } px-6 py-12 sm:px-12 sm:py-16 text-center ${className}`}
        >
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.doc,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Main Illustration Badge */}
            <div className="relative mb-6 sm:mb-8 flex items-center justify-center">
                {/* Rounded square container */}
                <div className="relative flex h-28 w-28 sm:h-32 sm:w-32 items-center justify-center rounded-3xl bg-[#ECE7FE] shadow-xs">
                    {/* Layered Document Illustration */}
                    <div className="relative flex items-center justify-center">
                        {/* Background layer card outline */}
                        <svg
                            className="absolute -top-1.5 -left-1.5 h-14 w-12 text-indigo-400 opacity-60"
                            viewBox="0 0 48 56"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path
                                d="M4 6C4 3.79086 5.79086 2 8 2H30L44 16V50C44 52.2091 42.2091 54 40 54H8C5.79086 54 4 52.2091 4 50V6Z"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* Foreground document */}
                        <div className="relative z-10 flex h-14 w-12 flex-col items-center justify-center rounded-lg border-[2.5px] border-[#3730A3] bg-white/20 backdrop-blur-xs">
                            {/* Folded corner indicator */}
                            <div className="absolute top-0 right-0 h-3 w-3 border-b-2 border-l-2 border-[#3730A3] bg-[#ECE7FE] rounded-bl-sm" />
                            {/* PDF badge box */}
                            <div className="mt-1 flex items-center justify-center rounded border border-[#3730A3] px-1 py-0.5">
                                <span className="text-[10px] font-extrabold tracking-tight text-[#3730A3]">
                                    PDF
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Sparkles Badge (Top-Right) */}
                    <div className="absolute -top-2.5 -right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-linear-to-tr from-[#6366F1] to-[#7C3AED] shadow-md shadow-indigo-500/25">
                        <Sparkles className="h-4.5 w-4.5 text-white fill-white" />
                    </div>

                    {/* Brain / AI Badge (Bottom-Left) */}
                    <div className="absolute -bottom-2 -left-2 flex h-8 w-8 items-center justify-center rounded-xl bg-[#34D399] shadow-md shadow-emerald-500/20">
                        <Brain className="h-4.5 w-4.5 text-[#064E3B]" />
                    </div>
                </div>
            </div>

            {/* Title */}
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Bắt đầu Không gian học tập của bạn
            </h2>

            {/* Subtitle / Description */}
            <p className="mt-2.5 max-w-xl text-center text-sm sm:text-[15px] leading-relaxed text-gray-600">
                Chưa có tài liệu nào trong phiên học này. Tải lên file PDF hoặc ảnh chụp bài giảng
                (JPEG, PNG) để AI StudyMate giúp bạn tóm tắt, tạo flashcard và giải đáp thắc
                mắc chuyên sâu.
            </p>

            {/* Upload Button */}
            <button
                type="button"
                onClick={handleTriggerUpload}
                className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-6 py-3 text-sm sm:text-base font-semibold text-white shadow-md shadow-indigo-500/25 transition-all hover:bg-[#4338CA] hover:shadow-lg hover:shadow-indigo-500/30 active:scale-[0.98] cursor-pointer"
            >
                <Plus className="h-5 w-5 stroke-[2.5]" />
                <span>Tải lên tài liệu</span>
            </button>

            {/* Drag & drop hint */}
            <p className="mt-3.5 text-xs sm:text-sm text-gray-500">
                Hoặc kéo và thả tệp tài liệu trực tiếp vào đây (Tối đa {maxSizeMB}MB)
            </p>

            {/* File type support pills */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
                {/* PDF chip */}
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
                    <span className="flex items-center justify-center rounded-[3px] border border-red-500 bg-red-50 px-1 py-0.2 text-[9px] font-black text-red-600 leading-none">
                        PDF
                    </span>
                    <span>PDF</span>
                </div>

                {/* DOCX chip */}
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    <span>DOCX</span>
                </div>

                {/* PNG / JPG chip */}
                <div className="flex items-center gap-1.5 rounded-full border border-gray-200/90 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
                    <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                    <span>PNG / JPG</span>
                </div>

                {/* Quét OCR tự động chip */}
                <div className="flex items-center gap-1.5 rounded-full border border-indigo-100 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-600 shadow-xs">
                    <ScanText className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Quét OCR tự động</span>
                </div>
            </div>
        </div>
    );
}
