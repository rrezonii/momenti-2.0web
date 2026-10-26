import html
import json
import re
import sys
from html.parser import HTMLParser

from argostranslate.translate import get_translation_from_codes


def preserve_space_translate(value, translator):
    match = re.match(r"^(\s*)(.*?)(\s*)$", value, re.DOTALL)
    if not match or not match.group(2):
        return value
    leading, core, trailing = match.groups()
    return leading + translator.translate(core) + trailing


class TranslatedHtml(HTMLParser):
    VOID_TAGS = {
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    }
    RAW_TEXT_TAGS = {"code", "pre", "script", "style", "textarea"}

    def __init__(self, translator):
        super().__init__(convert_charrefs=True)
        self.translator = translator
        self.parts = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        self.parts.append(self.get_starttag_text() or f"<{tag}>")
        if tag.lower() not in self.VOID_TAGS:
            self.stack.append(tag.lower())

    def handle_startendtag(self, tag, attrs):
        self.parts.append(self.get_starttag_text() or f"<{tag}/>")

    def handle_endtag(self, tag):
        self.parts.append(f"</{tag}>")
        tag = tag.lower()
        if tag in self.stack:
            self.stack = self.stack[: len(self.stack) - 1 - self.stack[::-1].index(tag)]

    def handle_data(self, data):
        if not data.strip() or any(tag in self.RAW_TEXT_TAGS for tag in self.stack):
            self.parts.append(data)
            return
        translated = preserve_space_translate(data, self.translator)
        self.parts.append(html.escape(translated, quote=False))

    def handle_entityref(self, name):
        self.parts.append(f"&{name};")

    def handle_charref(self, name):
        self.parts.append(f"&#{name};")

    def handle_comment(self, data):
        self.parts.append(f"<!--{data}-->")

    def handle_decl(self, decl):
        self.parts.append(f"<!{decl}>")

    def handle_pi(self, data):
        self.parts.append(f"<?{data}>")

    def translate(self, source):
        self.feed(source or "")
        self.close()
        return "".join(self.parts)


def main():
    translator = get_translation_from_codes("sq", "en")
    items = json.load(sys.stdin)
    result = []
    for item in items:
        result.append({
            "title": translator.translate(item.get("title", "")),
            "excerpt": translator.translate(item.get("excerpt", "")),
            "content": TranslatedHtml(translator).translate(item.get("content", "")),
        })
    json.dump(result, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Offline sq-to-en translation failed: {exc}", file=sys.stderr)
        sys.exit(1)
