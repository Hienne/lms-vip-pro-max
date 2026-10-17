/** Dev-server proxy: `/api` goes to the backend; unused while `apiBaseUrl` is set. */
export default {
  '/api': {
    // TODO(backend): the backend's dev origin.
    target: 'http://localhost:3000',
    secure: false,
    changeOrigin: true,
  },
};
