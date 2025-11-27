import axios from 'axios';
import classNames from 'classnames/bind';
import Content from 'layouts/Content';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './index.module.scss';

const cx = classNames.bind(styles);

const zeroXTokens = [
  {
    symbol: 'WETH',
    address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    decimals: 18,
    network: 'Ethereum'
  },
  {
    symbol: 'USDC',
    address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    decimals: 6,
    network: 'Ethereum'
  },
  {
    symbol: 'DAI',
    address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
    decimals: 18,
    network: 'Ethereum'
  },
  {
    symbol: 'WBTC',
    address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    decimals: 8,
    network: 'Ethereum'
  }
];

const bnbPriceEndpoint = 'https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT';

const zeroXPriceApi = 'https://api.0x.org/swap/v1/price';

type ZeroXPriceQuote = {
  buyAmount: string;
  sellAmount: string;
  price: string;
  estimatedGas: number;
  buyTokenAddress: string;
  sellTokenAddress: string;
};

type Holding = {
  id: string;
  symbol: string;
  network: string;
  amount: number;
  entry: number;
};

type HoldingWithPrice = Holding & {
  price?: number;
};

const formatUnits = (raw: string, decimals: number) => {
  if (!raw) return 0;
  const big = BigInt(raw);
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = Number(big / divisor);
  const fraction = Number(big % divisor) / Number(divisor);
  return whole + fraction;
};

const toBaseUnits = (value: string, decimals: number) => {
  if (!value) return '0';
  const [whole, fraction = ''] = value.split('.');
  const paddedFraction = `${fraction}${'0'.repeat(decimals)}`.slice(0, decimals);
  const normalized = `${whole || '0'}${paddedFraction}`.replace(/^0+/, '') || '0';
  return normalized;
};

const fetchZeroXPrice = async (sellToken: string, buyToken: string, sellAmount: string, signal?: AbortSignal) => {
  const params = new URLSearchParams({
    sellToken,
    buyToken,
    sellAmount
  });

  const { data } = await axios.get<ZeroXPriceQuote>(`${zeroXPriceApi}?${params.toString()}`, { signal });
  return data;
};

const useTokenPrices = (tokens: Holding[]) => {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const controller = new AbortController();

    const loadPrices = async () => {
      try {
        const usdc = zeroXTokens.find((t) => t.symbol === 'USDC');
        if (!usdc) return;

        const results = await Promise.all(
          tokens.map(async (holding) => {
            const tokenInfo = zeroXTokens.find((t) => t.symbol === holding.symbol);
            if (!tokenInfo) return [holding.symbol, 0];

            const baseAmount = toBaseUnits('1', tokenInfo.decimals);
            const quote = await fetchZeroXPrice(
              tokenInfo.address,
              usdc.address,
              baseAmount,
              controller.signal
            );

            const usdPrice = formatUnits(quote.buyAmount, usdc.decimals);
            return [holding.symbol, usdPrice];
          })
        );

        const priceMap = results.reduce((acc, [symbol, price]) => {
          acc[symbol as string] = price as number;
          return acc;
        }, {} as Record<string, number>);

        setPrices(priceMap);
      } catch (error) {
        if (!axios.isCancel(error)) {
          console.error('Failed to load token prices', error);
        }
      }
    };

    loadPrices();

    return () => controller.abort();
  }, [tokens]);

  return prices;
};

