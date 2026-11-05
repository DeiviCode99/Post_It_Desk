import { useCallback, useEffect, useRef, useState } from 'react';
import type { EdgeMode } from '../../../shared/contracts';

/** Tiempo de gracia al salir del panel antes de replegar, para tolerar movimientos torpes. */
const COLLAPSE_DELAY_MS = 450;
/** Debe coincidir con la duración de `panel-out` en app.css. */
const EXIT_ANIMATION_MS = 200;
/** Elementos opacos; todo lo demás de la ventana es transparente. */
const SURFACES = '.panel, .sheet, .edge-handle';
/**
 * Tras cambiar de estado la ventana cambia de tamaño, y Chromium puede
 * reportar que el mouse "salió" aunque no se movió. Esos avisos se ignoran.
 */
const RESIZE_GRACE_MS = 600;

/** ¿El puntero está ahora mismo sobre el panel o la hoja? */
function pointerOnSurface(): boolean {
  return document.querySelector('.panel:hover, .sheet:hover') !== null;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** ¿El usuario está escribiendo? Entonces no se repliega aunque salga el mouse. */
function isEditing(): boolean {
  const el = document.activeElement;
  return (
    document.hasFocus() &&
    el instanceof HTMLElement &&
    (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
  );
}

/**
 * Comportamiento "oculto hasta pasar el mouse": expande al entrar en la
 * pestaña y repliega al salir, con animación de salida antes de encoger la
 * ventana. Además decide cuándo las zonas transparentes dejan pasar clics.
 */
export function useEdgeMode() {
  const [mode, setModeState] = useState<EdgeMode>('collapsed');
  const [closing, setClosing] = useState(false);
  const [pinned, setPinnedState] = useState(false);
  const collapseTimer = useRef<number>();
  const overSurface = useRef(true);
  const collapsing = useRef(false);
  const modeChangedAt = useRef(0);

  const setMode = useCallback((next: EdgeMode) => {
    collapsing.current = false;
    setClosing(false);
    setModeState(next);
    void window.desktop.setMode(next);
  }, []);

  /** Anima la salida del panel y después pide a Electron encoger la ventana. */
  const requestCollapse = useCallback(() => {
    if (collapsing.current) return;
    collapsing.current = true;
    if (prefersReducedMotion()) return setMode('collapsed');
    setClosing(true);
    window.setTimeout(() => setMode('collapsed'), EXIT_ANIMATION_MS);
  }, [setMode]);

  useEffect(() => {
    void window.desktop.getPinned().then(setPinnedState);
    const offMode = window.desktop.onModeChanged((next) => {
      setClosing(false);
      setModeState(next);
    });
    const offCollapse = window.desktop.onRequestCollapse(requestCollapse);
    return () => {
      offMode();
      offCollapse();
    };
  }, [requestCollapse]);

  const togglePinned = useCallback(async () => {
    setPinnedState(await window.desktop.setPinned(!pinned));
  }, [pinned]);

  useEffect(() => {
    modeChangedAt.current = Date.now();
  }, [mode]);

  useEffect(() => {
    const cancel = () => window.clearTimeout(collapseTimer.current);
    const scheduleCollapse = () => {
      if (pinned || mode === 'collapsed' || isEditing()) return;
      cancel();
      collapseTimer.current = window.setTimeout(() => {
        // Última comprobación: si el puntero volvió al panel o a la hoja, no se repliega.
        if (!pointerOnSurface()) requestCollapse();
      }, COLLAPSE_DELAY_MS);
    };

    // Sobre una superficie: recibe clics y cancela cualquier repliegue pendiente.
    // Sobre lo transparente: deja pasar clics y cuenta como "salió del panel".
    const onMove = (event: MouseEvent) => {
      const onSurface = event.target instanceof Element && event.target.closest(SURFACES) !== null;
      if (onSurface) cancel();
      if (onSurface === overSurface.current) return;
      overSurface.current = onSurface;
      window.desktop.setPassthrough(!onSurface);
      if (!onSurface) scheduleCollapse();
    };

    const onLeave = () => {
      if (Date.now() - modeChangedAt.current < RESIZE_GRACE_MS) return;
      scheduleCollapse();
    };

    const root = document.documentElement;
    root.addEventListener('mousemove', onMove);
    root.addEventListener('mousedown', cancel);
    root.addEventListener('mouseleave', onLeave);
    return () => {
      cancel();
      root.removeEventListener('mousemove', onMove);
      root.removeEventListener('mousedown', cancel);
      root.removeEventListener('mouseleave', onLeave);
    };
  }, [mode, pinned, requestCollapse]);

  // Al replegar, la pestaña vuelve a recibir el mouse.
  useEffect(() => {
    if (mode === 'collapsed') overSurface.current = true;
  }, [mode]);

  return { mode, closing, setMode, requestCollapse, pinned, togglePinned };
}
