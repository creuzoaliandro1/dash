/**
 * Format date from YYYY-MM-DD to dd/mm/aa
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @returns {string} Date in dd/mm/aa format
 */
export const formatDate = (dateString) => {
  if (!dateString) return ''
  try {
    const [year, month, day] = dateString.split('-')
    const shortYear = year.slice(-2) // Get last 2 digits of year
    return `${day}/${month}/${shortYear}`
  } catch (error) {
    return dateString
  }
}

/**
 * Format number to Brazilian currency format: 45.654,34
 * @param {number|string} value - Value to format
 * @returns {string} Formatted value (e.g., "45.654,34")
 */
export const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return ''

  try {
    const numValue = parseFloat(value)
    if (isNaN(numValue)) return String(value)

    // Format with 2 decimal places
    const formatted = numValue.toFixed(2)
    // Split into integer and decimal parts
    const [intPart, decPart] = formatted.split('.')

    // Add thousands separator (dots) to integer part
    const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

    // Combine with comma as decimal separator
    return `${intFormatted},${decPart}`
  } catch (error) {
    return String(value)
  }
}

/**
 * Format number to Brazilian currency format with R$ prefix: R$ 45.654,34
 * @param {number|string} value - Value to format
 * @returns {string} Formatted value (e.g., "R$ 45.654,34")
 */
export const formatCurrencyWithPrefix = (value) => {
  return `R$ ${formatCurrency(value)}`
}
