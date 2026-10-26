<?php
declare(strict_types=1);

/**
 * Standalone RSS 2.0 feed for Klan Kosova's Kosovo news category.
 * Keep the cache directory writable by the PHP-FPM user on production.
 */

const KLAN_CATEGORY_URL = 'https://klankosova.tv/kosova/';
const KLAN_ORIGIN = 'https://klankosova.tv';
const CACHE_TTL = 600;
const MAX_ITEMS = 30;

$cacheFile = __DIR__ . '/cache.xml';
$lockFile = __DIR__ . '/cache.lock';

header('Content-Type: application/rss+xml; charset=UTF-8');
header('Cache-Control: public, max-age=600');
header('X-Content-Type-Options: nosniff');

if (is_file($cacheFile) && (time() - (int) filemtime($cacheFile)) < CACHE_TTL) {
    readfile($cacheFile);
    exit;
}

$lock = @fopen($lockFile, 'c');
if ($lock === false) {
    serveStaleOrFail($cacheFile);
}

if (!flock($lock, LOCK_EX)) {
    fclose($lock);
    serveStaleOrFail($cacheFile);
}

clearstatcache(true, $cacheFile);
if (is_file($cacheFile) && (time() - (int) filemtime($cacheFile)) < CACHE_TTL) {
    flock($lock, LOCK_UN);
    fclose($lock);
    readfile($cacheFile);
    exit;
}

try {
    $categoryHtml = fetchHtml(KLAN_CATEGORY_URL);
    $cards = parseCategoryCards($categoryHtml);
    if ($cards === []) {
        throw new RuntimeException('No category cards were parsed');
    }

    $items = [];
    foreach (array_slice($cards, 0, MAX_ITEMS) as $card) {
        try {
            $articleHtml = fetchHtml($card['url']);
            $article = parseArticle($articleHtml, $card);
            $items[] = array_merge($card, $article);
        } catch (Throwable $error) {
            error_log('Klan RSS: article fetch/parse failed for ' . $card['url'] . ': ' . $error->getMessage());
        }
    }

    if ($items === []) {
        throw new RuntimeException('No article content could be fetched');
    }

    $xml = buildFeed($items);
    $temporary = $cacheFile . '.' . bin2hex(random_bytes(6)) . '.tmp';
    if (file_put_contents($temporary, $xml, LOCK_EX) === false || !@rename($temporary, $cacheFile)) {
        @unlink($temporary);
        throw new RuntimeException('Could not update RSS cache');
    }

    echo $xml;
} catch (Throwable $error) {
    error_log('Klan RSS: feed refresh failed: ' . $error->getMessage());
    serveStaleOrFail($cacheFile);
}

flock($lock, LOCK_UN);
fclose($lock);

function serveStaleOrFail(string $cacheFile): never
{
    if (is_file($cacheFile) && filesize($cacheFile) > 0) {
        header('X-RSS-Cache: stale');
        readfile($cacheFile);
        exit;
    }
    http_response_code(502);
    echo "<?xml version=\"1.0\" encoding=\"UTF-8\"?><rss version=\"2.0\"><channel><title>Klan Kosova - Kosovë</title><link>https://klankosova.tv/kosova/</link><description>Feed refresh temporarily unavailable</description></channel></rss>";
    exit;
}

function fetchHtml(string $url): string
{
    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS => 5,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 25,
        CURLOPT_ENCODING => '',
        CURLOPT_USERAGENT => 'MomentiRSS/1.0 (+https://momenti.info/klan-rss/)',
        CURLOPT_HTTPHEADER => ['Accept: text/html,application/xhtml+xml'],
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ]);
    $body = curl_exec($curl);
    $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
    $error = curl_error($curl);
    curl_close($curl);

    if (!is_string($body) || $body === '' || $status < 200 || $status >= 400) {
        throw new RuntimeException('HTTP fetch failed (' . $status . ')' . ($error !== '' ? ': ' . $error : ''));
    }
    return $body;
}

