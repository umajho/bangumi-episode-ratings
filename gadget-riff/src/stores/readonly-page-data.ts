export const readonlyPageData = {
  get claimedUserID(): number | null {
    return (window as any).CHOBITS_UID || null;
  },
};
