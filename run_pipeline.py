import time
import psycopg2
from psycopg2.extras import execute_batch
from ingestion.sec_client import SECClient
from ingestion.sec_parser import SECFilingParser

DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "earningsiq",
    "user": "admin",
    "password": "adminpassword"
}

def save_to_postgres(records: list[dict]):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    query = """
        INSERT INTO filing_sections (
            cik, company_name, filing_type, reporting_period,
            section, subsection, content_type, content,
            table_context, source_location
        ) VALUES (
            %(cik)s, %(company_name)s, %(filing_type)s, %(reporting_period)s,
            %(section)s, %(subsection)s, %(content_type)s, %(content)s,
            %(table_context)s, %(source_location)s
        );
    """
    execute_batch(cur, query, records)
    conn.commit()
    cur.close()
    conn.close()
    print(f"Successfully inserted {len(records)} records into PostgreSQL.")

def main(ticker="AAPL"):
    client = SECClient(email="developer@earningsiq.com", app_name="EarningsIQ")
    
    print(f"1. Looking up CIK for {ticker}...")
    cik = client.get_cik(ticker)
    
    print("2. Locating latest 10-K URL...")
    _, filing_date, doc_url = client.get_latest_10k_info(cik)
    print(f"URL: {doc_url}")
    
    print("3. Downloading 10-K HTML (respecting rate limits)...")
    time.sleep(0.1)
    resp = client.session.get(doc_url)
    resp.raise_for_status()
    
    print("4. Parsing HTML into sections and preserving tables...")
    meta = {
        "cik": cik,
        "company_name": "Apple Inc.",
        "filing_type": "10-K",
        "reporting_period": filing_date
    }
    parser = SECFilingParser(resp.text)
    records = parser.parse(meta)
    print(f"Extracted {len(records)} structured elements.")
    
    print("5. Saving records into PostgreSQL inside Docker...")
    save_to_postgres(records)
    print("Milestone reached: SEC EDGAR -> Parser -> Sections -> PostgreSQL (Docker)!")

if __name__ == "__main__":
    main("AAPL")