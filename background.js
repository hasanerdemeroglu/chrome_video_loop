const DEFAULTS = {
  enabled: true,
  domains: [],
  position: "right",
  panelSize: 38,
  fit: "contain"
};

async function getConfig() {
  const data = await chrome.storage.local.get("videoPanelConfig");
  return { ...DEFAULTS, ...(data.videoPanelConfig || {}) };
}
async function setConfig(config) {
  await chrome.storage.local.set({ videoPanelConfig: { ...DEFAULTS, ...config } });
}
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get("videoPanelConfig");
  if (!data.videoPanelConfig) await setConfig(DEFAULTS);
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "GET_PANEL_CONFIG") {
    getConfig().then(config => sendResponse(config));
    return true;
  }
  if (message?.type === "PLAYLIST_CHANGED") {
    chrome.tabs.query({}).then(tabs => {
      for (const tab of tabs) if (tab.id && tab.url && /^https?:/.test(tab.url)) {
        chrome.tabs.sendMessage(tab.id, { type: "PLAYER_PLAYLIST_CHANGED" }).catch(() => {});
      }
    });
    sendResponse({ ok: true });
    return true;
  }
  if (message?.type === "SET_PANEL_CONFIG") {
    setConfig(message.config).then(async () => {
      const config = await getConfig();
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id && tab.url && /^https?:/.test(tab.url)) {
          chrome.tabs.sendMessage(tab.id, { type: "PANEL_CONFIG_CHANGED", config }).catch(() => {});
        }
      }
      sendResponse({ ok: true, config });
    });
    return true;
  }
});