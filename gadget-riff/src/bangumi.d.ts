namespace chiiLib {
  namespace ajax_reply {
    function insertJsonComments(...args: unknown[]): void;
  }
  namespace ukagaka {
    function addPanelTab(opts: {
      tab: string;
      label: string;
      type: "custom";
      customContent: () => unknown;
    }): void;
    function showCustomizePanelWithTab(tabName: string): void;
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
