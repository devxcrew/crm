const preferencePrefix = "techmedia.tema.pet.visible";

export type TemaPetPlatform = "mobile" | "web";

export function currentTemaPetPlatform(): TemaPetPlatform {
  return document.documentElement.dataset.runtime === "mobile" ? "mobile" : "web";
}

export function readTemaPetPreference(platform: TemaPetPlatform) {
  return window.localStorage.getItem(preferenceKey(platform)) !== "false";
}

export function saveTemaPetPreference(platform: TemaPetPlatform, visible: boolean) {
  window.localStorage.setItem(preferenceKey(platform), String(visible));
}

function preferenceKey(platform: TemaPetPlatform) {
  return `${preferencePrefix}.${platform}`;
}
