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
  Check,
  Cloud,
  Server,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  UploadTask,
  StorageError,
} from 'firebase/storage';
import { storage, storageBucketName, firebaseConfig } from '../../firebase';

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

  // Storage Engine: 'firebase' (Primary SDK) or 'local' (POS Local Server Fallback)
  const [storageEngine, setStorageEngine] = useState<'firebase' | 'local'>('firebase');
  const [isBucketNotFound, setIsBucketNotFound] = useState<boolean>(false);
  const [showConsoleHelp, setShowConsoleHelp] = useState<boolean>(false);

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
  const instantPreviewUrlRef = useRef<string | null>(null);
  instantPreviewUrlRef.current = instantPreviewUrl;

  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [bytesTransferred, setBytesTransferred] = useState<number>(0);
  const [totalBytes, setTotalBytes] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'preparing' | 'uploading' | 'success' | 'error' | 'cancelled'>('idle');
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  // User cancel ref & active upload task refs
  const userDidCancelRef = useRef<boolean>(false);
  const cancelUploadRef = useRef<(() => void) | null>(null);
  const activeUploadTaskRef = useRef<UploadTask | null>(null);

  // Preview modal
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  // Cleanup object URLs and active uploads ONLY when component unmounts
  useEffect(() => {
    return () => {
      if (instantPreviewUrlRef.current && instantPreviewUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(instantPreviewUrlRef.current);
      }
      if (cancelUploadRef.current) {
        cancelUploadRef.current();
      }
    };
  }, []);

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

  // ENGINE 1: Firebase Storage SDK (uploadBytesResumable + getDownloadURL)
  const uploadViaFirebaseStorage = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const fileExt = file.name.substring(file.name.lastIndexOf('.')) || '.jpg';
        const safeBase = file.name.replace(/[^a-zA-Z0-9_-]/g, '_');
        const storagePath = `products/${Date.now()}_${safeBase}${fileExt}`;
        const storageRef = ref(storage, storagePath);

        const metadata = {
          contentType: file.type || 'image/jpeg',
          customMetadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
          },
        };

        const uploadTask = uploadBytesResumable(storageRef, file, metadata);
        activeUploadTaskRef.current = uploadTask;

        cancelUploadRef.current = () => {
          userDidCancelRef.current = true;
          uploadTask.cancel();
        };

        uploadTask.on(
          'state_changed',
          (snapshot) => {
            // STRICT TRUE PROGRESS: NO ARTIFICIAL Math.max(pct, 10)!
            if (snapshot.totalBytes > 0) {
              const pct = Math.floor((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
              setUploadProgress(pct);
              setBytesTransferred(snapshot.bytesTransferred);
              setTotalBytes(snapshot.totalBytes);
            }
          },
          (error: StorageError) => {
            activeUploadTaskRef.current = null;
            cancelUploadRef.current = null;

            if (userDidCancelRef.current || error.code === 'storage/canceled') {
              reject(new Error('USER_CANCELLED'));
              return;
            }

            console.error('[Firebase Storage Error]', {
              code: error.code,
              message: error.message,
              bucket: storageBucketName,
            });

            const is404 =
              error.code === 'storage/bucket-not-found' ||
              error.message.includes('404') ||
              error.message.includes('bucket does not exist') ||
              error.code === 'storage/retry-limit-exceeded';

            if (is404) {
              setIsBucketNotFound(true);
              reject(
                new Error(
                  `FIREBASE_404: คลาวด์สตอเรจบัคเก็ต "${storageBucketName}" ยังไม่ได้ถูกเปิดใช้งานใน Firebase Console (HTTP 404: The specified bucket does not exist)`
                )
              );
            } else if (error.code === 'storage/unauthorized') {
              reject(new Error('สิทธิ์การเข้าถึงไม่เพียงพอ (Permission Denied): ตรวจสอบ Storage Security Rules'));
            } else if (error.code === 'storage/quota-exceeded') {
              reject(new Error('โควตา Firebase Storage เต็ม (Quota Exceeded)'));
            } else {
              reject(new Error(`Firebase Storage Error: ${error.message} (${error.code})`));
            }
          },
          async () => {
            activeUploadTaskRef.current = null;
            cancelUploadRef.current = null;
            try {
              const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
              setUploadProgress(100);
              resolve(downloadUrl);
            } catch (err: any) {
              reject(new Error(`ไม่สามารถดึง Download URL จาก Firebase ได้: ${err?.message || err}`));
            }
          }
        );
      } catch (err: any) {
        reject(err);
      }
    });
  }, []);

  // ENGINE 2: Local Server Storage (/api/upload -> public/uploads/)
  const uploadViaLocalServer = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => {
        reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพจากอุปกรณ์ได้'));
      };

      reader.onload = () => {
        const base64Data = reader.result as string;
        const xhr = new XMLHttpRequest();
        const uploadEndpoint = `${window.location.origin}/api/upload`;

        cancelUploadRef.current = () => {
          userDidCancelRef.current = true;
          xhr.abort();
        };

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const pct = Math.floor((event.loaded / event.total) * 100);
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
                reject(new Error('เซิร์ฟเวอร์ไม่ได้ส่ง URL รูปภาพกลับมา'));
              }
            } catch {
              reject(new Error('ข้อมูลตอบกลับจากเซิร์ฟเวอร์ไม่ถูกต้อง'));
            }
          } else {
            let msg = `การอัปโหลดขัดข้อง (HTTP ${xhr.status})`;
            if (xhr.status === 404) {
              msg = 'เซิร์ฟเวอร์ขัดข้อง (HTTP 404): ไม่พบ API สำหรับอัปโหลด';
            } else if (xhr.status === 413) {
              msg = 'ขนาดไฟล์เกินกำหนด 5 MB (HTTP 413)';
            } else if (xhr.status === 415) {
              msg = 'ชนิดไฟล์ไม่ถูกต้อง (HTTP 415): รองรับ JPG, PNG, WebP, GIF';
            }
            try {
              const errObj = JSON.parse(xhr.responseText);
              if (errObj.error) msg = errObj.error;
            } catch {}
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => {
          cancelUploadRef.current = null;
          reject(new Error('ไม่สามารถเชื่อมต่อเน็ตเวิร์กกับเซิร์ฟเวอร์ได้'));
        };

        xhr.ontimeout = () => {
          cancelUploadRef.current = null;
          reject(new Error('การอัปโหลดหมดเวลาเชื่อมต่อ (Connection Timeout)'));
        };

        xhr.open('POST', uploadEndpoint, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 45000;
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

  // Execute upload process with genuine progress and error handling
  const executeUpload = async (file: File, forcedEngine?: 'firebase' | 'local') => {
    userDidCancelRef.current = false;
    setIsUploading(true);
    setUploadStatus('uploading');
    setUploadProgress(0);
    setBytesTransferred(0);
    setTotalBytes(file.size);
    setUploadErrorMessage('');

    const targetEngine = forcedEngine || storageEngine;

    try {
      let finalDownloadUrl = '';

      if (targetEngine === 'firebase') {
        finalDownloadUrl = await uploadViaFirebaseStorage(file);
      } else {
        finalDownloadUrl = await uploadViaLocalServer(file);
      }

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
        if (instantPreviewUrlRef.current && instantPreviewUrlRef.current.startsWith('blob:')) {
          URL.revokeObjectURL(instantPreviewUrlRef.current);
        }
        setInstantPreviewUrl(null);
        setUploadStatus('idle');
      }, 1200);
    } catch (err: any) {
      if (userDidCancelRef.current || err?.message === 'USER_CANCELLED') {
        setIsUploading(false);
        setUploadStatus('cancelled');
        setUploadProgress(0);
        setUploadErrorMessage('ยกเลิกการอัปโหลดเรียบร้อยแล้ว');
        return;
      }

      console.error('Upload execution failed:', err);
      setIsUploading(false);
      setUploadStatus('error');
      setUploadErrorMessage(err?.message || 'เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    }
  };

  // Handle file selection from gallery, folder, or camera
  const handleFileSelected = (file: File) => {
    setUploadErrorMessage('');
    setIsBucketNotFound(false);

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
    if (instantPreviewUrlRef.current && instantPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(instantPreviewUrlRef.current);
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
    userDidCancelRef.current = true;
    if (cancelUploadRef.current) {
      cancelUploadRef.current();
    }
    setIsUploading(false);
    setUploadStatus('cancelled');
    setUploadProgress(0);
    setUploadErrorMessage('ยกเลิกการอัปโหลดแล้ว');
  };

  // Handle Retry Upload
  const handleRetryUpload = (forcedEngine?: 'firebase' | 'local') => {
    if (selectedFile) {
      userDidCancelRef.current = false;
      executeUpload(selectedFile, forcedEngine);
    }
  };

  // Switch to Local Storage Fallback and execute immediately
  const handleSwitchToLocalAndUpload = () => {
    setStorageEngine('local');
    setIsBucketNotFound(false);
    if (selectedFile) {
      executeUpload(selectedFile, 'local');
    }
  };

  // Handle Clear Selected File
  const handleClearSelected = () => {
    handleCancelUpload();
    setSelectedFile(null);
    if (instantPreviewUrlRef.current && instantPreviewUrlRef.current.startsWith('blob:')) {
      URL.revokeObjectURL(instantPreviewUrlRef.current);
    }
    setInstantPreviewUrl(null);
    setUploadStatus('idle');
    setUploadErrorMessage('');
    setIsBucketNotFound(false);
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
          <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
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
          {/* Storage Engine Status & Selector */}
          <div className="p-2.5 bg-blue-50/60 border border-blue-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">ระบบจัดเก็บ:</span>
              <span className="inline-flex items-center gap-1 font-bold text-blue-700 bg-white px-2 py-0.5 rounded-md border border-blue-200">
                {storageEngine === 'firebase' ? (
                  <>
                    <Cloud className="w-3.5 h-3.5 text-blue-600" />
                    <span>Firebase Storage SDK</span>
                  </>
                ) : (
                  <>
                    <Server className="w-3.5 h-3.5 text-indigo-600" />
                    <span>POS Local Server (สำรอง)</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setStorageEngine(storageEngine === 'firebase' ? 'local' : 'firebase')}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>สลับเป็น {storageEngine === 'firebase' ? 'Local Server' : 'Firebase Storage'}</span>
              </button>
            </div>
          </div>

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
                  แตะเพื่อเลือกรูปภาพจากเครื่อง หรือลากไฟล์มาวางที่นี่
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  รองรับ Windows, Mac, iPhone, iPad, Android (JPG, PNG, WebP สูงสุด {MAX_FILE_SIZE_MB}MB)
                </p>
              </div>

              <button
                type="button"
                disabled={allImages.length >= maxImages}
                className="mt-1 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl transition shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
                    <div className="absolute inset-0 bg-emerald-600/85 flex items-center justify-center">
                      <Check className="w-6 h-6 text-white stroke-[3]" />
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
                        กำลังอัปโหลดไปยัง {storageEngine === 'firebase' ? 'Firebase Storage' : 'Local Server'}... ({uploadProgress}%)
                      </span>
                    )}
                    {uploadStatus === 'success' && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        อัปโหลดสำเร็จ บันทึกเข้าคลังภาพและเตรียมลง Firestore แล้ว
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

                  {/* Byte counter - Genuine progress */}
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
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    title="ล้างรายการนี้"
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
                    <span className="font-bold text-blue-600">{uploadProgress}%</span>
                    <span>100%</span>
                  </div>
                </div>
              )}

              {/* Action buttons (Cancel / Retry / Fallback / Change) */}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-slate-100">
                {isUploading ? (
                  <button
                    type="button"
                    onClick={handleCancelUpload}
                    className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>ยกเลิกการส่ง</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                    >
                      เปลี่ยนรูปใหม่
                    </button>

                    {/* Quick switch to Local Server if Firebase failed with 404 */}
                    {isBucketNotFound && (
                      <button
                        type="button"
                        onClick={handleSwitchToLocalAndUpload}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Server className="w-3.5 h-3.5" />
                        <span>บันทึกผ่าน Local Server ทันที</span>
                      </button>
                    )}

                    {(uploadStatus === 'error' || uploadStatus === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => handleRetryUpload()}
                        className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center gap-1 cursor-pointer"
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
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-800">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-bold text-red-900">{uploadErrorMessage}</p>

                  {isBucketNotFound ? (
                    <div className="mt-2 text-[11px] text-red-700 space-y-1.5 bg-white/70 p-2.5 rounded-lg border border-red-200">
                      <p className="font-semibold text-slate-800 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-blue-600" />
                        <span>สาเหตุและการแก้ปัญหา:</span>
                      </p>
                      <p>
                        1. โครงการ Firebase <strong>{firebaseConfig.projectId}</strong> ยังไม่ได้กดเปิดใช้งาน <strong>Cloud Storage</strong> ใน Firebase Console
                      </p>
                      <p>
                        2. สามารถกดปุ่ม <strong>"บันทึกผ่าน Local Server ทันที"</strong> ด้านบน เพื่ออัปโหลดและใช้งานรูปภาพใน POS ได้ทันที
                      </p>
                      <p>
                        3. หรือเปิดใช้งาน Storage Bucket ใน Firebase Console โดยไปที่ <strong>Build &gt; Storage &gt; Get Started</strong>
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-red-600 mt-1">
                      สามารถกดปุ่ม "ลองใหม่อีกครั้ง" หรือสลับไปใช้แท็บ "ใส่ลิงก์ URL รูปภาพ" ได้ทันที
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setUploadErrorMessage('')}
                  className="text-red-400 hover:text-red-700 p-0.5 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {isBucketNotFound && (
                <div className="flex items-center justify-between pt-1 border-t border-red-100">
                  <button
                    type="button"
                    onClick={() => setShowConsoleHelp(!showConsoleHelp)}
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showConsoleHelp ? 'ซ่อนคำแนะนำ Firebase Console' : 'ดูขั้นตอนเปิดใช้งาน Firebase Console'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSwitchToLocalAndUpload}
                    className="text-xs font-bold text-emerald-700 bg-emerald-100 hover:bg-emerald-200 px-3 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                  >
                    <Server className="w-3 h-3" />
                    <span>ใช้ Local Storage สำรอง</span>
                  </button>
                </div>
              )}

              {showConsoleHelp && (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-[11px] text-slate-700 space-y-1 mt-2">
                  <p className="font-bold text-slate-900">ขั้นตอนการเปิดใช้งาน Firebase Storage ใน Firebase Console:</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600">
                    <li>เข้าสู่ <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-semibold">Firebase Console</a></li>
                    <li>เลือกโปรเจกต์ <code>{firebaseConfig.projectId}</code></li>
                    <li>เมนูด้านซ้าย เลือก <strong>Build &gt; Storage</strong></li>
                    <li>คลิกปุ่ม <strong>Get Started</strong> และเลือกตำแหน่ง Bucket</li>
                    <li>กฎความปลอดภัยจะถูกกำหนดไว้ในไฟล์ <code>storage.rules</code> ของโปรเจกต์นี้เรียบร้อยแล้ว</li>
                  </ol>
                </div>
              )}
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
              className="px-4 py-2 text-xs md:text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition shadow-xs disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1.5 cursor-pointer"
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
                className="text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
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
                    <div className="absolute top-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-xs flex items-center gap-1 z-10">
                      <Star className="w-2.5 h-2.5 fill-current" />
                      <span>ภาพหลัก</span>
                    </div>
                  )}

                  {/* Quick actions overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1 z-20">
                    {/* Preview full screen */}
                    <button
                      type="button"
                      title="ดูภาพขนาดใหญ่"
                      onClick={() => setPreviewModalUrl(imgUrl)}
                      className="p-1.5 bg-white/90 hover:bg-white text-slate-700 rounded-lg shadow-xs transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Set as main */}
                    {!isMain && (
                      <button
                        type="button"
                        title="ตั้งเป็นภาพหลัก"
                        onClick={() => handleSetMain(imgUrl)}
                        className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs transition cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      title="ลบรูปภาพนี้"
                      onClick={() => handleDeleteImage(imgUrl)}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs transition cursor-pointer"
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
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
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
