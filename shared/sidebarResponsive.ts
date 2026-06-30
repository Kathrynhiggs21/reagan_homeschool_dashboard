/**
 * Pure helpers for CozyShell's responsive sidebar/drawer behavior.
 *
 * Extracted so the breakpoint logic is unit-testable without a DOM/jsdom
 * toolchain (the suite runs in a `node` environment). The component imports
 * these and applies the returned class strings.
 *
 * Behavior contract (2026-06-30, Katy — fixes sidebar overlapping content on phone):
 * - Below the `lg` breakpoint the sidebar is a fixed off-canvas drawer that
 *   slides in (`translate-x-0`) when open and is hidden (`-translate-x-full`)
 *   when closed, over a dimmed backdrop.
 * - At `lg`+ the sidebar is always in-flow (`lg:translate-x-0`, `lg:sticky`) and
 *   the drawer state is ignored, preserving the original desktop layout.
 */

/** Classes for the <aside> sidebar element. */
export function asideResponsiveClass(collapsed: boolean, drawerOpen: boolean): string {
  const width = collapsed ? "lg:w-16" : "lg:w-60";
  const slide = drawerOpen ? "translate-x-0" : "-translate-x-full";
  return [
    width,
    "w-60",
    "shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col h-screen no-print",
    "transition-transform duration-200 lg:transition-[width]",
    slide,
    // Desktop always shows the sidebar in-flow regardless of drawer state.
    "lg:translate-x-0",
    "fixed lg:sticky inset-y-0 left-0 z-50 lg:z-auto",
  ].join(" ");
}

/** Whether the dimmed mobile backdrop should be rendered. */
export function showMobileBackdrop(drawerOpen: boolean): boolean {
  return drawerOpen;
}
