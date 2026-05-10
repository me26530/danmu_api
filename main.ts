import worker from "./danmu_api/worker.js";

Deno.serve((request: Request) => {
  return worker.fetch(request, {
    TOKEN: Deno.env.get("TOKEN") ?? "87654321",
    ADMIN_TOKEN: Deno.env.get("ADMIN_TOKEN") ?? "",
    SOURCE_ORDER: Deno.env.get("SOURCE_ORDER") ?? "",
    PLATFORM_ORDER: Deno.env.get("PLATFORM_ORDER") ?? "",
    OTHER_SERVER: Deno.env.get("OTHER_SERVER") ?? "",
    BILIBILI_COOKIE: Deno.env.get("BILIBILI_COOKIE") ?? "",
    DOUBAN_COOKIE: Deno.env.get("DOUBAN_COOKIE") ?? "",
    VOD_SERVERS: Deno.env.get("VOD_SERVERS") ?? "",
    VOD_RETURN_MODE: Deno.env.get("VOD_RETURN_MODE") ?? "",
    VOD_REQUEST_TIMEOUT: Deno.env.get("VOD_REQUEST_TIMEOUT") ?? "",
    RATE_LIMIT_MAX_REQUESTS: Deno.env.get("RATE_LIMIT_MAX_REQUESTS") ?? "",
  });
});
