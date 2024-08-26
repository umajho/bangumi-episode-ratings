type Callback<T> = (newValue: T, oldValue: T | undefined) => void;

export class Watched<T> {
  private _watchers: (Callback<T>)[] = [];

  constructor(private _value: T) {}

  getValueOnce(): T {
    return this._value;
  }

  setValue(newValue: T) {
    const oldValue = this._value;
    this._value = newValue;
    this._watchers.forEach((w) => w(newValue, oldValue));
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
}
