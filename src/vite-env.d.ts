/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the retail-serverless-api including `/v1`. Unset ⇒ demo mode. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
