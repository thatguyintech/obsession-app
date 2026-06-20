import { createRootRoute, createRoute, createRouter, Outlet } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Reader } from "./components/Reader";
import { loadScreenplay } from "./lib/screenplay";
import type { ScreenplayData } from "./types";

function RootLayout() {
  return (
    <div className="h-full">
      <Outlet />
    </div>
  );
}

function ReaderPage() {
  const [data, setData] = useState<ScreenplayData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadScreenplay()
      .then(setData)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-stone-500">
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-stone-500">
        Loading screenplay...
      </div>
    );
  }

  return <Reader data={data} />;
}

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: ReaderPage,
});

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
