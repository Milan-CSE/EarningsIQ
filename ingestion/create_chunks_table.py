import psycopg2

DB_CONFIG = {
    "host": "localhost",
    "port": "5433",
    "dbname": "earningsiq",
    "user": "admin",
    "password": "adminpassword"
}

def init_chunks_table():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS filing_chunks (
            chunk_id SERIAL PRIMARY KEY,
            cik VARCHAR(10) NOT NULL,
            company_name TEXT NOT NULL,
            filing_type VARCHAR(10) NOT NULL,
            reporting_period TEXT,
            section TEXT NOT NULL,
            chunk_type VARCHAR(20) NOT NULL, -- 'prose' or 'table_slice'
            chunk_content TEXT NOT NULL,     -- The self-contained text/table card
            chunk_index INT NOT NULL,        -- Relative order in section
            source_location TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()
    cur.close()
    conn.close()
    print("Table 'filing_chunks' initialized successfully in PostgreSQL.")

if __name__ == "__main__":
    init_chunks_table()