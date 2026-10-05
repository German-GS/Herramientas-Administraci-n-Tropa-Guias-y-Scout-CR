import { useEffect, useState } from 'react';
import { useConfig } from '../lib/useConfig';
import { useCollection } from '../lib/useCollection';
import { CATEGORIAS, ETAPAS } from '../lib/etapas';

export default function Ajustes() {
  const [config, guardar] = useConfig();
  const [f, setF] = useState(config);
  const [ok, setOk] = useState(false);
  const colecciones = ['patrullas', 'protagonistas', 'ciclos', 'reuniones', 'puntosExtra'];
  const datos = Object.fromEntries(colecciones.map((c) => [c, useCollection(c).docs]));

  useEffect(() => setF(config), [config]);

  const enviar = async (e) => {
    e.preventDefault();
    await guardar({
      mesesPorEtapa: Number(f.mesesPorEtapa),
      avisoAnticipadoDias: Number(f.avisoAnticipadoDias),
      edadPasoSeccion: Number(f.edadPasoSeccion),
      puntajeMaxCategoria: Number(f.puntajeMaxCategoria),
    });
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify({ exportado: new Date().toISOString(), config, ...datos }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tropa307-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  return (
    <div className="grid two">
      <form className="card" onSubmit={enviar}>
        <h2>Ajustes</h2>
        <div className="form">
          <label>Meses de referencia por etapa<input type="number" min={1} value={f.mesesPorEtapa} onChange={(e) => setF({ ...f, mesesPorEtapa: e.target.value })} /></label>
          <label>Avisar con (días) de anticipación<input type="number" min={0} value={f.avisoAnticipadoDias} onChange={(e) => setF({ ...f, avisoAnticipadoDias: e.target.value })} /></label>
          <label>Edad para evaluar paso a Wak<input type="number" min={10} value={f.edadPasoSeccion} onChange={(e) => setF({ ...f, edadPasoSeccion: e.target.value })} /></label>
          <label>Puntaje máximo por categoría<input type="number" min={1} value={f.puntajeMaxCategoria} onChange={(e) => setF({ ...f, puntajeMaxCategoria: e.target.value })} /></label>
        </div>
        <button className="btn primary">Guardar</button> {ok && <span className="muted">Guardado ✓</span>}
        <p className="muted" style={{ marginTop: 12 }}>
          El tiempo por etapa es solo una referencia para el recordatorio: el cambio de etapa se decide por la evaluación
          de objetivos con el protagonista, no por calendario.
        </p>
      </form>

      <div className="card">
        <h2>Referencia</h2>
        <p><strong>Etapas:</strong> {ETAPAS.join(' → ')}</p>
        <p><strong>Categorías por reunión:</strong> {CATEGORIAS.map((c) => c.label).join(', ')}</p>
        <h2 style={{ marginTop: 16 }}>Respaldo</h2>
        <p className="muted">Descarga todos los datos en un archivo JSON. Contiene datos personales y médicos de menores: guardalo en un lugar seguro.</p>
        <button className="btn" onClick={exportar}>Descargar respaldo</button>
      </div>
    </div>
  );
}
