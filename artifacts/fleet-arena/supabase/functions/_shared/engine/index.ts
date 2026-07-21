/**
 * Fleet Arena game engine — public barrel.
 *
 * Pure TypeScript: ZERO react / react-native imports and no Node-only APIs, so
 * every export here can also run inside Deno Edge Functions.
 */

export * from './types.ts';
export * from './coord.ts';
export * from './rng.ts';
export * from './placement.ts';
export * from './match.ts';
export * from './bots.ts';
export * from './rating.ts';
export * from './simulate.ts';
