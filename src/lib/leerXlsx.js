import JSZip from 'jszip';

// Lector mínimo de .xlsx (primera hoja): devuelve las filas como arreglos de texto. Todo ocurre en el navegador.
const NS_SKIP = (n) => n.localName;
const columna = (ref) => {
  const letras = /^[A-Z]+/.exec(ref || '')?.[0] || 'A';
  return [...letras].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
};
const textoDe = (el) => [...el.getElementsByTagName('*')].filter((n) => NS_SKIP(n) === 't').map((n) => n.textContent).join('');

export async function leerHojaXlsx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const hojas = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!hojas.length) throw new Error('El archivo no parece un Excel (.xlsx) válido.');
  const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

  let compartidas = [];
  const ss = zip.file('xl/sharedStrings.xml');
  if (ss) compartidas = [...parse(await ss.async('string')).getElementsByTagName('*')].filter((n) => NS_SKIP(n) === 'si').map(textoDe);

  const doc = parse(await zip.file(hojas[0]).async('string'));
  const filas = [];
  for (const row of [...doc.getElementsByTagName('*')].filter((n) => NS_SKIP(n) === 'row')) {
    const idx = Number(row.getAttribute('r')) - 1;
    const celdas = [];
    for (const c of [...row.children].filter((n) => NS_SKIP(n) === 'c')) {
      const tipo = c.getAttribute('t');
      const v = [...c.children].find((n) => NS_SKIP(n) === 'v')?.textContent ?? '';
      let valor = v;
      if (tipo === 's') valor = compartidas[Number(v)] ?? '';
      else if (tipo === 'inlineStr') valor = textoDe(c);
      celdas[columna(c.getAttribute('r'))] = String(valor).trim();
    }
    filas[Number.isNaN(idx) ? filas.length : idx] = Array.from(celdas, (x) => x ?? '');
  }
  return Array.from(filas, (f) => f || []);
}
