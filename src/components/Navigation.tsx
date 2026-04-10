"use client";

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ClipboardCheck,
  BookOpen,
  ChevronRight,
  Bell,
  CreditCard,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageCircle,
  Receipt,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PWAInstallButton } from '@/components/pwa-install-button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth, useFirestore, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';

const wellnessItems = [
  { href: '/dashboard', label: 'Home', icon: Home },
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/logbook', label: 'Logbook', icon: LayoutDashboard },
  { href: '/my-menu', label: 'My Menu', icon: BookOpen },
];

const profileItems = [
  { href: '/profile', label: 'Profile', icon: Users },
  { href: '/health-patterns', label: 'Health Patterns', icon: TrendingUp },
];

const DESKTOP_SIDEBAR_WIDTH_CLASS = 'w-48 xl:w-52';

function SidebarLink({ href, label, icon: Icon, active, onClick }: { href: string; label: string; icon: typeof Home; active: boolean; onClick?: () => void }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        'group flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-all',
        active
          ? 'bg-emerald-500 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      )}
    >
      <Icon className={cn('h-4 w-4 transition-transform', active ? 'text-white' : 'group-hover:scale-105')} />
      <span className="font-medium leading-5">{label}</span>
    </Link>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const { user } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showCompleteSetup, setShowCompleteSetup] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setOpen(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSetupStatus = async () => {
      if (!user?.uid) {
        if (!cancelled) setShowCompleteSetup(false);
        return;
      }

      try {
        const userDoc = await getDoc(doc(firestore, 'users', user.uid));
        const data = userDoc.data() as { profileCompletedAt?: string } | undefined;
        if (!cancelled) {
          setShowCompleteSetup(!data?.profileCompletedAt);
        }
      } catch {
        if (!cancelled) {
          setShowCompleteSetup(true);
        }
      }
    };

    loadSetupStatus();

    return () => {
      cancelled = true;
    };
  }, [firestore, user?.uid]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  if (!user && (pathname === '/' || pathname === '/login' || pathname === '/register')) {
    return null;
  }

  const handleNavClick = () => setOpen(false);

  const sidebar = (
    <div className="flex h-full flex-col bg-white px-3 py-4">
      <Link href="/dashboard" onClick={handleNavClick} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
        <div className="relative h-9 w-9 overflow-hidden rounded-xl shadow-sm">
          <Image src="/Glyvora-icon.png" alt="Glyvora logo" fill className="object-cover" sizes="36px" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-tight text-slate-900">GLYVORA</p>
          <p className="text-[11px] text-slate-500">Personal health coach</p>
        </div>
      </Link>

      <div className="mt-5 space-y-1">
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">My Wellness</p>
        {wellnessItems.map((item) => (
          <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} onClick={handleNavClick} />
        ))}
        <div className="my-2 border-t border-slate-200" />
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">My Profile</p>
        {profileItems.map((item) => (
          <SidebarLink key={item.href} href={item.href} label={item.label} icon={item.icon} active={pathname === item.href} onClick={handleNavClick} />
        ))}
        {showCompleteSetup ? (
          <>
            <div className="my-2 border-t border-slate-200" />
            <SidebarLink
              href="/onboarding"
              label="Complete Setup"
              icon={ClipboardCheck}
              active={pathname === '/onboarding'}
              onClick={handleNavClick}
            />
          </>
        ) : null}
      </div>

      <div className="mt-auto pt-5">
        <PWAInstallButton />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-xl bg-slate-100 px-3 py-2.5 text-left outline-none ring-offset-background transition-colors hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                {(user?.displayName?.slice(0, 2) || 'GL').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-900">{user?.displayName || 'Glyvora user'}</p>
                <p className="truncate text-xs text-slate-500">{user?.email}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56 rounded-xl">
            <DropdownMenuItem onClick={() => router.push('/settings')} className="cursor-pointer">
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-default text-slate-500">
              <Receipt className="h-4 w-4" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-default text-slate-500">
              <CreditCard className="h-4 w-4" />
              Pricing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-600 focus:text-rose-600">
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <>
      <aside className={cn('fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200 bg-white shadow-[8px_0_30px_rgba(15,23,42,0.04)] lg:flex', DESKTOP_SIDEBAR_WIDTH_CLASS)}>
        {sidebar}
      </aside>

      <div className="fixed left-0 top-0 z-50 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="relative h-8 w-8 overflow-hidden rounded-xl">
            <Image src="/Glyvora-icon.png" alt="Glyvora logo" fill className="object-cover" sizes="32px" />
          </div>
          <span className="text-sm font-semibold text-slate-900">GLYVORA</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => setOpen((prev) => !prev)} className="rounded-xl text-slate-600 hover:bg-slate-100">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <div className="relative h-full w-[280px] border-r border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              aria-label="Close sidebar"
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-slate-500 hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="h-14 lg:hidden" />
    </>
  );
}

