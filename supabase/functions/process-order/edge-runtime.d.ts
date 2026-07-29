/** Tipos mínimos para Edge Functions (Deno) en el IDE sin extensión Deno. */

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

declare module "https://deno.land/std@0.168.0/http/server.ts" {
  export function serve(
    handler: (req: Request) => Response | Promise<Response>,
  ): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2.39.3" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function createClient(url: string, key: string): any;
}

declare module "https://esm.sh/pdf-lib@1.17.1" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const PDFDocument: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const rgb: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const StandardFonts: any;
}
