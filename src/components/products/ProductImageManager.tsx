import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Link2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Star,
  Eye,
  Loader2,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  X,
  RotateCcw,
  Ban,
  FileImage,
  Server
} from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

interface ProductImageManagerProps {
  mainImageUrl: string;
  galleryImages: string[];
  onChange: (mainUrl: string, gallery: string[]) => void;
  maxImages?: number;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif'];

export const ProductImageManager: React.FC<ProductImageManagerProps> = ({
  mainImageUrl,
  galleryImages = [],
  onChange,
  maxImages = 6,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');

  // URL state
  const [urlInput, setUrlInput] = useState<string>('');
  const [isVerifyingUrl, setIsVerifyingUrl] = useState<boolean>(false);
  const [urlVerifyStatus, setUrlVerifyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [urlErrorMessage, setUrlErrorMessage] = useState<string>('');
  const [verifiedUrlPreview, setVerifiedUrlPreview] = useState<string>('');

  // Device upload state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [instantPreviewUrl, setInstantPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [bytesTransferred, setBytesTransferred] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'preparing' | 'uploading' | 'success' | 'error' | 'cancelled'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>('');
  const [activeEngine, setActiveEngine] = useState<'firebase' | 'server'>('firebase');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // Active upload canceller
  const cancelUploadRef = useRef<(() => void) | null>(null);
  const timeoutTimerRef = useRef<any>(null);

  // Large preview modal
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (instantPreviewUrl && instantPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(instantPreviewUrl);
      }
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
      }
      if (cancelUploadRef.current) {
        cancelUploadRef.current();
      }
    };
  }, [instantPreviewUrl]);

  // Normalize image list (unique, non-empty, main image always included)
  const allImages = React.useMemo(() => {
    const list: string[] = [];
    if (mainImageUrl && mainImageUrl.trim()) {
      list.push(mainImageUrl.trim());
    }
    for (const img of galleryImages) {
      if (img && img.trim() && !list.includes(img.trim())) {
        list.push(img.trim());
      }
    }
    return list;
  }, [mainImageUrl, galleryImages]);

  // Clean URL helper
  const cleanUrl = (raw: string): string => {
    let trimmed = raw.trim();
    if (!trimmed) return '';
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = 'https://' + trimmed;
    }
    return trimmed;
  };

  // Format bytes helper
  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes >= 1024 * 1024) {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return Math.round(bytes / 1024) + ' KB';
  };

  // Real-time URL Image verification
  const verifyImageUrl = (raw: string) => {
    const targetUrl = cleanUrl(raw);
    if (!targetUrl) {
      setUrlVerifyStatus('idle');
      setUrlErrorMessage('');
      setVerifiedUrlPreview('');
      return;
    }

    setIsVerifyingUrl(true);
    setUrlVerifyStatus('idle');
    setUrlErrorMessage('');

    const img = new Image();
    let isCancelled = false;

    const timeoutId = setTimeout(() => {
      if (!isCancelled) {
        setIsVerifyingUrl(false);
        setUrlVerifyStatus('invalid');
        setUrlErrorMessage('หมดเวลาการโหลดรูปภาพ (Timeout) กรุณาตรวจสอบว่า URL เปิดเข้าถึงได้');
      }
    }, 8000);

    img.onload = () => {
      clearTimeout(timeoutId);
      if (!isCancelled) {
        setIsVerifyingUrl(false);
        setUrlVerifyStatus('valid');
        setUrlErrorMessage('');
        setVerifiedUrlPreview(targetUrl);
      }
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      if (!isCancelled) {
        setIsVerifyingUrl(false);
        setUrlVerifyStatus('invalid');
        setUrlErrorMessage('ไม่สามารถโหลดรูปภาพจาก URL นี้ได้ กรุณาตรวจสอบลิงก์หรือการอนุญาตเข้าถึง');
      }
    };

    img.src = targetUrl;
  };

  const handleUrlInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setUrlInput(val);
    if (val.trim()) {
      verifyImageUrl(val);
    } else {
      setUrlVerifyStatus('idle');
      setUrlErrorMessage('');
      setVerifiedUrlPreview('');
    }
  };

  // Add verified URL to product images
  const handleAddUrlImage = () => {
    const target = cleanUrl(urlInput);
    if (!target || urlVerifyStatus !== 'valid') return;

    if (allImages.includes(target)) {
      setUrlErrorMessage('รูปภาพนี้มีอยู่ในรายการสินค้าแล้ว');
      return;
    }

    if (allImages.length >= maxImages) {
      setUrlErrorMessage(`เพิ่มรูปภาพได้สูงสุด ${maxImages} รูปต่อสินค้า`);
      return;
    }

    let newMain = mainImageUrl;
    let newGallery = [...galleryImages];

    if (!newMain) {
      newMain = target;
    } else {
      newGallery.push(target);
    }

    onChange(newMain, newGallery);
    setUrlInput('');
    setUrlVerifyStatus('idle');
    setVerifiedUrlPreview('');
  };

  // Upload file via App Server endpoint (/api/upload) with genuine XMLHttpRequest progress
  const uploadViaServer = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพจากอุปกรณ์ได้'));
      };

      reader.onload = () => {
        const base64Data = reader.result as string;
        const xhr = new XMLHttpRequest();

        cancelUploadRef.current = () => {
          xhr.abort();
          reject(new Error('USER_CANCELLED'));
        };

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const pct = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(pct);
            setBytesTransferred(event.loaded);
            setTotalBytes(event.total);
          }
        };

        xhr.onload = () => {
          cancelUploadRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const res = JSON.parse(xhr.responseText);
              if (res.url) {
                setUploadProgress(100);
                resolve(res.url);
              } else {
                reject(new Error('เซิร์ฟเวอร์ไม่ส่ง URL รูปภาพกลับมา'));
              }
            } catch (parseErr) {
              reject(new Error('เซิร์ฟเวอร์ส่งข้อมูลตอบกลับไม่ถูกต้อง'));
            }
          } else {
            let msg = `เซิร์ฟเวอร์ขัดข้อง (HTTP ${xhr.status})`;
            try {
              const errObj = JSON.parse(xhr.responseText);
              if (errObj.error) msg = errObj.error;
            } catch {}
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => {
          cancelUploadRef.current = null;
          reject(new Error('เกิดข้อผิดพลาดในการเชื่อมต่อเน็ตเวิร์ก (Network Error)'));
        };

        xhr.ontimeout = () => {
          cancelUploadRef.current = null;
          reject(new Error('การอัปโหลดหมดเวลาเชื่อมต่อ (Connection Timeout)'));
        };

        xhr.open('POST', '/api/upload', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 30000; // 30s timeout

        xhr.send(
          JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'image/jpeg',
            base64: base64Data,
          })
        );
      };

      reader.readAsDataURL(file);
    });
  }, []);

  // Upload file via Firebase Storage resumable upload
  const uploadViaFirebase = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filename = `products/${Date.now()}_${safeName}`;
        const storageRef = ref(storage, filename);

        const uploadTask = uploadBytesResumable(storageRef, file, {
          contentType: file.type,
        });

        // Set cancel hook
        cancelUploadRef.current = () => {
          try {
            uploadTask.cancel();
          } catch {}
          reject(new Error('USER_CANCELLED'));
        };

        // Strict connection timeout: if Firebase Storage is 404 or hangs, fail fast to fallback
        const connectionTimeout = setTimeout(() => {
          if (uploadTask.snapshot.bytesTransferred === 0) {
            try {
              uploadTask.cancel();
            } catch {}
            reject(new Error('FIREBASE_STORAGE_UNAVAILABLE'));
          }
        }, 6000);

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            if (snapshot.bytesTransferred > 0) {
              clearTimeout(connectionTimeout);
            }
            const transferred = snapshot.bytesTransferred;
            const total = snapshot.totalBytes;
            setBytesTransferred(transferred);
            setTotalBytes(total);

            // Genuine progress calculation: strictly from bytesTransferred / totalBytes
            const progress = total > 0 ? Math.round((transferred / total) * 100) : 0;
            setUploadProgress(progress);
          },
          (error) => {
            clearTimeout(connectionTimeout);
            cancelUploadRef.current = null;
            reject(error);
          },
          async () => {
            clearTimeout(connectionTimeout);
            cancelUploadRef.current = null;
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadUrl);
            } catch (err) {
              reject(err);
            }
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  }, []);

  // Execute full upload process with automatic fallback and genuine error reporting
  const executeUpload = async (file: File) => {
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setBytesTransferred(0);
    setTotalBytes(file.size);
    setUploadErrorMessage('');

    let finalDownloadUrl: string | null = null;

    // Phase 1: Try Firebase Storage resumable upload
    try {
      setActiveEngine('firebase');
      finalDownloadUrl = await uploadViaFirebase(file);
    } catch (fbErr: any) {
      // Check if user manually cancelled
      if (fbErr?.message === 'USER_CANCELLED' || fbErr?.code === 'storage/canceled') {
        setIsUploading(false);
        setUploadStatus('cancelled');
        setUploadProgress(0);
        setUploadErrorMessage('ยกเลิกการอัปโหลดเรียบร้อยแล้ว');
        return;
      }

      console.warn('Firebase Storage upload failed or not provisioned, switching to App Server Storage:', fbErr);

      // Phase 2: Automatic fallback to App Server Storage (/api/upload)
      try {
        setActiveEngine('server');
        setUploadErrorMessage(
          'Firebase Storage ไม่พร้อมใช้งาน กำลังสลับไปอัปโหลดผ่าน App Server Storage อัตโนมัติ...'
        );
        finalDownloadUrl = await uploadViaServer(file);
      } catch (serverErr: any) {
        if (serverErr?.message === 'USER_CANCELLED') {
          setIsUploading(false);
          setUploadStatus('cancelled');
          setUploadProgress(0);
          setUploadErrorMessage('ยกเลิกการอัปโหลดเรียบร้อยแล้ว');
          return;
        }

        console.error('All upload engines failed:', serverErr);
        setIsUploading(false);
        setUploadStatus('error');
        setUploadErrorMessage(
          `อัปโหลดไม่สำเร็จ: ${serverErr?.message || fbErr?.message || 'ไม่สามารถส่งรูปภาพได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'}`
        );
        return;
      }
    }

    // Phase 3: Successful upload completion
    if (finalDownloadUrl) {
      setIsUploading(false);
      setUploadStatus('success');
      setUploadProgress(100);
      setUploadErrorMessage('');

      // Add to product images and update parent immediately
      let newMain = mainImageUrl;
      let newGallery = [...galleryImages];

      if (!newMain) {
        newMain = finalDownloadUrl;
      } else {
        if (!newGallery.includes(finalDownloadUrl)) {
          newGallery.push(finalDownloadUrl);
        }
      }

      onChange(newMain, newGallery);

      // Clean up local instant preview after successful sync
      setTimeout(() => {
        setSelectedFile(null);
        if (instantPreviewUrl && instantPreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(instantPreviewUrl);
        }
        setInstantPreviewUrl(null);
        setUploadStatus('idle');
      }, 1500);
    }
  };

  // Handle file selection from gallery or camera
  const handleFileSelected = (file: File) => {
    setUploadErrorMessage('');

    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
      setUploadErrorMessage('รองรับเฉพาะไฟล์รูปภาพ JPG, JPEG, PNG, WebP และ GIF เท่านั้น');
      return;
    }

    // Check File Size limit
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
      setUploadErrorMessage(
        `ขนาดไฟล์ ${sizeMb} MB เกินกำหนด (จำกัดขนาดไม่เกิน ${MAX_FILE_SIZE_MB} MB)`
      );
      return;
    }

    if (allImages.length >= maxImages) {
      setUploadErrorMessage(`เพิ่มรูปภาพได้สูงสุด ${maxImages} รูปต่อสินค้า`);
      return;
    }

    // Revoke previous blob URL if exists
    if (instantPreviewUrl && instantPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(instantPreviewUrl);
    }

    // STEP 1: Show Instant Preview immediately
    const localUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setInstantPreviewUrl(localUrl);
    setUploadStatus('preparing');
    setUploadProgress(0);
    setBytesTransferred(0);
    setTotalBytes(file.size);

    // STEP 2: Start upload automatically
    executeUpload(file);
  };

  // Handle Cancel Upload
  const handleCancelUpload = () => {
    if (cancelUploadRef.current) {
      cancelUploadRef.current();
    }
    setIsUploading(false);
    setUploadStatus('cancelled');
    setUploadProgress(0);
    setUploadErrorMessage('ยกเลิกการอัปโหลดแล้ว');
  };

  // Handle Retry Upload
  const handleRetryUpload = () => {
    if (selectedFile) {
      executeUpload(selectedFile);
    }
  };

  // Handle Clear Selected File
  const handleClearSelected = () => {
    handleCancelUpload();
    setSelectedFile(null);
    if (instantPreviewUrl && instantPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(instantPreviewUrl);
    }
    setInstantPreviewUrl(null);
    setUploadStatus('idle');
    setUploadErrorMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  // Set Main Image
  const handleSetMain = (targetUrl: string) => {
    if (targetUrl === mainImageUrl) return;
    const remaining = allImages.filter((img) => img !== targetUrl);
    onChange(targetUrl, remaining);
  };

  // Delete Image
  const handleDeleteImage = (targetUrl: string) => {
    const remaining = allImages.filter((img) => img !== targetUrl);
    if (targetUrl === mainImageUrl) {
      const nextMain = remaining[0] || '';
      const nextGallery = remaining.slice(1);
      onChange(nextMain, nextGallery);
    } else {
      onChange(mainImageUrl, remaining.filter((img) => img !== mainImageUrl));
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Tab Controls */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <ImageIcon className="w-4 h-4 text-blue-600" />
            <span>จัดการรูปภาพสินค้า (Product Images)</span>
          </label>
          <span className="text-[11px] font-medium text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
            {allImages.length} / {maxImages} รูป
          </span>
        </div>

        {/* Tab switch */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'upload'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-4 h-4 text-blue-600" />
            <span>อัปโหลดจากเครื่อง</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition ${
              activeTab === 'url'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Link2 className="w-4 h-4 text-blue-600" />
            <span>ใส่ลิงก์ URL รูปภาพ</span>
          </button>
        </div>
      </div>

      {/* Mode A: Device File Upload */}
      {activeTab === 'upload' && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg,image/gif"
            onChange={handleInputChange}
            className="hidden"
          />

          {/* Upload Dropzone */}
          {!instantPreviewUrl && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-5 md:p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5 select-none ${
                isDragOver
                  ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                  : 'border-slate-300 bg-slate-50/60 hover:bg-blue-50/40 hover:border-blue-400'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-xs">
                <UploadCloud className="w-6 h-6" />
              </div>

              <div>
                <p className="text-xs md:text-sm font-bold text-slate-800">
                  แตะเพื่อเลือกรูปภาพจากคลัง หรือลากไฟล์มาวางที่นี่
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  รองรับ iPhone, iPad, Android, Windows, Mac (JPG, PNG, WebP สูงสุด {MAX_FILE_SIZE_MB}MB)
                </p>
              </div>

              <button
                type="button"
                disabled={allImages.length >= maxImages}
                className="mt-1 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เลือกไฟล์จากอุปกรณ์</span>
              </button>
            </div>
          )}

          {/* Instant Preview Card (Displays immediately when file is picked) */}
          {instantPreviewUrl && selectedFile && (
            <div className="p-3.5 bg-white border border-slate-200 rounded-2xl shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-start gap-3">
                {/* Instant Image Thumbnail */}
                <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shrink-0 shadow-2xs">
                  <img
                    src={instantPreviewUrl}
                    alt="Instant Preview"
                    className="w-full h-full object-cover"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-blue-950/40 backdrop-blur-2xs flex items-center justify-center">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                  )}
                  {uploadStatus === 'success' && (
                    <div className="absolute inset-0 bg-emerald-600/80 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                  )}
                </div>

                {/* File info and status */}
                <div className="flex-1 min-w-0 pr-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {selectedFile.name}
                    </p>
                    <span className="text-[10px] font-mono font-medium text-slate-500 shrink-0">
                      {formatBytes(selectedFile.size)}
                    </span>
                  </div>

                  {/* Status text */}
                  <div className="mt-1 flex items-center gap-1.5">
                    {uploadStatus === 'uploading' && (
                      <span className="text-[11px] font-semibold text-blue-600 flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        กำลังส่งรูปภาพ ({activeEngine === 'firebase' ? 'Firebase Storage' : 'App Storage'})...
                      </span>
                    )}
                    {uploadStatus === 'success' && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        อัปโหลดสำเร็จ บันทึกเข้าสู่สินค้าแล้ว
                      </span>
                    )}
                    {uploadStatus === 'error' && (
                      <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        อัปโหลดไม่สำเร็จ
                      </span>
                    )}
                    {uploadStatus === 'cancelled' && (
                      <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
                        <Ban className="w-3.5 h-3.5" />
                        ยกเลิกการส่งแล้ว
                      </span>
                    )}
                    {uploadStatus === 'preparing' && (
                      <span className="text-[11px] text-slate-500">
                        เตรียมส่งข้อมูล...
                      </span>
                    )}
                  </div>

                  {/* Byte counter */}
                  {isUploading && (
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {formatBytes(bytesTransferred)} / {formatBytes(totalBytes)} ({uploadProgress}%)
                    </p>
                  )}
                </div>

                {/* Clear / Dismiss button */}
                {!isUploading && (
                  <button
                    type="button"
                    onClick={handleClearSelected}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
                    title="ลบตัวอย่างนี้"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Genuine Progress Bar (0 - 100%) */}
              {isUploading && (
                <div className="space-y-1">
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                    <div
                      className="bg-blue-600 h-full transition-all duration-150"
                      style={{ width: `${Math.max(uploadProgress, 2)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                    <span>0%</span>
                    <span>{uploadProgress}%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Action buttons (Cancel / Retry / Change) */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                {isUploading ? (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition flex items-center gap-1"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>ยกเลิกการส่ง</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      เปลี่ยนรูปใหม่
                    </button>
                    {(uploadStatus === 'error' || uploadStatus === 'cancelled') && (
                      <button
                        type="button"
                        onClick={handleRetryUpload}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>ลองใหม่อีกครั้ง</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Upload Error Banner */}
          {uploadErrorMessage && uploadStatus === 'error' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{uploadErrorMessage}</p>
                <p className="text-[11px] text-red-500 mt-1">
                  สามารถกดปุ่ม "ลองใหม่อีกครั้ง" หรือสลับไปใช้แท็บ "ใส่ลิงก์ URL รูปภาพ" ได้ทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => setUploadErrorMessage('')}
                className="text-red-400 hover:text-red-700 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mode B: URL Input */}
      {activeTab === 'url' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="วางลิงก์รูปภาพ เช่น https://images.unsplash.com/... หรือ CDN"
                value={urlInput}
                onChange={handleUrlInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddUrlImage();
                  }
                }}
                className={`w-full pl-9 pr-9 py-2 text-xs md:text-sm bg-slate-50 border rounded-xl focus:outline-hidden transition ${
                  urlVerifyStatus === 'valid'
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : urlVerifyStatus === 'invalid'
                    ? 'border-red-400 bg-red-50/30'
                    : 'border-slate-300 focus:border-blue-500'
                }`}
              />
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />

              {/* Status icon inside input */}
              <div className="absolute right-3 top-2.5">
                {isVerifyingUrl && <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />}
                {!isVerifyingUrl && urlVerifyStatus === 'valid' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                )}
                {!isVerifyingUrl && urlVerifyStatus === 'invalid' && (
                  <AlertCircle className="w-4 h-4 text-red-500" />
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddUrlImage}
              disabled={urlVerifyStatus !== 'valid' || isVerifyingUrl || allImages.length >= maxImages}
              className="px-4 py-2 text-xs md:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>เพิ่มรูปภาพ</span>
            </button>
          </div>

          {/* Quick info / Help text */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>รองรับ Direct Image URL ทุกประเภท (Unsplash, Imgur, Cloudinary, WebP, JPG, PNG)</span>
            {urlInput && (
              <button
                type="button"
                onClick={() => verifyImageUrl(urlInput)}
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                <span>ตรวจสอบใหม่</span>
              </button>
            )}
          </div>

          {/* Validated preview & confirmation */}
          {urlVerifyStatus === 'valid' && verifiedUrlPreview && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3">
              <img
                src={verifiedUrlPreview}
                alt="Preview"
                className="w-12 h-12 object-cover rounded-lg border border-emerald-300 shadow-2xs shrink-0 bg-white"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  โหลดรูปภาพสำเร็จ พร้อมเพิ่มลงในสินค้า
                </p>
                <p className="text-[11px] text-emerald-700 truncate font-mono mt-0.5">
                  {verifiedUrlPreview}
                </p>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {urlVerifyStatus === 'invalid' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">{urlErrorMessage || 'ไม่สามารถโหลดรูปภาพจาก URL นี้ได้'}</p>
                <p className="text-[11px] text-red-500 mt-0.5">
                  โปรดตรวจสอบว่า URL เป็นลิงก์ตรงของไฟล์รูปภาพและสามารถเปิดดูได้ในเบราว์เซอร์
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Gallery & Main Image Preview Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700">
            คลังรูปภาพของสินค้านี้ ({allImages.length} รูป)
          </p>
          <span className="text-[11px] text-slate-400">
            แตะรูปดาวเพื่อตั้งเป็นภาพหลัก
          </span>
        </div>

        {allImages.length === 0 ? (
          <div className="py-6 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-slate-50/50">
            <ImageIcon className="w-8 h-8 mx-auto text-slate-300 mb-1" />
            <p className="text-xs font-medium">ยังไม่มีรูปภาพสำหรับสินค้านี้</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              เลือกอัปโหลดจากเครื่อง หรือกรอก URL เพื่อเพิ่มรูปภาพ
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
            {allImages.map((imgUrl, index) => {
              const isMain = imgUrl === mainImageUrl;
              return (
                <div
                  key={`${imgUrl}-${index}`}
                  className={`relative group rounded-xl overflow-hidden border bg-white aspect-square shadow-2xs transition ${
                    isMain
                      ? 'border-blue-500 ring-2 ring-blue-400/30'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`Product image ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const fallback = e.currentTarget.parentElement?.querySelector('.fallback-placeholder');
                      if (fallback) fallback.classList.remove('hidden');
                    }}
                  />

                  {/* Fallback hidden container */}
                  <div className="fallback-placeholder hidden absolute inset-0 bg-slate-100 flex flex-col items-center justify-center p-1 text-center">
                    <AlertCircle className="w-5 h-5 text-amber-500 mb-0.5" />
                    <span className="text-[9px] text-slate-500">โหลดภาพไม่ผ่าน</span>
                  </div>

                  {/* Main badge */}
                  {isMain && (
                    <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span>ภาพหลัก</span>
                    </div>
                  )}

                  {/* Quick actions overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                    {/* Preview full screen */}
                    <button
                      type="button"
                      title="ดูภาพขนาดใหญ่"
                      onClick={() => setPreviewModalUrl(imgUrl)}
                      className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-xs transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Set as main */}
                    {!isMain && (
                      <button
                        type="button"
                        title="ตั้งเป็นภาพหลัก"
                        onClick={() => handleSetMain(imgUrl)}
                        className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      title="ลบรูปภาพนี้"
                      onClick={() => handleDeleteImage(imgUrl)}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Large Image Preview Modal */}
      {previewModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => setPreviewModalUrl(null)}
        >
          <div
            className="relative max-w-xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-2 border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-800">ตัวอย่างรูปภาพขนาดใหญ่</span>
              <button
                type="button"
                onClick={() => setPreviewModalUrl(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-slate-50 min-h-[250px] max-h-[70vh] overflow-auto">
              <img
                src={previewModalUrl}
                alt="Enlarged preview"
                className="max-h-[65vh] w-auto max-w-full rounded-xl object-contain shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