const SwapPanel: React.FC = () => {
  const [sellToken, setSellToken] = useState(zeroXTokens[0]);
  const [buyToken, setBuyToken] = useState(zeroXTokens[1]);
  const [sellAmount, setSellAmount] = useState('1');
  const [quote, setQuote] = useState<ZeroXPriceQuote | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    const fetchQuote = async () => {
      try {
        setLoading(true);
        setError('');
        const baseAmount = toBaseUnits(sellAmount, sellToken.decimals);
        const data = await fetchZeroXPrice(sellToken.address, buyToken.address, baseAmount, controller.signal);
        setQuote(data);
      } catch (err) {
        if (!axios.isCancel(err)) {
          console.error('Failed to fetch 0x price', err);
          setError('Unable to reach the 0x aggregator right now. Please try again shortly.');
        }
        setQuote(null);
      } finally {
        setLoading(false);
      }
    };

    if (!sellAmount || Number(sellAmount) <= 0) {
      setQuote(null);
      return;
    }

    fetchQuote();

    return () => controller.abort();
  }, [sellToken, buyToken, sellAmount]);

  const readableBuyAmount = useMemo(() => {
    if (!quote) return '';
    const token = zeroXTokens.find((t) => t.address === quote.buyTokenAddress);
    if (!token) return '';
    return formatUnits(quote.buyAmount, token.decimals).toFixed(6);
  }, [quote]);

  const handleSwapToken = () => {
    setSellToken(buyToken);
    setBuyToken(sellToken);
    setQuote(null);
  };

  return (
    <div className={cx('card')}>
      <div className={cx('card-header')}>
        <div>
          <p className={cx('overline')}>DEX</p>
          <h2>0x Aggregator Swap</h2>
          <p className={cx('muted')}>Live pricing sourced directly from the 0x API.</p>
        </div>
        <button className={cx('ghost-btn')} onClick={handleSwapToken}>
          Flip pair
        </button>
      </div>

      <div className={cx('form-grid')}>
        <label className={cx('field')}>
          <span>Sell token</span>
          <select value={sellToken.symbol} onChange={(e) => setSellToken(zeroXTokens.find((t) => t.symbol === e.target.value)!)}>
            {zeroXTokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol} · {token.network}
              </option>
            ))}
          </select>
        </label>

        <label className={cx('field')}>
          <span>Buy token</span>
          <select value={buyToken.symbol} onChange={(e) => setBuyToken(zeroXTokens.find((t) => t.symbol === e.target.value)!)}>
            {zeroXTokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol} · {token.network}
              </option>
            ))}
          </select>
        </label>

        <label className={cx('field')}>
          <span>Sell amount</span>
          <input
            type="number"
            min={0}
            value={sellAmount}
            onChange={(e) => setSellAmount(e.target.value)}
            placeholder={`0.0 ${sellToken.symbol}`}
          />
        </label>
      </div>

      <div className={cx('quote')}>
        {loading && <p>Loading latest price...</p>}
        {error && <p className={cx('error')}>{error}</p>}
        {!loading && !error && quote && (
          <div className={cx('quote-grid')}>
            <div>
              <p className={cx('muted')}>Execution price</p>
              <strong>1 {sellToken.symbol} ≈ {Number(quote.price).toFixed(6)} {buyToken.symbol}</strong>
            </div>
            <div>
              <p className={cx('muted')}>Expected output</p>
              <strong>
                {readableBuyAmount} {buyToken.symbol}
              </strong>
            </div>
            <div>
              <p className={cx('muted')}>Estimated gas</p>
              <strong>{quote.estimatedGas.toLocaleString()} units</strong>
            </div>
          </div>
        )}
        {!loading && !error && !quote && <p className={cx('muted')}>Enter an amount to see an instant 0x quote.</p>}
      </div>

      <div className={cx('hint')}>
        <p>
          This widget pulls real-time quotes from <a href="https://0x.org">0x</a>. Connect your preferred wallet in
          the main header to route trades through your existing setup.
        </p>
      </div>
    </div>
  );
};

