const ALPHA_VANTAGE_API_KEY = "TZfsz4sWLeBgxou7vkpw1h2JJdI9abdqExNPruaE";
const DATA_URL = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&apikey=${ALPHA_VANTAGE_API_KEY}&symbol=`;
const SEARCH_URL = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&apikey=${ALPHA_VANTAGE_API_KEY}&keywords=`;
const MIN_SEARCH_LENGTH = 3;

const stockSearch = document.getElementById("stock-search");
const watchlistDiv = document.getElementById("watchlist");
const searchResults = document.getElementById("search-results");

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
        <button class="remove-btn">×</button>
    `;
    
    const removeBtn = stockDiv.querySelector(".remove-btn");
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

    fetch(`${DATA_URL}${symbol}`)
        .then((res) => res.json())
        .then((data) => {
            if (data.Note || !data["Time Series (Daily)"]) {
                stockDiv.querySelector(".stock-price").textContent = "Unable to load data";
                return;
            }

            const timeSeries = data["Time Series (Daily)"];
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
        })
        .catch(() => {
            stockDiv.querySelector(".stock-price").textContent = "Failed to load data";
        });
}

// Initialize watchlist
chrome.storage.local.get(["watchlist"], (result) => {
    const watchlist = result.watchlist || [];
    watchlist.forEach((stock) => renderStock(stock));
});

// Close search results when clicking outside
document.addEventListener("click", (e) => {
    if (!searchResults.contains(e.target) && !stockSearch.contains(e.target)) {
        searchResults.innerHTML = "";
    }
});