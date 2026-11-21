(() => {
  if (window.top !== window) return;
  const ROOT_ID = "__chrome_video_loop_root";
  let root = null, style = null;

  function domainAllowed(domains) {
    const host = location.hostname.toLowerCase();
    return (domains || []).some(item => {
      const d = String(item).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, "");
      return host === d || host === "www." + d || host.endsWith("." + d);
    });
  }
  function removePanel() {
    root?.remove(); style?.remove(); root = null; style = null;
    document.documentElement.classList.remove("__cvl_split");
  }
  function createPanel(config) {
    removePanel();
    if (!config.enabled || !domainAllowed(config.domains) || !document.documentElement) return;
    const pos = ["left","right","top","bottom"].includes(config.position) ? config.position : "right";
    const size = Math.max(20, Math.min(70, Number(config.panelSize) || 38));
    const horizontal = pos === "left" || pos === "right";
    const edge = pos;
    const margin = horizontal ? "margin-" + (pos === "left" ? "left" : "right") : "margin-" + (pos === "top" ? "top" : "bottom");
    const marginSize = horizontal ? size + "vw" : size + "vh";
    style = document.createElement("style");
    style.textContent = `
      html.__cvl_split { box-sizing:border-box !important; ${margin}: ${marginSize} !important; }
      #${ROOT_ID} {
        position:fixed !important; ${edge}:0 !important;
        ${horizontal ? "width:" + size + "vw" : "width:100vw"} !important;
        ${horizontal ? "height:100vh" : "height:" + size + "vh"} !important;
        ${horizontal ? "min-width:280px;max-width:70vw" : "min-height:180px;max-height:70vh"} !important;
        z-index:2147483647 !important; border:0 !important; margin:0 !important; padding:0 !important;
        background:#101318 !important; box-shadow:${pos==="left"?"8px":"-8px"} ${pos==="top"?"8px":"-8px"} 28px rgba(0,0,0,.28) !important;
      }
      @media(max-width:700px) {
        html.__cvl_split { ${margin}:0 !important; }
        #${ROOT_ID} { width:100vw !important; height:${horizontal ? "100vh" : size+"vh"} !important; }
      }`;
    document.documentElement.appendChild(style);
    document.documentElement.classList.add("__cvl_split");
    root = document.createElement("iframe");
    root.id = ROOT_ID; root.title = "Video Loop Panel";
    root.allow = "autoplay; fullscreen";
    root.src = chrome.runtime.getURL("player.html") + "?fit=" + encodeURIComponent(config.fit || "contain");
    document.documentElement.appendChild(root);
  }
  function refresh() {
    chrome.runtime.sendMessage({ type: "GET_PANEL_CONFIG" }, config => {
      if (chrome.runtime.lastError || !config) return;
      if (config.enabled && domainAllowed(config.domains)) createPanel(config);
      else removePanel();
    });
  }
  refresh();
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === "PLAYER_PLAYLIST_CHANGED") {
      const frame = root;
      if (frame) frame.contentWindow.postMessage({ type: "CVL_PLAYLIST_CHANGED" }, "*");
      return;
    }
    if (message?.type === "PANEL_CONFIG_CHANGED") {
      const c = message.config;
      if (c?.enabled && domainAllowed(c.domains)) createPanel(c);
      else removePanel();
    }
  });
})();