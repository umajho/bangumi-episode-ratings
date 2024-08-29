type Callback<T> = (newValue: T, oldValue: T | undefined) => void;

export class Watched<T> {
  private _watchers: (Callback<T>)[] = [];

  private _broadcastID: string | null;

  constructor(private _value: T, opts?: { broadcastID?: string }) {
    this._broadcastID = opts?.broadcastID ?? null;
    if (this._broadcastID) {
      window.addEventListener("storage", (ev) => {
        if (ev.key === this._broadcastID && ev.newValue) {
          const oldValue = this._value;
          const newValue = JSON.parse(ev.newValue);
          this._value = newValue;
          this._watchers.forEach((w) => w(newValue, oldValue));
        }
      });
    }
  }

  getValueOnce(): T {
    return this._value;
  }

  setValue(newValue: T) {
    const oldValue = this._value;
    this._value = newValue;
    this._watchers.forEach((w) => w(newValue, oldValue));

    if (this._broadcastID) {
      localStorage.setItem(this._broadcastID, JSON.stringify(newValue));
      localStorage.removeItem(this._broadcastID);
    }
  }

  watchDeferred(cb: Callback<T>): () => void {
    this._watchers.push(cb);

    return () => {
      this._watchers = this._watchers.filter((w) => w !== cb);
    };
  }

  watch(cb: Callback<T>): () => void {
    cb(this._value, undefined);
    return this.watchDeferred(cb);
  }

  createComputed<U>(computeFn: (value: T) => U): Watched<U> {
    const computed = new Watched(computeFn(this.getValueOnce()));
    this.watchDeferred((newValue) => {
      computed.setValue(computeFn(newValue));
    });
    return computed;
  }
}
