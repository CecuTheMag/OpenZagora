// Bulgaria joined the Eurozone on 1 January 2024.
// The irrevocable fixed conversion rate is 1 EUR = 1.95583 BGN.
export const BGN_TO_EUR = 1.95583

export const bgnToEur = (bgn) => bgn / BGN_TO_EUR

export const formatCurrency = (amount) => {
  if (amount === null || amount === undefined) return 'N/A'
  const eur = bgnToEur(parseFloat(amount))
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(eur)
}

export const formatMillions = (amount) => {
  if (!amount) return '0'
  const eur = bgnToEur(parseFloat(amount))
  return `${(eur / 1_000_000).toFixed(1)}M €`
}
