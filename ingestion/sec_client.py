import time
import requests
import re

class SECClient:
    def __init__(self, email="your.email@domain.com", app_name="EarningsIQ"):
        # Rule 1: The SEC requires a custom User-Agent with your app name and contact email
        self.headers = {"User-Agent": f"{app_name} ({email})"}
        self.session = requests.Session()
        self.session.headers.update(self.headers)
        self.base_url = "https://data.sec.gov/"

    def get_cik(self, ticker: str) -> str:
        """Translates a ticker symbol (e.g. 'AAPL') into a 10-digit zero-padded CIK."""
        url = "https://www.sec.gov/files/company_tickers.json"
        response = self.session.get(url)
        response.raise_for_status()
        
        # SEC provides a dictionary of companies
        for entry in response.json().values():
            if entry["ticker"] == ticker.upper():
                cik_int = entry["cik_str"]
                # Rule 3: SEC API strictly requires a 10-digit zero-padded string
                return f"{int(cik_int):010d}"
                
        raise ValueError(f"Ticker {ticker} not found in SEC registry.")

    def get_submissions(self, padded_cik: str) -> dict:
        """Fetches the master JSON containing all historical filings for a company."""
        # Rule 2: Rate limit yourself to respect the SEC's 10 requests/second policy
        time.sleep(0.1) 
        
        url = f"{self.base_url}submissions/CIK{padded_cik}.json"
        response = self.session.get(url)
        response.raise_for_status()
        return response.json()

    def get_latest_10k_info(self, padded_cik: str) -> tuple[str, str, str]:
        """
        Returns (accession_number, filing_date, primary_doc_url) for the latest 10-K.
        """
        data = self.get_submissions(padded_cik)
        recent = data["filings"]["recent"]
        
        forms = recent["form"]
        for idx, form in enumerate(forms):
            if form == "10-K":
                accession = recent["accessionNumber"][idx]
                filing_date = recent["filingDate"][idx]
                primary_doc = recent["primaryDocument"][idx]
                
                # Accession number without dashes for folder path
                accession_clean = accession.replace("-", "")
                cik_int = str(int(padded_cik))
                
                url = f"https://www.sec.gov/Archives/edgar/data/{cik_int}/{accession_clean}/{primary_doc}"
                return accession, filing_date, url
                
        raise ValueError("No 10-K found for this company.")

# --- TEST IT OUT ---
if __name__ == "__main__":
    client = SECClient(email="student@earningsiq.test", app_name="EarningsIQPortfolio")
    
    ticker = "AAPL"
    print(f"Looking up CIK for {ticker}...")
    cik = client.get_cik(ticker)
    print(f"Success! Padded CIK for {ticker} is: {cik}")
    
    print("Fetching submission history...")
    data = client.get_submissions(cik)
    print(f"Success! Company Name: {data.get('name')}")
    print(f"Total filings found: {len(data['filings']['recent']['form'])}")