/**
 * Navigate with a full page load. Unlike router.push, this drops every route
 * Next.js keeps mounted in memory (Cache Components preserve them with React
 * <Activity>), so nothing typed by one user is still there for the next.
 */
export function hardNavigate(path: string): void {
  window.location.assign(path);
}
