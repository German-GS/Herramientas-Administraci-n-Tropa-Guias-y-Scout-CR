import { useEffect, useRef } from 'react';

// Hace que el botón «atrás» del navegador (y el gesto del celular) cierre la vista de detalle en vez de salir de la app.
//  - `activa`: false mientras la pantalla está oculta (otra sección abierta); entonces no escucha ni toca el historial.
//  - `antes`: puede devolver false para quedarse (p. ej., hay cambios sin guardar y la persona cancela).
export function useAtras(activa, cerrar, antes) {
  const cerrarRef = useRef(cerrar);
  const antesRef = useRef(antes);
  const activaRef = useRef(activa);
  cerrarRef.current = cerrar;
  antesRef.current = antes;
  activaRef.current = activa;

  useEffect(() => {
    if (!activa) return undefined;
    // Una sola marca en el historial, aunque se vuelva a esta pantalla desde otra sección
    if (!window.history.state?.tropaDetalle) window.history.pushState({ tropaDetalle: true }, '');
    const alVolver = () => {
      if (antesRef.current && antesRef.current() === false) { window.history.pushState({ tropaDetalle: true }, ''); return; }
      cerrarRef.current();
    };
    window.addEventListener('popstate', alVolver);
    return () => {
      window.removeEventListener('popstate', alVolver);
      // Si la pantalla solo quedó oculta (cambio de sección) no se toca el historial; si se cerró, se retira la marca
      if (activaRef.current && window.history.state?.tropaDetalle) window.history.back();
    };
  }, [activa]);
}
