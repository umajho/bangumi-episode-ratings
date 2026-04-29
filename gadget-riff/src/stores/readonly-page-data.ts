export const readonlyPageData = {
  get claimedUserId(): number | null {
    return (window as any).CHOBITS_UID || null;
  },
};
