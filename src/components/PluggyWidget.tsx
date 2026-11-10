// Janela da Pluggy (só no navegador; carregada sob demanda).
import { PluggyConnect } from "react-pluggy-connect";

export default function PluggyWidget(props: {
  token: string;
  onSuccess: (itemId: string, institution: string | null) => void;
  onClose: () => void;
}) {
  return (
    <PluggyConnect
      connectToken={props.token}
      includeSandbox={import.meta.env["VITE_PLUGGY_SANDBOX"] !== "false"}
      onSuccess={(d: { item: { id: string; connector?: { name?: string } } }) => props.onSuccess(d.item.id, d.item.connector?.name ?? null)}
      onError={() => props.onClose()}
      onClose={props.onClose}
    />
  );
}
