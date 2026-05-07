namespace chiiLib {
  namespace ukagaka {
    function addPanelTab(opts: {
      tab: string;
      label: string;
      type: "custom";
      customContent: () => unknown;
    });
    function showCustomizePanelWithTab(tabName: string);
  }
}

namespace chiiApp {
  const cloud_settings: {
    get(key: string): string | undefined;
    update(key: string, value: string): void;
    delete(key: string): void;
  };
}

interface Window {
  CHOBITS_UID: number | undefined;
}

const CHII_APP_ID: string;
