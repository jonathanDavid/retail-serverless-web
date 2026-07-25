/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the retail-serverless-api including `/v1`. Unset ⇒ demo mode. */
  readonly VITE_API_URL?: string;
  /**
   * Base URL of genetic-visualizer-api (e.g. http://localhost:8000). Unset ⇒
   * the "Optimizar recogida" feature is hidden entirely.
   */
  readonly VITE_OPTIMIZER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
