/** Tipos para comprobar las Edge Functions (Deno) con tsc sin la extensión de Deno. */

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}

declare module "npm:pdf-lib@1.17.1" {
  export * from "pdf-lib";
}

declare module "npm:zod@4" {
  export * from "zod";
}
