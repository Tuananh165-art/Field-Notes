const { resolveApiNetworkPolicy } = require("./app.config.utils");

describe("native API transport configuration", () => {
  it.each([
    "http://localhost:8080/api/v1",
    "http://10.0.2.2:8080/api/v1",
    "http://192.168.1.45:8080/api/v1",
    "http://172.20.10.4:8080/api/v1",
    "http://[::1]:8080/api/v1",
  ])("allows cleartext only for local development endpoint %s", (url) => {
    expect(resolveApiNetworkPolicy(url)).toEqual({ usesLocalHttp: true });
  });

  it("keeps HTTPS builds on platform transport defaults", () => {
    expect(resolveApiNetworkPolicy("https://api.example.com/api/v1")).toEqual({ usesLocalHttp: false });
  });

  it.each(["http://api.example.com/api/v1", "http://fc.example.com/api/v1", "ftp://localhost:8080/api/v1", "not a url"])(
    "rejects unsafe API endpoint %s",
    (url) => expect(() => resolveApiNetworkPolicy(url)).toThrow(),
  );
});
