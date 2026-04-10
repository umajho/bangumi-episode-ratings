const CUSTOM_ELEMENT_TAG_NAME_PREFIX = "umajho-bangumi-eprt";

export function makeCustomElementTagName(name: string) {
  return `${CUSTOM_ELEMENT_TAG_NAME_PREFIX}-${name}`;
}
