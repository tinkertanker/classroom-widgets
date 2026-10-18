/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SERVER_URL: string
  readonly VITE_LINK_SHORTENER_ENABLED: string
  readonly VITE_BUILD_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface Window {
  umami?: { track: (event: string) => void }
  // Hooks App registers so the toolbar and widgets can reach board state.
  playTrashSound?: () => void
  setStickerMode?: (mode: boolean, type?: string | null) => void
  getStickerState?: () => { mode: boolean; type: string | null }
  activateVoiceControl?: () => void
  getVoiceControlActive?: () => boolean
}
