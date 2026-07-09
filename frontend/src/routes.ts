export type AppRoute = "/" | "/demo" | "/app";

export const ROUTES = {
  landing: "/",
  demo: "/demo",
  app: "/app",
} as const;

export function routeFromPath(pathname: string): AppRoute {
  if (pathname === ROUTES.demo) return ROUTES.demo;
  if (pathname === ROUTES.app) return ROUTES.app;
  return ROUTES.landing;
}
