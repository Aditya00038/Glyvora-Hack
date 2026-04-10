'use client';

import { useEffect, useRef, useState } from 'react';
import { Barcode, Camera, CheckCircle2, Loader2, ScanLine, Search, ShieldCheck, CircleAlert } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type LookupResult = {
  found: boolean;
  barcode: string;
  productName?: string;
  brand?: string;
  quantity?: string;
  servingSize?: string;
  caloriesPer100g?: number | null;
  caloriesPerServing?: number | null;
  healthScore?: number;
  healthLabel?: string;
  healthNotes?: string[];
  nutriscore?: string;
  image?: string;
  ingredients?: string;
  source?: string;
  message?: string;
};

type ScanStatus = 'idle' | 'scanning' | 'lookup' | 'error' | 'ready';

export function BarcodeScanner() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const lastDetectedRef = useRef<string>('');
  const mountedRef = useRef(true);

  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState<ScanStatus>('idle');
  const [error, setError] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [detectedBarcode, setDetectedBarcode] = useState('');

  useEffect(() => {
    mountedRef.current = true;
    const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    setSupported(hasDetector);

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    detectorRef.current = null;
    if (mountedRef.current) {
      setStatus('idle');
    }
  };

  const lookupBarcode = async (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) {
      return;
    }

    setError('');
    setStatus('lookup');
    setDetectedBarcode(cleanBarcode);

    try {
      const response = await fetch(`/api/barcode/lookup?barcode=${encodeURIComponent(cleanBarcode)}`);
      const data = (await response.json()) as LookupResult;

      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Unable to fetch product data.');
      }

      setLookupResult(data);
      setStatus('ready');
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : 'Product lookup failed.';
      setError(message);
      setLookupResult(null);
      setStatus('error');
    }
  };

  const scanFrame = async () => {
    if (!mountedRef.current || !videoRef.current || !detectorRef.current) {
      return;
    }

    try {
      const barcodes = await detectorRef.current.detect(videoRef.current);
      const rawValue = barcodes?.[0]?.rawValue?.trim();

      if (rawValue && rawValue !== lastDetectedRef.current) {
        lastDetectedRef.current = rawValue;
        await lookupBarcode(rawValue);
        stopScanner();
        return;
      }
    } catch {
      // Detection can fail intermittently while the camera is warming up.
    }

    timerRef.current = window.setTimeout(scanFrame, 350);
  };

  const startScanner = async () => {
    if (!supported) {
      setError('Barcode scanning is not supported in this browser. Use the manual barcode field below.');
      setStatus('error');
      return;
    }

    try {
      setError('');
      setStatus('scanning');
      lastDetectedRef.current = '';

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });

      streamRef.current = mediaStream;

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      const Detector = (window as any).BarcodeDetector;
      detectorRef.current = new Detector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code'],
      });

      scanFrame();
    } catch (scannerError) {
      const message = scannerError instanceof Error ? scannerError.message : 'Unable to access the camera.';
      setError(message);
      setStatus('error');
      stopScanner();
    }
  };

  const handleManualLookup = async () => {
    await lookupBarcode(barcodeInput);
  };

  const score = lookupResult?.healthScore ?? 0;
  const scoreClass =
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-lime-400' : score >= 40 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-white/10 bg-slate-950/70 shadow-2xl shadow-emerald-500/10 backdrop-blur-xl">
        <CardHeader className="space-y-3 border-b border-white/5 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
              <ScanLine className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl font-black uppercase tracking-tight text-white">Barcode Scanner</CardTitle>
              <CardDescription className="text-slate-400">
                Scan a packaged food barcode, pull product data from Food Facts, and show calories plus health score.
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/90">
              <div className="absolute left-0 top-0 z-10 h-[2px] w-full bg-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.9)]" />
              <div className="relative aspect-[4/3] bg-slate-950">
                <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
                {!streamRef.current && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/90 px-6 text-center">
                    <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-400">
                      <Barcode className="h-8 w-8" />
                    </div>
                    <div className="max-w-sm space-y-2">
                      <p className="text-lg font-bold text-white">Ready to scan</p>
                      <p className="text-sm leading-relaxed text-slate-400">
                        Point your camera at a barcode on a packaged product. The scanner will resolve it to product data automatically.
                      </p>
                    </div>
                  </div>
                )}
                {status === 'scanning' && (
                  <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-3xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-300 backdrop-blur">
                    Scan barcode → API → Product data → Show calories + health score
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={startScanner} className="rounded-full bg-emerald-500 px-5 font-black uppercase tracking-[0.2em] text-white hover:bg-emerald-600">
                <Camera className="h-4 w-4" />
                {status === 'scanning' ? 'Scanning' : 'Start Scan'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={stopScanner}
                className="rounded-full border-white/10 bg-white/5 px-5 font-black uppercase tracking-[0.2em] text-white hover:bg-white/10"
              >
                Stop Camera
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { title: 'Scan barcode', icon: Barcode, desc: 'Capture a packaged food code' },
                { title: 'Call Food Facts', icon: Search, desc: 'Fetch product nutrition data' },
                { title: 'Show score', icon: ShieldCheck, desc: 'Calories and health score' },
              ].map((step) => (
                <div key={step.title} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <step.icon className="mb-3 h-5 w-5 text-emerald-400" />
                  <p className="text-sm font-bold text-white">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
              <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Manual barcode</label>
              <div className="flex gap-3">
                <Input
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  placeholder="Enter barcode"
                  className="h-12 rounded-2xl border-white/10 bg-slate-950/70 text-white placeholder:text-slate-500"
                />
                <Button
                  type="button"
                  onClick={handleManualLookup}
                  className="h-12 rounded-2xl bg-white px-5 font-black uppercase tracking-[0.18em] text-slate-950 hover:bg-slate-200"
                >
                  Lookup
                </Button>
              </div>
              {!supported && (
                <p className="mt-3 flex items-center gap-2 text-xs text-amber-300">
                  <CircleAlert className="h-4 w-4" />
                  Camera barcode scanning is not available in this browser.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
              <div className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.25em] text-slate-400">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                Live result
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {error}
                </div>
              )}

              {!error && !lookupResult && (
                <div className="mt-6 space-y-3 text-sm text-slate-400">
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-4">
                    Scan or enter a barcode to see product nutrition details.
                  </div>
                  {status === 'lookup' && (
                    <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Looking up product data...
                    </div>
                  )}
                </div>
              )}

              {lookupResult && (
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
                      {lookupResult.image ? (
                        <img src={lookupResult.image} alt={lookupResult.productName || 'Product image'} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-600">
                          <Barcode className="h-7 w-7" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-black text-white">{lookupResult.productName}</p>
                      <p className="text-sm text-slate-400">{lookupResult.brand || 'Unknown brand'}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{lookupResult.barcode}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Calories</p>
                      <p className="mt-2 text-2xl font-black text-white">
                        {lookupResult.caloriesPerServing ?? lookupResult.caloriesPer100g ?? 'N/A'}
                      </p>
                      <p className="text-xs text-slate-400">{lookupResult.caloriesPerServing ? 'per serving' : 'per 100g'}</p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Health score</p>
                      <p className={cn('mt-2 text-2xl font-black', scoreClass)}>{lookupResult.healthScore ?? 0}/100</p>
                      <p className="text-xs text-slate-400">{lookupResult.healthLabel || 'Balanced'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-300">
                    {lookupResult.nutriscore ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Nutri-Score {lookupResult.nutriscore.toUpperCase()}</span>
                    ) : null}
                    {lookupResult.quantity ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{lookupResult.quantity}</span>
                    ) : null}
                    {lookupResult.servingSize ? (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Serving {lookupResult.servingSize}</span>
                    ) : null}
                  </div>

                  {lookupResult.healthNotes?.length ? (
                    <div className="flex flex-wrap gap-2">
                      {lookupResult.healthNotes.map((note) => (
                        <span key={note} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                          {note}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}