const PortfolioPanel: React.FC = () => {
  const [holdings, setHoldings] = useState<Holding[]>([
    { id: '1', symbol: 'WETH', network: 'Ethereum', amount: 0.8, entry: 2450 },
    { id: '2', symbol: 'USDC', network: 'Ethereum', amount: 1200, entry: 1 },
    { id: '3', symbol: 'DAI', network: 'Ethereum', amount: 800, entry: 1 }
  ]);
  const [newHolding, setNewHolding] = useState<Omit<Holding, 'id'>>({ symbol: 'WBTC', network: 'Ethereum', amount: 0.05, entry: 63000 });

  const priceMap = useTokenPrices(holdings);

  const portfolio: HoldingWithPrice[] = useMemo(
    () =>
      holdings.map((holding) => ({
        ...holding,
        price: priceMap[holding.symbol]
      })),
    [holdings, priceMap]
  );

  const totals = useMemo(() => {
    const totalValue = portfolio.reduce((acc, position) => {
      const price = position.price ?? position.entry;
      return acc + position.amount * price;
    }, 0);

    const totalEntry = holdings.reduce((acc, position) => acc + position.amount * position.entry, 0);
    return { totalValue, pnl: totalValue - totalEntry };
  }, [portfolio, holdings]);

  const addHolding = () => {
    if (!newHolding.symbol || newHolding.amount <= 0) return;
    setHoldings((prev) => [...prev, { ...newHolding, id: Date.now().toString() }]);
  };

  const removeHolding = (id: string) => setHoldings((prev) => prev.filter((item) => item.id !== id));

  return (
    <div className={cx('card')}>
      <div className={cx('card-header')}>
        <div>
          <p className={cx('overline')}>PORTFOLIO</p>
          <h2>Multi-chain balance sheet</h2>
          <p className={cx('muted')}>Lightweight tracking for your on-chain bags.</p>
        </div>
        <div className={cx('pill', totals.pnl >= 0 ? 'success' : 'danger')}>
          PnL: {totals.pnl >= 0 ? '+' : ''}{totals.pnl.toFixed(2)} USD
        </div>
      </div>

      <div className={cx('table')}>
        <div className={cx('table-head')}>
          <span>Asset</span>
          <span>Amount</span>
          <span>Last price (USD)</span>
          <span>Value</span>
          <span>Entry</span>
          <span></span>
        </div>
        {portfolio.map((holding) => {
          const value = (holding.price ?? holding.entry) * holding.amount;
          return (
            <div key={holding.id} className={cx('table-row')}>
              <span>{holding.symbol}</span>
              <span>
                {holding.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} {holding.network}
              </span>
              <span>{holding.price ? `$${holding.price.toFixed(2)}` : 'Loading...'}</span>
              <span>${value.toFixed(2)}</span>
              <span>${holding.entry.toFixed(2)}</span>
              <button className={cx('ghost-btn')} onClick={() => removeHolding(holding.id)}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className={cx('form-grid', 'add-row')}>
        <label className={cx('field')}>
          <span>Asset</span>
          <select
            value={newHolding.symbol}
            onChange={(e) => setNewHolding((prev) => ({ ...prev, symbol: e.target.value }))}
          >
            {zeroXTokens.map((token) => (
              <option key={token.symbol} value={token.symbol}>
                {token.symbol}
              </option>
            ))}
          </select>
        </label>
        <label className={cx('field')}>
          <span>Network</span>
          <input
            value={newHolding.network}
            onChange={(e) => setNewHolding((prev) => ({ ...prev, network: e.target.value }))}
            placeholder="Ethereum"
          />
        </label>
        <label className={cx('field')}>
          <span>Amount</span>
          <input
            type="number"
            value={newHolding.amount}
            min={0}
            onChange={(e) => setNewHolding((prev) => ({ ...prev, amount: Number(e.target.value) }))}
          />
        </label>
        <label className={cx('field')}>
          <span>Entry price (USD)</span>
          <input
            type="number"
            value={newHolding.entry}
            min={0}
            onChange={(e) => setNewHolding((prev) => ({ ...prev, entry: Number(e.target.value) }))}
          />
        </label>
        <div className={cx('actions')}>
          <button className={cx('primary-btn')} onClick={addHolding}>
            Add position
          </button>
        </div>
      </div>
    </div>
  );
};

type Direction = 'long' | 'short';

type Round = {
  status: 'idle' | 'running' | 'finished';
  direction?: Direction;
  startPrice?: number;
  currentPrice?: number;
  entryTime?: number;
  endTime?: number;
  result?: 'win' | 'lose' | 'draw';
};

const TradingGame: React.FC = () => {
  const [round, setRound] = useState<Round>({ status: 'idle' });
  const [balance, setBalance] = useState(1000);
  const [wager, setWager] = useState(50);
  const [history, setHistory] = useState<Array<Omit<Round, 'status' | 'entryTime' | 'endTime'>>>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBnbPrice = async () => {
    const { data } = await axios.get<{ price: string }>(bnbPriceEndpoint);
    return Number(data.price);
  };

  const evaluateRound = async (direction: Direction, startPrice: number, endTime: number) => {
    try {
      const price = await fetchBnbPrice();
      const isLong = direction === 'long';
      const win = isLong ? price > startPrice : price < startPrice;
      const draw = price === startPrice;
      const result: Round['result'] = draw ? 'draw' : win ? 'win' : 'lose';

      setRound({ status: 'finished', direction, startPrice, currentPrice: price, endTime, result });
      setHistory((prev) => [{ direction, startPrice, currentPrice: price, result }, ...prev].slice(0, 5));

      if (result === 'win') setBalance((prev) => prev + wager * 0.8);
      if (result === 'lose') setBalance((prev) => Math.max(0, prev - wager));
    } catch (error) {
      console.error('Failed to settle round', error);
    }
  };

  const startRound = async (direction: Direction) => {
    if (timerRef.current) clearInterval(timerRef.current);

    const startPrice = await fetchBnbPrice();
    const entryTime = Date.now();
    const endTime = entryTime + 60_000;

    setRound({ status: 'running', direction, startPrice, currentPrice: startPrice, entryTime, endTime });

    timerRef.current = setInterval(async () => {
      try {
        const price = await fetchBnbPrice();
        setRound((prev) => ({ ...prev, currentPrice: price }));

        if (Date.now() >= endTime) {
          if (timerRef.current) clearInterval(timerRef.current);
          await evaluateRound(direction, startPrice, endTime);
        }
      } catch (error) {
        console.error('Failed to refresh BNB price', error);
      }
    }, 5000);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const progress = useMemo(() => {
    if (!round.entryTime || !round.endTime || round.status !== 'running') return 0;
    const now = Date.now();
    const total = round.endTime - round.entryTime;
    const elapsed = Math.min(now - round.entryTime, total);
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  }, [round]);

  return (
    <div className={cx('card')}>
      <div className={cx('card-header')}>
        <div>
          <p className={cx('overline')}>GAME</p>
          <h2>BNB 60s prediction</h2>
          <p className={cx('muted')}>A playful take inspired by PancakeSwap’s BNB prediction market.</p>
        </div>
        <div className={cx('pill')}>
          Balance: ${balance.toFixed(2)} demo USD
        </div>
      </div>

      <div className={cx('game-grid')}>
        <div className={cx('field')}>
          <span>Wager</span>
          <input type="number" min={10} value={wager} onChange={(e) => setWager(Number(e.target.value) || 10)} />
        </div>
        <div className={cx('actions')}>
          <button className={cx('primary-btn')} onClick={() => startRound('long')} disabled={round.status === 'running'}>
            Go Long
          </button>
          <button className={cx('ghost-btn')} onClick={() => startRound('short')} disabled={round.status === 'running'}>
            Go Short
          </button>
        </div>
      </div>

      <div className={cx('status')}>
        <div>
          <p className={cx('muted')}>Current round</p>
          <p>
            {round.status === 'idle' && 'No active round'}
            {round.status !== 'idle' && (
              <>
                <strong>{round.direction?.toUpperCase()}</strong> · Entry {round.startPrice?.toFixed(2)} · Live
                {round.currentPrice ? ` ${round.currentPrice.toFixed(2)} USDT` : ' ...'}
              </>
            )}
          </p>
        </div>
        <div className={cx('progress')}>
          <div className={cx('progress-bar')} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {round.status === 'finished' && (
        <div className={cx('result', round.result)}>
          {round.result === 'draw' ? 'No movement: stake returned.' : round.result === 'win' ? 'You won this round!' : 'Round lost.'}
        </div>
      )}

      <div className={cx('history')}>
        <div className={cx('table-head')}>
          <span>Direction</span>
          <span>Entry</span>
          <span>Close</span>
          <span>Result</span>
        </div>
        {history.length === 0 && <p className={cx('muted')}>No recent rounds. Choose a direction to start.</p>}
        {history.map((item, idx) => (
          <div key={idx} className={cx('table-row')}>
            <span>{item.direction?.toUpperCase()}</span>
            <span>${item.startPrice?.toFixed(2)}</span>
            <span>${item.currentPrice?.toFixed(2)}</span>
            <span className={cx(item.result || '')}>{item.result}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ZeroXDex: React.FC = () => {
  return (
    <Content nonBackground>
      <div className={cx('container')}>
        <div className={cx('intro')}>
          <div>
            <p className={cx('overline')}>EXPERIMENTAL</p>
            <h1>ZeroX DEX, portfolio & BNB minute game</h1>
            <p className={cx('muted')}>
              Swap with the 0x aggregator, keep tabs on your holdings, and try a one-minute BNB prediction game inspired
              by PancakeSwap.
            </p>
          </div>
        </div>

        <div className={cx('grid')}>
          <SwapPanel />
          <PortfolioPanel />
        </div>

        <TradingGame />
      </div>
    </Content>
  );
};

export default ZeroXDex;
