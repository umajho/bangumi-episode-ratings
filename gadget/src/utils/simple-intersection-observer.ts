const callbackMap = new WeakMap<Element, () => void>();

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    const cb = callbackMap.get(entry.target);
    if (cb && entry.isIntersecting) {
      cb();
      observer.unobserve(entry.target);
    }
  });
});

export function observeInteractionWithViewportOnce(
  el: Element,
  cb: () => void,
) {
  callbackMap.set(el, cb);
  observer.observe(el);
}

setInterval(() => {
  observer.takeRecords().forEach((record) => {
    if (!document.contains(record.target)) {
      observer.unobserve(record.target);
    }
  });
}, 1000);
