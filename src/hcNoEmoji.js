const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu;

function limpiar(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    if (!node.nodeValue || node.parentElement?.closest("script,style")) return;
    const clean = node.nodeValue.replace(EMOJI_RE, "");
    if (clean !== node.nodeValue) node.nodeValue = clean.replace(/\s{2,}/g, " ");
  });
}

const start = () => {
  limpiar(document.body);
  new MutationObserver((mutations) => mutations.forEach((m) => m.addedNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const clean = n.nodeValue.replace(EMOJI_RE, "");
      if (clean !== n.nodeValue) n.nodeValue = clean.replace(/\s{2,}/g, " ");
    } else if (n.nodeType === Node.ELEMENT_NODE) limpiar(n);
  }))).observe(document.body, { childList: true, subtree: true });
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
else start();
