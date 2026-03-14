/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string
  readonly VITE_SHORTIO_API_KEY: string
  readonly VITE_SHORTIO_BASE_URL: string
  readonly VITE_SHORTIO_DOMAIN: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}