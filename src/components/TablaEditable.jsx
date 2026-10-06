import { useRef, useState } from 'react';

// Tabla de filas editables: agregar, quitar y reordenar arrastrando el asa (mouse, táctil o flechas del teclado).
// En pantallas pequeñas cada fila se muestra como tarjeta.
export default function TablaEditable({ columnas, filas, onChange, nueva = {}, agregar = 'Agregar fila', acciones = null }) {
  const tabla = useRef(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [sobre, setSobre] = useState(null);

  const set = (i, k, v) => onChange(filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
  const mover = (de, a) => {
    if (de === a || a < 0 || a >= filas.length) return;
    const copia = [...filas];
    const [x] = copia.splice(de, 1);
    copia.splice(a, 0, x);
    onChange(copia);
  };

  const iniciar = (e, i) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setArrastrando(i); setSobre(i);
  };
  const mueve = (e) => {
    if (arrastrando === null) return;
    if (e.clientY < 90) window.scrollBy(0, -14);
    else if (e.clientY > window.innerHeight - 90) window.scrollBy(0, 14);
    const tr = document.elementFromPoint(e.clientX, e.clientY)?.closest('tr[data-fila]');
    if (tr && tr.closest('table') === tabla.current) setSobre(Number(tr.dataset.fila));
  };
  const suelta = () => {
    if (arrastrando !== null && sobre !== null) mover(arrastrando, sobre);
    setArrastrando(null); setSobre(null);
  };
  const teclado = (e, i) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); mover(i, i - 1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); mover(i, i + 1); }
  };

  const campo = (c, f, i) => {
    const val = f[c.key] ?? '';
    if (c.tipo === 'textarea') return <textarea rows={2} value={val} onChange={(e) => set(i, c.key, e.target.value)} aria-label={c.label} />;
    if (c.tipo === 'select') {
      return (
        <select value={val} onChange={(e) => set(i, c.key, e.target.value)} aria-label={c.label}>
          <option value="">—</option>
          {c.opciones.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      );
    }
    return <input type={c.tipo || 'text'} value={val} onChange={(e) => set(i, c.key, e.target.value)} aria-label={c.label} />;
  };

  const claseFila = (i) => {
    if (arrastrando === null) return undefined;
    if (i === arrastrando) return 'arrastrando';
    if (i === sobre) return arrastrando > sobre ? 'destino-arriba' : 'destino-abajo';
    return undefined;
  };

  return (
    <div>
      {filas.length > 0 && (
        <div className="table-wrap">
          <table className="table editable" ref={tabla}>
            <thead>
              <tr><th aria-label="Mover" />{columnas.map((c) => <th key={c.key} style={{ minWidth: c.min }}>{c.label}</th>)}<th aria-label="Quitar" /></tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={f.id ?? i} data-fila={i} className={claseFila(i)}>
                  <td className="asa-celda">
                    <button type="button" className="asa" aria-label="Mover fila: arrastrá o usá las flechas arriba y abajo"
                      title="Arrastrá para reordenar"
                      onPointerDown={(e) => iniciar(e, i)} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta}
                      onKeyDown={(e) => teclado(e, i)}>⠿<span className="solo-movil"> Mover</span></button>
                  </td>
                  {columnas.map((c) => <td key={c.key} data-label={c.label}>{campo(c, f, i)}</td>)}
                  <td><button type="button" className="btn small quiet" aria-label="Quitar fila" onClick={() => onChange(filas.filter((_, j) => j !== i))}>✕ Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="row" style={{ marginTop: 6 }}>
        <button type="button" className="btn small" onClick={() => onChange([...filas, typeof nueva === 'function' ? nueva() : { ...nueva }])}>+ {agregar}</button>
        {acciones}
      </div>
    </div>
  );
}
