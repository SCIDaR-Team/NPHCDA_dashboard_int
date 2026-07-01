import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';

/** Export an array of plain objects to CSV. */
export function exportCSV(filename: string, rows: Record<string, unknown>[]): void {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, ensureExt(filename, 'csv'));
}

/** Export an array of plain objects to a .xlsx workbook. */
export function exportExcel(filename: string, rows: Record<string, unknown>[], sheet = 'Data'): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, ensureExt(filename, 'xlsx'));
}

/** Rasterise a DOM element to a PNG. Lazy-loads html2canvas to keep the bundle lean. */
export async function exportElementToPNG(el: HTMLElement, filename: string): Promise<void> {
  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(el, { backgroundColor: readBg(), scale: 2, useCORS: true });
  canvas.toBlob((blob) => {
    if (blob) saveAs(blob, ensureExt(filename, 'png'));
  });
}

/** Render a DOM element into a single-page PDF. */
export async function exportElementToPDF(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const canvas = await html2canvas(el, { backgroundColor: readBg(), scale: 2, useCORS: true });
  const img = canvas.toDataURL('image/png');
  const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', unit: 'pt', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(img, 'PNG', (pageW - w) / 2, 24, w, h - 24);
  pdf.save(ensureExt(filename, 'pdf'));
}

function ensureExt(name: string, ext: string): string {
  return name.endsWith(`.${ext}`) ? name : `${name}.${ext}`;
}

function readBg(): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim();
  return raw ? `rgb(${raw})` : '#0F172A';
}
