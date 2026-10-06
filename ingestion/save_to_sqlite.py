import os
import sqlite3
import json
from sec_client import SECClient

# Local SQLite database file path
DB_FILE = "earningsiq_local.db"

def save_company_metadata_sqlite(ticker: str):
    # 1. Pull data using our SEC Client
    client = SECClient(email="developer@earningsiq.com", app_name="EarningsIQ")
    print(f"Fetching CIK for {ticker}...")
    cik = client.get_cik(ticker)
    
    print(f"Fetching submissions for CIK {cik}...")
    data = client.get_submissions(cik)
    
    company_name = data.get("name")
    fiscal_year_end = data.get("fiscalYearEnd", "")
    
    # 2. Connect to SQLite (creates the file automatically if it doesn't exist)
    print(f"Connecting to local SQLite database ({DB_FILE})...")
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    # 3. Create table if it doesn't exist
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            cik TEXT PRIMARY KEY,
            name TEXT,
            fiscal_year_end TEXT,
            raw_data TEXT
        );
    """)
    
    # 4. Insert data (storing the full JSON payload as text)
    cursor.execute("""
        INSERT INTO companies (cik, name, fiscal_year_end, raw_data)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cik) DO UPDATE SET
            name = excluded.name,
            raw_data = excluded.raw_data;
    """, (cik, company_name, fiscal_year_end, json.dumps(data)))
    
    # SQLite syntax fix for upsert:
    cursor.execute("""
        INSERT INTO companies (cik, name, fiscal_year_end, raw_data)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(cik) DO UPDATE SET
            name = excluded.name,
            raw_data = excluded.raw_data;
    """, (cik, company_name, fiscal_year_end, json.dumps(data)))
    
    conn.commit()
    cursor.close()
    conn.close()
    print(f"Success! Saved metadata and raw submissions for {company_name} (CIK: {cik}) into SQLite.")

if __name__ == "__main__":
    save_company_metadata_sqlite("AAPL")