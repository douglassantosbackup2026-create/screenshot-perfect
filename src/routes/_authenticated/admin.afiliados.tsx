import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: o programa agora se chama "parceiros".
export const Route = createFileRoute("/_authenticated/admin/afiliados")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/parceiros", statusCode: 301 });
  },
});
