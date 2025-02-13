# Stock Watchlist Chrome Extension

A minimalistic Chrome extension to monitor stocks using Alpha Vantage for data and OpenAI for technical analysis.

![stock-watchlist](https://github.com/user-attachments/assets/817d9ed6-53da-41b2-9209-5ba0b948e4e8)

## Features

- **Search & Add Stocks:** Quickly search for stocks and add them to your watchlist.
- **Real-Time Data:** Fetch daily time series data from Alpha Vantage.
- **Technical Analysis:** Get detailed technical insights using OpenAI's analysis.

## Installation

1. **Clone the Repository:**  
   `git clone https://github.com/yourusername/stock-watchlist.git`
2. **Load Extension in Chrome:**  
   - Open Chrome and go to `chrome://extensions/`.
   - Enable **Developer Mode**.
   - Click **Load unpacked** and select the project folder.

## API Keys Setup

### Alpha Vantage API Key

1. Go to [Alpha Vantage API Key Request](https://www.alphavantage.co/support/#api-key).
2. Sign up with your email address.
3. Retrieve your API key from your inbox.
4. Open `popup.js` and replace `#YOUR_ALPHA_VANTAGE_KEY` with your key.

### OpenAI API Key

1. Visit [OpenAI API Keys](https://platform.openai.com/account/api-keys).
2. Log in or create an account.
3. Generate a new API key.
4. Open `popup.js` and replace `#YOUR_OPENAI_KEY` with your key.

## Usage

- Open the extension popup.
- Search for a stock and add it to your watchlist.
- Click the analysis button (💡) next to a stock to view detailed technical analysis.
