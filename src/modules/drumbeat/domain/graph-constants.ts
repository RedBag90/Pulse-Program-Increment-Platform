/**
 * Node-width geometry for the Drumbeat dependency graphs — the one bit of graph
 * constants that is genuine layout math (consumed by the pure `graph-layout.ts`
 * and by the client graph components). The view palette (edge colors, status-dot
 * classes) lives with the components in `features/umsetzung/components/graph-palette.ts`.
 *
 * Node widths differ per view (the graphs are laid out at two densities), so
 * they stay as named exports — the goal is one source, not one value.
 */

/** Delivery-Cockpit network (`features/umsetzung/components/cockpit-network.tsx`). */
export const NODE_W_COCKPIT = 200;
/** Epic-Breakdown network (`features/umsetzung/components/breakdown-network-view.tsx`). */
export const NODE_W_BREAKDOWN = 220;
