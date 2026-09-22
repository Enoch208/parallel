import { maskAddress } from "./judgeToken";

const addressPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

export function shownAddress(address: string, hide: boolean): string {
  return hide ? maskAddress(address) : address;
}

export function maskAddressesIn(text: string): string {
  return text.replace(addressPattern, (address) => maskAddress(address));
}
