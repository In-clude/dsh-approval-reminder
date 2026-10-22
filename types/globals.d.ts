/**
 * Ambient declarations for the environment the browser bundle runs in.
 *
 * `@deepseek-ai/dsh-client-modules` seeds a module table on the page and calls
 * the factory registered through `window.__ModuleLoader__`. The CommonJS-style
 * `require` it passes exists only there, so neither symbol comes from the DOM
 * lib; declaring them keeps `// @ts-check` reporting real problems instead of a
 * wall of "cannot find name".
 */

/**
 * Module requests the browser module table can answer. The Harness seeds React
 * and the static UI libraries; this package only asks for React.
 */
interface ModuleLoaderRequire {
  (spec: 'react'): typeof import('react');
  (spec: string): unknown;
}

interface Window {
  /** Registration facade injected into the page by dsh-client-modules. */
  __ModuleLoader__: {
    load(module: {
      id: string;
      factory(require: ModuleLoaderRequire): unknown;
    }): void;
  };
}
