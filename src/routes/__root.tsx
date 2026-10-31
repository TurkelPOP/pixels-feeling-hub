/* eslint-disable prettier/prettier */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { MotionConfig } from "framer-motion";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { TwitchAuthProvider } from "../lib/useTwitchAuth";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {
  SITE_DESCRIPTION,
  SITE_JSON_LD,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
  absoluteUrl,
} from "../lib/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center glass-strong p-8">
        <p className="text-[11px] hud-label text-accent">▶ Game over</p>
        <h1
          className="mt-2 text-7xl font-homebase text-foreground"
          style={{ textShadow: "0 6px 14px oklch(0.1 0.05 290 / 0.55)" }}
        >
          404
        </h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page introuvable</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          La page que vous cherchez n'existe pas ou a été déplacée.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center pixel-btn bg-magenta px-4 py-2 text-[11px] hud-label text-primary-foreground"
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center glass-strong p-8">
        <p className="text-[11px] hud-label text-accent blink-soft">Continuer ?</p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
          Cette page ne s'est pas chargée
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Un problème est survenu de notre côté. Essayez de recharger la page ou retournez à l'accueil.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center pixel-btn bg-magenta px-4 py-2 text-[11px] hud-label text-primary-foreground"
          >
            Réessayer
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center pixel-btn bg-background px-4 py-2 text-[11px] hud-label text-foreground hover:bg-muted"
          >
            Retour à l'accueil
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const image = absoluteUrl("/og-image.jpg");
    const canonical = absoluteUrl("/");
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: SITE_TITLE },
        { name: "description", content: SITE_DESCRIPTION },
        { name: "theme-color", content: "#0e0a18" },
        { property: "og:title", content: SITE_TITLE },
        { property: "og:description", content: SITE_DESCRIPTION },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: SITE_NAME },
        { property: "og:locale", content: "fr_FR" },
        // Large card only when the 1200x630 image is available (it needs an absolute URL).
        { name: "twitter:card", content: image ? "summary_large_image" : "summary" },
        { name: "twitter:title", content: SITE_NAME },
        { name: "twitter:description", content: SITE_DESCRIPTION },
        ...(canonical ? [{ property: "og:url", content: canonical }] : []),
        ...(image
          ? [
              { property: "og:image", content: image },
              { property: "og:image:width", content: "1200" },
              { property: "og:image:height", content: "630" },
              { property: "og:image:alt", content: `${SITE_NAME} : le podcast qui joue avec vos émotions` },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "icon", href: "/favicon.png", type: "image/png" },
        { rel: "apple-touch-icon", href: "/pp-logo.png" },
        ...(canonical ? [{ rel: "canonical", href: canonical }] : []),
        {
          rel: "preload",
          href: "/fonts/homebasesuper3dital-webfont.woff2",
          as: "font",
          type: "font/woff2",
          crossOrigin: "anonymous" as const,
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({ ...SITE_JSON_LD, url: SITE_URL || undefined }),
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <TwitchAuthProvider>
        <MotionConfig reducedMotion="user">
          <Outlet />
        </MotionConfig>
      </TwitchAuthProvider>
    </QueryClientProvider>
  );
}
