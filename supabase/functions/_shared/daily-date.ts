const JAKARTA_TIME_ZONE = 'Asia/Jakarta';

export function jakartaDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JAKARTA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function epochToJakartaDate(seconds: number): string {
  return jakartaDate(new Date(seconds * 1000));
}
