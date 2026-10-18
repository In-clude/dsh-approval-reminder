/**
 * Host half of dsh-approval-reminder.
 *
 * The plugin owns no Host service, tool, configuration, or session event: it
 * exists so the package is one enabled Loader entry whose `dsh.client`
 * declaration serves `client.js` to the browser. The desktop notification and
 * the General-settings row are entirely Client-side.
 */
export function apply() {}
