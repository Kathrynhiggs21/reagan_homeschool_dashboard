import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import { ReaganThemeProvider } from "./contexts/ReaganThemes";
import "./index.css";

// Early theme bootstrap (runs before React mounts) so the very first paint uses
// the saved theme, or the glass default for first-time visitors — avoiding a
// flash of the wrong theme. Mirrors normalize()/DEFAULT_THEME in ReaganThemes.
try {
  if (typeof document !== "undefined") {
    const LEGACY: Record<string, string> = { starry: "galaxy", cream: "white", notebook: "white" };
    const VALID = new Set(["chalkboard", "white", "glass", "sunshine", "galaxy"]);
    const raw = localStorage.getItem("reagan_theme_v1");
    const resolved = raw && VALID.has(raw) ? raw : raw && LEGACY[raw] ? LEGACY[raw] : "glass";
    const root = document.documentElement;
    root.setAttribute("data-rtheme", resolved);
    if (resolved === "chalkboard" || resolved === "glass" || resolved === "galaxy") {
      root.classList.add("dark");
    }
  }
} catch {
  /* non-fatal: ReaganThemeProvider will set the attribute on mount */
}

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <ReaganThemeProvider>
        <App />
      </ReaganThemeProvider>
    </QueryClientProvider>
  </trpc.Provider>
);
