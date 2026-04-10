import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { BarcodeScanner } from '@/components/barcode-scanner';
import { Activity, Camera, Cpu, Database, ShieldCheck } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="fixed top-0 w-full z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-xl overflow-hidden shadow-sm">
              <Image src="/Glyvora-icon.png" alt="Glyvora logo" fill className="object-cover" sizes="40px" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Glyvora</span>
          </div>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <Link href="#engine" className="hover:text-emerald-600 transition-colors">Engine</Link>
            <Link href="#science" className="hover:text-emerald-600 transition-colors">Science</Link>
            <Link href="/learn" className="hover:text-emerald-600 transition-colors">Academy</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" className="text-slate-600 hover:text-slate-900">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-6 h-10 shadow-sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="pt-36 pb-24 md:pt-44 md:pb-28 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-14 items-center">
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                <Cpu className="w-3.5 h-3.5" />
                <span>Production core active (2026)</span>
              </div>

              <h1 className="text-5xl md:text-7xl font-semibold leading-tight tracking-tight text-slate-900">
                Predict your glucose
                <span className="block text-emerald-600">before you spike.</span>
              </h1>

              <p className="text-lg text-slate-600 max-w-2xl leading-relaxed">
                A practical metabolic assistant for daily choices. Scan meals, estimate impact, and make safer nutrition decisions in seconds.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                <Link href="/analyze">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-8 h-12 text-base font-semibold w-full sm:w-auto">
                    Start Scan
                    <Camera className="ml-2 w-5 h-5" />
                  </Button>
                </Link>
              </div>

              <div className="grid grid-cols-3 gap-6 pt-8 border-t border-slate-200">
                <div>
                  <p className="text-2xl font-semibold text-slate-900">96.2%</p>
                  <p className="text-xs font-medium text-emerald-700">Model precision</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">12.8M</p>
                  <p className="text-xs font-medium text-emerald-700">Metabolic maps</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-slate-900">200ms</p>
                  <p className="text-xs font-medium text-emerald-700">Inference latency</p>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative aspect-[3/4] rounded-3xl overflow-hidden border border-slate-200 shadow-xl">
                <Image
                  src="/hero-meal.png"
                  alt="Meal analysis preview"
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/30 via-transparent to-transparent" />

                <div className="absolute top-8 left-8 p-4 rounded-2xl border border-white/70 bg-white/85 backdrop-blur">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3 text-emerald-600" />
                    <span className="text-[11px] font-semibold text-emerald-700">Predictive logic</span>
                  </div>
                  <p className="text-xl font-semibold text-slate-900">+24 <span className="text-xs">mg/dL est.</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="engine" className="py-20 bg-slate-50 border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 space-y-12">
          <div className="text-center space-y-3">
            <h2 className="text-sm font-semibold tracking-wide text-emerald-700">Barcode Nutrition Engine</h2>
            <p className="text-4xl font-semibold text-slate-900">Scan. Resolve. Score.</p>
          </div>

          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7">
              <BarcodeScanner />
            </div>

            <div className="lg:col-span-5 space-y-5">
              <div className="p-7 rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                    <Camera className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-semibold text-slate-900">Food Facts Workflow</h3>
                </div>
                <p className="text-slate-600 leading-relaxed">
                  Point the camera at a packaged food barcode, query Food Facts, then render calories and a health score instantly.
                </p>
              </div>

              <div className="grid gap-4">
                {[
                  { icon: Camera, title: 'Scan barcode', desc: 'Use camera or manual entry to capture a product code.' },
                  { icon: Database, title: 'Fetch product data', desc: 'Look up brand, calories, serving size, and nutrition signals from Food Facts.' },
                  { icon: ShieldCheck, title: 'Show health score', desc: 'Turn nutrition profile into a simple 0-100 score.' },
                ].map((item) => (
                  <div key={item.title} className="p-5 rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <item.icon className="w-8 h-8 text-emerald-600 mb-3" />
                    <h4 className="text-lg font-semibold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-slate-600 leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-14 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-10 mb-10">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative w-8 h-8 rounded-lg overflow-hidden">
                  <Image src="/Glyvora-icon.png" alt="Glyvora logo" fill className="object-cover" sizes="32px" />
                </div>
                <span className="text-xl font-semibold tracking-tight">Glyvora</span>
              </div>
              <p className="text-slate-500 max-w-xs text-sm leading-relaxed">
                Metabolic Decision Engine v4.0. Practical guidance for everyday glucose-aware nutrition.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12">
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-900 tracking-wide">System</h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li><Link href="/dashboard" className="hover:text-emerald-600">Dashboard</Link></li>
                  <li><Link href="/analyze" className="hover:text-emerald-600">Scanner</Link></li>
                  <li><Link href="/my-menu" className="hover:text-emerald-600">Planner</Link></li>
                </ul>
              </div>
              <div className="space-y-4">
                <h4 className="text-xs font-semibold text-slate-900 tracking-wide">Knowledge</h4>
                <ul className="space-y-2 text-sm text-slate-600">
                  <li><Link href="/learn" className="hover:text-emerald-600">Academy</Link></li>
                  <li><Link href="/coach" className="hover:text-emerald-600">Coach AI</Link></li>
                  <li><Link href="/health-patterns" className="hover:text-emerald-600">Pattern Lab</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-500">© 2026 Glyvora AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
