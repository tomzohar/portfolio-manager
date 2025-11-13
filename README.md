# Stocks Researcher

A Python project for stock research using Google Sheets integration.

## Installation

1. **Create a virtual environment** (isolates project dependencies):

```bash
python3 -m venv venv
```

2. **Activate the virtual environment:**

```bash
source venv/bin/activate
```

3. **Install dependencies:**

```bash
pip install -r requirements.txt
```

4. **Set up environment variables:**

Copy the example file and add your API keys:

```bash
cp .env.example .env
```

Then edit `.env` with your actual credentials:
- Google Sheets: Service account file, Spreadsheet ID, Range
- SerpAPI: API key for news search
- Gemini AI: API key for summaries  
- Twilio: Account SID, Auth Token, WhatsApp numbers

**Note:** The `.env` file contains secrets and is in `.gitignore` (won't be committed to git)

## Usage

Run the stock research pipeline:

```bash
# Make sure virtual environment is activated first
source venv/bin/activate

# Run the main flow
python main.py
```

**Note:** After activating the venv, `python` = `python3` inside the environment.

## Dependencies

- gspread: Google Sheets API library
- google-auth: Google authentication library

