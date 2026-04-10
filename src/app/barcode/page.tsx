'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BrowserMultiFormatReader } from '@zxing/browser';
import {
  Barcode,
  Camera,
  Loader2,
  Search,
  ScanLine,
  Upload,
} from 'lucide-react';
import {
  addDoc,
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';

import { Navigation } from '@/components/Navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';

type LookupResult = {
  found: boolean;
  hasNutrition?: boolean;
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
  estimatedSpikeMgDl?: number;
  spikeLevel?: string;
  carbsPer100g?: number | null;
  sugarPer100g?: number | null;
  fiberPer100g?: number | null;
  proteinPer100g?: number | null;
  benefitNotes?: string[];
  image?: string;
  message?: string;
};

type HistoryEntry = {
  id: string;
  barcode: string;
  productName: string;
  calories: number | null;
  healthScore: number | null;
  scannedAt: string;
  imagePreview?: string;
};

const LOCAL_HISTORY_KEY = 'glyvora_barcode_history';

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(file);
  });
}

function formatDate(value: unknown): string {
  if (!value) return 'Now';
  if (typeof value === 'string') return value;

  const maybeDate = (value as { toDate?: () => Date }).toDate?.();
  if (maybeDate instanceof Date) {
    return maybeDate.toLocaleString();
  }

  return 'Now';
}

