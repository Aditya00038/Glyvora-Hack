"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Home, 
  Camera, 
  History, 
  User, 
  Zap, 
  Languages, 
  BookOpen, 
  LogOut, 
  LayoutDashboard, 
  CalendarDays, 
  Bot,
  BrainCircuit,
  Menu,
  X,
  Activity,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { triggerTranslation } from '@/lib/translate-utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from '@/components/ui/button';
import { useUser, useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';

import { ThemeToggle } from '@/components/theme-toggle';

export function Navigation() {
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const navItems = [
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/insights', icon: TrendingUp, label: 'Insights' },
    { href: '/meal-plan', icon: CalendarDays, label: 'Meal Plan' },
    { href: '/history', icon: History, label: 'History' },
  ];

  const languages = [
    { code: 'en', label: 'English', native: 'English' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
    { code: 'mr', label: 'Marathi', native: 'મરાઠી' },
    { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
    { code: 'te', label: 'Telugu', native: 'తెలుగు' },
    { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ' },
    { code: 'ml', label: 'Malayalam', native: 'മലയാളം' },
    { code: 'bn', label: 'Bengali', native: 'বাংলা' },
    { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'ur', label: 'Urdu', native: 'اردو' },
  ];

  if (!user && (pathname === '/' || pathname === '/login' || pathname === '/register')) {
    return null;
  }

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 border-b border-border bg-background/80 backdrop-blur-md z-[100] shadow-sm">
      <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
        {/* Logo Section */}
        <Link href="/dashboard" className="flex items-center gap-2 group shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center transition-transform">
            <Zap className="w-4 h-4" fill="currentColor" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground hidden sm:block">Glyvora</span>
        </Link>

        {/* Desktop Navigation Items */}
        <div className="hidden lg:flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-medium",
                  isActive 
                    ? "text-foreground bg-secondary" 
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}>
                  <item.icon className={cn("w-4 h-4 transition-transform group-hover:scale-105", isActive && "text-foreground")} />
                  <span className="text-sm">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Actions Section */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 px-3">
                <Languages className="w-4 h-4" />
                <span className="hidden md:block ml-2 font-medium text-sm">Region</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 bg-card border-border rounded-2xl p-2 max-h-[400px] overflow-y-auto custom-scrollbar shadow-lg">
              {languages.map((lang) => (
                <DropdownMenuItem 
                  key={lang.code}
                  className="cursor-pointer notranslate flex justify-between items-center rounded-lg p-2.5 hover:bg-secondary hover:text-foreground transition-colors" 
                  onClick={() => triggerTranslation(lang.code)}
                >
                  <span className="font-semibold text-sm text-foreground">{lang.native}</span>
                  <span className="text-xs font-medium text-muted-foreground ml-2">({lang.label})</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/profile" className="hidden sm:block">
            <Button variant="ghost" size="sm" className={cn(
              "rounded-xl px-3",
              pathname === '/profile' ? "text-foreground bg-secondary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            )}>
              <User className="w-4 h-4" />
              <span className="hidden md:block ml-2 font-medium text-sm">Profile</span>
            </Button>
          </Link>

          {/* Mobile Menu Trigger */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden rounded-xl text-muted-foreground hover:text-foreground">
                <Menu className="w-6 h-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="bg-background border-l border-border p-6 flex flex-col">
              <SheetHeader className="text-left mb-6">
                <SheetTitle className="text-xl font-bold flex items-center gap-3 text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4" fill="currentColor" />
                  </div>
                  Glyvora
                </SheetTitle>
                <SheetDescription className="text-sm font-medium text-muted-foreground">
                  Metabolic Intelligence
                </SheetDescription>
              </SheetHeader>
              
              <div className="space-y-2 flex-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                    <div className={cn(
                      "flex items-center gap-4 px-4 py-4 rounded-xl transition-all font-medium",
                      pathname === item.href ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                    )}>
                      <item.icon className="w-5 h-5" />
                      <span className="text-sm">{item.label}</span>
                    </div>
                  </Link>
                ))}
                <div className="flex items-center gap-4 px-4 py-4 rounded-xl transition-all font-medium bg-background border border-border mt-4">
                  <ThemeToggle /> <span className="text-sm font-semibold">Toggle Theme</span>
                </div>
                <Link href="/profile" onClick={() => setIsMobileMenuOpen(false)}>
                  <div className={cn(
                    "flex items-center gap-4 px-4 py-4 rounded-xl transition-all font-medium",
                    pathname === '/profile' ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                  )}>
                    <User className="w-5 h-5" />
                    <span className="text-sm">Profile</span>
                  </div>
                </Link>
              </div>

              <Button 
                variant="ghost" 
                onClick={handleLogout}
                className="w-full justify-start gap-4 px-4 py-6 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 transition-all mt-auto font-semibold"
              >
                <LogOut className="w-5 h-5" />
                <span className="text-sm">Sign Out</span>
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}