export type Lang = "ja" | "en";

const detect = (): Lang => {
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  return langs[0]?.toLowerCase().startsWith("ja") ? "ja" : "en";
};

export const lang: Lang = detect();

export type Localized = Record<Lang, string>;

export const t = (s: Localized): string => s[lang];

export const messages = {
  appName: { ja: "Lightroom Deck", en: "Lightroom Deck" },
  connect: { ja: "Lightroom と接続", en: "Connect to Lightroom" },
  connecting: {
    ja: "接続中… Lightroom 側でペアリングしてください",
    en: "Connecting… click “Pair” in Lightroom",
  },
  disconnect: { ja: "切断", en: "Disconnect" },
  loading: { ja: "読み込み中…", en: "Loading…" },
  notEditing: {
    ja: "編集モードではありません。Lightroom で写真を1枚開いてください。",
    en: "Not in edit mode. Open a single photo in Lightroom.",
  },
} satisfies Record<string, Localized>;
