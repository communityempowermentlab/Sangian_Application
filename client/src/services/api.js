const API_URL = process.env.REACT_APP_API_URL || import.meta.env?.VITE_API_BASE_URL || 'http://localhost:5000/api';
export { API_URL };
export default API_URL;