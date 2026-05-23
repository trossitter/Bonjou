export function makeTicketShortCode(region = 'HT'): string {
  const prefix = region.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) || 'HT';
  const number = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${number}`;
}
