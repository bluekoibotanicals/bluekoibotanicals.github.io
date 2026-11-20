using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
 services = [
  (name = "epd-test", worker = (
   compatibilityDate = "2026-09-18",
   modules = [
    (name = "test.mjs", esModule = embed "test.mjs"),
    (name = "epd.mjs", esModule = embed "../../server/epd.mjs"),
    (name = "core.mjs", esModule = embed "core-stub.mjs")
   ],
   globalOutbound = "mock-gateway"
  )),
  (name = "mock-gateway", worker = (
   compatibilityDate = "2026-09-18",
   modules = [(name = "gateway.mjs", esModule = embed "gateway.mjs")]
  ))
 ]
);