/** Extract category cards from Next.js Flight/RSC payloads, not from the DOM. */
function parseCategoryCards(string $html): array
{
    $cards = [];

    foreach (extractFlightStreams($html) as $stream) {
        $cardMarker = ',"className":"kk-nf-card"';
        $titleMarker = '"className":"kk-nf-card-title","children":';
        $imageMarker = '"className":"kk-nf-card-img","style":{"backgroundImage":"url(';
        $position = 0;
        while (($position = strpos($stream, $cardMarker, $position)) !== false) {
            $hrefKey = strrpos(substr($stream, 0, $position), '"href":');
            $titleAt = strpos($stream, $titleMarker, $position + strlen($cardMarker));
            $nextCard = strpos($stream, $cardMarker, $position + strlen($cardMarker));
            if ($hrefKey === false || $titleAt === false || ($nextCard !== false && $titleAt > $nextCard)) {
                $position += strlen($cardMarker);
                continue;
            }

            $href = readRscValue($stream, $hrefKey + strlen('"href":'));
            $title = readRscValue($stream, $titleAt + strlen($titleMarker));
            if (!is_string($href) || !is_string($title) || trim($title) === '' || !str_starts_with($href, '/') || str_starts_with($href, '//')) {
                $position += strlen($cardMarker);
                continue;
            }

            $image = '';
            $imageAt = strpos($stream, $imageMarker, $position + strlen($cardMarker));
            if ($imageAt !== false && ($nextCard === false || $imageAt < $nextCard)) {
                $image = readRscValue($stream, $imageAt + strlen($imageMarker));
                if (is_string($image)) {
                    $image = html_entity_decode($image, ENT_QUOTES | ENT_HTML5, 'UTF-8');
                } else {
                    $image = '';
                }
            }

            $url = absoluteKlanUrl($href);
            $cards[$url] ??= [
                'url' => $url,
                'title' => trim(html_entity_decode($title, ENT_QUOTES | ENT_HTML5, 'UTF-8')),
                'image' => $image !== '' ? absoluteKlanUrl($image) : '',
            ];
            if (count($cards) >= MAX_ITEMS) {
                break;
            }
            $position += strlen($cardMarker);
        }
    }
    return array_values($cards);
}

function extractFlightStreams(string $html): array
{
    $marker = 'self.__next_f.push([1,';
    $streams = [];
    $searchAt = 0;
    while (($start = strpos($html, $marker, $searchAt)) !== false) {
        $quoteAt = $start + strlen($marker);
        if (($html[$quoteAt] ?? '') !== '"') {
            $searchAt = $quoteAt;
            continue;
        }
        $escaped = false;
        $end = $quoteAt + 1;
        $length = strlen($html);
        for (; $end < $length; $end++) {
            $char = $html[$end];
            if ($escaped) {
                $escaped = false;
            } elseif ($char === '\\') {
                $escaped = true;
            } elseif ($char === '"') {
                break;
            }
        }
        $decoded = json_decode(substr($html, $quoteAt, $end - $quoteAt + 1), true);
        if (is_string($decoded)) {
            $streams[] = $decoded;
        }
        $searchAt = $end + 1;
    }
    return $streams;
}

function readRscValue(string $stream, int $quoteAt): ?string
{
    if (($stream[$quoteAt] ?? '') !== '"') {
        return null;
    }
    $escaped = false;
    $end = $quoteAt + 1;
    $length = strlen($stream);
    for (; $end < $length; $end++) {
        $char = $stream[$end];
        if ($escaped) {
            $escaped = false;
        } elseif ($char === '\\') {
            $escaped = true;
        } elseif ($char === '"') {
            break;
        }
    }
    $decoded = json_decode(substr($stream, $quoteAt, $end - $quoteAt + 1));
    return is_string($decoded) ? $decoded : null;
}

function absoluteKlanUrl(string $url): string
{
    if (str_starts_with($url, 'https://') || str_starts_with($url, 'http://')) {
        return $url;
    }
    return KLAN_ORIGIN . '/' . ltrim($url, '/');
}

