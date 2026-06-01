function normalizeUrl(value = "") {
  return value.replace(/\/+$/, "").toLowerCase();
}

function hostFor(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return value;
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function collectSupabaseUrls(content) {
  return [...content.matchAll(/https:\/\/[a-z0-9]+\.supabase\.co/g)].map(
    (match) => match[0]
  );
}

function collectScriptSources(content) {
  return [...content.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(
    (match) => match[1]
  );
}

export async function findDeployedSupabaseUrls(baseUrl) {
  const origin = new URL(baseUrl).origin;
  const loginUrl = new URL("/login", origin).toString();
  const html = await fetchText(loginUrl);
  const found = new Set(collectSupabaseUrls(html));

  for (const source of collectScriptSources(html)) {
    const scriptUrl = new URL(source, origin).toString();

    try {
      const script = await fetchText(scriptUrl);
      for (const url of collectSupabaseUrls(script)) {
        found.add(url);
      }
    } catch {
      // A missing non-critical chunk should not hide URLs found elsewhere.
    }
  }

  return [...found];
}

export async function assertDeployedSupabaseMatches({ baseUrl, expectedUrl }) {
  const deployedUrls = await findDeployedSupabaseUrls(baseUrl);

  if (deployedUrls.length === 0) {
    throw new Error(
      `Could not detect the deployed NEXT_PUBLIC_SUPABASE_URL from ${hostFor(baseUrl)}.`
    );
  }

  if (deployedUrls.some((url) => normalizeUrl(url) === normalizeUrl(expectedUrl))) {
    return deployedUrls;
  }

  throw new Error(
    [
      `Deployed app Supabase host mismatch for ${hostFor(baseUrl)}.`,
      `Expected staging host: ${hostFor(expectedUrl)}.`,
      `Detected deployed host(s): ${deployedUrls.map(hostFor).join(", ")}.`,
      "Update the Vercel Environment Variables and redeploy before running staging E2E.",
    ].join(" ")
  );
}
