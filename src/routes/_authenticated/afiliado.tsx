import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: o programa agora se chama "parceiros".
export const Route = createFileRoute("/_authenticated/afiliado")({
  beforeLoad: () => {
    throw redirect({ to: "/parceiro", statusCode: 301 });
  },
});
