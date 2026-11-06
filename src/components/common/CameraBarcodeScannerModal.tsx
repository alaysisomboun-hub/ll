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
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Layers,
  Settings2,
  Sparkles,
} from 'lucide-react';
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  NotFoundException,
} from '@zxing/library';
import { playScanSuccessSound, playScanErrorSound } from '../../utils/audio';
import { detectUserDevice, DeviceInfo } from '../../utils/deviceDetector';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  continuous?: boolean;
  onOpenDiagnostics?: () => void;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'กล้องสแกนบาร์โค้ดสินค้า (Universal Camera Scanner)',
  continuous = true,
  onOpenDiagnostics,
}) => {
  const deviceInfo: DeviceInfo = useMemo(() => detectUserDevice(), []);

  // Camera state
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [cameraActive, setCameraActive] = useState<boolean>(true);
  const [cameraError, setCameraError] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [torchEnabled, setTorchEnabled] = useState<boolean>(false);
  const [hasTorchCapability, setHasTorchCapability] = useState<boolean>(false);

  // Scanning state
  const [lastScanned, setLastScanned] = useState<string>('');
  const [lastScannedFormat, setLastScannedFormat] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [scanCount, setScanCount] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScannedTimeRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });

  // Initialize ZXing reader with specified formats
  const getOrCreateReader = useCallback(() => {
    if (!readerRef.current) {
      const hints = new Map();
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

      readerRef.current = new BrowserMultiFormatReader(hints);
    }
    return readerRef.current;
  }, []);

  // Stop camera stream & ZXing decoder
  const stopCamera = useCallback(() => {
    if (readerRef.current) {
      try {
        readerRef.current.reset();
      } catch (err) {
        console.warn('Error resetting reader:', err);
      }
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn('Error stopping tracks:', err);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setTorchEnabled(false);
    setHasTorchCapability(false);
  }, []);

  // Enumerate connected cameras
  const refreshCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === 'videoinput');
      setCameras(videoDevices);
      return videoDevices;
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
      return [];
    }
  }, []);

  // Handle successful barcode recognition
  const handleBarcodeRecognized = useCallback(
    (code: string, formatName: string = '') => {
      const now = Date.now();
      const last = lastScannedTimeRef.current;

      // Anti-duplicate protection: 1200ms throttle for the same code
      if (last.code === code && now - last.time < 1200) {
        return;
      }

      lastScannedTimeRef.current = { code, time: now };
      playScanSuccessSound();

      setLastScanned(code);
      setLastScannedFormat(formatName);
      setScanCount((prev) => prev + 1);

      onScan(code);

      if (!continuous) {
        stopCamera();
        onClose();
      }
    },
    [continuous, onClose, onScan, stopCamera]
  );

  // Start Camera Stream & ZXing Decoding
  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError('');
    setIsInitializing(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง (WebRTC Not Supported)');
      }

      // Step 1: Discover cameras
      const videoDevices = await refreshCameras();

      // Step 2: Choose best camera if none selected yet
      let targetDeviceId = selectedDeviceId;

      if (!targetDeviceId && videoDevices.length > 0) {
        if (deviceInfo.type === 'mobile_phone' || deviceInfo.type === 'tablet') {
          // Prefer back/rear camera on phones & tablets
          const rearCam = videoDevices.find(
            (d) =>
              /back|rear|environment|หลัง/i.test(d.label) ||
              /camera2 0|facing back/i.test(d.label)
          );
          targetDeviceId = rearCam ? rearCam.deviceId : videoDevices[videoDevices.length - 1].deviceId;
        } else {
          // On Laptops / Desktops, default to the first or USB camera
          const usbCam = videoDevices.find((d) => /usb|external|webcam/i.test(d.label));
          targetDeviceId = usbCam ? usbCam.deviceId : videoDevices[0].deviceId;
        }
        setSelectedDeviceId(targetDeviceId);
      }

      // Step 3: Build constraints with continuous autofocus & HD resolution
      const videoConstraints: MediaTrackConstraints = {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
      };

      if (targetDeviceId) {
        videoConstraints.deviceId = { exact: targetDeviceId };
      } else {
        videoConstraints.facingMode = { ideal: deviceInfo.recommendedFacingMode };
      }

      // Request stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      streamRef.current = stream;

      // Check track capabilities (e.g. Torch / Continuous Focus)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        try {
          const capabilities = (videoTrack as any).getCapabilities?.() || {};
          if (capabilities.torch) {
            setHasTorchCapability(true);
          }

          // Apply continuous autofocus if allowed
          if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            await (videoTrack as any).applyConstraints?.({
              advanced: [{ focusMode: 'continuous' }],
            });
          }
        } catch (capErr) {
          console.debug('Autofocus constraint not supported:', capErr);
        }
      }

      // Re-enumerate to get device labels now that permission is granted
      const updatedDevices = await refreshCameras();
      if (!targetDeviceId && updatedDevices.length > 0) {
        const activeTrack = stream.getVideoTracks()[0];
        const activeSetting = activeTrack?.getSettings?.();
        if (activeSetting?.deviceId) {
          setSelectedDeviceId(activeSetting.deviceId);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Step 4: Hook into ZXing Reader
      const reader = getOrCreateReader();

      reader.decodeFromVideoElementContinuously(videoRef.current!, (result, err) => {
        if (result) {
          const rawText = result.getText();
          const formatEnum = result.getBarcodeFormat();
          const formatName = BarcodeFormat[formatEnum] || '';
          if (rawText) {
            handleBarcodeRecognized(rawText, formatName);
          }
        }
        if (err && !(err instanceof NotFoundException)) {
          // Ignore normal frames where no barcode is in view
        }
      });

      setIsInitializing(false);
      setCameraActive(true);
    } catch (err: unknown) {
      setIsInitializing(false);
      console.warn('Camera initiation failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError(
          'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณากด "อนุญาต (Allow)" ในเบราว์เซอร์เพื่อเปิดใช้งาน'
        );
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFound')) {
        setCameraError(
          'ไม่พบอุปกรณ์กล้องบนเครื่องนี้ คุณสามารถใช้เครื่องสแกนภายนอก หรือพิมพ์รหัสบาร์โค้ดด้านล่างได้ทันที'
        );
      } else if (msg.includes('NotReadableError') || msg.includes('Device in use')) {
        setCameraError(
          'กล้องกำลังถูกใช้งานโดยแอปพลิเคชันอื่น กรุณาปิดโปรแกรมอื่นที่ใช้กล้องแล้วกดเปิดใหม่อีกครั้ง'
        );
      } else {
        setCameraError('ไม่สามารถเริ่มการทำงานของกล้องได้: ' + msg);
      }
    }
  }, [
    deviceInfo.recommendedFacingMode,
    deviceInfo.type,
    getOrCreateReader,
    handleBarcodeRecognized,
    refreshCameras,
    selectedDeviceId,
    stopCamera,
  ]);

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

  // Handle Manual Form Submit
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    handleBarcodeRecognized(code, 'MANUAL_ENTRY');
    setManualCode('');
  };

  // Watch modal open/close & selected device changes
  useEffect(() => {
    if (isOpen && cameraActive) {
      startCamera();
    } else {
      stopCamera();
    }

    // Listen for USB camera hotplug / unplug events
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden text-white flex flex-col max-h-[94vh]">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-slate-100">{title}</h3>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {deviceInfo.type === 'mobile_phone' && <Smartphone className="w-3 h-3 text-emerald-400" />}
                  {deviceInfo.type === 'tablet' && <Tablet className="w-3 h-3 text-emerald-400" />}
                  {deviceInfo.type === 'laptop_desktop' && <Laptop className="w-3 h-3 text-blue-400" />}
                  <span>{deviceInfo.platformName}</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                รองรับ EAN-13, EAN-8, UPC, Code-128, Code-39 และ QR Code ทุกอุปกรณ์
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
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

        {/* CAMERA SELECTION & CONTROL BAR */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Device Selector */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-blue-400" />
              <span>เลือกกล้อง:</span>
            </span>
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              disabled={cameras.length === 0}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500 truncate cursor-pointer"
            >
              {cameras.length === 0 && <option value="">ตรวจพบกล้อง 1 ตัว (กล้องเริ่มต้น)</option>}
              {cameras.map((c, idx) => (
                <option key={c.deviceId || idx} value={c.deviceId}>
                  {c.label || `กล้องตัวที่ ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Toggle Camera On/Off */}
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

        {/* VIEWFINDER CONTAINER */}
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
                  หรือพิมพ์รหัสสินค้าด้านล่างได้ทันทีโดยไม่ต้องใช้กล้อง
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
              {/* Live Video Element */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className="w-full h-full object-cover max-h-[380px]"
              />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-44 sm:w-72 sm:h-48 border-2 border-white/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.52)] flex flex-col justify-between p-2">
                  {/* Top corners */}
                  <div className="flex justify-between">
                    <div className="w-6 h-6 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
                    <div className="w-6 h-6 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
                  </div>

                  {/* Pulsing Red Laser Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse" />

                  {/* Bottom corners */}
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
                  <span>ZXing Scanner กำลังทำงานสด...</span>
                </div>

                <div className="bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/70 text-[11px] text-slate-300 font-mono">
                  สแกนแล้ว {scanCount} รายการ
                </div>
              </div>
            </>
          )}

          {/* Last Scanned Successful Banner */}
          {lastScanned && (
            <div className="absolute top-3 left-3 right-3 bg-emerald-600/95 text-white px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xl backdrop-blur-md animate-in slide-in-from-top-2 border border-emerald-400/40">
              <div className="flex items-center gap-2 truncate">
                <CheckCircle2 className="w-4 h-4 text-emerald-200 shrink-0" />
                <span className="text-emerald-100 font-normal">สแกนติด:</span>
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
                เพิ่มลงตะกร้าแล้ว
              </span>
            </div>
          )}
        </div>

        {/* FALLBACK / MANUAL BARCODE INPUT BAR */}
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
              ค้นหาและเพิ่ม
            </button>
          </form>

          {/* Footer Meta & Compatibility Info */}
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 gap-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 text-slate-300">
                <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                <span>เสียง Beep อัตโนมัติ</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-400">Autofocus ต่อเนื่อง</span>
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
