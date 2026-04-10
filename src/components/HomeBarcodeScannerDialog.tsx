'use client';

import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Barcode, Loader2, ScanLine, Upload } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

type LookupResult = {
  found: boolean;
  hasNutrition?: boolean;
  productName?: string;
  caloriesPerServing?: number | null;
  caloriesPer100g?: number | null;
  healthScore?: number;
  healthLabel?: string;
  message?: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read selected image.'));
    reader.readAsDataURL(file);
  });
}

export function HomeBarcodeScannerDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState('');
  const [error, setError] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [detectedBarcode, setDetectedBarcode] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    readerRef.current = new BrowserMultiFormatReader();

    return () => {
      readerRef.current = null;
    };
  }, []);

  const resetState = () => {
    setError('');
    setPreviewImage('');
    setDetectedBarcode('');
    setLookupResult(null);
    setIsProcessing(false);
    setProcessingStage('');
  };

  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 12000) => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const lookupBarcode = async (barcode: string) => {
    const cleanBarcode = barcode.trim();
    if (!cleanBarcode) {
      throw new Error('No barcode detected.');
    }

    setProcessingStage('Fetching product from Food Facts...');
    const lookupRes = await fetchWithTimeout(`/api/barcode/lookup?barcode=${encodeURIComponent(cleanBarcode)}`);
    const lookupData = await lookupRes.json();

    if (!lookupRes.ok) {
      throw new Error(lookupData?.error || 'Food Facts lookup failed.');
    }

    setLookupResult(lookupData as LookupResult);

    if (!lookupData?.found || lookupData?.hasNutrition === false) {
      setError(lookupData?.message || 'Barcode is invalid or nutrition facts are unavailable for this product.');
    }
  };

  const scanFromImage = async (file: File) => {
    if (!readerRef.current) {
      setError('Scanner is not ready yet. Please try again.');
      return;
    }

    setIsProcessing(true);
    setError('');
    setLookupResult(null);
    setDetectedBarcode('');
    setProcessingStage('Reading image...');

    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewImage(dataUrl);

      setProcessingStage('Scanning barcode...');
      const result = await (readerRef.current as any).decodeFromImageUrl(dataUrl);
      const barcode = String(result?.getText?.() || '').trim();

      if (!barcode) {
        throw new Error('No barcode detected in the image.');
      }

      setDetectedBarcode(barcode);
      await lookupBarcode(barcode);
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Could not scan barcode from image.');
    } finally {
      setIsProcessing(false);
      setProcessingStage('');
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
          resetState();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="h-9 rounded-lg bg-violet-600 px-3 text-xs text-white hover:bg-violet-700">
          <ScanLine className="mr-1.5 h-3.5 w-3.5" />
          Open Scanner
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Barcode className="h-5 w-5 text-violet-600" />
            Barcode Scanner
          </DialogTitle>
          <DialogDescription>
            Upload a barcode photo to get product details from Food Facts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full border-violet-300 text-violet-700 hover:bg-violet-50">
            <Upload className="mr-2 h-4 w-4" />
            Upload Photo
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (file) {
                await scanFromImage(file);
              }
              input.value = '';
            }}
          />

          {previewImage ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
              <img src={previewImage} alt="Selected barcode image" className="max-h-64 w-full object-contain" />
            </div>
          ) : null}

          {isProcessing ? (
            <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-800">
              <Loader2 className="h-4 w-4 animate-spin" />
              {processingStage || 'Scanning barcode...'}
            </div>
          ) : null}

          {detectedBarcode ? (
            <p className="text-sm text-slate-700">
              Detected barcode: <span className="font-semibold text-slate-900">{detectedBarcode}</span>
            </p>
          ) : null}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          {lookupResult?.found && lookupResult?.hasNutrition !== false ? (
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-slate-50 p-4 text-sm text-slate-700 shadow-sm">
              <p className="font-semibold text-slate-900 text-base">{lookupResult.productName || 'Product found'}</p>
              <p className="mt-1">
                Calories: {lookupResult.caloriesPerServing ?? lookupResult.caloriesPer100g ?? 'N/A'}
                {lookupResult.caloriesPerServing ? ' per serving' : ' per 100g'}
              </p>
              <p className="mt-1">Health score: {lookupResult.healthScore ?? 'N/A'}/100 ({lookupResult.healthLabel || 'Balanced'})</p>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
