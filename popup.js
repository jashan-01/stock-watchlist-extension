const StockTracker = (() => {
  const config = {
    ALPHA_VANTAGE_API_KEY : "#YOUR_ALPHA_VANTAGE_API_KEY",
    OPENAI_API_KEY : "#YOUR_OPENAI_API_KEY",
    MIN_SEARCH_LENGTH: 3,
    DATA_FUNCTION: "TIME_SERIES_DAILY",
    SEARCH_FUNCTION: "SYMBOL_SEARCH"
  };

  const DOM = {
    stockSearch: document.getElementById("stock-search"),
    watchlistDiv: document.getElementById("watchlist"),
    searchResults: document.getElementById("search-results"),
    app: document.getElementById("app"),
    analysisScreen: document.getElementById("analysis-screen"),
    analysisContent: document.querySelector(".analysis-content"),
    stockTitle: document.querySelector(".stock-title"),
    backButton: document.querySelector(".back-button"),
  };

  let searchTimeout;
  let currentStockData = {};

  // Public methods
  return {
    init,
    DOM,
    config
  };

  function init() {
    setupEventListeners();
    loadWatchlist();
  }

  function setupEventListeners() {
    DOM.stockSearch.addEventListener("input", handleSearchInput);
    DOM.backButton.addEventListener("click", hideAnalysisScreen);
    document.addEventListener("click", handleDocumentClick);
  }

  async function handleSearchInput(e) {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    if (query.length < config.MIN_SEARCH_LENGTH) {
      DOM.searchResults.innerHTML = query ? 
        `<div class="search-item">Enter at least ${config.MIN_SEARCH_LENGTH} characters...</div>` : "";
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const data = await fetchSearchResults(query);
        displaySearchResults(data.bestMatches || []);
      } catch (error) {
        console.error("Search error:", error);
      }
    }, 300);
  }

  async function fetchSearchResults(query) {
    const url = `https://www.alphavantage.co/query?function=${config.SEARCH_FUNCTION}&apikey=${config.ALPHA_VANTAGE_API_KEY}&keywords=${query}`;
    const response = await fetch(url);
    return response.json();
  }

  function displaySearchResults(matches) {
    DOM.searchResults.innerHTML = matches.length ? 
      matches.map(createSearchItem).join("") : 
      '<div class="search-item">No matches found</div>';
      
      const searchItems = document.querySelectorAll('.search-item');

      searchItems.forEach(item => {
        item.addEventListener("click", () => {
          const symbol = item.getAttribute("data-symbol");
          addToWatchlist({ symbol });
        });
      });
  }

  function createSearchItem(match) {
    return `
      <div class="search-item" data-symbol="${match["1. symbol"]}">
        <span class="symbol">${match["1. symbol"]}</span>
        <span class="name">${match["2. name"]}</span>
      </div>
    `;
  }

  async function addToWatchlist(stock) {
    const { watchlist = [] } = await chrome.storage.local.get(["watchlist"]);
    
    if (!watchlist.some(s => s.symbol === stock.symbol)) {
      const newWatchlist = [...watchlist, stock];
      await chrome.storage.local.set({ watchlist: newWatchlist });
      renderStock(stock);
    }
    
    DOM.stockSearch.value = "";
    DOM.searchResults.innerHTML = "";
  }

  async function renderStock(stock) {
    const stockElement = createStockElement(stock);
    DOM.watchlistDiv.appendChild(stockElement);
    
    try {
      const data = await fetchStockData(stock.symbol);
      if (data.Note) throw new Error("API limit reached");
      
      currentStockData[stock.symbol] = data["Time Series (Daily)"];
      updateStockPrice(stockElement, data);
      setupStockButtons(stockElement, stock.symbol);
    } catch (error) {
      stockElement.querySelector(".stock-price").textContent = "Data unavailable";
    }
  }

  function createStockElement(stock) {
    const div = document.createElement("div");
    div.className = "stock-item";
    div.setAttribute("data-symbol", stock.symbol); 
    div.innerHTML = `
      <div class="stock-info">
        <div class="stock-symbol">${stock.symbol}</div>
        <div class="stock-price">Loading...</div>
      </div>
      <div class="stock-buttons">
        <button class="gpt-btn">💡</button>
        <button class="remove-btn">×</button>
      </div>
    `;
    return div;
  }

  function setupStockButtons(stockElement, symbol) {
    stockElement.querySelector(".remove-btn").addEventListener("click", () => removeStock(symbol));
    stockElement.querySelector(".gpt-btn").addEventListener("click", () => showStockAnalysis(symbol));
  }

  async function showStockAnalysis(symbol) {
    showLoadingState();
    
    try {
      const analysis = await analyzeStockData(currentStockData[symbol]);
      displayAnalysis(symbol, analysis);
    } catch (error) {
      DOM.analysisContent.textContent = "Analysis failed. Please try again.";
    }
  }

  function showLoadingState() {
    DOM.analysisContent.innerHTML = `
      <div class="loading">
        <div class="spinner"></div>
        <div>Analyzing stock data...</div>
      </div>
    `;
    DOM.app.classList.add("hidden");
    DOM.analysisScreen.classList.remove("hidden");
  }

  async function fetchStockData(symbol) {
    const url = `https://www.alphavantage.co/query?function=${config.DATA_FUNCTION}&apikey=${config.ALPHA_VANTAGE_API_KEY}&symbol=${symbol}`;
    const response = await fetch(url);
    return response.json();
  }

  function updateStockPrice(stockElement, data) {
    const timeSeries = data["Time Series (Daily)"];
    if (!timeSeries) {
      stockElement.querySelector(".stock-price").textContent = "Data unavailable";
      return;
    }

    const dates = Object.keys(timeSeries).slice(0, 2);
    const latest = timeSeries[dates[0]];
    const previous = timeSeries[dates[1]];

    const currentPrice = parseFloat(latest["4. close"]).toFixed(2);
    const change = (
      ((latest["4. close"] - previous["4. close"]) / previous["4. close"]) *
      100
    ).toFixed(2);

    const priceDiv = stockElement.querySelector(".stock-price");
    priceDiv.textContent = `₹${currentPrice} `;

    const changeSpan = document.createElement("span");
    changeSpan.textContent = `(${change}%)`;
    changeSpan.className = change >= 0 ? "positive-change" : "negative-change";
    priceDiv.appendChild(changeSpan);
  }

  async function removeStock(symbol) {
    const { watchlist = [] } = await chrome.storage.local.get(["watchlist"]);
    const newWatchlist = watchlist.filter((s) => s.symbol !== symbol);
    await chrome.storage.local.set({ watchlist: newWatchlist });
    document.querySelector(`.stock-item[data-symbol="${symbol}"]`)?.remove();
  }

  async function analyzeStockData(timeSeries) {
    const ohlcvData = getOHLCVData(timeSeries);
    console.log('ohlcvData>>'+ohlcvData);
    const prompt = `Perform an extensive technical analysis of the following OHLCV data:\n\n${ohlcvData}.  Based on the data perform the following:
                    Identify trends, volatility, volume spikes, critical patterns, events, and any significant price movements.
                    Detect recent trend changes, the last highest and lowest prices, and discuss short-term and long-term trends.
                    Provide insights using moving averages, RSI, MACD, support/resistance levels, or any other relevant technical indicators.
                    If possible, predict potential future price movements based on historical patterns and give strategic insights.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content;
  }

  function getOHLCVData(timeSeries) {
    const dates = Object.keys(timeSeries).slice(0, 60);
    return JSON.stringify(
      dates.map((date) => ({
        date,
        open: parseFloat(timeSeries[date]["1. open"]),
        high: parseFloat(timeSeries[date]["2. high"]),
        low: parseFloat(timeSeries[date]["3. low"]),
        close: parseFloat(timeSeries[date]["4. close"]),
        volume: parseInt(timeSeries[date]["5. volume"]),
      }))
    );
  }

  function displayAnalysis(symbol, analysis) {
    DOM.stockTitle.textContent = symbol;
    DOM.analysisContent.textContent = analysis;
  }

  function hideAnalysisScreen() {
    DOM.app.classList.remove("hidden");
    DOM.analysisScreen.classList.add("hidden");
  }

  function handleDocumentClick(e) {
    if (!DOM.searchResults.contains(e.target) && !DOM.stockSearch.contains(e.target)) {
      DOM.searchResults.innerHTML = "";
    }
  }

  async function loadWatchlist() {
    const { watchlist = [] } = await chrome.storage.local.get(["watchlist"]);
    watchlist.forEach((stock) => renderStock(stock));
  }

  // Public API
  return {
    init,
    DOM,
    config,
  };
})();

// Initialize the app
document.addEventListener("DOMContentLoaded", StockTracker.init);