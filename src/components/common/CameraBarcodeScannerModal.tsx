import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, RefreshCw, Zap, CheckCircle2, AlertCircle, Barcode, Volume2 } from 'lucide-react';
import { playScanSuccessSound, playScanErrorSound } from '../../utils/audio';

interface CameraBarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  continuous?: boolean;
}

export const CameraBarcodeScannerModal: React.FC<CameraBarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = 'กล้องสแกนบาร์โค้ดสินค้า (Camera Barcode Scanner)',
  continuous = false,
}) => {
  const [cameraError, setCameraError] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [lastScanned, setLastScanned] = useState<string>('');
  const [manualCode, setManualCode] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Stop camera tracks
  const stopCamera = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Start camera stream
  const startCamera = async () => {
    stopCamera();
    setCameraError('');

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้อง');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Start Barcode Detection loop if BarcodeDetector is supported
      setupBarcodeDetector();
    } catch (err: unknown) {
      console.warn('Camera error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setCameraError('ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณากดอนุญาตสิทธิ์การใช้งานกล้องในเบราว์เซอร์');
      } else if (msg.includes('NotFoundError') || msg.includes('DevicesNotFoundError')) {
        setCameraError('ไม่พบอุปกรณ์กล้องบนเครื่องนี้ สามารถกรอกรหัสบาร์โค้ดด้วยตนเองด้านล่างได้ครับ');
      } else {
        setCameraError('ไม่สามารถเปิดกล้องได้: ' + msg);
      }
    }
  };

  const setupBarcodeDetector = () => {
    const BarcodeDetectorClass = (window as unknown as { BarcodeDetector?: any }).BarcodeDetector;

    if (!BarcodeDetectorClass) {
      // Browser doesn't have native BarcodeDetector API
      return;
    }

    try {
      const detector = new BarcodeDetectorClass({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'],
      });

      let processing = false;

      scanIntervalRef.current = window.setInterval(async () => {
        if (!videoRef.current || videoRef.current.readyState < 2 || processing || !isScanning) {
          return;
        }

        try {
          processing = true;
          const barcodes = await detector.detect(videoRef.current);
          if (barcodes && barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (code && code !== lastScanned) {
              handleBarcodeFound(code);
            }
          }
        } catch {
          // ignore transient detection frames
        } finally {
          processing = false;
        }
      }, 250);
    } catch (e) {
      console.warn('BarcodeDetector setup failed', e);
    }
  };

  const handleBarcodeFound = (code: string) => {
    playScanSuccessSound();
    setLastScanned(code);

    onScan(code);

    if (!continuous) {
      stopCamera();
      onClose();
    } else {
      // Throttle repeat scans in continuous mode
      setIsScanning(false);
      setTimeout(() => {
        setIsScanning(true);
        setLastScanned('');
      }, 1500);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manualCode.trim();
    if (!code) return;
    playScanSuccessSound();
    onScan(code);
    setManualCode('');
    if (!continuous) {
      stopCamera();
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden text-white flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-100">{title}</h3>
              <p className="text-[11px] text-slate-400">จ่อบาร์โค้ดให้อยู่ในกรอบเลเซอร์เพื่อสแกนอัตโนมัติ</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Viewfinder Area */}
        <div className="relative bg-black flex-1 min-h-[260px] sm:min-h-[320px] flex items-center justify-center overflow-hidden">
          {cameraError ? (
            <div className="p-6 text-center max-w-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-red-300 leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-xl text-white transition flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลองเปิดกล้องใหม่อีกครั้ง</span>
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover max-h-[360px]"
              />

              {/* Viewfinder Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="relative w-64 h-44 sm:w-72 sm:h-48 border-2 border-white/60 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] flex flex-col justify-between p-2">
                  {/* Target Corners */}
                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-sm" />
                    <div className="w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-sm" />
                  </div>

                  {/* Animated Laser Scanning Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_12px_#ef4444] animate-pulse" />

                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-sm" />
                    <div className="w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-sm" />
                  </div>
                </div>
              </div>

              {/* Controls bar overlaid on camera */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                <button
                  type="button"
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="px-3 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white rounded-xl text-xs font-medium backdrop-blur-md border border-slate-700/60 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>สลับกล้อง ({facingMode === 'environment' ? 'หลัง' : 'หน้า'})</span>
                </button>

                <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-700/60 text-[11px] text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>กำลังสแกนสด...</span>
                </div>
              </div>
            </>
          )}

          {/* Last Scanned Tag */}
          {lastScanned && (
            <div className="absolute top-3 left-3 right-3 bg-emerald-600/90 text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg backdrop-blur-md animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>สแกนติด: {lastScanned}</span>
            </div>
          )}
        </div>

        {/* Modal Footer / Manual Barcode Input */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 space-y-3">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="หรือพิมพ์รหัสบาร์โค้ดตรงนี้ (กรณีกล้องไม่ติด)..."
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs md:text-sm bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md transition shrink-0 cursor-pointer"
            >
              ตกลง
            </button>
          </form>

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-blue-400" />
              <span>มีเสียง Beep ตอบรับทุกครั้งที่สแกนติด</span>
            </span>
            <span className="font-mono">รองรับ: EAN-13, EAN-8, UPC, Code-128</span>
          </div>
        </div>
      </div>
    </div>
  );
};
