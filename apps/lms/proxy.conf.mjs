/**
 * Dev-server proxy: the app calls `/api/` on its own origin and this forwards it to the shared
 * backend (`corebanking-academy`). To use a backend on this machine, start the server with
 * `LMS_API_TARGET=http://localhost:8019 npm start`.
 */
export default {
  '/api': {
    target: process.env.LMS_API_TARGET ?? 'http://103.121.90.119:8019',
    secure: false,
    changeOrigin: true,
  },
};