export default function BarcodePage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const scannerRef = useRef<BrowserMultiFormatReader | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [previewImage, setPreviewImage] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState('');
  const [manualBarcode, setManualBarcode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const readLocalHistory = (): HistoryEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_HISTORY_KEY);
      const parsed = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeLocalHistory = (entries: HistoryEntry[]) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(entries.slice(0, 20)));
  };

  useEffect(() => {
    scannerRef.current = new BrowserMultiFormatReader();
    return () => {
      scannerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [isUserLoading, router, user]);

  const loadHistory = async () => {
    if (!user) return;

    setIsLoadingHistory(true);
    try {
      const historyRef = collection(firestore, 'users', user.uid, 'barcodeHistory');
      const historyQuery = query(historyRef, orderBy('scannedAt', 'desc'), limit(20));
      const snaps = await getDocs(historyQuery);

      const nextHistory: HistoryEntry[] = snaps.docs.map((entry) => {
        const data = entry.data() as Record<string, unknown>;
        return {
          id: entry.id,
          barcode: String(data.barcode || ''),
          productName: String(data.productName || 'Unknown product'),
          calories: typeof data.calories === 'number' ? data.calories : null,
          healthScore: typeof data.healthScore === 'number' ? data.healthScore : null,
          scannedAt: formatDate(data.scannedAt),
          imagePreview: typeof data.imagePreview === 'string' ? data.imagePreview : undefined,
        };
      });

      setHistory(nextHistory);
    } catch (historyError) {
      console.error('Failed to load barcode history from Firestore:', historyError);
      const localHistory = readLocalHistory();
      setHistory(localHistory);
      setInfo('Cloud history is unavailable due to permissions. Showing local history on this device.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const caloriesLabel = useMemo(() => {
    if (!lookupResult) return 'N/A';
    const value = lookupResult.caloriesPerServing ?? lookupResult.caloriesPer100g;
    if (typeof value !== 'number') return 'N/A';
    return String(value);
  }, [lookupResult]);

  const saveHistory = async (payload: LookupResult, imageDataUrl: string) => {
    if (!user) return;

    const nextLocalEntry: HistoryEntry = {
      id: `${Date.now()}`,
      barcode: payload.barcode,
      productName: payload.productName || 'Unknown product',
      calories: payload.caloriesPerServing ?? payload.caloriesPer100g ?? null,
      healthScore: payload.healthScore ?? null,
      scannedAt: new Date().toLocaleString(),
      imagePreview: imageDataUrl || '',
    };

    try {
      await addDoc(collection(firestore, 'users', user.uid, 'barcodeHistory'), {
        barcode: payload.barcode,
        productName: payload.productName || 'Unknown product',
        calories: payload.caloriesPerServing ?? payload.caloriesPer100g ?? null,
        healthScore: payload.healthScore ?? null,
        healthLabel: payload.healthLabel || '',
        imagePreview: imageDataUrl || '',
        scannedAt: serverTimestamp(),
      });
    } catch {
      const updated = [nextLocalEntry, ...readLocalHistory()];
      writeLocalHistory(updated);
      setHistory(updated.slice(0, 20));
      setInfo('Saved to local history because cloud write permission is currently unavailable.');
    }
  };

  const lookupBarcode = async (barcode: string, imageDataUrl: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) {
      throw new Error('No barcode detected in image.');
    }

    const response = await fetch(`/api/barcode/lookup?barcode=${encodeURIComponent(cleanBarcode)}`);
    const data = (await response.json()) as LookupResult;

    if (!response.ok) {
      throw new Error((data as unknown as { error?: string })?.error || 'Lookup failed.');
    }

    setLookupResult(data);
    setDetectedBarcode(cleanBarcode);

    if (!data.found || data.hasNutrition === false) {
      setInfo(data.message || 'Product was found, but nutrition data is unavailable for this barcode.');
      if (imageDataUrl) {
        await saveHistory(data, imageDataUrl);
        await loadHistory();
      }
      return;
    }

    await saveHistory(data, imageDataUrl);
    await loadHistory();
  };

  const handleScan = async (file: File) => {
    if (!scannerRef.current) {
      setError('Scanner is not ready yet.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setInfo('');
    setLookupResult(null);
    setDetectedBarcode('');

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewImage(dataUrl);

      const result = await (scannerRef.current as unknown as { decodeFromImageUrl: (url: string) => Promise<{ getText?: () => string }> }).decodeFromImageUrl(dataUrl);
      const barcode = String(result?.getText?.() || '').trim();

      if (!barcode) {
        throw new Error('No barcode detected. Use a clear photo focused on barcode lines.');
      }

      setDetectedBarcode(barcode);
      await lookupBarcode(barcode, dataUrl);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Could not scan barcode from image.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleManualLookup = async () => {
    setError('');
    setInfo('');
    setLookupResult(null);

    try {
      await lookupBarcode(manualBarcode, '');
    } catch (manualError) {
      setError(manualError instanceof Error ? manualError.message : 'Manual lookup failed.');
    }
  };

  if (isUserLoading || !user) {
    return <div className="min-h-screen bg-[#F5F3F0]" />;
  }

  return (
    <div className="min-h-screen bg-[#F5F3F0] text-slate-900 lg:ml-48 xl:ml-52">
      <Navigation />

      <main className="mx-auto max-w-6xl px-4 py-4 lg:py-6">
        <div className="space-y-4">
          <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Barcode Scanner</h1>
                <p className="mt-1 text-sm text-slate-600">Click photo or upload food image with barcode to get nutrition details and save scan history.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={isProcessing} onClick={() => cameraInputRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                Click Photo
              </Button>
              <Button type="button" variant="outline" className="h-11 rounded-xl" disabled={isProcessing} onClick={() => uploadInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Image
              </Button>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Manual barcode entry</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualBarcode}
                  onChange={(e) => setManualBarcode(e.target.value)}
                  placeholder="Enter barcode number"
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-emerald-500"
                />
                <Button type="button" className="h-10 rounded-lg bg-slate-900 text-white hover:bg-slate-800" onClick={handleManualLookup} disabled={isProcessing}>
                  <Search className="mr-1 h-4 w-4" />
                  Check
                </Button>
              </div>
            </div>

            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (file) {
                  await handleScan(file);
                }
                input.value = '';
              }}
            />

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (file) {
                  await handleScan(file);
                }
                input.value = '';
              }}
            />

            {isProcessing ? (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <Loader2 className="h-4 w-4 animate-spin" />
                Scanning image and reading barcode...
              </div>
            ) : null}

            {previewImage ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                <img src={previewImage} alt="Selected food" className="max-h-72 w-full object-contain" />
              </div>
            ) : null}

            {detectedBarcode ? (
              <p className="mt-3 text-sm text-slate-600">
                Detected barcode: <span className="font-semibold text-slate-900">{detectedBarcode}</span>
              </p>
            ) : null}

            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            {info ? <p className="mt-3 text-sm text-slate-600">{info}</p> : null}

            {lookupResult?.found ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                    <Barcode className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">{lookupResult.productName || 'Product found'}</p>
                    <p className="text-sm text-slate-600">{lookupResult.brand || 'Unknown brand'}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2">
                    <p className="text-xs font-medium text-slate-500">Calories</p>
                    <p className="text-xl font-semibold text-slate-900">{caloriesLabel}</p>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2">
                    <p className="text-xs font-medium text-slate-500">Health score</p>
                    <p className="text-xl font-semibold text-slate-900">{lookupResult.healthScore ?? 'N/A'}/100</p>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2">
                    <p className="text-xs font-medium text-slate-500">Estimated glucose spike</p>
                    <p className="text-xl font-semibold text-slate-900">{lookupResult.estimatedSpikeMgDl ?? 'N/A'} mg/dL</p>
                  </div>
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2">
                    <p className="text-xs font-medium text-slate-500">Spike level</p>
                    <p className="text-xl font-semibold text-slate-900">{lookupResult.spikeLevel || 'N/A'}</p>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-700">Carbs/100g: {lookupResult.carbsPer100g ?? 'N/A'}</div>
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-700">Sugar/100g: {lookupResult.sugarPer100g ?? 'N/A'}</div>
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-700">Fiber/100g: {lookupResult.fiberPer100g ?? 'N/A'}</div>
                  <div className="rounded-xl border border-white/80 bg-white px-3 py-2 text-sm text-slate-700">Protein/100g: {lookupResult.proteinPer100g ?? 'N/A'}</div>
                </div>

                {lookupResult.benefitNotes?.length ? (
                  <div className="mt-3 rounded-xl border border-white/80 bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Impact notes</p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700">
                      {lookupResult.benefitNotes.map((note) => (
                        <li key={note}>• {note}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Scan History</h2>
              {isLoadingHistory ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" /> : null}
            </div>

            {!history.length ? (
              <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-6 text-center text-sm text-slate-600">
                No scan history yet. Scan a food image to save it here.
              </div>
            ) : (
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {history.map((entry) => (
                  <div key={entry.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {entry.imagePreview ? (
                      <img src={entry.imagePreview} alt={entry.productName} className="mb-2 h-28 w-full rounded-lg object-cover" />
                    ) : null}
                    <p className="text-sm font-semibold text-slate-900">{entry.productName}</p>
                    <p className="mt-1 text-xs text-slate-600">Barcode: {entry.barcode}</p>
                    <p className="mt-1 text-xs text-slate-600">Calories: {entry.calories ?? 'N/A'}</p>
                    <p className="mt-1 text-xs text-slate-600">Health score: {entry.healthScore ?? 'N/A'}/100</p>
                    <p className="mt-1 text-[11px] text-slate-500">{entry.scannedAt}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
