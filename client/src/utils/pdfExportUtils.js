// Screenshot-based "download this dashboard as a PDF" — reuses the same
// html2canvas + jsPDF technique already used for per-game result PDFs (see
// e.g. ChaloMelaChaleGame.jsx's generateAndUploadPDF): clone the target
// element into a detached, off-screen wrapper so ancestor overflow/scroll
// containers never clip the screenshot, rasterize it, then embed the image
// as one continuously-tall PDF page (no mid-chart page-break cuts).
//
// Elements marked `data-pdf-ignore` (e.g. toolbar buttons, loading chips) are
// removed from the clone before capture, so the PDF shows the dashboard
// itself without interactive controls.
export async function downloadElementAsPdf(elementId, filename) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const [html2canvas, { jsPDF }] = await Promise.all([
    import('html2canvas').then(m => m.default),
    import('jspdf'),
  ]);

  const originalNodes = element.querySelectorAll('*');
  const clone = element.cloneNode(true);
  const cloneNodes = clone.querySelectorAll('*');

  clone.querySelectorAll('[data-pdf-ignore]').forEach(n => n.remove());

  // Kill animations/transitions and unclip any scrollable inner regions —
  // html2canvas otherwise paints scrolled content as currently scrolled,
  // leaving tall tables/lists clipped in the screenshot.
  clone.style.animation = 'none';
  clone.style.opacity = '1';
  clone.style.overflow = 'visible';
  clone.style.height = 'auto';
  clone.style.maxHeight = 'none';
  cloneNodes.forEach((node, i) => {
    node.style.animation = 'none';
    node.style.transition = 'none';
    node.style.opacity = '';
    const original = originalNodes[i];
    if (!original) return;
    const cs = window.getComputedStyle(original);
    if (cs.overflowX === 'auto' || cs.overflowX === 'scroll') node.style.overflowX = 'visible';
    if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') node.style.overflowY = 'visible';
  });

  const wrapper = document.createElement('div');
  wrapper.style.cssText = [
    'position:fixed', 'top:-99999px', 'left:0',
    `width:${Math.max(element.scrollWidth, 1200)}px`,
    'background:#ffffff', 'padding:20px',
    'z-index:-9999', 'pointer-events:none',
  ].join(';');
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    const canvas = await html2canvas(wrapper, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: wrapper.scrollWidth,
      windowHeight: wrapper.scrollHeight,
    });
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const pdfWidth = 210; // A4 width, mm — height is derived so nothing is cropped
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', [pdfWidth, pdfHeight]);
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
  } finally {
    wrapper.parentNode?.removeChild(wrapper);
  }
}
