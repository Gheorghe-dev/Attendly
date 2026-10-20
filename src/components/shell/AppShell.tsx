'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard,
  BookOpen,
  Layers,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  PlusCircle,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface AppShellProps {
  children: React.ReactNode;
  user?: {
    name?: string | null;
    email?: string | null;
  };
}

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Restore collapsed preference
  React.useEffect(() => {
    const saved = localStorage.getItem('qr_sidebar_collapsed');
    if (saved !== null) {
      setCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('qr_sidebar_collapsed', String(next));
  };

  // Close mobile drawer on route change
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Cursuri', href: '/dashboard/courses', icon: BookOpen },
    { label: 'Sesiuni', href: '/dashboard/sessions', icon: Layers },
    { label: 'Setări', href: '/dashboard/settings', icon: Settings },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Skip to content link for WCAG AA */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent focus:text-white focus:rounded-input focus:shadow-md"
      >
        Sari la conținutul principal
      </a>

      <div className="flex-1 flex w-full">
        {/* ── Desktop Left Sidebar ───────────────────────────────────── */}
        <aside
          className={cn(
            'hidden lg:flex flex-col border-r border-border bg-card transition-all duration-300 ease-academic sticky top-0 h-screen z-30 select-none',
            collapsed ? 'w-[72px]' : 'w-[264px]'
          )}
        >
          {/* Brand header */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-border">
            <Logo
              size={collapsed ? 'sm' : 'md'}
              showTagline={!collapsed}
              href="/dashboard"
            />
          </div>

          {/* Nav Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-input text-xs font-medium transition-colors relative group',
                    active
                      ? 'bg-accent-soft text-accent font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {/* 2px gold left indicator on active item */}
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r bg-accent" />
                  )}
                  <Icon
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-transform group-hover:scale-105',
                      active ? 'text-accent' : 'text-muted-foreground'
                    )}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Bottom user profile & collapse trigger */}
          <div className="p-3 border-t border-border space-y-2">
            <div
              className={cn(
                'flex items-center gap-2.5 p-2 rounded-card bg-muted/50 border border-border/50',
                collapsed && 'justify-center p-1.5'
              )}
            >
              <Avatar name={user?.name || 'Profesor'} size="sm" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground truncate">
                    {user?.name || 'Profesor'}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground truncate">
                    {user?.email || 'prof@univ.ro'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-1 pt-1">
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className={cn(
                  'flex items-center gap-2 text-[11px] text-muted-foreground hover:text-danger p-2 rounded-input hover:bg-danger-soft transition-colors w-full',
                  collapsed && 'justify-center'
                )}
                title="Deconectare"
              >
                <LogOut className="w-3.5 h-3.5" />
                {!collapsed && <span>Deconectare</span>}
              </button>

              <button
                type="button"
                onClick={toggleCollapsed}
                className="hidden lg:flex items-center justify-center p-1.5 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title={collapsed ? 'Extinde bara laterală' : 'Restrânge bara laterală'}
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* ── Mobile Sidebar Drawer (<1024px) ─────────────────────────── */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
              onClick={() => setMobileOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 w-[280px] bg-card border-r border-border shadow-xl flex flex-col p-4 z-50">
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <Logo href="/dashboard" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="p-2 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1">
                {navItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-3 rounded-input text-xs font-medium transition-colors',
                        active
                          ? 'bg-accent-soft text-accent font-semibold'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-border space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar name={user?.name || 'Profesor'} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user?.name || 'Profesor'}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">
                      {user?.email || 'prof@univ.ro'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-danger border-danger/30 hover:bg-danger-soft"
                  onClick={() => signOut({ callbackUrl: '/login' })}
                >
                  <LogOut className="w-3.5 h-3.5 mr-2" />
                  <span>Deconectare</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Content Area ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Sticky 56px Top Bar */}
          <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/85 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Deschide meniul"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="text-xs font-mono text-muted-foreground hidden sm:block">
                Universitatea Politehnica · Portal Academic
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />

              <Link href="/dashboard/courses">
                <Button variant="accent" size="sm">
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Sesiune nouă</span>
                </Button>
              </Link>
            </div>
          </header>

          {/* Main View Container */}
          <main
            id="main-content"
            className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1200px] w-full mx-auto"
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
