const { parseIncome } = require('./income-parser');
const { parseExpenses } = require('./expense-parser');
const { parseVillages } = require('./village-parser');
const { parseLoans } = require('./loan-parser');
const { parseForecasts } = require('./forecast-parser');
const { parseIndicators } = require('./indicator-parser');

module.exports = {
  parseIncome,
  parseExpenses,
  parseVillages,
  parseLoans,
  parseForecasts,
  parseIndicators
};
