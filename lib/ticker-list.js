'use strict';
/* lib/ticker-list.js — autocomplete suggestions */

const TICKER_LIST = [
  { symbol: 'AAPL',  name: 'Apple Inc.',              sector: 'Technology'    },
  { symbol: 'MSFT',  name: 'Microsoft Corporation',   sector: 'Technology'    },
  { symbol: 'NVDA',  name: 'NVIDIA Corporation',      sector: 'Technology'    },
  { symbol: 'GOOGL', name: 'Alphabet Inc.',           sector: 'Technology'    },
  { symbol: 'AMZN',  name: 'Amazon.com Inc.',         sector: 'Consumer'      },
  { symbol: 'TSLA',  name: 'Tesla, Inc.',             sector: 'Automotive'    },
  { symbol: 'META',  name: 'Meta Platforms Inc.',     sector: 'Technology'    },
  { symbol: 'NFLX',  name: 'Netflix Inc.',            sector: 'Entertainment' },
  { symbol: 'AMD',   name: 'Advanced Micro Devices',  sector: 'Technology'    },
  { symbol: 'INTC',  name: 'Intel Corporation',       sector: 'Technology'    },
  { symbol: 'JPM',   name: 'JPMorgan Chase & Co.',    sector: 'Finance'       },
  { symbol: 'BAC',   name: 'Bank of America Corp.',   sector: 'Finance'       },
  { symbol: 'GS',    name: 'Goldman Sachs Group',     sector: 'Finance'       },
  { symbol: 'MS',    name: 'Morgan Stanley',          sector: 'Finance'       },
  { symbol: 'V',     name: 'Visa Inc.',               sector: 'Finance'       },
  { symbol: 'MA',    name: 'Mastercard Inc.',         sector: 'Finance'       },
  { symbol: 'PYPL',  name: 'PayPal Holdings Inc.',    sector: 'Finance'       },
  { symbol: 'COIN',  name: 'Coinbase Global Inc.',    sector: 'Finance'       },
  { symbol: 'UBER',  name: 'Uber Technologies',       sector: 'Technology'    },
  { symbol: 'SHOP',  name: 'Shopify Inc.',            sector: 'Technology'    },
  { symbol: 'PLTR',  name: 'Palantir Technologies',   sector: 'Technology'    },
  { symbol: 'SQ',    name: 'Block Inc.',              sector: 'Finance'       },
  { symbol: 'HOOD',  name: 'Robinhood Markets',       sector: 'Finance'       },
  { symbol: 'WMT',   name: 'Walmart Inc.',            sector: 'Consumer'      },
  { symbol: 'TGT',   name: 'Target Corporation',      sector: 'Consumer'      },
  { symbol: 'COST',  name: 'Costco Wholesale',        sector: 'Consumer'      },
  { symbol: 'JNJ',   name: 'Johnson & Johnson',       sector: 'Healthcare'    },
  { symbol: 'PFE',   name: 'Pfizer Inc.',             sector: 'Healthcare'    },
  { symbol: 'MRNA',  name: 'Moderna Inc.',            sector: 'Healthcare'    },
  { symbol: 'UNH',   name: 'UnitedHealth Group',      sector: 'Healthcare'    },
  { symbol: 'DIS',   name: 'Walt Disney Company',     sector: 'Entertainment' },
  { symbol: 'SPOT',  name: 'Spotify Technology',      sector: 'Entertainment' },
  { symbol: 'T',     name: 'AT&T Inc.',               sector: 'Telecom'       },
  { symbol: 'VZ',    name: 'Verizon Communications',  sector: 'Telecom'       },
  { symbol: 'XOM',   name: 'Exxon Mobil Corp.',       sector: 'Energy'        },
  { symbol: 'CVX',   name: 'Chevron Corporation',     sector: 'Energy'        },
  { symbol: 'SPY',   name: 'SPDR S&P 500 ETF',        sector: 'ETF'           },
  { symbol: 'QQQ',   name: 'Invesco QQQ Trust',       sector: 'ETF'           },
  { symbol: 'IWM',   name: 'iShares Russell 2000 ETF',sector: 'ETF'           },
  { symbol: 'GLD',   name: 'SPDR Gold Trust ETF',     sector: 'ETF'           },
  { symbol: 'BRK.B', name: 'Berkshire Hathaway B',    sector: 'Finance'       },
  { symbol: 'ORCL',  name: 'Oracle Corporation',      sector: 'Technology'    },
  { symbol: 'CRM',   name: 'Salesforce Inc.',         sector: 'Technology'    },
  { symbol: 'NOW',   name: 'ServiceNow Inc.',         sector: 'Technology'    },
  { symbol: 'SNOW',  name: 'Snowflake Inc.',          sector: 'Technology'    },
  { symbol: 'ABNB',  name: 'Airbnb Inc.',             sector: 'Consumer'      },
];

const SECTOR_COLORS = {
  Technology:    '#1B64F2',
  Finance:       '#16A34A',
  Consumer:      '#D97706',
  Healthcare:    '#7C3AED',
  Entertainment: '#DB2777',
  Automotive:    '#EA580C',
  Telecom:       '#0891B2',
  Energy:        '#65A30D',
  ETF:           '#6B7280',
};

function tickerSearch(query) {
  const q = query.toUpperCase().trim();
  if (!q) return [];
  return TICKER_LIST.filter(t =>
    t.symbol.startsWith(q) || t.name.toUpperCase().includes(q)
  ).slice(0, 6);
}
