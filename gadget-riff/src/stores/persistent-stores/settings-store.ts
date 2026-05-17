import { type Accessor, createSignal } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";

import { makeBroadcastChannelName } from "../../definitions";
import { readonlyPageData } from "../readonly-page-data";

export type SettingsStore = ReturnType<typeof createSettingsStore>;

type SettingAntiSpoilerOption = "off" | "on-for-neither-watched-nor-rated";
type SettingAntiSpoilerForMusicOption = "off" | "on-for-not-rated";

export interface SettingsStatus {
  ready?: true;
  saving?: true;
  error?: string;
}

export interface Settings {
  antiSpoiler?: SettingAntiSpoilerOption;
  antiSpoilerForMusic?: SettingAntiSpoilerForMusicOption;
}

const DEFAULT_SETTINGS: Required<Settings> = {
  antiSpoiler: "on-for-neither-watched-nor-rated",
  antiSpoilerForMusic: "off",
};

export function createSettingsStore() {
  const [status, setStatus] = createSignal<SettingsStatus>({ ready: true });

  const saved = ((): Settings => {
    try {
      return JSON.parse(chiiApp.cloud_settings.get("settings") ?? "{}");
    } catch {
      return {};
    }
  })();
  const [store, setStore] = createStore<Settings>(saved);

  const bc = new BroadcastChannel(makeBroadcastChannelName("settings"));
  bc.postMessage(saved);
  bc.addEventListener("message", (ev) => setStore(reconcile(ev.data)));

  function update<Key extends keyof Settings>(key: Key, value: Settings[Key]) {
    if (status().saving) return;

    setStatus({ saving: true });
    (async () => {
      const newStore = { ...unwrap(store), [key]: value };
      const saveResult = await saveSettingsToCloud(newStore);
      if (saveResult[0] === "error") {
        setStatus({ error: saveResult[1] });
        return;
      }

      setStatus({ ready: true });
      setStore(key, value);
      bc.postMessage(newStore);
    })();
  }

  function updateAntiSpoiler(value: SettingAntiSpoilerOption) {
    update("antiSpoiler", value);
  }
  function getAntiSpoilerValues(): SettingAntiSpoilerOption[] {
    return ["off", "on-for-neither-watched-nor-rated"];
  }
  function getAntiSpoilerValueLabelText(
    value: SettingAntiSpoilerOption,
  ): string {
    return {
      "off": "关闭",
      "on-for-neither-watched-nor-rated":
        "已有评分而自己尚未观看且尚未评分时，需主动揭开评分",
    }[value];
  }
  function getAntiSpoilerSignal(): Accessor<SettingAntiSpoilerOption> {
    return () => store.antiSpoiler ?? DEFAULT_SETTINGS.antiSpoiler;
  }

  function updateAntiSpoilerForMusic(value: SettingAntiSpoilerForMusicOption) {
    update("antiSpoilerForMusic", value);
  }
  function getAntiSpoilerForMusicValues(): SettingAntiSpoilerForMusicOption[] {
    return ["off", "on-for-not-rated"];
  }
  function getAntiSpoilerForMusicValueLabelText(
    value: SettingAntiSpoilerForMusicOption,
  ): string {
    return {
      "off": "关闭",
      "on-for-not-rated": "已有评分而自己尚未评分时，需主动揭开评分",
    }[value];
  }
  function getAntiSpoilerForMusicSignal(): Accessor<
    SettingAntiSpoilerForMusicOption
  > {
    return () =>
      store.antiSpoilerForMusic ?? DEFAULT_SETTINGS.antiSpoilerForMusic;
  }

  return {
    getStatusSignal: () => status,
    updateAntiSpoiler,
    getAntiSpoilerValues,
    getAntiSpoilerValueLabelText,
    getAntiSpoilerSignal,
    updateAntiSpoilerForMusic,
    getAntiSpoilerForMusicValues,
    getAntiSpoilerForMusicValueLabelText,
    getAntiSpoilerForMusicSignal,
  };
}

async function saveSettingsToCloud(
  settings: Settings,
): Promise<["ok"] | ["error", string]> {
  if (Number.isNaN(Number(readonlyPageData.appId))) throw new Error("?");

  const payload = new URLSearchParams({
    [`settings[${readonlyPageData.appId}][settings]`]: JSON.stringify(settings),
  });
  try {
    const resp = await fetch("/settings/cloud?ajax=1", {
      method: "POST",
      body: payload,
    });
    if (resp.ok) {
      const dataText = await resp.text();
      const data = JSON.parse(dataText);
      if (data.status === "ok") {
        return ["ok"];
      } else {
        // TODO: 搞清楚此情况下返回内容具体的格式。
        return ["error", `Non-OK status: ${dataText}`];
      }
    } else {
      const text = await resp.text();
      return ["error", `HTTP ${resp.status}: ${text}`];
    }
  } catch (e) {
    return ["error", `Exception: ${e}`];
  }
}
