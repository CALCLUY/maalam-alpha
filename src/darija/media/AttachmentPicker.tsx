import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Camera, FileImage, FileText, RotateCcw, X } from "lucide-react";

type Props = {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onFile: (file: File) => void;
};

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

export function AttachmentPicker({ open, busy, onClose, onFile }: Props) {
  const imageInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const nativeCameraInput = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const openRef = useRef(open);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  openRef.current = open;

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraActive(false);
  };

  useEffect(() => {
    if (!open) {
      stopCamera();
      setCameraError("");
      setCameraStarting(false);
      return;
    }
    firstButtonRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    if (!cameraActive || !streamRef.current || !videoRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => {
      stopCamera();
      setCameraError("ما قدرناش نشغلو معاينة الكاميرا. جرّب تطبيق الكاميرا فالتليفون.");
    });
  }, [cameraActive]);

  const startCamera = async () => {
    if (busy || cameraStarting) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      nativeCameraInput.current?.click();
      return;
    }
    setCameraError("");
    setCameraStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      if (!openRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      setCameraActive(true);
    } catch {
      stopCamera();
      setCameraError("ما قدرناش نفتحو الكاميرا. عطينا الإذن ولا استعمل تطبيق الكاميرا فالتليفون.");
    } finally {
      if (openRef.current) setCameraStarting(false);
    }
  };

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) {
      setCameraError("الصورة ما وجداتش بعد. تسنّى لحظة وعاود جرّب.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("ما قدرناش نلتاقطو الصورة فهاد المتصفح.");
      return;
    }
    context.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("ما قدرناش نلتاقطو الصورة. عاود جرّب.");
        return;
      }
      if (!openRef.current) return;
      const file = new File([blob], `vox-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      stopCamera();
      onClose();
      onFile(file);
    }, "image/jpeg", 0.93);
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    stopCamera();
    onClose();
    onFile(file);
  };

  if (!open) return null;

  return (
    <div className="media-picker-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="media-picker" role="dialog" aria-modal="true" aria-labelledby="media-picker-title" dir="rtl">
        <div className="media-picker-heading">
          <div>
            <p className="media-picker-kicker">Maalam</p>
            <h2 id="media-picker-title">شنو بغيتي تصيفط؟</h2>
          </div>
          <button type="button" className="media-picker-close" aria-label="سد" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {cameraActive ? (
          <div className="media-camera">
            <video ref={videoRef} autoPlay playsInline muted aria-label="معاينة الكاميرا" />
            <div className="media-camera-actions">
              <button type="button" className="media-picker-action is-primary" onClick={takePhoto}>
                <Camera className="h-4 w-4" /> صوّر و صيفط
              </button>
              <button type="button" className="media-picker-action" onClick={stopCamera}>
                رجع
              </button>
            </div>
          </div>
        ) : (
          <div className="media-picker-actions">
            <button
              ref={firstButtonRef}
              type="button"
              className="media-picker-choice"
              onClick={() => void startCamera()}
              disabled={busy || cameraStarting}
            >
              {cameraStarting ? <RotateCcw className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              <span><strong>تصوّر بالكميرا</strong><small>التمرين ولا السبورة مباشرة</small></span>
            </button>
            <button type="button" className="media-picker-choice" onClick={() => imageInput.current?.click()} disabled={busy}>
              <FileImage className="h-5 w-5" />
              <span><strong>ترفع صورة</strong><small>JPG, PNG, WebP و صور الهاتف</small></span>
            </button>
            <button type="button" className="media-picker-choice" onClick={() => pdfInput.current?.click()} disabled={busy}>
              <FileText className="h-5 w-5" />
              <span><strong>ترفع PDF</strong><small>درس ولا تمارين</small></span>
            </button>
            {cameraError && (
              <button type="button" className="media-camera-fallback" onClick={() => nativeCameraInput.current?.click()}>
                {cameraError} <span>جرّب كاميرا التليفون</span>
              </button>
            )}
          </div>
        )}
        <p className="media-picker-hint">تقدر حتى تلسق صورة ولا PDF بـ Ctrl + V</p>
        <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} className="hidden" onChange={handleFile} />
        <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="hidden" onChange={handleFile} />
        <input ref={nativeCameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
      </section>
    </div>
  );
}