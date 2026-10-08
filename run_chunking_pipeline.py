import psycopg2
from psycopg2.extras import execute_batch
from ingestion.sec_client import SECClient
from ingestion.sec_parser import SECFilingParser
from ingestion.chunker import FilingAwareChunker

DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "earningsiq",
    "user": "admin",
    "password": "adminpassword"
}

def save_chunks_to_postgres(chunks: list[dict]):
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Clear existing chunks for idempotent run
    cur.execute("TRUNCATE TABLE filing_chunks RESTART IDENTITY;")
    
    query = """
        INSERT INTO filing_chunks (
            cik, company_name, filing_type, reporting_period,
            section, chunk_type, chunk_content, chunk_index, source_location
        ) VALUES (
            %(cik)s, %(company_name)s, %(filing_type)s, %(reporting_period)s,
            %(section)s, %(chunk_type)s, %(chunk_content)s, %(chunk_index)s, %(source_location)s
        );
    """
    execute_batch(cur, query, chunks)
    conn.commit()
    cur.close()
    conn.close()
    print(f"Stored {len(chunks)} search-ready index cards into 'filing_chunks' table.")

def main(ticker="AAPL"):
    client = SECClient(email="developer@earningsiq.com", app_name="EarningsIQ")
    
    print(f"1. Fetching 10-K for {ticker}...")
    cik = client.get_cik(ticker)
    _, filing_date, doc_url = client.get_latest_10k_info(cik)
    resp = client.session.get(doc_url)
    resp.raise_for_status()
    
    print("2. Parsing with noise-filtering parser...")
    meta = {
        "cik": cik,
        "company_name": "Apple Inc.",
        "filing_type": "10-K",
        "reporting_period": filing_date
    }
    parser = SECFilingParser(resp.text)
    clean_records = parser.parse(meta)
    print(f"Retained {len(clean_records)} clean, high-signal sections & financial tables.")

    print("3. Executing filing-aware chunker...")
    chunker = FilingAwareChunker()
    chunks = chunker.process_records(clean_records)
    print(f"Generated {len(chunks)} contextual chunks.")

    print("4. Persisting chunks into PostgreSQL...")
    save_chunks_to_postgres(chunks)
    print("Step 3 Complete: Raw Sections -> Context-Stamped Searchable Chunks!")

if __name__ == "__main__":
    main("AAPL")