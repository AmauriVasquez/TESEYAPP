import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Menu, X, Pin, PinOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const pinnedStorageKey = (persistKey) => `tesey:moduleSubnav:${persistKey}:pinned`;

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

function readPinned(persistKey) {
  try {
    return localStorage.getItem(pinnedStorageKey(persistKey)) === 'true';
  } catch {
    return false;
  }
}

function writePinned(persistKey, value) {
  try {
    localStorage.setItem(pinnedStorageKey(persistKey), String(value));
  } catch {
    /* ignore */
  }
}

/**
 * Layout de módulo: submenú colapsable (hover + pin en desktop, toggle drawer en móvil) + contenido.
 * @param {{ title: string, persistKey?: string, items: { to: string, label: string, icon: React.ComponentType<{ className?: string }>, end?: boolean, isActive?: (pathname: string) => boolean }[], children?: React.ReactNode }} props
 */
export function ModuleSubnavLayout({ title, items, children, persistKey = 'default' }) {
  const { pathname } = useLocation();
  const body = children ?? <Outlet />;
  const isDesktop = useIsDesktop();

  const [pinned, setPinned] = useState(() => readPinned(persistKey));
  const [hovered, setHovered] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setPinned(readPinned(persistKey));
  }, [persistKey]);

  useEffect(() => {
    if (isDesktop) setMobileOpen(false);
  }, [isDesktop]);

  const setPinnedPersist = useCallback(
    (next) => {
      setPinned(next);
      writePinned(persistKey, next);
    },
    [persistKey]
  );

  const togglePinned = useCallback(() => {
    setPinnedPersist(!pinned);
  }, [pinned, setPinnedPersist]);

  const desktopExpanded = pinned || hovered;
  const showNavLabels = isDesktop ? desktopExpanded : mobileOpen;

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  const navItems = useMemo(
    () =>
      items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            onClick={() => !isDesktop && setMobileOpen(false)}
            className={({ isActive: navIsActive }) => {
              const active = item.isActive ? item.isActive(pathname) : navIsActive;
              return cn(
                'flex shrink-0 items-center gap-2 rounded-md border-l-[3px] py-2 text-sm font-medium text-gray-700 transition-colors duration-200',
                'border-transparent hover:bg-gray-100/90',
                showNavLabels ? 'px-2' : 'justify-center px-2 md:justify-center',
                active && 'border-sky-600 bg-sky-50 text-sky-900 shadow-sm'
              );
            }}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            <span
              className={cn(
                'min-w-0 truncate transition-[opacity,max-width] duration-300 ease-in-out',
                showNavLabels ? 'max-w-[14rem] opacity-100' : 'max-w-0 overflow-hidden opacity-0 md:max-w-0 md:opacity-0'
              )}
            >
              {item.label}
            </span>
          </NavLink>
        );
      }),
    [items, pathname, showNavLabels, isDesktop]
  );

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm md:min-h-[calc(100vh-9.5rem)]">
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        {!isDesktop && mobileOpen ? (
          <button
            type="button"
            className="absolute inset-0 z-20 bg-black/40 md:hidden"
            aria-label="Cerrar submenú"
            onClick={closeMobile}
          />
        ) : null}

        <aside
          onMouseEnter={() => isDesktop && setHovered(true)}
          onMouseLeave={() => isDesktop && setHovered(false)}
          className={cn(
            'z-30 flex shrink-0 flex-col border-b border-gray-200 bg-slate-50 transition-[width] duration-300 ease-in-out md:border-r md:border-b-0',
            isDesktop && (desktopExpanded ? 'md:w-52' : 'md:w-14'),
            !isDesktop &&
              (mobileOpen
                ? 'absolute inset-0 w-full max-w-md flex-col self-start overflow-hidden shadow-2xl md:relative md:max-w-none md:shadow-none'
                : 'relative w-full flex-row items-stretch gap-0 overflow-hidden py-0.5 pl-0.5 pr-1')
          )}
        >
          {/* Cabecera módulo: desktop = pin / título según expansión; móvil = menú + título + cerrar */}
          {isDesktop ? (
            <div
              role="presentation"
              className={cn(
                'flex shrink-0 cursor-pointer select-none items-center border-b border-gray-200/90 transition-all duration-300',
                desktopExpanded ? 'justify-between gap-2 px-3 py-2' : 'justify-center py-2'
              )}
              onClick={togglePinned}
              title={
                pinned
                  ? 'Clic para desfijar el submenú (se colapsa al quitar el cursor)'
                  : 'Clic aquí o en el ícono para fijar el submenú expandido'
              }
            >
              <p
                className={cn(
                  'pointer-events-none text-[11px] font-semibold uppercase tracking-wide text-gray-500 transition-opacity duration-300',
                  desktopExpanded ? 'min-w-0 truncate opacity-100' : 'sr-only'
                )}
              >
                {title}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn('h-8 w-8 shrink-0 text-gray-600 hover:text-gray-900', !desktopExpanded && 'mx-auto')}
                onClick={(e) => {
                  e.stopPropagation();
                  togglePinned();
                }}
                title={pinned ? 'Desfijar menú' : 'Fijar menú expandido'}
                aria-pressed={pinned}
              >
                {pinned ? <PinOff className="h-4 w-4" aria-hidden /> : <Pin className="h-4 w-4" aria-hidden />}
              </Button>
            </div>
          ) : (
            <div className="flex w-full min-w-0 shrink-0 items-center gap-2 border-b border-gray-200/90 px-2 py-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-gray-700"
                onClick={() => setMobileOpen((o) => !o)}
                aria-expanded={mobileOpen}
                aria-controls="module-subnav-panel"
                title={mobileOpen ? 'Ocultar submódulos' : 'Mostrar submódulos'}
              >
                {mobileOpen ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
              </Button>
              <p className="min-w-0 flex-1 truncate text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                {title}
              </p>
            </div>
          )}

          <nav
            id="module-subnav-panel"
            className={cn(
              'flex min-h-0 gap-0.5 p-1.5 md:flex-col md:overflow-y-auto',
              !isDesktop && !mobileOpen && 'min-w-0 flex-1 flex-row items-center overflow-x-auto overflow-y-hidden py-0.5',
              !isDesktop && mobileOpen && 'flex flex-1 flex-col overflow-y-auto pb-4'
            )}
            aria-label={`Submódulos de ${title}`}
          >
            {navItems}
          </nav>
        </aside>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-gray-50/60 p-3 sm:p-4 md:p-6">
          {body}
        </div>
      </div>
    </div>
  );
}
