// Informe «Reporte detalle por Grupo» de la Asociación → miembros de la sección Tropa listos para crear expedientes.
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
export const soloDigitos = (s) => String(s || '').replace(/\D/g, '');

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'san', 'santa', 'van', 'von', 'y']);
const titulo = (s) => s.toLowerCase().split(' ').map((p, i) => (i > 0 && PARTICULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');

// «NOMBRE(S) APELLIDO1 APELLIDO2» → { nombre, apellidos }. Las partículas (de, del, la…) se quedan con el apellido.
export function separarNombre(completo) {
  const t = String(completo || '').trim().replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (t.length <= 1) return { nombre: titulo(t.join(' ')), apellidos: '' };
  if (t.length === 2) return { nombre: titulo(t[0]), apellidos: titulo(t[1]) };
  let corte = t.length - 2; // dos apellidos
  while (corte > 1 && PARTICULAS.has(t[corte - 1].toLowerCase())) corte -= 1;
  return { nombre: titulo(t.slice(0, corte).join(' ')), apellidos: titulo(t.slice(corte).join(' ')) };
}

export function fechaIsoInforme(txt) {
  const s = String(txt || '').trim();
  let m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  if (/^\d{5}$/.test(s)) { // número de serie de Excel
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return '';
}

const esCabecera = (f) => f.some((c) => norm(c).startsWith('cargo')) && f.some((c) => norm(c).includes('nombre'));

// Acepta las hojas del libro y usa la primera que tenga el encabezado del informe
export function parsearLibro(libro) {
  for (const h of libro) if (h.filas.some(esCabecera)) return parsearInforme(h.filas);
  const vistas = libro.map((h) => {
    const prim = h.filas.find((f) => f.some(Boolean)) || [];
    return `${h.nombre.replace('xl/worksheets/', '')}: ${h.filas.filter((f) => f.some(Boolean)).length} filas, empieza con «${prim.filter(Boolean).slice(0, 4).join(' | ') || 'vacío'}»`;
  });
  throw new Error(`No encontré el encabezado del informe (Cargo, Sección, Nombre…). ¿Es el «Reporte detalle por Grupo»? Lo que leí → ${vistas.join(' ; ')}`);
}

export function parsearInforme(filas) {
  const cab = filas.findIndex(esCabecera);
  if (cab < 0) throw new Error('No encontré el encabezado del informe (Cargo, Sección, Nombre…). ¿Es el «Reporte detalle por Grupo»?');
  const col = (nombre) => filas[cab].findIndex((c) => norm(c) === nombre || norm(c).startsWith(nombre));
  const idx = { cargo: col('cargo'), seccion: col('seccion'), etapa: col('etapa'), nombre: col('nombre'), cedula: col('cedula'), nacimiento: col('fecha de nacimiento'), correo: col('email') };
  const celda = (f, k) => (idx[k] >= 0 ? (f[idx[k]] || '').trim() : '');

  const grupoF = filas.slice(0, cab).find((f) => f.some((c) => /grupo/i.test(c) && /no/i.test(c)));
  const grupo = grupoF ? grupoF[grupoF.findIndex((c) => /grupo/i.test(c)) + 1] : '';
  const fechaInforme = filas.slice(0, cab).flat().find((c) => /\d{4}/.test(c) && /de/i.test(c) && !/grupo/i.test(c)) || '';

  const datos = filas.slice(cab + 1).filter((f) => f.some(Boolean));
  const secciones = {};
  const miembros = [];
  for (const f of datos) {
    const sec = celda(f, 'seccion') || 'N/A';
    secciones[sec] = (secciones[sec] || 0) + 1;
    if (!norm(sec).includes('tropa')) continue;
    const { nombre, apellidos } = separarNombre(celda(f, 'nombre'));
    miembros.push({
      nombre, apellidos, cedula: celda(f, 'cedula'), fechaNacimiento: fechaIsoInforme(celda(f, 'nacimiento')), correo: celda(f, 'correo').toLowerCase(),
      cargoAsociacion: celda(f, 'cargo'), etapaInforme: celda(f, 'etapa'),
    });
  }
  const dirigentes = datos.filter((f) => /tropa/.test(norm(celda(f, 'cargo'))) && !norm(celda(f, 'seccion')).includes('tropa')).length;
  return { grupo, fechaInforme, miembros, secciones, dirigentes };
}
