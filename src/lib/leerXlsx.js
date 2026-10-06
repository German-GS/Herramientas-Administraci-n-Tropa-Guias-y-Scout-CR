import JSZip from 'jszip';

// Lector de .xlsx sin depender del analizador XML del navegador (funciona igual en Chrome, Safari, Firefox y Node).
// Devuelve todas las hojas: [{ nombre, filas: [[texto, …], …] }]
const entidades = (s) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const quitarFonetica = (s) => s.replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '');
const textos = (s) => [...quitarFonetica(s).matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => entidades(m[1])).join('');
const atributo = (attrs, nombre) => new RegExp(`(?:^|\\s)${nombre}="([^"]*)"`).exec(attrs)?.[1];
const columna = (ref) => [...(/^[A-Z]+/.exec(ref || '')?.[0] || 'A')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;

export async function leerLibroXlsx(buffer) {
  let zip;
  try { zip = await JSZip.loadAsync(buffer); } catch { throw new Error('El archivo no es un Excel (.xlsx) válido. Si empieza con «~$» es un archivo temporal de Excel: cerrá Excel y elegí el archivo real.'); }
  const hojas = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!hojas.length) throw new Error('El archivo no parece un Excel (.xlsx) válido: no encontré hojas.');

  const compartidas = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) for (const m of (await ss.async('string')).matchAll(/<(?:\w+:)?si\b[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g)) compartidas.push(textos(m[1]));

  const libro = [];
  for (const nombre of hojas) {
    const xml = await zip.file(nombre).async('string');
    const filas = [];
    for (const r of xml.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
      const num = Number(atributo(r[1], 'r'));
      const celdas = [];
      for (const c of (r[2] || '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
        const tipo = atributo(c[1], 't');
        const cuerpo = c[2] || '';
        const v = /<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/.exec(cuerpo)?.[1];
        let valor = '';
        if (tipo === 's') valor = compartidas[Number(v)] ?? '';
        else if (tipo === 'inlineStr') valor = textos(cuerpo);
        else if (v !== undefined) valor = entidades(v);
        celdas[columna(atributo(c[1], 'r'))] = String(valor).trim();
      }
      filas[Number.isFinite(num) && num > 0 ? num - 1 : filas.length] = Array.from(celdas, (x) => x ?? '');
    }
    libro.push({ nombre, filas: Array.from(filas, (f) => f || []) });
  }
  return libro;
}

// Compatibilidad: primera hoja
export const leerHojaXlsx = async (buffer) => (await leerLibroXlsx(buffer))[0].filas;
