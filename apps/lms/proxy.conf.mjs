/**
 * Dev-server proxy: the app calls `/api/` on its own origin and this forwards it to the shared
 * backend (`corebanking-academy`). To use a backend on this machine, change the target to
 * `http://localhost:8019`.
 */
export default {
  '/api': {
    target: 'http://103.121.90.119:8019',
    secure: false,
    changeOrigin: true,
  },
};
