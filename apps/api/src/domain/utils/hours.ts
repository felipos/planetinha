/** The hour is the unit a Forecast is valid for, so both paths agree on where an hour starts. */
export class Hours {
  /** Floors an instant to the top of its UTC hour. */
  static floor(instant: Date): Date {
    const floored = new Date(instant.getTime())
    floored.setUTCMinutes(0, 0, 0)
    return floored
  }
}
