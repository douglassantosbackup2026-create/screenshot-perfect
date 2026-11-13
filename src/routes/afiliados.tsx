import { createFileRoute, redirect } from "@tanstack/react-router";

// Endereço antigo: o programa agora se chama "parceiros".
export const Route = createFileRoute("/afiliados")({
  beforeLoad: () => {
    throw redirect({ to: "/parceiros", statusCode: 301 });
  },
});
