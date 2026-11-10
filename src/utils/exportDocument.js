// Unduh PDF & cetak dokumen langsung dari tampilan web, supaya hasilnya sama persis
// (kop, logo, tabel, tanda tangan) dengan yang terlihat di layar.
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

const PAGE_W_MM = 210;
const PAGE_H_MM = 297;
const PAPER_PX = 794;               // lebar A4 pada 96 dpi
const SCALE = 2;                    // ketajaman hasil
const MARGIN_MM = 12;               // margin atas/bawah halaman lanjutan

// Tunggu gambar (logo, TTD) selesai dimuat agar tidak hilang di PDF
async function waitForImages(root) {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(imgs.map((img) => (img.complete ? null : new Promise((resolve) => {
    img.addEventListener('load', resolve, { once: true });
    img.addEventListener('error', resolve, { once: true });
  }))));
}

// Render elemen ke beberapa halaman A4 (kanvas), tidak memotong baris teks di tengah
async function renderPages(element) {
  await waitForImages(element);
  if (document.fonts?.ready) await document.fonts.ready;

  let blocks = [];
  const canvas = await html2canvas(element, {
    scale: SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    windowWidth: 1280,              // pakai tampilan desktop, juga saat dibuka dari HP
    onclone: (doc, el) => {
      el.style.width = `${PAPER_PX}px`;
      el.style.maxWidth = 'none';
      el.style.margin = '0';
      el.style.boxShadow = 'none';
      el.style.borderRadius = '0';
      el.querySelectorAll('.no-print, [data-export-hide]').forEach((n) => { n.style.display = 'none'; });
      // Catat posisi setiap baris/elemen terkecil agar potongan halaman jatuh di sela-selanya
      const base = el.getBoundingClientRect().top;
      const box = (n) => {
        const r = n.getBoundingClientRect();
        return [r.top - base, r.bottom - base];
      };
      // Elemen yang punya teks langsung (mis. <p>teks<br/><span/></p>) juga dihitung satu baris utuh
      const hasOwnText = (n) => Array.from(n.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim());
      blocks = Array.from(el.querySelectorAll('*'))
        .filter((n) => n.children.length === 0 || n.tagName === 'TR' || n.tagName === 'IMG' || hasOwnText(n))
        .map(box)
        .filter(([top, bottom]) => bottom - top > 0 && bottom - top < 400);
      // Blok bertanda data-keep-together (penutup + TTD + stempel) tidak boleh terbelah
      el.querySelectorAll('[data-keep-together]').forEach((n) => {
        const [t, b] = box(n);
        if (b - t > 0) blocks.push([t, b]);
      });
      // Judul bertanda data-keep-with-next tidak ditinggal sendirian di bawah halaman:
      // ikut pindah bersama baris pertama sesudahnya
      el.querySelectorAll('[data-keep-with-next]').forEach((n) => {
        const next = n.nextElementSibling;
        const firstRow = next?.querySelector('tr, p, li') || next;
        if (!firstRow) return;
        const [t] = box(n);
        const [, b] = box(firstRow);
        if (b - t > 0) blocks.push([t, b]);
      });
    },
  });

  const pxPerMm = canvas.width / PAGE_W_MM;
  const pageH = PAGE_H_MM * pxPerMm;
  const margin = MARGIN_MM * pxPerMm;
  const cssToCanvas = canvas.width / PAPER_PX;
  const cuts = blocks.map(([t, b]) => [t * cssToCanvas, b * cssToCanvas]);

  const safeCut = (start, limit) => {
    if (limit >= canvas.height) return canvas.height;
    let y = limit;
    for (let guard = 0; guard < 200; guard++) {
      const hit = cuts.find(([t, b]) => t < y - 1 && b > y + 1);
      if (!hit) break;
      y = hit[0];
    }
    // Hindari halaman yang terlalu kosong karena satu blok raksasa
    return y - start < (limit - start) * 0.5 ? limit : y;
  };

  // Surat yang hanya sedikit melebihi satu halaman diperkecil agar tetap utuh di satu lembar
  if (canvas.height > pageH && canvas.height <= pageH * 1.3) {
    const scale = pageH / canvas.height;
    const page = document.createElement('canvas');
    page.width = canvas.width;
    page.height = Math.round(pageH);
    const ctx = page.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    const w = canvas.width * scale;
    ctx.drawImage(canvas, (canvas.width - w) / 2, 0, w, pageH);
    return [page];
  }

  // Sisa area hanya berisi ruang kosong (padding/min-height kertas)? Jangan jadikan halaman baru
  const isBlank = (y0, y1) => {
    const h = Math.max(1, Math.round(y1 - y0));
    const probe = document.createElement('canvas');
    probe.width = 120;
    probe.height = Math.max(1, Math.round(h / (canvas.width / 120)));
    const pctx = probe.getContext('2d');
    pctx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, probe.width, probe.height);
    const data = pctx.getImageData(0, 0, probe.width, probe.height).data;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 235 || data[i + 1] < 235 || data[i + 2] < 235) return false;
    }
    return true;
  };

  const pages = [];
  let start = 0;
  while (start < canvas.height - 2) {
    if (pages.length > 0 && isBlank(start, canvas.height)) break;
    const first = pages.length === 0;
    const top = first ? 0 : margin;
    const capacity = pageH - top - margin;
    const end = safeCut(start, start + capacity);
    const page = document.createElement('canvas');
    page.width = canvas.width;
    page.height = Math.round(pageH);
    const ctx = page.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, page.width, page.height);
    ctx.drawImage(canvas, 0, start, canvas.width, end - start, 0, top, canvas.width, end - start);
    pages.push(page);
    start = end;
  }
  return pages;
}

// Gabungkan beberapa dokumen (masing-masing mulai di halaman baru) menjadi satu PDF
export async function downloadElementsPdf(elements, filename) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let first = true;
  for (const el of elements.filter(Boolean)) {
    const pages = await renderPages(el);
    pages.forEach((page) => {
      if (!first) pdf.addPage();
      first = false;
      pdf.addImage(page.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
    });
  }
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

export async function downloadElementPdf(element, filename) {
  if (!element) return;
  const pages = await renderPages(element);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  pages.forEach((page, i) => {
    if (i > 0) pdf.addPage();
    pdf.addImage(page.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, PAGE_W_MM, PAGE_H_MM);
  });
  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

// Cetak: halaman yang sama dengan PDF, dikirim ke dialog print browser
export async function printElement(element, title = 'Dokumen IKAPI Jawa Barat') {
  if (!element) return;
  const pages = await renderPages(element);
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '')}</title>
    <style>@page{size:A4;margin:0}html,body{margin:0;padding:0;background:#fff}
    img{display:block;width:210mm;height:297mm;page-break-after:always;break-after:page}
    img:last-child{page-break-after:auto;break-after:auto}</style></head><body>
    ${pages.map((p) => `<img src="${p.toDataURL('image/jpeg', 0.95)}" alt="">`).join('')}
    </body></html>`);
  doc.close();
  await waitForImages(doc.body);
  iframe.contentWindow.focus();
  iframe.contentWindow.print();
  setTimeout(() => iframe.remove(), 60000);
}

export const safeFileName = (text, fallback = 'IKAPI') =>
  (text || fallback).replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || fallback;
