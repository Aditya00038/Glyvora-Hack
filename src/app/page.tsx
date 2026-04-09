import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { 
  Camera, 
  Zap, 
  BrainCircuit, 
  ArrowRight, 
  BadgeCheck, 
  Activity, 
  Target, 
  ShieldCheck, 
  Sparkles,
  Cpu,
  Microscope,
  Database
} from 'lucide-react';

export default function LandingPage() {

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-50 selection:bg-emerald-500/30 font-body overflow-x-hidden">
      {/* Cinematic Grid Background */}
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-20 -z-10" />

      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)]">
              <Zap className="text-white w-6 h-6" fill="currentColor" />
            </div>
            <span className="text-2xl font-black tracking-tighter italic uppercase">GLYVORA</span>
          </div>
          
          <div className="hidden md:flex items-center gap-10 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
            <Link href="#engine" className="hover:text-emerald-500 transition-colors">Engine</Link>
            <Link href="#science" className="hover:text-emerald-500 transition-colors">Science</Link>
            <Link href="/learn" className="hover:text-emerald-500 transition-colors">Academy</Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hidden sm:block">
              <Button variant="ghost" className="text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest">
                Login
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full px-8 h-11 font-black text-[10px] uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all hover:scale-105">
                Initialize Engine
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 md:pt-64 md:pb-48">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-16 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-10 relative z-10">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] animate-fade-in-up">
                <Cpu className="w-3.5 h-3.5" />
                <span>v4.0 Production Core Active (2026)</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter text-white uppercase italic">
                Predict <br />
                <span className="text-emerald-500">The Spike.</span>
              </h1>
              
              <p className="text-xl text-slate-400 max-w-xl leading-relaxed font-medium">
                The world's leading metabolic decision engine. Real-time physiological modeling for precision glucose control.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 pt-4">
                <Link href="/analyze">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl px-12 py-9 text-2xl w-full sm:w-auto shadow-[0_20px_40px_rgba(16,185,129,0.2)] transition-all hover:scale-105 font-black uppercase italic group">
                    Start Scan
                    <Camera className="ml-4 w-7 h-7 group-hover:rotate-12 transition-transform" />
                  </Button>
                </Link>
              </div>

              {/* Stats HUD */}
              <div className="grid grid-cols-3 gap-8 pt-12 border-t border-white/5">
                <div>
                  <p className="text-3xl font-black text-white">96.2%</p>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Model Precision</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">12.8M</p>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Metabolic Maps</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">200ms</p>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Inference Latency</p>
                </div>
              </div>
            </div>

            {/* Right Content */}
            <div className="lg:col-span-5 relative">
              <div className="absolute -inset-20 bg-emerald-500/10 blur-[120px] rounded-full -z-10 animate-pulse" />
              
              <div className="relative aspect-[3/4] rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group">
                <Image
                  src="/hero-meal.png"
                  alt="Predictive metabolic logic analysis of a premium meal"
                  fill
                  className="object-cover transition-all duration-1000 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_15px_#10b981] z-20 animate-scan opacity-80" />
                
                {/* HUD Elements */}
                <div className="absolute top-10 left-10 p-4 glass-card rounded-2xl border-emerald-500/30 backdrop-blur-xl animate-fade-in-up">
                  <div className="flex items-center gap-2 mb-1">
                    <Activity className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] font-black uppercase text-emerald-500 tracking-widest">Predictive Logic</span>
                  </div>
                  <p className="text-xl font-black text-white">+24 <span className="text-[10px]">mg/dL Est.</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="engine" className="py-32 bg-slate-900/50 relative border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 text-center mb-20 space-y-4">
          <h2 className="text-sm font-black uppercase tracking-[0.4em] text-emerald-500">The 2026 Engine</h2>
          <p className="text-5xl font-black text-white uppercase italic">Surgical Precision. <br /> Total Control.</p>
        </div>

        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            { icon: Camera, title: "Vision OCR", desc: "Instant ingredient decomposition and portion weight estimation via proprietary neural nets." },
            { icon: BrainCircuit, title: "Deep Insights", desc: "Uncover hidden triggers. The engine learns your unique insulin response curve over time." },
            { icon: ShieldCheck, title: "Risk Shield", desc: "Proactive intervention. Suggested swaps reduce predicted spikes by up to 60%." }
          ].map((item, i) => (
            <div key={i} className="p-10 glass-card rounded-[3rem] border-slate-800 hover:border-emerald-500/40 transition-all group">
              <item.icon className="w-12 h-12 text-emerald-500 mb-8 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-4">{item.title}</h3>
              <p className="text-slate-400 leading-relaxed font-medium">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start gap-16 mb-20">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                  <Zap className="text-white w-5 h-5" />
                </div>
                <span className="text-xl font-black tracking-tighter uppercase italic">GLYVORA</span>
              </div>
              <p className="text-slate-500 max-w-xs text-xs font-black uppercase tracking-widest leading-loose">
                Metabolic Decision Engine v4.0. <br />
                Neural Processing Grid Active (2026).
              </p>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-20">
              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">System</h4>
                <ul className="space-y-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <li><Link href="/dashboard" className="hover:text-emerald-500">Dashboard</Link></li>
                  <li><Link href="/analyze" className="hover:text-emerald-500">Scanner</Link></li>
                  <li><Link href="/my-menu" className="hover:text-emerald-500">Planner</Link></li>
                </ul>
              </div>
              <div className="space-y-6">
                <h4 className="text-[10px] font-black text-white uppercase tracking-[0.3em]">Knowledge</h4>
                <ul className="space-y-4 text-xs font-bold text-slate-500 uppercase tracking-widest">
                  <li><Link href="/learn" className="hover:text-emerald-500">Academy</Link></li>
                  <li><Link href="/coach" className="hover:text-emerald-500">Coach AI</Link></li>
                  <li><Link href="/health-patterns" className="hover:text-emerald-500">Pattern Lab</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.4em]">
              © 2026 GLYVORA AI. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
