import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Camera,
  CameraOff,
  X,
  RefreshCw,
  Zap,
  ZapOff,
  CheckCircle2,
  AlertCircle,
  Barcode,
  Volume2,
  Smartphone,
  Tablet,
  Laptop,
  Settings2,
  Bug,
  SwitchCamera,
  Focus,
} from 'lucide-react';
import {
  MultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
} from '@zxing/library';
import { playScanSuccessSound } from '../../utils/audio';
import { detectUserDevice, DeviceInfo } from '../../utils/deviceDetector';
import { validateBarcode } from '../../utils/barcodeValidator';
import { Product } from '../../types/pos';

export interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string, formatName?: string) => void;
  title?: string;
  continuous?: boolean;
  onOpenDiagnostics?: () => void;
  showDebugInfo?: boolean;
  currentFormBarcode?: string;
  existingProducts?: Product[];
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'กล้องสแกนบาร์โค้ดสินค้า (Universal Barcode Scanner)',
  continuous = false,
  onOpenDiagnostics,
  showDebugInfo = false,
  currentFormBarcode = '',
  existingProducts = [],
}) => {
  const deviceInfo: DeviceInfo = useMemo(() => detectUserDevice(), []);

  // Camera stream states
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [streamResolution, setStreamResolution] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Torch / Focus capability
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);
  const [hasContinuousFocus, setHasContinuousFocus] = useState<boolean>(false);

  // Scanning results & feedback
  const [lastScanned, setLastScanned] = useState<string>('');
  const [lastScannedFormat, setLastScannedFormat] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [scanCount, setScanCount] = useState<number>(0);
  const [decoderFps, setDecoderFps] = useState<number>(12);

  // Debug Panel toggle
  const [isDebugOpen, setIsDebugOpen] = useState<boolean>(showDebugInfo);
  const [activeEngine, setActiveEngine] = useState<string>('ZXing MultiFormat (Grayscale Buffer)');

  // Barcode validation of detected code
  const validationResult = useMemo(() => {
    if (!lastScanned) return null;
    return validateBarcode(lastScanned);
  }, [lastScanned]);

  // Duplicate Check against existing products in database
  const matchedExistingProduct = useMemo(() => {
    if (!lastScanned) return null;
    return (
      existingProducts.find(
        (p) =>
          p.barcode === lastScanned ||
          p.sku.toLowerCase() === lastScanned.toLowerCase()
      ) || null
    );
  }, [lastScanned, existingProducts]);

  // DOM & Decoder references
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const centerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanIntervalIdRef = useRef<number | null>(null);
  const zxingReaderRef = useRef<MultiFormatReader | null>(null);
  const isDecodingRef = useRef<boolean>(false);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const fpsCounterRef = useRef<{ count: number; lastTime: number }>({ count: 0, lastTime: Date.now() });

  // Native BarcodeDetector instance if supported by browser (Chrome/Edge/Android/Safari 17+)
  const nativeDetectorRef = useRef<any>(null);

  // Initialize ZXing MultiFormatReader with all standard POS formats & TRY_HARDER
  const getOrCreateZxingReader = useCallback(() => {
    if (!zxingReaderRef.current) {
      const hints = new Map<DecodeHintType, any>();
      const formats = [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.ITF,
        BarcodeFormat.DATA_MATRIX,
      ];
      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);

      const reader = new MultiFormatReader();
      reader.setHints(hints);
      zxingReaderRef.current = reader;
    }
    return zxingReaderRef.current;
  }, []);

  // Initialize native BarcodeDetector if available
  useEffect(() => {
    const BarcodeDetectorClass = (window as any).BarcodeDetector;
    if (BarcodeDetectorClass) {
      try {
        nativeDetectorRef.current = new BarcodeDetectorClass({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
        });
        setActiveEngine('Native BarcodeDetector (Hardware)');
      } catch (err) {
        console.debug('Native BarcodeDetector initialization error:', err);
      }
    }
  }, []);

  // Stop camera tracks and cancel scan loops
  const stopCamera = useCallback(() => {
    if (scanIntervalIdRef.current) {
      clearInterval(scanIntervalIdRef.current);
      scanIntervalIdRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('Error stopping camera track:', err);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    isDecodingRef.current = false;
    setTorchEnabled(false);
    setHasTorchCapability(false);
    setHasContinuousFocus(false);
  }, []);

  // Enumerate all video input devices with clean human-readable labels
  const refreshCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoDevices);
      return videoDevices;
    } catch (err) {
      console.warn('Failed to enumerate cameras:', err);
      return [];
    }
  }, []);

  // Handle successful barcode recognition (strictly String format, preserving leading zeros)
  const handleBarcodeFound = useCallback(
    (code: string, formatName: string = '') => {
      const cleanCode = String(code).trim();
      if (!cleanCode) return;

      const now = Date.now();
      const last = lastScannedTimeRef.current;

      // Throttle exact same barcode within 1200ms
      if (last.code === cleanCode && now - last.time < 1200) {
        return;
      }

      lastScannedTimeRef.current = { code: cleanCode, time: now };
      playScanSuccessSound();

      setLastScanned(cleanCode);
      setLastScannedFormat(formatName || 'BARCODE');
      setScanCount((prev) => prev + 1);

      // Call parent callback with real barcode string
      onScan(cleanCode, formatName);

      if (!continuous) {
        stopCamera();
        onClose();
      }
    },
    [continuous, onClose, onScan, stopCamera]
  );

  // Core Resilient Multi-Pass Frame Decoding Loop
  const decodeVideoFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState < 2 || isDecodingRef.current) {
      return;
    }

    const video = videoRef.current;
    const vWidth = video.videoWidth;
    const vHeight = video.videoHeight;

    if (vWidth === 0 || vHeight === 0) return;

    if (streamResolution.width !== vWidth || streamResolution.height !== vHeight) {
      setStreamResolution({ width: vWidth, height: vHeight });
    }

    isDecodingRef.current = true;

    // Track decoding FPS
    const now = Date.now();
    fpsCounterRef.current.count++;
    if (now - fpsCounterRef.current.lastTime >= 1000) {
      setDecoderFps(fpsCounterRef.current.count);
      fpsCounterRef.current.count = 0;
      fpsCounterRef.current.lastTime = now;
    }

    try {
      // -------------------------------------------------------------
      // PASS 1: Native Hardware BarcodeDetector (High speed C++ engine)
      // -------------------------------------------------------------
      if (nativeDetectorRef.current) {
        try {
          const detected = await nativeDetectorRef.current.detect(video);
          if (detected && detected.length > 0) {
            const hit = detected[0];
            const raw = String(hit.rawValue || '').trim();
            if (raw) {
              setActiveEngine('Native BarcodeDetector (Hardware)');
              handleBarcodeFound(raw, String(hit.format || '').toUpperCase());
              isDecodingRef.current = false;
              return;
            }
          }
        } catch {
          // Native detector frame pass through to ZXing
        }
      }

      // -------------------------------------------------------------
      // PASS 2: ZXing MultiFormat with HTMLCanvasElementLuminanceSource
      // -------------------------------------------------------------
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }
      const canvas = canvasRef.current;

      // Downscale 4K / large frames to optimal 1080p/720p for fast barcode line detection
      const maxDim = 1280;
      let targetW = vWidth;
      let targetH = vHeight;
      if (targetW > maxDim || targetH > maxDim) {
        const ratio = Math.min(maxDim / targetW, maxDim / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }

      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, targetW, targetH);

        const zxingReader = getOrCreateZxingReader();
        setActiveEngine('ZXing MultiFormat (Grayscale Buffer)');

        // 2A: Full frame scan with HybridBinarizer
        try {
          const lumSource = new HTMLCanvasElementLuminanceSource(canvas, false);
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(lumSource));
          const result = zxingReader.decodeWithState(binaryBitmap);
          if (result && result.getText()) {
            const raw = String(result.getText()).trim();
            const fmt = BarcodeFormat[result.getBarcodeFormat()] || 'ZXING';
            if (raw) {
              handleBarcodeFound(raw, fmt);
              isDecodingRef.current = false;
              return;
            }
          }
        } catch {
          // Full frame pass didn't find, proceed to Center Crop Zone
        } finally {
          zxingReader.reset();
        }

        // 2B: Center Target Zone Scan (75% width, 55% height) for sharp 1D barcode focus
        try {
          if (!centerCanvasRef.current) {
            centerCanvasRef.current = document.createElement('canvas');
          }
          const cCanvas = centerCanvasRef.current;
          const cropW = Math.round(targetW * 0.75);
          const cropH = Math.round(targetH * 0.55);
          const cropX = Math.round((targetW - cropW) / 2);
          const cropY = Math.round((targetH - cropH) / 2);

          cCanvas.width = cropW;
          cCanvas.height = cropH;
          const cCtx = cCanvas.getContext('2d', { willReadFrequently: true });
          if (cCtx) {
            cCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
            const cropLum = new HTMLCanvasElementLuminanceSource(cCanvas, false);
            const cropBitmap = new BinaryBitmap(new HybridBinarizer(cropLum));
            const cropResult = zxingReader.decodeWithState(cropBitmap);
            if (cropResult && cropResult.getText()) {
              const raw = String(cropResult.getText()).trim();
              const fmt = BarcodeFormat[cropResult.getBarcodeFormat()] || 'ZXING_CENTER';
              if (raw) {
                handleBarcodeFound(raw, fmt);
                isDecodingRef.current = false;
                return;
              }
            }
          }
        } catch {
          // Center crop pass didn't find
        } finally {
          zxingReader.reset();
        }

        // 2C: GlobalHistogramBinarizer Pass (Superior for low-contrast / glossy / faded barcodes)
        try {
          const lumSource = new HTMLCanvasElementLuminanceSource(canvas, false);
          const histBitmap = new BinaryBitmap(new GlobalHistogramBinarizer(lumSource));
          const histResult = zxingReader.decodeWithState(histBitmap);
          if (histResult && histResult.getText()) {
            const raw = String(histResult.getText()).trim();
            const fmt = BarcodeFormat[histResult.getBarcodeFormat()] || 'ZXING_HIST';
            if (raw) {
              handleBarcodeFound(raw, fmt);
              isDecodingRef.current = false;
              return;
            }
          }
        } catch {
          // Histogram pass didn't find
        } finally {
          zxingReader.reset();
        }
      }
    } catch (frameErr) {
      console.debug('Transient scan frame error:', frameErr);
    } finally {
      isDecodingRef.current = false;
    }
  }, [getOrCreateZxingReader, handleBarcodeFound, streamResolution.height, streamResolution.width]);

  // Start Camera Stream with Rear-Camera Priority on Mobile and Webcam on Laptop
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError('');
    setIsInitializing(true);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง (WebRTC MediaDevices Not Supported)');
      }

      // Discover cameras
      const videoDevices = await refreshCameras();

      // Configure video constraints:
      // On mobile/tablet: Always prefer facingMode: 'environment' (back camera) unless user picked a specific ID
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      };

      if (selectedDeviceId) {
        videoConstraints.deviceId = { exact: selectedDeviceId };
      } else if (deviceInfo.type === 'mobile_phone' || deviceInfo.type === 'tablet') {
        // Enforce rear/environment camera on phones and tablets
        videoConstraints.facingMode = { ideal: 'environment' };
      } else {
        // Laptop / Desktop: prefer webcam
        const usbCam = videoDevices.find((d) => /usb|external|webcam/i.test(d.label));
        if (usbCam) {
          videoConstraints.deviceId = { exact: usbCam.deviceId };
        }
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (strictErr) {
        console.warn('Initial camera constraints failed, attempting fallback:', strictErr);
        // Fallback: unconstrained video
        stream = await navigator.mediaDevices.getUserMedia({
          video: deviceInfo.type === 'mobile_phone' ? { facingMode: 'environment' } : true,
          audio: false,
        });
      }

      streamRef.current = stream;

      // Extract active track details and capabilities
      const track = stream.getVideoTracks()[0];
      if (track) {
        setActiveCameraLabel(track.label || 'กล้องหลัก (Active Camera)');
        try {
          const capabilities = (track as any).getCapabilities?.() || {};
          if (capabilities.torch) {
            setHasTorchCapability(true);
          }
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            setHasContinuousFocus(true);
            await (track as any).applyConstraints?.({
              advanced: [{ focusMode: 'continuous' }],
            });
          }
        } catch (capErr) {
          console.debug('Autofocus constraint not supported:', capErr);
        }
      }

      // Re-enumerate devices now that camera permission is granted (all labels populated)
      await refreshCameras();

      if (videoRef.current) {
        const v = videoRef.current;
        v.setAttribute('playsinline', 'true');
        v.setAttribute('webkit-playsinline', 'true');
        v.srcObject = stream;
        await v.play();
      }

      // Start Resilient Continuous Scan Interval (85ms for smooth 12 FPS decoding)
      scanIntervalIdRef.current = window.setInterval(() => {
        decodeVideoFrame();
      }, 85);

      setIsInitializing(false);
      setCameraActive(true);
    } catch (err: unknown) {
      setIsInitializing(false);
      console.warn('Camera initialization failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError(
          'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณากด "อนุญาต (Allow)" ในเบราว์เซอร์เพื่อเปิดใช้งาน'
        );
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFound')) {
        setCameraError(
          'ไม่พบอุปกรณ์กล้องบนเครื่องนี้ คุณสามารถพิมพ์รหัสสินค้าด้วยตนเองด้านล่างได้ทันที'
        );
      } else if (msg.includes('NotReadableError') || msg.includes('Device in use')) {
        setCameraError(
          'กล้องกำลังถูกใช้งานโดยแอปพลิเคชันอื่น กรุณาปิดโปรแกรมอื่นที่กำลังใช้กล้องแล้วลองอีกครั้ง'
        );
      } else {
        setCameraError('ไม่สามารถเริ่มการทำงานของกล้องได้: ' + msg);
      }
    }
  }, [
    decodeVideoFrame,
    deviceInfo.type,
    refreshCameras,
    selectedDeviceId,
    stopCamera,
  ]);

  // Switch to next camera in list (สลับกล้อง)
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    const currentIndex = cameras.findIndex((c) => c.deviceId === selectedDeviceId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];
    setSelectedDeviceId(nextCamera.deviceId);
  };

  // Trigger manual continuous autofocus refocus
  const handleTriggerRefocus = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        await (track as any).applyConstraints?.({
          advanced: [{ focusMode: 'continuous' }],
        });
      } catch (err) {
        console.debug('Refocus error:', err);
      }
    }
  };

  // Toggle Torch / Flashlight
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && hasTorchCapability) {
      try {
        const next = !torchEnabled;
        await (track as any).applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchEnabled(next);
      } catch (err) {
        console.warn('Failed to toggle torch:', err);
      }
    }
  };

  // Toggle Camera On/Off
  const handleToggleCameraPower = () => {
    if (cameraActive) {
      stopCamera();
      setCameraActive(false);
    } else {
      setCameraActive(true);
      startCamera();
    }
  };

  // Handle Manual Barcode Submit (Preserving string format & leading zeros)
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    handleBarcodeFound(code, 'MANUAL_ENTRY');
    setManualCode('');
  };

  // Reset scan state on modal open & start camera
  useEffect(() => {
    if (isOpen) {
      setLastScanned('');
      setLastScannedFormat('');
      setManualCode('');
      setCameraError('');
      if (cameraActive) {
        startCamera();
      }
    } else {
      stopCamera();
    }

    // Hotplug listener for USB cameras
    const handleDeviceChange = () => {
      refreshCameras();
    };

    if (navigator.mediaDevices?.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }

    return () => {
      stopCamera();
      if (navigator.mediaDevices?.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, [isOpen, selectedDeviceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden text-white flex flex-col max-h-[94vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100 truncate">{title}</h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 shrink-0">
                  {deviceInfo.type === 'mobile_phone' && <Smartphone className="w-3 h-3 text-emerald-400" />}
                  {deviceInfo.type === 'tablet' && <Tablet className="w-3 h-3 text-emerald-400" />}
                  {deviceInfo.type === 'laptop_desktop' && <Laptop className="w-3 h-3 text-blue-400" />}
                  <span>{deviceInfo.platformName}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {activeCameraLabel ? `กล้องที่ใช้งาน: ${activeCameraLabel}` : 'สแกนอัตโนมัติ • EAN-13, EAN-8, UPC, Code-128, Code-39, QR'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Debug Overlay */}
            <button
              type="button"
              onClick={() => setIsDebugOpen(!isDebugOpen)}
              title="เปิด/ปิด แถบตรวจสอบระบบ Debug"
              className={`p-2 rounded-xl transition cursor-pointer ${
                isDebugOpen
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Bug className="w-4 h-4" />
            </button>

            {onOpenDiagnostics && (
              <button
                type="button"
                onClick={onOpenDiagnostics}
                title="เปิดศูนย์ทดสอบสแกนเนอร์"
                className="p-2 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-xl transition cursor-pointer"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* CAMERA CONTROLS BAR */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Camera Selector Dropdown */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>กล้อง:</span>
            </span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={cameras.length === 0}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 truncate cursor-pointer"
            >
              {cameras.length === 0 && <option value="">{activeCameraLabel || 'กำลังเชื่อมต่อกล้อง...'}</option>}
              {cameras.map((c, idx) => (
                <option key={c.deviceId || idx} value={c.deviceId}>
                  {c.label || `กล้องตัวที่ ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons: Switch Camera, Autofocus, Flash, Power */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Switch Camera Button (สลับกล้อง) */}
            {cameras.length > 1 && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                title="สลับไปกล้องตัวถัดไป"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">สลับกล้อง</span>
              </button>
            )}

            {/* Continuous Autofocus Trigger */}
            {hasContinuousFocus && cameraActive && (
              <button
                type="button"
                onClick={handleTriggerRefocus}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
                title="ปรับโฟกัสกล้องใหม่"
              >
                <Focus className="w-4 h-4 text-emerald-400" />
              </button>
            )}

            {/* Torch toggle if available */}
            {hasTorchCapability && cameraActive && (
              <button
                type="button"
                onClick={toggleTorch}
                className={`p-1.5 rounded-xl border transition cursor-pointer ${
                  torchEnabled
                    ? 'bg-amber-400 text-slate-900 border-amber-300 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title={torchEnabled ? 'ปิดไฟแฟลช' : 'เปิดไฟแฟลช'}
              >
                {torchEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
              </button>
            )}

            {/* Toggle Camera Power */}
            <button
              type="button"
              onClick={handleToggleCameraPower}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                cameraActive
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
              }`}
              title={cameraActive ? 'ปิดกล้องชั่วคราว' : 'เปิดกล้องทำงาน'}
            >
              {cameraActive ? (
                <>
                  <CameraOff className="w-3.5 h-3.5" />
                  <span>ปิดกล้อง</span>
                </>
              ) : (
                <>
                  <Camera className="w-3.5 h-3.5" />
                  <span>เปิดกล้อง</span>
                </>
              )}
            </button>

            {/* Refresh Camera */}
            <button
              type="button"
              onClick={startCamera}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition cursor-pointer"
              title="รีเฟรชกล้องใหม่"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* VIEWFINDER & LIVE SCANNING AREA */}
        <div className="relative bg-black flex-1 min-h-[260px] sm:min-h-[340px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-sm space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-rose-300 leading-relaxed font-medium">{cameraError}</p>
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-xs font-semibold rounded-xl text-white transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>ลองเปิดกล้องใหม่อีกครั้ง</span>
                </button>
                <p className="text-[11px] text-slate-400">
                  หรือพิมพ์รหัสสินค้าลงในช่องด้านล่างเพื่อบันทึกได้ทันที
                </p>
              </div>
            </div>
          ) : !cameraActive ? (
            <div className="p-6 text-center max-w-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-400 mx-auto flex items-center justify-center border border-slate-700">
                <CameraOff className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 font-medium">กล้องถูกปิดอยู่</p>
              <button
                type="button"
                onClick={handleToggleCameraPower}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-xl text-white transition flex items-center justify-center gap-1.5 mx-auto cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>เปิดกล้องสแกน</span>
              </button>
            </div>
          ) : (
            <>
              {/* HTML5 Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover max-h-[380px]"
              />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-44 sm:w-76 sm:h-52 border-2 border-white/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.52)] flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
                  </div>

                  {/* Pulsing Red Laser Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse" />

                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-b-4 border-l-4 border-blue-400 rounded-bl-sm" />
                    <div className="w-6 h-6 border-b-4 border-r-4 border-blue-400 rounded-br-sm" />
                  </div>
                </div>
              </div>

              {/* Status Pill on Bottom of Viewfinder */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                <div className="flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/70 text-[11px] text-emerald-400 font-semibold shadow-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>เอนจินสแกนสด: กำลังทำงาน (~{decoderFps} FPS)</span>
                </div>

                <div className="bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/70 text-[11px] text-slate-300 font-mono">
                  {activeCameraLabel ? activeCameraLabel.slice(0, 20) : `สแกนแล้ว ${scanCount} ครั้ง`}
                </div>
              </div>
            </>
          )}

          {/* Scanned Success Notification Banner */}
          {lastScanned && (
            <div className="absolute top-3 left-3 right-3 bg-emerald-600/95 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 border border-emerald-400/40">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span className="text-emerald-100 font-normal">อ่านรหัสสำเร็จ:</span>
                <span className="font-mono text-sm tracking-wider font-extrabold truncate">
                  {lastScanned}
                </span>
                {lastScannedFormat && (
                  <span className="text-[10px] bg-emerald-800/80 px-2 py-0.5 rounded text-emerald-200 font-mono">
                    {lastScannedFormat}
                  </span>
                )}
              </div>
              <span className="text-[11px] bg-white text-emerald-900 px-2 py-0.5 rounded-md font-bold shrink-0 ml-2">
                ส่งเข้าฟอร์มแล้ว
              </span>
            </div>
          )}

          {/* DUPLICATE BARCODE ALERT BANNER INSIDE SCANNER */}
          {lastScanned && matchedExistingProduct && (
            <div className="absolute bottom-12 left-3 right-3 bg-amber-500/95 text-slate-950 px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xl backdrop-blur-md border border-amber-300">
              <div className="flex items-center gap-2 truncate">
                <AlertCircle className="w-4 h-4 text-slate-900 shrink-0" />
                <span className="truncate">
                  พบสินค้านี้ในระบบแล้ว: "{matchedExistingProduct.name}" (สต็อก: {matchedExistingProduct.stockQty} {matchedExistingProduct.unit})
                </span>
              </div>
            </div>
          )}
        </div>

        {/* LIVE DEBUG & DIAGNOSTIC PANEL (ข้อกำหนดข้อ 7) */}
        {isDebugOpen && (
          <div className="p-3 bg-slate-950 border-t border-slate-800 font-mono text-[11px] space-y-2 text-slate-300 animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between text-amber-400 font-bold border-b border-slate-800 pb-1 text-xs">
              <span className="flex items-center gap-1.5">
                <Bug className="w-3.5 h-3.5" />
                <span>แผงตรวจสอบระบบสแกนสด (Live Scanner Debugger)</span>
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-[10px] sm:text-[11px]">
              {/* 1. Camera Status */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">1. Camera Status:</span>
                <span className={cameraActive ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                  {cameraActive ? '● Streaming (กำลังทำงาน)' : '○ Inactive (ปิดอยู่)'}
                </span>
                <span className="text-slate-400 block text-[9px] mt-0.5 truncate">
                  ความละเอียด: {streamResolution.width}x{streamResolution.height}
                </span>
              </div>

              {/* 2. Camera Device Name */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">2. Camera Device Name:</span>
                <span className="text-blue-300 font-bold truncate block" title={activeCameraLabel}>
                  {activeCameraLabel || 'กล้องหลัก (Default Camera)'}
                </span>
                <span className="text-slate-400 block text-[9px] mt-0.5">
                  พบอุปกรณ์กล้อง {cameras.length} ตัว
                </span>
              </div>

              {/* 3. Scanner Engine */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">3. Scanner Engine:</span>
                <span className="text-blue-400 font-bold truncate block">{activeEngine}</span>
                <span className="text-slate-400 block text-[9px] mt-0.5">
                  ความถี่: ~{decoderFps} FPS
                </span>
              </div>

              {/* 4. Barcode Format */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">4. Barcode Format:</span>
                <span className={lastScannedFormat ? 'text-purple-400 font-bold' : 'text-slate-400'}>
                  {lastScannedFormat || 'Waiting for Barcode Detection'}
                </span>
                {validationResult?.message && (
                  <span className="text-slate-400 block text-[9px] mt-0.5 truncate">
                    {validationResult.message}
                  </span>
                )}
              </div>

              {/* 5. Raw Detected Barcode */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">5. Raw Detected Barcode:</span>
                <span className={lastScanned ? 'text-amber-400 font-bold truncate block' : 'text-slate-400'}>
                  {lastScanned || 'Waiting for Barcode Detection'}
                </span>
                {lastScanned && (
                  <span className="text-emerald-400 block text-[9px] mt-0.5 font-bold">
                    ✓ ตรวจจับได้จริงจากกล้อง
                  </span>
                )}
              </div>

              {/* 6. Form Barcode Value */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                <span className="text-slate-500 block">6. Form Barcode Value:</span>
                <span className="text-emerald-300 font-bold truncate block">
                  {lastScanned || currentFormBarcode || '(ยังไม่มีรหัสในฟอร์ม)'}
                </span>
                <span className="text-slate-400 block text-[9px] mt-0.5">
                  {lastScanned ? 'อัปเดตจากกล้องแล้ว' : 'ค่าเดิมในฟอร์ม'}
                </span>
              </div>

              {/* 7. Duplicate / Save Status */}
              <div className="bg-slate-900 p-2 rounded-lg border border-slate-800 sm:col-span-3">
                <span className="text-slate-500 block">7. Firebase Duplicate Check Status:</span>
                {!lastScanned ? (
                  <span className="text-slate-400">Waiting for Barcode Detection</span>
                ) : matchedExistingProduct ? (
                  <span className="text-amber-400 font-bold">
                    ⚠️ รหัสซ้ำกับสินค้าในระบบ: "{matchedExistingProduct.name}" (SKU: {matchedExistingProduct.sku})
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">
                    ✓ รหัสไม่ซ้ำในระบบ Firebase พร้อมบันทึกสินค้าใหม่ได้ทันที
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* FALLBACK MANUAL BARCODE INPUT */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="หรือพิมพ์รหัสบาร์โค้ด / SKU สินค้าที่นี่ แล้วกด Enter..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full pl-10 pr-3 py-2.5 text-xs sm:text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono tracking-wider"
              />
            </div>
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md transition shrink-0 cursor-pointer"
            >
              ส่งเข้าฟอร์ม
            </button>
          </form>

          {/* Footer info */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-slate-300">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>เสียง Beep อัตโนมัติ</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">รักษาเลข 0 ด้านหน้าแบบ String</span>
            </div>
            <div className="font-mono text-slate-300 text-[10px]">
              EAN-13 • EAN-8 • UPC-A/E • Code-128 • Code-39 • QR
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
