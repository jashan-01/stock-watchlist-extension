const ALPHA_VANTAGE_API_KEY = "TZfsz4sWLeBgxou7vkpw1h2JJdI9abdqExNPruaE";
const OPENAI_API_KEY = "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";
const DATA_URL = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&apikey=${ALPHA_VANTAGE_API_KEY}&symbol=`;
const SEARCH_URL = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&apikey=${ALPHA_VANTAGE_API_KEY}&keywords=`;
const MIN_SEARCH_LENGTH = 3;

const stockSearch = document.getElementById("stock-search");
const watchlistDiv = document.getElementById("watchlist");
const searchResults = document.getElementById("search-results");
// const analysisScreen = document.getElementById("analysis-screen");
// const analysisContent = document.getElementById("analysis-content");
// const backBtn = document.getElementById("back-btn");

// backBtn.addEventListener("click", () => {
//   analysisScreen.classList.add("hidden");
//   analysisContent.innerHTML = "";
// });

let searchTimeout;

stockSearch.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    
    // Clear results if query is empty or too short
    if (!query || query.length < MIN_SEARCH_LENGTH) {
        searchResults.innerHTML = "";
        if (query && query.length > 0) {
            searchResults.innerHTML = `<div class="search-item">Enter at least ${MIN_SEARCH_LENGTH} characters...</div>`;
        }
        return;
    }

    searchTimeout = setTimeout(() => {
        fetch(`${SEARCH_URL}${query}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.bestMatches) {
                    searchResults.innerHTML = "";
                    return;
                }

                displaySearchResults(data.bestMatches);
            })
            .catch((error) => console.error("Search error:", error));
    }, 300);
});

function displaySearchResults(matches) {
    searchResults.innerHTML = "";
    
    if (matches.length === 0) {
        searchResults.innerHTML = '<div class="search-item">No matches found</div>';
        return;
    }
    
    matches.forEach((match) => {
        const symbol = match["1. symbol"];
        const name = match["2. name"];
        
        const resultItem = document.createElement("div");
        resultItem.className = "search-item";
        resultItem.innerHTML = `
            <span class="symbol">${symbol}</span>
            <span class="name">${name}</span>
        `;
        
        resultItem.addEventListener("click", () => addToWatchlist({ symbol, name }));
        searchResults.appendChild(resultItem);
    });
}

function addToWatchlist(stock) {
    chrome.storage.local.get(["watchlist"], (result) => {
        const watchlist = result.watchlist || [];
        
        if (!watchlist.some(s => s.symbol === stock.symbol)) {
            watchlist.push({
                symbol: stock.symbol,
                name: stock.name
            });
            chrome.storage.local.set({ watchlist });
            renderStock(stock);
        }
    });
    
    stockSearch.value = "";
    searchResults.innerHTML = "";
}

function renderStock(stock) {
    const { symbol, name } = stock;
    const stockDiv = document.createElement("div");
    stockDiv.className = "stock-item";
    stockDiv.innerHTML = `
        <div class="stock-info">
            <div class="stock-symbol">${symbol}</div>
            <div class="stock-price">Loading...</div>
        </div>
        <button class="gpt-btn">💡</button>
        <button class="remove-btn">×</button>
    `;
    
    const removeBtn = stockDiv.querySelector(".remove-btn");
    //const gptBtn = stockDiv.querySelector(".gpt-btn");

    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        chrome.storage.local.get(["watchlist"], (result) => {
            const watchlist = result.watchlist || [];
            const newWatchlist = watchlist.filter((s) => s.symbol !== symbol);
            chrome.storage.local.set({ watchlist: newWatchlist });
            stockDiv.remove();
        });
    });

    watchlistDiv.appendChild(stockDiv);
    let timeSeries;
    fetch(`${DATA_URL}${symbol}`)
        .then((res) => res.json())
        .then((data) => {
            if (data.Note || !data["Time Series (Daily)"]) {
                stockDiv.querySelector(".stock-price").textContent = "Unable to load data";
                return;
            }

            timeSeries = data["Time Series (Daily)"];
            const dates = Object.keys(timeSeries).slice(0, 2);
            const latest = timeSeries[dates[0]];
            const previous = timeSeries[dates[1]];

            const currentPrice = parseFloat(latest["4. close"]).toFixed(2);
            const change = (
                ((latest["4. close"] - previous["4. close"]) / previous["4. close"]) *
                100
            ).toFixed(2);

            const priceDiv = stockDiv.querySelector(".stock-price");
            priceDiv.textContent = `₹${currentPrice} `;
            
            const changeSpan = document.createElement("span");
            changeSpan.textContent = `(${change}%)`;
            changeSpan.className = change >= 0 ? "positive-change" : "negative-change";
            priceDiv.appendChild(changeSpan);
            const gptBtn = stockDiv.querySelector(".gpt-btn");
            gptBtn.addEventListener("click", async (e) => {
              e.stopPropagation();
              
              if (!timeSeries) {
                alert('Stock data not yet loaded. Please try again in a moment.');
                return;
              }
              const analysisScreen = document.getElementById('analysis-screen');
              const analysisContent = analysisScreen.querySelector('.analysis-content');
              analysisContent.innerHTML = `
                    <div class="loading">
                        <div class="spinner"></div>
                        <div>Analyzing stock data...</div>
                    </div>
                `;

              showAnalysisScreen(symbol, '');

              try {
                const ohlcvData = getOHLCVData(timeSeries);
                const analysis = await analyzeStockData(ohlcvData);
                showAnalysisScreen(symbol, analysis);
              } catch (error) {
                analysisContent.textContent = 'Failed to generate analysis. Please try again.';
                console.error('Analysis error:', error);
              }
            });
        })
        .catch(() => {
            stockDiv.querySelector(".stock-price").textContent = "Failed to load data";
      });
}

function getOHLCVData(timeSeries) {
  const dates = Object.keys(timeSeries).slice(0, 30); // Last 30 days
  return JSON.stringify(dates.map(date => ({
    date,
    open: parseFloat(timeSeries[date]['1. open']),
    high: parseFloat(timeSeries[date]['2. high']),
    low: parseFloat(timeSeries[date]['3. low']),
    close: parseFloat(timeSeries[date]['4. close']),
    volume: parseInt(timeSeries[date]['5. volume'])
  })));
}

async function analyzeStockData(ohlcvData) {
  const prompt = `Perform an extensive technical analysis of the following OHLCV data. Identify trends, volatility, volume spikes, critical patterns, events, and any significant price movements. Detect recent trend changes, the last highest and lowest prices, and discuss short-term and long-term trends. Provide insights using moving averages, RSI, MACD, support/resistance levels, or any other relevant technical indicators. If possible, predict potential future price movements based on historical patterns and give strategic insights. Here is the data:\n\n${ohlcvData}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{
        role: "user",
        content: prompt
      }],
      temperature: 0.7
    })
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

function showAnalysisScreen(symbol, analysis) {
  const mainScreen = document.getElementById('app');
  const analysisScreen = document.getElementById('analysis-screen');
  const stockTitle = analysisScreen.querySelector('.stock-title');
  const analysisContent = analysisScreen.querySelector('.analysis-content');

  stockTitle.textContent = `${symbol}`;
  analysisContent.textContent = analysis;

  mainScreen.classList.add('hidden');
  analysisScreen.classList.remove('hidden');
}

function hideAnalysisScreen() {
  const mainScreen = document.getElementById('app');
  const analysisScreen = document.getElementById('analysis-screen');

  mainScreen.classList.remove('hidden');
  analysisScreen.classList.add('hidden');
}

chrome.storage.local.get(["watchlist"], (result) => {
    const watchlist = result.watchlist || [];
    watchlist.forEach((stock) => renderStock(stock));
});

document.addEventListener("click", (e) => {
    if (!searchResults.contains(e.target) && !stockSearch.contains(e.target)) {
        searchResults.innerHTML = "";
    }
});


document.addEventListener('DOMContentLoaded', () => {
  const backButton = document.querySelector('.back-button');
  backButton.addEventListener('click', hideAnalysisScreen);
});