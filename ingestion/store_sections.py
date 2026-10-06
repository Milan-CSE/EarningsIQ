import sqlite3
import os

DB_FILE = "earningsiq_local.db"

def init_sections_table(conn):
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS filing_sections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cik TEXT NOT NULL,
            company_name TEXT NOT NULL,
            filing_type TEXT NOT NULL,
            reporting_period TEXT,
            section TEXT NOT NULL,
            subsection TEXT,
            content_type TEXT NOT NULL,
            content TEXT NOT NULL,
            table_context TEXT,
            source_location TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()

def save_sections(records: list[dict]):
    conn = sqlite3.connect(DB_FILE)
    init_sections_table(conn)
    cursor = conn.cursor()
    
    query = """
        INSERT INTO filing_sections (
            cik, company_name, filing_type, reporting_period,
            section, subsection, content_type, content,
            table_context, source_location
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """
    
    batch = [
        (
            r["cik"], r["company_name"], r["filing_type"], r["reporting_period"],
            r["section"], r["subsection"], r["content_type"], r["content"],
            r["table_context"], r["source_location"]
        )
        for r in records
    ]
    
    cursor.executemany(query, batch)
    conn.commit()
    print(f"Stored {len(batch)} structured records into filing_sections.")
    conn.close()