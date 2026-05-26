import { type Component, createSignal } from "solid-js";
import { EPRT_ID_HTML_SAFE } from "../definitions";

export const EprtLinkSmallGrey: Component<{}> = () => {
  const [isHovering, setIsHovering] = createSignal(false);

  return (
    <a
      onClick={() =>
        chiiLib.ukagaka.showCustomizePanelWithTab(EPRT_ID_HTML_SAFE)}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        "font-size": "10px", // small.grey
        ...(isHovering()
          ? { cursor: "pointer" }
          : { color: "#999" /* small.grey */ }),
      }}
    >
      单集评分
    </a>
  );
};
