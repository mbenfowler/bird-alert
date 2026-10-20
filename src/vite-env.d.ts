/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly REACT_APP_EBIRD_API_KEY: string
  readonly REACT_APP_NUTHATCH_API_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
