import { createPortal } from 'react-dom';

// Render anak langsung di <body>. Dipakai modal agar lapisan gelapnya menutupi seluruh layar,
// termasuk header sticky, tanpa terpengaruh transform/stacking context elemen induk.
export default function Portal({ children }) {
  return typeof document !== 'undefined' ? createPortal(children, document.body) : children;
}
