export function fromTinybarToHbar(valueInTinyBar: number): number {
  return valueInTinyBar / 10 ** 8;
}

export function fromBaseToDisplayUnit(
  rawBalance: number,
  decimals: number
): number {
  return rawBalance / 10 ** decimals;
}

export function fromDisplayToBaseUnit(
  displayBalance: number,
  decimals: number
): number {
  return displayBalance * 10 ** decimals;
}

export function hashscanLinkMatcher(message: string): RegExpMatchArray {
  return message.match(/https:\/\/hashscan\.io\/[^/]+\/tx\/([\d.]+)@([\d.]+)/);
}

export function hashscanTopicLinkMatcher(message: string): RegExpMatchArray {
  return message.match(/https:\/\/hashscan\.io\/[^/]+\/topic\/([\d.]+)/);
}
