/**
 * Dev-server proxy: `/api` goes to the backend (`corebanking-academy`, port 8019) when
 * `apiBaseUrl` is empty, which is how the dev, staging and production builds reach it.
 */
export default {
  '/api': {
    target: 'http://localhost:8019',
    secure: false,
    changeOrigin: true,
  },
};
