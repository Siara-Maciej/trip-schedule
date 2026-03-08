'use client';

import { Menu } from 'lucide-react';
import { AppSidebar } from './AppSidebar';
import { SidebarProvider, useSidebar } from './SidebarContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function ShellContent({ children }: { children: React.ReactNode }) {
  const { collapsed, setMobileOpen } = useSidebar();
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur lg:hidden">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <span className="text-sm font-semibold">Harmonogram</span>
      </header>

      <main
        className={cn(
          'min-h-[calc(100vh-3.5rem)] transition-all duration-300 lg:min-h-screen',
          collapsed ? 'lg:ml-16' : 'lg:ml-60'
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <ShellContent>{children}</ShellContent>
    </SidebarProvider>
  );
}
