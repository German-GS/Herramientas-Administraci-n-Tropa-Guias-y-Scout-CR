// Tabla de filas editables (agregar / quitar). En pantallas pequeñas cada fila se muestra como tarjeta.
export default function TablaEditable({ columnas, filas, onChange, nueva = {}, agregar = 'Agregar fila' }) {
  const set = (i, k, v) => onChange(filas.map((f, j) => (j === i ? { ...f, [k]: v } : f)));
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
  return (
    <div>
      {filas.length > 0 && (
        <div className="table-wrap">
          <table className="table editable">
            <thead>
              <tr>{columnas.map((c) => <th key={c.key} style={{ minWidth: c.min }}>{c.label}</th>)}<th aria-label="Quitar" /></tr>
            </thead>
            <tbody>
              {filas.map((f, i) => (
                <tr key={i}>
                  {columnas.map((c) => <td key={c.key} data-label={c.label}>{campo(c, f, i)}</td>)}
                  <td><button type="button" className="btn small quiet" aria-label="Quitar fila" onClick={() => onChange(filas.filter((_, j) => j !== i))}>✕ Quitar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button type="button" className="btn small" style={{ marginTop: 6 }} onClick={() => onChange([...filas, typeof nueva === 'function' ? nueva() : { ...nueva }])}>+ {agregar}</button>
    </div>
  );
}
