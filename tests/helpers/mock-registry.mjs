import { createServer } from "node:http";

// Minimal GitHub API mock for Arklean tests. Serves owner lookup, paginated
// version listing, and version deletion. All state is per-instance.
export async function startMockRegistry({
  ownerType = "Organization",
  pages = [[]],
  mutateAfterListCalls = 0,
  mutatedPages,
  deleteStatus = () => 204,
  failList = 0,
  failStatus = 503,
  failHeaders = {},
  manifests = {},
  registryTokenStatus = 200,
} = {}) {
  const calls = { list: 0, delete: [], users: 0, listFailures: 0, manifests: [], token: 0 };

  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname.startsWith("/users/") && !url.pathname.includes("/packages/")) {
      calls.users++;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ type: ownerType }));
      return;
    }

    if (req.method === "GET" && url.pathname.endsWith("/versions")) {
      if (calls.listFailures < failList) {
        calls.listFailures++;
        res.writeHead(failStatus, { "content-type": "application/json", ...failHeaders });
        res.end("{}");
        return;
      }
      calls.list++;
      const active = mutatedPages && calls.list > mutateAfterListCalls ? mutatedPages : pages;
      const page = Number(url.searchParams.get("page") || 1);
      const body = active[page - 1] ?? [];
      const headers = { "content-type": "application/json" };
      if (page < active.length) {
        const next = `http://127.0.0.1:${server.address().port}${url.pathname}?per_page=100&page=${page + 1}`;
        headers.link = `<${next}>; rel="next"`;
      }
      res.writeHead(200, headers);
      res.end(JSON.stringify(body));
      return;
    }

    if (req.method === "DELETE") {
      const id = Number(url.pathname.split("/").pop());
      calls.delete.push(id);
      const status = deleteStatus(id);
      res.writeHead(status, { "content-type": "application/json" });
      res.end(status === 204 ? "" : "{}");
      return;
    }

    if (req.method === "GET" && url.pathname === "/token") {
      calls.token++;
      res.writeHead(registryTokenStatus, { "content-type": "application/json" });
      res.end(registryTokenStatus === 200 ? JSON.stringify({ token: "registry-token" }) : "{}");
      return;
    }

    if (req.method === "GET" && url.pathname.includes("/manifests/")) {
      const digest = decodeURIComponent(url.pathname.split("/manifests/")[1]);
      calls.manifests.push(digest);
      const entry = manifests[digest];
      if (typeof entry === "number") {
        res.writeHead(entry, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      // Default: a plain image manifest with no children and no subject.
      const body = entry ?? { mediaType: "application/vnd.oci.image.manifest.v1+json" };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
      return;
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end("{}");
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () =>
      new Promise((resolve) => {
        // Drop kept-alive sockets from the fetch pool so close() can finish.
        server.closeAllConnections();
        server.close(resolve);
      }),
  };
}

export const apiVersion = (id, tags, createdAt) => ({
  id,
  name: `sha256:${id}`,
  created_at: createdAt,
  updated_at: createdAt,
  metadata: { container: { tags } },
});
