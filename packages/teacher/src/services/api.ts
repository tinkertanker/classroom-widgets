import axios from 'axios';
import { useWorkspaceStore } from '../store/workspaceStore.simple';

const api = axios.create({
  baseURL: useWorkspaceStore.getState().serverStatus.url,
});

api.interceptors.request.use((config) => {
  const token = useWorkspaceStore.getState().sessionCode;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
