// The pdf.js worker as its own entry: the build bundles it into a hashed `.js` chunk, so the app
// does not depend on the server typing `.mjs` as JavaScript.
import 'pdfjs-dist/build/pdf.worker.min.mjs';
