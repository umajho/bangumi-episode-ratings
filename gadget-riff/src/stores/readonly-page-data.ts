import type { SubjectId } from "../definitions";

export const readonlyPageData = {
  get appId(): string {
    return CHII_APP_ID;
  },

  get claimedUserId(): number | null {
    return window.CHOBITS_UID ?? null;
  },

  get subjectId(): SubjectId | null {
    const pathParts = window.location.pathname.split("/").slice(1);
    if (pathParts[0] === "subject" && pathParts.length >= 2) {
      return Number(pathParts[1]) as SubjectId;
    }

    const a = document.querySelector("#headerSubject a");
    if (!a) return null;

    const aPathParts = a.getAttribute("href")?.split("/").slice(1);
    if (aPathParts && aPathParts[0] === "subject" && aPathParts.length >= 2) {
      return Number(aPathParts[1]) as SubjectId;
    }

    return null;
  },
};
