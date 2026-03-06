'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Users,
  CalendarPlus,
  LayoutDashboard,
  Settings,
  LogIn,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useSidebar } from './SidebarContext';

const navItems = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Osoby', href: '/people', icon: Users },
  { label: 'Nowy grafik', href: '/schedule', icon: CalendarPlus },
];

const bottomItems = [
  { label: 'Ustawienia', href: '/settings', icon: Settings },
  { label: 'Zaloguj się', href: '/login', icon: LogIn },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, setMobileOpen } = useSidebar();

  const closeMobile = () => setMobileOpen(false);

  const renderNav = (showLabels: boolean) => (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          {showLabels && (
            <span className="truncate text-sm font-semibold text-sidebar-foreground">
              Harmonogram
            </span>
          )}
        </div>
        {/* Mobile close button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden"
          onClick={closeMobile}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Main nav */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          const link = (
            <Link
              href={item.href}
              onClick={closeMobile}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-primary'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {showLabels && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (!showLabels) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{link}</div>;
        })}
      </nav>

      {/* Bottom nav */}
      <div className="space-y-1 p-2">
        <Separator className="mb-2 bg-sidebar-border" />
        {bottomItems.map((item) => {
          const link = (
            <Link
              href={item.href}
              onClick={closeMobile}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {showLabels && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (!showLabels) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.href}>{link}</div>;
        })}
      </div>
    </>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 lg:flex',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {renderNav(!collapsed)}

        {/* Collapse toggle — desktop only */}
        <div className="border-t border-sidebar-border p-2">
          <Button variant="ghost" size="icon" className="w-full" onClick={toggle}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeMobile}
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-300 lg:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {renderNav(true)}
      </aside>
    </TooltipProvider>
  );
}
