"use client";

import { Tooltip } from "@base-ui/react/tooltip";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <Tooltip.Provider delay={150} closeDelay={80}>
        {children}
      </Tooltip.Provider>
    </NextThemesProvider>
  );
}
