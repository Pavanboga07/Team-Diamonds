'use strict';
/* lib/ticker-list.js — NSE (Indian) stock autocomplete suggestions */

const TICKER_LIST = [
  { symbol: 'RELIANCE',   name: 'Reliance Industries',    sector: 'Energy'   },
  { symbol: 'TCS',        name: 'Tata Consultancy',        sector: 'IT'       },
  { symbol: 'INFY',       name: 'Infosys',                 sector: 'IT'       },
  { symbol: 'HDFCBANK',   name: 'HDFC Bank',               sector: 'Banking'  },
  { symbol: 'ICICIBANK',  name: 'ICICI Bank',              sector: 'Banking'  },
  { symbol: 'WIPRO',      name: 'Wipro',                   sector: 'IT'       },
  { symbol: 'HCLTECH',    name: 'HCL Technologies',        sector: 'IT'       },
  { symbol: 'SBIN',       name: 'State Bank of India',     sector: 'Banking'  },
  { symbol: 'AXISBANK',   name: 'Axis Bank',               sector: 'Banking'  },
  { symbol: 'KOTAKBANK',  name: 'Kotak Mahindra Bank',     sector: 'Banking'  },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance',           sector: 'Finance'  },
  { symbol: 'BAJAJFINSV', name: 'Bajaj Finserv',           sector: 'Finance'  },
  { symbol: 'MARUTI',     name: 'Maruti Suzuki',           sector: 'Auto'     },
  { symbol: 'TATAMOTORS', name: 'Tata Motors',             sector: 'Auto'     },
  { symbol: 'HEROMOTOCO', name: 'Hero MotoCorp',           sector: 'Auto'     },
  { symbol: 'ITC',        name: 'ITC Limited',             sector: 'FMCG'     },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever',      sector: 'FMCG'     },
  { symbol: 'BRITANNIA',  name: 'Britannia Industries',    sector: 'FMCG'     },
  { symbol: 'SUNPHARMA',  name: 'Sun Pharmaceuticals',     sector: 'Pharma'   },
  { symbol: 'DRREDDY',    name: "Dr. Reddy's Labs",        sector: 'Pharma'   },
  { symbol: 'CIPLA',      name: 'Cipla Limited',           sector: 'Pharma'   },
  { symbol: 'NTPC',       name: 'NTPC Limited',            sector: 'Energy'   },
  { symbol: 'ONGC',       name: 'ONGC',                    sector: 'Energy'   },
  { symbol: 'POWERGRID',  name: 'Power Grid Corp',         sector: 'Energy'   },
  { symbol: 'TECHM',      name: 'Tech Mahindra',           sector: 'IT'       },
  { symbol: 'LTI',        name: 'LTIMindtree',             sector: 'IT'       },
  { symbol: 'MPHASIS',    name: 'Mphasis Limited',         sector: 'IT'       },
  { symbol: 'ADANIENT',   name: 'Adani Enterprises',       sector: 'Conglom'  },
  { symbol: 'ADANIPORTS', name: 'Adani Ports',             sector: 'Infra'    },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement',        sector: 'Cement'   },
  { symbol: 'GRASIM',     name: 'Grasim Industries',       sector: 'Cement'   },
  { symbol: 'ASIANPAINT', name: 'Asian Paints',            sector: 'Consumer' },
  { symbol: 'NESTLEIND',  name: 'Nestle India',            sector: 'FMCG'     },
  { symbol: 'TITAN',      name: 'Titan Company',           sector: 'Consumer' },
  { symbol: 'DIVISLAB',   name: "Divi's Laboratories",     sector: 'Pharma'   },
  { symbol: 'JSWSTEEL',   name: 'JSW Steel',               sector: 'Metal'    },
  { symbol: 'TATASTEEL',  name: 'Tata Steel',              sector: 'Metal'    },
  { symbol: 'HINDALCO',   name: 'Hindalco Industries',     sector: 'Metal'    },
  { symbol: 'INDUSINDBK', name: 'IndusInd Bank',           sector: 'Banking'  },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel',           sector: 'Telecom'  },
];

const SECTOR_COLORS = {
  IT:       '#1B64F2',
  Banking:  '#16A34A',
  Finance:  '#0891B2',
  FMCG:     '#D97706',
  Pharma:   '#7C3AED',
  Auto:     '#EA580C',
  Energy:   '#65A30D',
  Metal:    '#6B7280',
  Telecom:  '#DB2777',
  Infra:    '#0D9488',
  Cement:   '#92400E',
  Conglom:  '#374151',
  Consumer: '#B45309',
};

function tickerSearch(query) {
  const q = query.toUpperCase().trim();
  if (!q) return [];
  return TICKER_LIST.filter(t =>
    t.symbol.startsWith(q) || t.name.toUpperCase().includes(q)
  ).slice(0, 6);
}
