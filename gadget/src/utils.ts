export class Watched<T> {
  private _watchers: ((updatedValue: T) => void)[] = [];

  constructor(private _value: T) {}

  getValueOnce(): T {
    return this._value;
  }

  setValue(newValue: T) {
    this._value = newValue;
    this._watchers.forEach((w) => w(newValue));
  }

  watchDeferred(cb: (updatedValue: T) => void): () => void {
    this._watchers.push(cb);

    return () => {
      this._watchers = this._watchers.filter((w) => w !== cb);
    };
  }

  watch(cb: (updatedValue: T) => void): () => void {
    cb(this._value);
    return this.watchDeferred(cb);
  }
}
