const mode = process.argv[2] === "recent" ? "recent" : "archive";
const baseUrl = process.env.SITE_URL?.replace(/\/$/, "");
const wordpressUrl = process.env.WORDPRESS_URL?.replace(/\/$/, "");
const secret = process.env.ARTICLE_TRANSLATION_SECRET;

if (!baseUrl || !secret) {
  console.error("Set SITE_URL and ARTICLE_TRANSLATION_SECRET before running this script.");
  process.exit(1);
}

async function getArchivePageCount() {
  if (!wordpressUrl) throw new Error("Set WORDPRESS_URL before processing the archive.");
  const tagsUrl = new URL(`${wordpressUrl}/wp-json/wp/v2/tags`);
  tagsUrl.search = new URLSearchParams({ slug: "momenti-en", _fields: "id" }).toString();
  const tagsResponse = await fetch(tagsUrl, { cache: "no-store" });
  if (!tagsResponse.ok) throw new Error(`Could not read the English translation tag: ${tagsResponse.status}`);
  const tags = await tagsResponse.json();
  const languageTagId = tags[0]?.id;
  if (!languageTagId) throw new Error("The English translation tag is missing in WordPress.");

  const postsUrl = new URL(`${wordpressUrl}/wp-json/wp/v2/posts`);
  postsUrl.search = new URLSearchParams({
    status: "publish",
    tags_exclude: String(languageTagId),
    per_page: "2",
    page: "1",
    _fields: "id",
  }).toString();
  const postsResponse = await fetch(postsUrl, { cache: "no-store" });
  if (!postsResponse.ok) throw new Error(`Could not count the source archive: ${postsResponse.status}`);
  return Number(postsResponse.headers.get("x-wp-totalpages") || "1");
}

async function runBatch(page, limit = 2) {
  const response = await fetch(`${baseUrl}/api/translations/process`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode, limit, page }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Translation batch failed with HTTP ${response.status}.`);
  return result;
}

async function runBatchWithFallback(page) {
  try {
    return [{ page, result: await runBatch(page) }];
  } catch (error) {
    const fallbackPages = mode === "archive" ? [page * 2 - 1, page * 2] : [1, 1];
    const results = [];
    for (const fallbackPage of fallbackPages) {
      try {
        results.push({
          page: fallbackPage,
          fallbackFor: page,
          result: await runBatch(fallbackPage, 1),
        });
      } catch (fallbackError) {
        results.push({
          page: fallbackPage,
          fallbackFor: page,
          error: `${String(error)}; single-article retry: ${String(fallbackError)}`,
        });
        break;
      }
    }
    return results;
  }
}

try {
  let total = 0;
  const totalPages = mode === "archive" ? await getArchivePageCount() : 1;
  const concurrency = mode === "archive" ? 2 : 1;
  for (let firstPage = 1; firstPage <= totalPages; firstPage += concurrency) {
    const pages = Array.from({ length: concurrency }, (_, index) => firstPage + index)
      .filter((page) => page <= totalPages);
    const resultGroups = await Promise.all(pages.map(runBatchWithFallback));
    let shouldStop = false;
    for (const results of resultGroups) {
      for (const entry of results) {
        if ("error" in entry) {
          console.error(JSON.stringify({ mode, page: entry.page, totalPages, error: entry.error }));
          process.exitCode = 1;
          shouldStop = true;
          continue;
        }
        const { result } = entry;
        total += result.processed;
        console.log(JSON.stringify({
          mode,
          page: entry.page,
          fallbackFor: entry.fallbackFor,
          totalPages,
          processedThisBatch: result.processed,
          skipped: result.skipped,
          totalProcessed: total,
          failed: result.failed,
          done: result.done,
        }));

        if (result.failed?.length) {
          process.exitCode = 2;
          shouldStop = true;
        }
      }
    }
    if (mode === "recent" || shouldStop) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
}
