import { describe, expect, it } from "vitest";
import { isPushEndpoint } from "./endpoint";

describe("endpoints de push aceitos", () => {
  it("serviços de push dos navegadores", () => {
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc")).toBe(true);
    expect(isPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=abc")).toBe(true);
    expect(isPushEndpoint("https://web.push.apple.com/abc")).toBe(true);
  });
  it("qualquer outro endereço é recusado (SSRF)", () => {
    expect(isPushEndpoint("https://evil.example/hook")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com.evil.example/x")).toBe(false);
    expect(isPushEndpoint("http://fcm.googleapis.com/fcm/send/abc")).toBe(false);
    expect(isPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
    expect(isPushEndpoint("https://user:pw@fcm.googleapis.com/x")).toBe(false);
    expect(isPushEndpoint("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isPushEndpoint("não é url")).toBe(false);
  });
});
