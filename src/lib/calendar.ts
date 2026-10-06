/** Offsets displayed by the calendar, including today in either direction. */
export function calendarOffsets(previous: boolean): number[] {
  return Array.from({ length: 8 }, (_, index) => previous ? index - 7 : index);
}