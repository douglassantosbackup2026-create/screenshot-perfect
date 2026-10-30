// Gera o par de chaves VAPID das notificações push. Rode uma vez e guarde a saída:
//   node scripts/vapid-keys.mjs
// VITE_VAPID_PUBLIC_KEY e VAPID_PUBLIC_KEY recebem a pública (as duas iguais); VAPID_PRIVATE_KEY a privada,
// só no servidor. VAPID_SUBJECT é um contato, por exemplo mailto:contato@seudominio.com.br.
// Trocar as chaves depois desliga as notificações de todos os aparelhos já cadastrados.
const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
const b64url = (bytes) => Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

console.log(`VITE_VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PUBLIC_KEY=${b64url(raw)}`);
console.log(`VAPID_PRIVATE_KEY=${jwk.d}`);
console.log("VAPID_SUBJECT=mailto:contato@seudominio.com.br");