function parseArticle(string $html, array $card): array
{
    $previous = libxml_use_internal_errors(true);
    $dom = new DOMDocument('1.0', 'UTF-8');
    $dom->loadHTML('<?xml encoding="UTF-8">' . $html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
    $xpath = new DOMXPath($dom);

    $contentParts = [];
    $proseNodes = $xpath->query('//article[contains(concat(" ", normalize-space(@class), " "), " kk-art-body ")]//div[contains(concat(" ", normalize-space(@class), " "), " kk-art-prose ")]');
    if ($proseNodes !== false) {
        foreach ($proseNodes as $prose) {
            removeNodes($xpath, './/script|.//style|.//*[@id="article-inline-1"]|.//*[contains(concat(" ", normalize-space(@class), " "), " ad-slot ")]', $prose);
            $part = '';
            foreach ($prose->childNodes as $child) {
                $part .= $dom->saveHTML($child);
            }
            if (trim(strip_tags($part)) !== '') {
                $contentParts[] = trim($part);
            }
        }
    }

    $description = '';
    foreach ($contentParts as $part) {
        if (preg_match('~<p\b[^>]*>(.*?)</p>~is', $part, $paragraph)) {
            $description = trim(preg_replace('/\s+/u', ' ', html_entity_decode(strip_tags($paragraph[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8')));
            break;
        }
    }

    $published = metaContent($xpath, 'article:published_time');
    $pubTimestamp = $published !== '' ? strtotime($published) : false;
    if ($pubTimestamp === false) {
        $pubTimestamp = time();
    }

    $image = metaContent($xpath, 'og:image');
    if ($image === '') {
        $image = $card['image'];
    }

    libxml_clear_errors();
    libxml_use_internal_errors($previous);

    if ($contentParts === []) {
        throw new RuntimeException('Article body selector returned no content');
    }
    $content = implode("\n", $contentParts);
    if ($image !== '') {
        $imageUrl = htmlspecialchars($image, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
        $imageAlt = htmlspecialchars($card['title'], ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
        $content = '<p><img src="' . $imageUrl . '" alt="' . $imageAlt . '" /></p>' . "\n" . $content;
    }
    return [
        'content' => $content,
        'description' => $description !== '' ? $description : $card['title'],
        'image' => $image,
        'published' => (int) $pubTimestamp,
    ];
}

function removeNodes(DOMXPath $xpath, string $query, DOMNode $context): void
{
    $nodes = $xpath->query($query, $context);
    if ($nodes === false) {
        return;
    }
    $toRemove = [];
    foreach ($nodes as $node) {
        $toRemove[] = $node;
    }
    foreach ($toRemove as $node) {
        $node->parentNode?->removeChild($node);
    }
}

function metaContent(DOMXPath $xpath, string $property): string
{
    $nodes = $xpath->query('//meta[@property="' . $property . '"]/@content | //meta[@name="' . $property . '"]/@content');
    return $nodes !== false && $nodes->length > 0 ? trim($nodes->item(0)->nodeValue ?? '') : '';
}

function buildFeed(array $items): string
{
    $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
    $xml .= '<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:media="http://search.yahoo.com/mrss/">' . "\n";
    $xml .= "<channel>\n";
    $xml .= '<title>Klan Kosova - Kosovë</title>' . "\n";
    $xml .= '<link>' . xmlEscape(KLAN_CATEGORY_URL) . '</link>' . "\n";
    $xml .= '<description>Lajmet e fundit nga Kosova - Klan Kosova</description>' . "\n";
    $xml .= '<language>sq</language>' . "\n";
    $xml .= '<lastBuildDate>' . gmdate(DATE_RSS) . '</lastBuildDate>' . "\n";

    foreach ($items as $item) {
        $xml .= "<item>\n";
        $xml .= '<title>' . xmlEscape($item['title']) . '</title>' . "\n";
        $xml .= '<link>' . xmlEscape($item['url']) . '</link>' . "\n";
        $xml .= '<guid isPermaLink="true">' . xmlEscape($item['url']) . '</guid>' . "\n";
        $xml .= '<pubDate>' . gmdate(DATE_RSS, $item['published']) . '</pubDate>' . "\n";
        $xml .= '<category>Kosovë</category>' . "\n";
        $xml .= '<description>' . cdata($item['description']) . '</description>' . "\n";
        $xml .= '<content:encoded>' . cdata($item['content']) . '</content:encoded>' . "\n";
        if ($item['image'] !== '') {
            $image = xmlEscape($item['image']);
            $xml .= '<media:content url="' . $image . '" medium="image" type="' . imageMime($item['image']) . '" />' . "\n";
            $xml .= '<media:thumbnail url="' . $image . '" />' . "\n";
            $xml .= '<enclosure url="' . $image . '" length="0" type="' . imageMime($item['image']) . '" />' . "\n";
        }
        $xml .= "</item>\n";
    }
    $xml .= "</channel>\n</rss>\n";
    return $xml;
}

function xmlEscape(string $value): string
{
    return htmlspecialchars($value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
}

function cdata(string $value): string
{
    return '<![CDATA[' . str_replace(']]>', ']]]]><![CDATA[>', $value) . ']]>';
}

function imageMime(string $url): string
{
    $path = (string) parse_url($url, PHP_URL_PATH);
    $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    return match ($extension) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        default => 'image/jpeg',
    };
}
