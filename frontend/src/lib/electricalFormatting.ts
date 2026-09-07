export const currentLabel = (value: number | null) => value === null ? 'Unavailable' : `${(value * 1000).toFixed(2)} mA`;
export const voltageLabel = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(2)} V`;
